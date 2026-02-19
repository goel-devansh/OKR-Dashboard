// ============================================================
// KAM Dashboard Backend Server (Multi-Function + Multi-FY)
// Reads Excel files → Serves JSON API → Watches for changes
// Supports: {Function}_Dashboard_FY*.xlsx (e.g. KAM_Dashboard_FY26.xlsx, Sales_Dashboard_FY27.xlsx)
// Run: node server.cjs
// ============================================================
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { WebSocketServer } = require('ws');

const app = express();
const PORT = 3001;
const PROJECT_DIR = __dirname;

// Pattern for multi-function, multi-FY files: {Function}_Dashboard_FY{NN}.xlsx
const FUNC_FILE_PATTERN = /^(\w+)_Dashboard_FY(\d+)\.xlsx$/i;
// Legacy fallback (treated as KAM + FY26)
const FALLBACK_FILE = 'KAM_Dashboard_Input.xlsx';
const FALLBACK_FUNC = 'KAM';
const FALLBACK_FY = 'FY26';

app.use(cors());
app.use(express.json());

// ─── Serve built frontend (Vite outputs to parent directory) ──
const STATIC_DIR = path.resolve(__dirname, '..');
app.use(express.static(STATIC_DIR));

// ─── Multi-Function + Multi-FY Data Store ────────────────────
// { KAM: { FY26: {...data...}, FY27: {...} }, SALES: { FY26: {...} } }
let cachedData = {};
let defaultFunction = null;

// ─── Discover all function + FY Excel files ──────────────────
// Returns: { KAM: { FY26: '/path/to/file', FY27: '...' }, SALES: { FY26: '...' } }
function discoverAllFiles() {
  const files = {};

  const allFiles = fs.readdirSync(PROJECT_DIR);
  for (const filename of allFiles) {
    const match = filename.match(FUNC_FILE_PATTERN);
    if (match) {
      const funcName = match[1].toUpperCase();
      const fyKey = `FY${match[2]}`;
      if (!files[funcName]) files[funcName] = {};
      files[funcName][fyKey] = path.join(PROJECT_DIR, filename);
    }
  }

  // Fallback: if no files found at all, check for KAM_Dashboard_Input.xlsx
  const totalFiles = Object.values(files).reduce((s, obj) => s + Object.keys(obj).length, 0);
  if (totalFiles === 0) {
    const fallbackPath = path.join(PROJECT_DIR, FALLBACK_FILE);
    if (fs.existsSync(fallbackPath)) {
      files[FALLBACK_FUNC] = { [FALLBACK_FY]: fallbackPath };
    }
  }

  return files;
}

// ─── Parse function + FY from a file path ────────────────────
function parseFuncAndFY(filePath) {
  const filename = path.basename(filePath);
  const match = filename.match(FUNC_FILE_PATTERN);
  if (match) {
    return { func: match[1].toUpperCase(), fy: `FY${match[2]}` };
  }
  if (filename.toLowerCase() === FALLBACK_FILE.toLowerCase()) {
    return { func: FALLBACK_FUNC, fy: FALLBACK_FY };
  }
  return null;
}

// ─── Get sorted list of available functions ──────────────────
function getAvailableFunctions() {
  const funcs = Object.keys(cachedData).filter(f => {
    // Only include functions that have at least one non-null FY data
    const fyData = cachedData[f];
    return fyData && Object.values(fyData).some(d => d !== null);
  });
  // Sort: KAM first, then alphabetically
  funcs.sort((a, b) => {
    if (a === 'KAM') return -1;
    if (b === 'KAM') return 1;
    return a.localeCompare(b);
  });
  return funcs;
}

// ─── Get the default (latest) FY year for a function ─────────
function computeDefaultYear(years) {
  if (!years || years.length === 0) return null;
  const sorted = [...years].sort((a, b) => {
    const numA = parseInt(a.replace(/\D/g, ''), 10) || 0;
    const numB = parseInt(b.replace(/\D/g, ''), 10) || 0;
    return numB - numA;
  });
  return sorted[0];
}

// ─── Get sorted list of available years for a function ───────
function getAvailableYears(funcName) {
  const funcData = cachedData[funcName];
  if (!funcData) return [];
  const years = Object.keys(funcData).filter(fy => funcData[fy] !== null);
  years.sort((a, b) => {
    const numA = parseInt(a.replace(/\D/g, ''), 10) || 0;
    const numB = parseInt(b.replace(/\D/g, ''), 10) || 0;
    return numA - numB;
  });
  return years;
}

// ─── Excel Parser (shared module) ────────────────────────────
const { parseExcelData, parseMonthlySheet, parseQuarterlySheet, parseNum } = require('./parseExcel.cjs');

// ─── Initial Load: Parse all function+FY files ───────────────
function loadAllData() {
  const allFiles = discoverAllFiles();
  cachedData = {};

  for (const [funcName, fyFiles] of Object.entries(allFiles)) {
    if (!cachedData[funcName]) cachedData[funcName] = {};
    for (const [fyKey, filePath] of Object.entries(fyFiles)) {
      const data = parseExcelData(filePath);
      if (data) {
        cachedData[funcName][fyKey] = data;
      }
    }
  }

  const funcs = getAvailableFunctions();
  defaultFunction = funcs.length > 0 ? funcs[0] : null;

  if (funcs.length > 0) {
    for (const f of funcs) {
      const years = getAvailableYears(f);
      console.log(`  ${f}: ${years.join(', ')}`);
    }
  } else {
    console.log('No data files found.');
  }
}

loadAllData();

// ─── API Routes ──────────────────────────────────────────────

// GET /api/functions - list available business functions
app.get('/api/functions', (req, res) => {
  const funcs = getAvailableFunctions();
  res.json({
    functions: funcs,
    defaultFunction: defaultFunction || null,
  });
});

// GET /api/years?function=KAM - list available FYs for a function
app.get('/api/years', (req, res) => {
  const funcName = (req.query.function || defaultFunction || '').toUpperCase();
  const years = getAvailableYears(funcName);
  const defYear = computeDefaultYear(years);
  res.json({
    function: funcName,
    years,
    defaultYear: defYear,
  });
});

// GET /api/data?function=KAM&fy=FY26 - get data for function+FY
app.get('/api/data', (req, res) => {
  const funcName = (req.query.function || defaultFunction || '').toUpperCase();
  const years = getAvailableYears(funcName);
  const requestedFY = req.query.fy || computeDefaultYear(years);

  if (!funcName) {
    return res.status(500).json({ error: 'No function data available' });
  }

  if (!requestedFY) {
    return res.status(500).json({ error: `No FY data available for ${funcName}` });
  }

  // If not cached, try to reload
  if (!cachedData[funcName] || !cachedData[funcName][requestedFY]) {
    const allFiles = discoverAllFiles();
    if (allFiles[funcName] && allFiles[funcName][requestedFY]) {
      const data = parseExcelData(allFiles[funcName][requestedFY]);
      if (data) {
        if (!cachedData[funcName]) cachedData[funcName] = {};
        cachedData[funcName][requestedFY] = data;
      }
    }
  }

  const data = cachedData[funcName] && cachedData[funcName][requestedFY];
  if (!data) {
    return res.status(404).json({ error: `No data found for ${funcName} ${requestedFY}` });
  }

  res.json(data);
});

app.get('/api/health', (req, res) => {
  const funcs = getAvailableFunctions();
  const allFiles = discoverAllFiles();
  const details = {};
  for (const [func, fyFiles] of Object.entries(allFiles)) {
    details[func] = {};
    for (const [fy, fp] of Object.entries(fyFiles)) {
      details[func][fy] = path.basename(fp);
    }
  }
  res.json({
    status: 'ok',
    availableFunctions: funcs,
    defaultFunction,
    details,
    lastParsed: new Date().toISOString(),
  });
});

// POST /api/rag — Update a RAG metric value in the Excel file
app.post('/api/rag', (req, res) => {
  const { function: funcName, fy, key, value } = req.body || {};

  if (!funcName || !fy || !key || !value) {
    return res.status(400).json({ error: 'Missing required fields: function, fy, key, value' });
  }

  const validValues = ['red', 'amber', 'green'];
  if (!validValues.includes(value.toLowerCase())) {
    return res.status(400).json({ error: `Invalid value "${value}". Must be: red, amber, or green` });
  }

  const allFiles = discoverAllFiles();
  const upperFunc = funcName.toUpperCase();
  const filePath = allFiles[upperFunc] && allFiles[upperFunc][fy];

  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).json({ error: `No Excel file found for ${upperFunc} ${fy}` });
  }

  try {
    const buf = fs.readFileSync(filePath);
    const workbook = XLSX.read(buf, { type: 'buffer' });

    // Find or create RAG Metrics sheet
    let ragSheet = workbook.Sheets['RAG Metrics'];
    if (!ragSheet) {
      // Create sheet with headers + default rows
      const sheetData = [
        ['Key', 'Label', 'Value'],
        ['capabilityAI', 'Capability Development in AI', 'red'],
        ['accountStrategy', 'Account Strategy', 'red'],
        ['archDomain', 'Architecture & Domain Knowledge', 'red'],
      ];
      ragSheet = XLSX.utils.aoa_to_sheet(sheetData);
      XLSX.utils.book_append_sheet(workbook, ragSheet, 'RAG Metrics');
    }

    // Read current data
    const rows = XLSX.utils.sheet_to_json(ragSheet, { header: 1, defval: '' });

    // Find the row with matching key and update value
    let found = false;
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0] || '').trim() === key) {
        rows[i][2] = value.toLowerCase();
        found = true;
        break;
      }
    }

    if (!found) {
      return res.status(404).json({ error: `RAG metric key "${key}" not found in sheet` });
    }

    // Write updated sheet back
    const newRagSheet = XLSX.utils.aoa_to_sheet(rows);
    newRagSheet['!cols'] = [{ wch: 20 }, { wch: 40 }, { wch: 10 }];
    workbook.Sheets['RAG Metrics'] = newRagSheet;

    XLSX.writeFile(workbook, filePath);
    console.log(`RAG updated: ${upperFunc}/${fy} — ${key} = ${value}`);

    // Re-parse and update cache
    const freshData = parseExcelData(filePath);
    if (freshData) {
      if (!cachedData[upperFunc]) cachedData[upperFunc] = {};
      cachedData[upperFunc][fy] = freshData;

      // Broadcast to all WebSocket clients
      broadcastFYUpdate(upperFunc, fy);
    }

    res.json({ success: true, function: upperFunc, fy, key, value: value.toLowerCase() });
  } catch (err) {
    console.error('RAG update error:', err);
    res.status(500).json({ error: 'Failed to update RAG metric', details: err.message });
  }
});

// ─── AI Chat Endpoint (Multi-Provider: Groq → Gemini) ────────
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';

// Groq: OpenAI-compatible, Llama 3.3 70B with 131K context, 30 RPM free tier
const GROQ_MODELS = [
  'llama-3.3-70b-versatile',   // Primary: 131K context, great at data grounding
  'llama-3.1-8b-instant',      // Fallback: faster, smaller
];
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Gemini: Fallback provider
const GEMINI_MODELS = [
  'gemini-2.0-flash',
  'gemini-2.5-flash',
  'gemini-2.0-flash-lite',
];
function geminiUrl(model) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`;
}

// Build data section for a single function+FY dataset
function buildDataSection(data) {
  if (!data) return '';
  const lines = [];

  // Annual Metrics
  if (data.annualMetrics) {
    lines.push(`\n### Annual KPI Metrics:`);
    for (const [key, m] of Object.entries(data.annualMetrics)) {
      const pct = m.targetFY26 ? ((m.achievementTillDate / m.targetFY26) * 100).toFixed(1) : 'N/A';
      lines.push(`- ${m.label}: Target=${m.targetFY26}${m.unit || ''}, Achievement=${m.achievementTillDate}${m.unit || ''} (${pct}%)`);
    }
  }

  // Billing totals
  if (data.billingTotals) {
    const bt = data.billingTotals;
    lines.push(`\n### Billing: Target=₹${bt.totalTarget.toFixed(1)} Cr, Achievement=₹${bt.totalAchievement.toFixed(1)} Cr (${(bt.achievementPercentage * 100).toFixed(1)}%)`);
    // Top/bottom months
    if (data.monthlyBilling) {
      const withData = data.monthlyBilling.filter(m => m.achievement !== null && m.achievement !== undefined);
      if (withData.length > 0) {
        const best = withData.reduce((a, b) => (b.percentage || 0) > (a.percentage || 0) ? b : a);
        const worst = withData.reduce((a, b) => (b.percentage || 0) < (a.percentage || 0) ? b : a);
        lines.push(`- Best month: ${best.month} (${(best.percentage * 100).toFixed(0)}%), Worst: ${worst.month} (${(worst.percentage * 100).toFixed(0)}%)`);
      }
    }
  }

  // Collection totals
  if (data.collectionTotals) {
    const ct = data.collectionTotals;
    lines.push(`\n### Collection: Target=₹${ct.totalTarget.toFixed(1)} Cr, Achievement=₹${ct.totalAchievement.toFixed(1)} Cr (${(ct.achievementPercentage * 100).toFixed(1)}%)`);
  }

  // Quarterly metrics (compact: just totals per quarter)
  const qMetrics = [
    ['QBRs', data.quarterlyQBRs],
    ['New Logos', data.quarterlyNewLogos],
    ['Hero Stories', data.quarterlyHeroStories],
    ['ARR', data.quarterlyARR],
    ['Service Revenue', data.quarterlyServiceRev],
  ];
  for (const [name, arr] of qMetrics) {
    if (arr && arr.length > 0) {
      const totalTarget = arr.reduce((s, q) => s + (q.target || 0), 0);
      const totalAch = arr.reduce((s, q) => s + (q.achievement || 0), 0);
      const pct = totalTarget ? ((totalAch / totalTarget) * 100).toFixed(1) : 'N/A';
      lines.push(`- ${name}: Target=${totalTarget}, Achievement=${totalAch.toFixed(2)} (${pct}%)`);
    }
  }

  // Account Owner Performance
  if (data.accountOwnerPerformance && data.accountOwnerPerformance.length > 0) {
    lines.push(`\n### Account Owner Performance (Individual Team Members):`);
    lines.push(`Each person below is an account owner. Their metrics are:`);
    lines.push(`- ARR Achievement = incremental ARR in Cr (can be negative if accounts churned)`);
    lines.push(`- Billing = total billing amount in Cr (higher is better)`);
    lines.push(`- Collection = total collection amount in Cr (higher is better)`);
    for (const o of data.accountOwnerPerformance) {
      lines.push(`- ${o.name}: ARR Achievement=₹${o.arrAchievement} Cr, Billing=₹${o.billing} Cr, Collection=₹${o.collection} Cr`);
    }
    // Add explicit rankings for common queries
    const sortedByBilling = [...data.accountOwnerPerformance].sort((a, b) => b.billing - a.billing);
    lines.push(`\nBilling Ranking (highest to lowest): ${sortedByBilling.map((o, i) => `${i + 1}. ${o.name} (₹${o.billing} Cr)`).join(', ')}`);
    const sortedByCollection = [...data.accountOwnerPerformance].sort((a, b) => b.collection - a.collection);
    lines.push(`Collection Ranking (highest to lowest): ${sortedByCollection.map((o, i) => `${i + 1}. ${o.name} (₹${o.collection} Cr)`).join(', ')}`);
    const sortedByARR = [...data.accountOwnerPerformance].sort((a, b) => b.arrAchievement - a.arrAchievement);
    lines.push(`ARR Achievement Ranking (highest to lowest): ${sortedByARR.map((o, i) => `${i + 1}. ${o.name} (₹${o.arrAchievement} Cr)`).join(', ')}`);
  }

  // Pipeline Coverage
  if (data.pipelineCoverage) {
    const pc = data.pipelineCoverage;
    lines.push(`\n### Pipeline Coverage:`);
    lines.push(`- Open Pipeline: ${pc.openPipeline} Cr`);
    lines.push(`- Remaining Target: ${pc.remainingTarget} Cr`);
    lines.push(`- Coverage Ratio: ${pc.coverage}x`);
  }

  // Weightages
  if (data.weightages) {
    lines.push(`\n### OKR Weightages:`);
    for (const [key, w] of Object.entries(data.weightages)) {
      lines.push(`- ${w.label}: ${w.weight}%`);
    }
  }

  // RAG Metrics
  if (data.ragMetrics) {
    lines.push(`\n### RAG (Red/Amber/Green) Metrics:`);
    for (const [key, val] of Object.entries(data.ragMetrics)) {
      lines.push(`- ${key}: ${val.toUpperCase()}`);
    }
  }

  return lines.join('\n');
}

// Build data string for injecting as user message context
function buildDataForMessages(currentFunc, currentFY, allData) {
  const funcs = Object.keys(allData);
  const lines = [];
  for (const funcName of funcs) {
    const fyData = allData[funcName];
    if (!fyData) continue;
    const fyKeys = Object.keys(fyData).sort();
    for (const fyKey of fyKeys) {
      const data = fyData[fyKey];
      if (!data) continue;
      const isCurrent = (funcName === currentFunc && fyKey === currentFY);
      lines.push(`\n## ${funcName} — ${fyKey}${isCurrent ? ' (CURRENTLY VIEWING)' : ''}`);
      lines.push(buildDataSection(data));
    }
  }
  return lines.join('\n');
}

// Compact summary for non-current functions (saves context tokens)
function buildCompactSummary(data) {
  if (!data) return '';
  const lines = [];
  if (data.annualMetrics) {
    lines.push(`Annual KPIs:`);
    for (const [key, m] of Object.entries(data.annualMetrics)) {
      lines.push(`- ${m.label}: Target=${m.targetFY26}${m.unit || ''}, Achievement=${m.achievementTillDate}${m.unit || ''}`);
    }
  }
  if (data.billingTotals) {
    lines.push(`Billing Total: Target=₹${data.billingTotals.totalTarget.toFixed(1)} Cr, Achievement=₹${data.billingTotals.totalAchievement.toFixed(1)} Cr (${(data.billingTotals.achievementPercentage * 100).toFixed(1)}%)`);
  }
  if (data.collectionTotals) {
    lines.push(`Collection Total: Target=₹${data.collectionTotals.totalTarget.toFixed(1)} Cr, Achievement=₹${data.collectionTotals.totalAchievement.toFixed(1)} Cr (${(data.collectionTotals.achievementPercentage * 100).toFixed(1)}%)`);
  }
  if (data.accountOwnerPerformance && data.accountOwnerPerformance.length > 0) {
    const sortedByBilling = [...data.accountOwnerPerformance].sort((a, b) => b.billing - a.billing);
    lines.push(`Top Billers: ${sortedByBilling.slice(0, 3).map(o => `${o.name} (₹${o.billing} Cr)`).join(', ')}`);
  }
  return lines.join('\n');
}

function buildSystemPrompt(currentFunc, currentFY, allData) {
  const funcs = Object.keys(allData);
  if (funcs.length === 0) return `You are an AI assistant for the OKR Dashboard. No data is currently loaded.`;

  const lines = [];
  lines.push(`You are an AI assistant for the OKR Dashboard.`);
  lines.push(`The user is currently viewing the ${currentFunc} dashboard for ${currentFY}.`);
  lines.push(`You have access to ALL business functions and fiscal years loaded in the system.`);
  lines.push(`You can answer questions about any function (${funcs.join(', ')}) and any FY.`);
  lines.push(`You can also compare metrics across functions and fiscal years.`);
  lines.push(`IMPORTANT RULES:`);
  lines.push(`- ONLY use the data provided below. NEVER make up or guess numbers.`);
  lines.push(`- When asked "who has highest X", look at the rankings provided and give the correct answer.`);
  lines.push(`- Be concise, use bullet points, and reference specific numbers from the data.`);
  lines.push(`- If the data doesn't contain the answer, say "This data is not available in the dashboard."`);
  lines.push(`- Use ₹ for currency values. Values are in Crores (Cr) unless stated otherwise.`);
  lines.push(`- When the user asks without specifying a function or FY, assume ${currentFunc} ${currentFY}.`);

  // Include FULL data for ALL functions and FYs
  for (const funcName of funcs) {
    const fyData = allData[funcName];
    if (!fyData) continue;
    const fyKeys = Object.keys(fyData).sort();
    for (const fyKey of fyKeys) {
      const data = fyData[fyKey];
      if (!data) continue;
      const isCurrent = (funcName === currentFunc && fyKey === currentFY);
      lines.push(`\n${'='.repeat(50)}`);
      lines.push(`## ${funcName} — ${fyKey}${isCurrent ? ' (CURRENTLY VIEWING)' : ''}`);
      lines.push(`${'='.repeat(50)}`);
      lines.push(buildDataSection(data));
    }
  }

  return lines.join('\n');
}

// ─── Groq streaming helper (OpenAI-compatible SSE) ──────────
async function tryGroq(systemPrompt, messages, res, req) {
  if (!GROQ_API_KEY) return false;

  for (const model of GROQ_MODELS) {
    try {
      const bodyObj = {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        temperature: 0.3,
        max_tokens: 1024,
        stream: true,
      };

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);

      const attempt = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`,
        },
        signal: controller.signal,
        body: JSON.stringify(bodyObj),
      });

      clearTimeout(timeout);

      if (attempt.ok) {
        console.log(`Groq: using ${model}`);
        await streamOpenAI(attempt, res, req, 'Groq');
        return true;
      }

      if (attempt.status === 429) {
        console.warn(`Groq 429 on ${model}, trying next...`);
        await attempt.text();
        continue;
      }

      const errBody = await attempt.text();
      console.error(`Groq error (${model}):`, attempt.status, errBody);
      // Try next Groq model
      continue;
    } catch (err) {
      if (err.name === 'AbortError') {
        console.warn(`Groq timeout on ${model}`);
        continue;
      }
      console.error(`Groq exception (${model}):`, err.message);
      continue;
    }
  }
  return false; // All Groq models failed
}

// ─── Gemini streaming helper ────────────────────────────────
async function tryGemini(systemPrompt, geminiContents, res, req) {
  if (!GEMINI_API_KEY) return false;

  for (const model of GEMINI_MODELS) {
    try {
      const bodyObj = {
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: geminiContents,
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1024,
        },
      };
      if (model.includes('2.5')) {
        bodyObj.generationConfig.thinkingConfig = { thinkingBudget: 0 };
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);

      const attempt = await fetch(geminiUrl(model), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify(bodyObj),
      });

      clearTimeout(timeout);

      if (attempt.ok) {
        console.log(`Gemini: using ${model}`);
        await streamGemini(attempt, res, req);
        return true;
      }

      if (attempt.status === 429) {
        console.warn(`Gemini 429 on ${model}, trying next...`);
        await attempt.text();
        continue;
      }

      const errBody = await attempt.text();
      console.error(`Gemini error (${model}):`, attempt.status, errBody);
      continue;
    } catch (err) {
      if (err.name === 'AbortError') {
        console.warn(`Gemini timeout on ${model}`);
        continue;
      }
      console.error(`Gemini exception (${model}):`, err.message);
      continue;
    }
  }
  return false;
}

// ─── Stream parsers ─────────────────────────────────────────
async function streamOpenAI(response, res, req, providerName) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let aborted = false;

  req.on('close', () => { aborted = true; reader.cancel(); });

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done || aborted) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const jsonStr = trimmed.slice(6);
        if (jsonStr === '[DONE]') continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const text = parsed?.choices?.[0]?.delta?.content;
          if (text) {
            res.write(`data: ${JSON.stringify({ token: text })}\n\n`);
          }
        } catch (e) {}
      }
    }

    // Process remaining buffer
    if (buffer.trim()) {
      const trimmed = buffer.trim();
      if (trimmed.startsWith('data: ') && trimmed.slice(6) !== '[DONE]') {
        try {
          const parsed = JSON.parse(trimmed.slice(6));
          const text = parsed?.choices?.[0]?.delta?.content;
          if (text) res.write(`data: ${JSON.stringify({ token: text })}\n\n`);
        } catch (e) {}
      }
    }
  } catch (err) {
    if (!aborted) {
      console.error(`${providerName} stream error:`, err);
      if (!res.writableEnded) res.write(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`);
    }
  } finally {
    if (!res.writableEnded) {
      res.write('data: [DONE]\n\n');
      res.end();
    }
  }
}

async function streamGemini(response, res, req) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let aborted = false;

  req.on('close', () => { aborted = true; reader.cancel(); });

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done || aborted) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const jsonStr = trimmed.slice(6);
        if (!jsonStr) continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            res.write(`data: ${JSON.stringify({ token: text })}\n\n`);
          }
        } catch (e) {}
      }
    }

    if (buffer.trim()) {
      const trimmed = buffer.trim();
      if (trimmed.startsWith('data: ')) {
        try {
          const parsed = JSON.parse(trimmed.slice(6));
          const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) res.write(`data: ${JSON.stringify({ token: text })}\n\n`);
        } catch (e) {}
      }
    }
  } catch (err) {
    if (!aborted) {
      console.error('Gemini stream error:', err);
      if (!res.writableEnded) res.write(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`);
    }
  } finally {
    if (!res.writableEnded) {
      res.write('data: [DONE]\n\n');
      res.end();
    }
  }
}

// ─── Chat Endpoint (Groq primary → Gemini fallback) ─────────
app.post('/api/chat', async (req, res) => {
  const { message, function: funcName, fy, history } = req.body || {};

  if (!message) {
    return res.status(400).json({ error: 'Missing "message" field' });
  }

  const func = (funcName || defaultFunction || 'KAM').toUpperCase();
  const fyKey = fy || computeDefaultYear(getAvailableYears(func)) || 'FY26';

  const systemPrompt = buildSystemPrompt(func, fyKey, cachedData);

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  // Build OpenAI-format messages (for Groq)
  const openAIMessages = [];
  if (history && Array.isArray(history)) {
    for (const msg of history.slice(-6)) {
      openAIMessages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      });
    }
  }
  openAIMessages.push({ role: 'user', content: message });

  // Build Gemini-format contents
  const geminiContents = [];
  if (history && Array.isArray(history)) {
    for (const msg of history.slice(-6)) {
      geminiContents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      });
    }
  }
  geminiContents.push({ role: 'user', parts: [{ text: message }] });

  try {
    // Provider priority: Groq → Gemini
    const groqOk = await tryGroq(systemPrompt, openAIMessages, res, req);
    if (groqOk) return;

    const geminiOk = await tryGemini(systemPrompt, geminiContents, res, req);
    if (geminiOk) return;

    // All providers exhausted
    res.write(`data: ${JSON.stringify({ error: 'All AI models are currently unavailable. Please try again in a minute.' })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('Chat API error:', err);
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ error: `Chat error: ${err.message}` })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }
  }
});

// ─── HTTP + WebSocket Server ─────────────────────────────────
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`Dashboard client connected (total: ${clients.size})`);

  // Send available functions immediately
  const funcs = getAvailableFunctions();
  ws.send(JSON.stringify({
    type: 'functions',
    functions: funcs,
    defaultFunction: defaultFunction,
  }));

  // Send years for default function
  if (defaultFunction) {
    const years = getAvailableYears(defaultFunction);
    const defYear = computeDefaultYear(years);
    ws.send(JSON.stringify({
      type: 'years',
      function: defaultFunction,
      years,
      defaultYear: defYear,
    }));

    // Send default data
    if (defYear && cachedData[defaultFunction] && cachedData[defaultFunction][defYear]) {
      ws.send(JSON.stringify({
        type: 'data',
        function: defaultFunction,
        fy: defYear,
        payload: cachedData[defaultFunction][defYear],
      }));
    }
  }

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`Dashboard client disconnected (total: ${clients.size})`);
  });
});

function broadcastFunctions() {
  const funcs = getAvailableFunctions();
  const message = JSON.stringify({
    type: 'functions',
    functions: funcs,
    defaultFunction: defaultFunction,
  });
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(message);
  }
}

function broadcastYears(funcName) {
  const years = getAvailableYears(funcName);
  const defYear = computeDefaultYear(years);
  const message = JSON.stringify({
    type: 'years',
    function: funcName,
    years,
    defaultYear: defYear,
  });
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(message);
  }
}

function broadcastFYUpdate(funcName, fyKey) {
  const data = cachedData[funcName] && cachedData[funcName][fyKey];
  if (!data) return;

  const message = JSON.stringify({
    type: 'data',
    function: funcName,
    fy: fyKey,
    payload: data,
  });
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(message);
  }
  console.log(`Broadcasted ${funcName}/${fyKey} update to ${clients.size} client(s)`);
}

// ─── File Watcher ────────────────────────────────────────────
const debounceTimers = {};
const activeWatchers = new Map(); // filePath -> fs.FSWatcher

function watchFile(filePath) {
  if (activeWatchers.has(filePath)) return;
  if (!fs.existsSync(filePath)) return;

  const parsed = parseFuncAndFY(filePath);
  if (!parsed) return;

  const { func, fy } = parsed;
  console.log(`Watching: ${path.basename(filePath)} (${func}/${fy})`);

  const watcher = fs.watch(filePath, { persistent: true }, (eventType) => {
    if (eventType === 'change' || eventType === 'rename') {
      if (debounceTimers[filePath]) clearTimeout(debounceTimers[filePath]);
      debounceTimers[filePath] = setTimeout(() => {
        console.log(`\nExcel file changed: ${path.basename(filePath)} - Reloading...`);

        if (!fs.existsSync(filePath)) {
          console.log(`File removed: ${path.basename(filePath)}`);
          if (cachedData[func]) {
            delete cachedData[func][fy];
            // If no FYs left for this function, remove the function
            if (Object.keys(cachedData[func]).length === 0) {
              delete cachedData[func];
              defaultFunction = getAvailableFunctions()[0] || null;
              broadcastFunctions();
            }
          }
          broadcastYears(func);
          const w = activeWatchers.get(filePath);
          if (w) { w.close(); activeWatchers.delete(filePath); }
          return;
        }

        // Retry logic: Excel on Windows locks the file while open,
        // so XLSX.readFile() may fail with EBUSY. Retry up to 3 times.
        let retries = 0;
        const maxRetries = 3;
        const tryParse = () => {
          const newData = parseExcelData(filePath);
          if (newData) {
            if (!cachedData[func]) cachedData[func] = {};
            cachedData[func][fy] = newData;
            broadcastFYUpdate(func, fy);
            broadcastYears(func);
          } else if (retries < maxRetries) {
            retries++;
            console.log(`  ⏳ File may be locked by Excel, retrying (${retries}/${maxRetries})...`);
            setTimeout(tryParse, retries * 1000);
          } else {
            console.log(`  ❌ Could not read file after ${maxRetries} retries — is Excel still open? Close and re-save.`);
          }
        };
        tryParse();
      }, 1500);
    }
  });

  activeWatchers.set(filePath, watcher);
}

function watchAllFiles() {
  const allFiles = discoverAllFiles();
  for (const [funcName, fyFiles] of Object.entries(allFiles)) {
    for (const [fyKey, filePath] of Object.entries(fyFiles)) {
      watchFile(filePath);
    }
  }

  // Watch the project directory for new files being added
  fs.watch(PROJECT_DIR, { persistent: true }, (eventType, filename) => {
    if (!filename) return;

    const match = filename.match(FUNC_FILE_PATTERN);
    const isFallback = filename.toLowerCase() === FALLBACK_FILE.toLowerCase();

    if (match || isFallback) {
      const fullPath = path.join(PROJECT_DIR, filename);
      const parsed = parseFuncAndFY(fullPath);

      if (parsed && fs.existsSync(fullPath) && !activeWatchers.has(fullPath)) {
        const { func, fy } = parsed;
        console.log(`\nNew file detected: ${filename} (${func}/${fy})`);

        const prevFuncs = getAvailableFunctions();

        const data = parseExcelData(fullPath);
        if (data) {
          if (!cachedData[func]) cachedData[func] = {};
          cachedData[func][fy] = data;

          const newFuncs = getAvailableFunctions();
          if (!defaultFunction) defaultFunction = newFuncs[0] || null;

          // If a new function appeared, broadcast the updated functions list
          if (newFuncs.length !== prevFuncs.length || newFuncs.some((f, i) => f !== prevFuncs[i])) {
            broadcastFunctions();
          }

          broadcastYears(func);
          broadcastFYUpdate(func, fy);
          watchFile(fullPath);
        }
      }
    }
  });
}

// ─── SPA Catch-All: serve index.html for non-API routes ──────
// Express 5 uses path-to-regexp v8+ which requires named params for wildcards
app.get('/{*path}', (req, res) => {
  const indexPath = path.join(STATIC_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Dashboard not built yet. Run: npm run build');
  }
});

// ─── Start Server ────────────────────────────────────────────
server.listen(PORT, () => {
  const funcs = getAvailableFunctions();
  const allFiles = discoverAllFiles();
  const hasBuilt = fs.existsSync(path.join(STATIC_DIR, 'index.html'));

  console.log('');
  console.log('========================================================');
  console.log('    Dashboard Server (API + Frontend + Live Updates)     ');
  console.log('========================================================');
  console.log(`  🌐 Dashboard:  http://localhost:${PORT}`);
  console.log(`  API:           http://localhost:${PORT}/api/data?function=KAM&fy=FY26`);
  console.log(`  WebSocket:     ws://localhost:${PORT}`);
  console.log(`  Health:        http://localhost:${PORT}/api/health`);
  if (!hasBuilt) {
    console.log('');
    console.log('  ⚠️  Frontend not built yet! Run: npm run build');
    console.log('  (Or use: npm start — builds + starts server)');
  }
  console.log('--------------------------------------------------------');
  if (funcs.length > 0) {
    console.log(`  Functions:     ${funcs.join(', ')}`);
    console.log(`  Default:       ${defaultFunction}`);
    console.log('  Files:');
    for (const [func, fyFiles] of Object.entries(allFiles)) {
      for (const [fy, fp] of Object.entries(fyFiles)) {
        console.log(`    ${func}/${fy} -> ${path.basename(fp)}`);
      }
    }
  } else {
    console.log('  No data files found.');
    console.log(`  Place KAM_Dashboard_FY26.xlsx (or any {Function}_Dashboard_FY{NN}.xlsx)`);
    console.log(`  in: ${PROJECT_DIR}`);
  }
  console.log('--------------------------------------------------------');
  console.log('  Edit any Excel file and save it.');
  console.log('  The dashboard will auto-refresh!');
  console.log('========================================================');
  console.log('');

  watchAllFiles();
});
