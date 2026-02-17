// ============================================================
// KAM Dashboard Backend Server (Multi-Function + Multi-FY)
// Reads Excel files → Serves JSON API → Watches for changes
// Supports: {Function}_Dashboard_FY*.xlsx (e.g. KAM_Dashboard_FY26.xlsx, Sales_Dashboard_FY27.xlsx)
// Run: node server.cjs
// ============================================================
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

// ─── Excel Parser ────────────────────────────────────────────
function parseExcelData(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`Excel file not found at: ${filePath}`);
    return null;
  }

  try {
    const workbook = XLSX.readFile(filePath);
    const data = {};

    // ── 1. Annual KPIs ──
    const annualSheet = workbook.Sheets['Annual KPIs'];
    if (annualSheet) {
      const rows = XLSX.utils.sheet_to_json(annualSheet, { header: 1, defval: '' });
      const metricRows = rows.slice(2); // skip title + blank row

      data.annualMetrics = {};
      // ARR and Service Rev are computed from Quarterly ARR & Service Rev sheet
      const metricKeyMap = {
        'NDR': 'ndr',
        'GDR': 'gdr',
        'NPS Score': 'nps',
      };

      const unitMap = {
        'ndr': 'x',
        'gdr': 'x',
        'nps': '',
      };

      let openPipeline = 0;

      for (let i = 1; i < metricRows.length; i++) {
        const row = metricRows[i];
        if (!row[0]) continue;
        const label = String(row[0]).trim();
        const key = metricKeyMap[label];
        if (key) {
          data.annualMetrics[key] = {
            label: label,
            targetFY26: parseNum(row[1]),
            achievementTillDate: parseNum(row[2]),
            unit: unitMap[key] || '',
          };
        }
        // Parse Open Pipeline value
        if (label.toLowerCase().includes('pipeline')) {
          openPipeline = parseNum(row[2]) || parseNum(row[1]); // check Achievement col first, then Target col
        }
      }
      data._openPipeline = openPipeline;
    }

    // ── 2. Monthly Billing ──
    const billingSheet = workbook.Sheets['Monthly Billing'];
    if (billingSheet) {
      data.monthlyBilling = parseMonthlySheet(billingSheet);
    }

    // ── 3. Monthly Collection ──
    const collectionSheet = workbook.Sheets['Monthly Collection'];
    if (collectionSheet) {
      data.monthlyCollection = parseMonthlySheet(collectionSheet);
    }

    // ── 4. Quarterly QBRs ──
    const qbrSheet = workbook.Sheets['Quarterly QBRs'];
    if (qbrSheet) {
      data.quarterlyQBRs = parseQuarterlySheet(qbrSheet);
    }

    // ── 5. Hero Stories ──
    const heroSheet = workbook.Sheets['Hero Stories'];
    if (heroSheet) {
      data.quarterlyHeroStories = parseQuarterlySheet(heroSheet);
    }

    // ── 6. Quarterly ARR & Service Revenue ──
    const quarterlyArrSrvSheet = workbook.Sheets['Quarterly ARR & Service Rev'];
    if (quarterlyArrSrvSheet) {
      const rows = XLSX.utils.sheet_to_json(quarterlyArrSrvSheet, { header: 1, defval: '' });
      data.quarterlyARR = [];
      data.quarterlyServiceRev = [];
      // skip title, blank, header (rows 0,1,2)
      for (let i = 3; i < rows.length; i++) {
        const row = rows[i];
        if (!row[0]) continue;
        const quarter = String(row[0]).trim();
        data.quarterlyARR.push({
          quarter,
          target: parseNum(row[1]),
          achievement: parseNum(row[2]),
          percentage: parseNum(row[1]) > 0 ? parseNum(row[2]) / parseNum(row[1]) : 0,
        });
        data.quarterlyServiceRev.push({
          quarter,
          target: parseNum(row[3]),
          achievement: parseNum(row[4]),
          percentage: parseNum(row[3]) > 0 ? parseNum(row[4]) / parseNum(row[3]) : 0,
        });
      }
    }

    // ── 7. Account Owners ──
    const ownerSheet = workbook.Sheets['Account Owners'];
    if (ownerSheet) {
      const rows = XLSX.utils.sheet_to_json(ownerSheet, { header: 1, defval: '' });
      data.accountOwnerPerformance = [];
      // skip title, blank, header (rows 0,1,2)
      for (let i = 3; i < rows.length; i++) {
        const row = rows[i];
        if (!row[0]) continue;
        data.accountOwnerPerformance.push({
          name: String(row[0]).trim(),
          arrAchievement: parseNum(row[1]),
          billing: parseNum(row[2]),
          collection: parseNum(row[3]),
        });
      }
    }

    // ── 8. Weightages ──
    const weightageSheet = workbook.Sheets['Weightages'];
    if (weightageSheet) {
      const rows = XLSX.utils.sheet_to_json(weightageSheet, { header: 1, defval: '' });
      data.weightages = {};
      // skip title, blank, header (rows 0,1,2)
      for (let i = 3; i < rows.length; i++) {
        const row = rows[i];
        if (!row[0]) continue;
        const key = String(row[0]).trim();
        const label = String(row[1] || key).trim();
        const weight = parseNum(row[2]);
        data.weightages[key] = { label, weight };
      }
    }

    // ── Compute totals ──
    if (data.monthlyBilling) {
      const achieved = data.monthlyBilling.filter(d => d.achievement !== null);
      const totalTarget = data.monthlyBilling.reduce((s, d) => s + d.target, 0);
      const totalAchievement = achieved.reduce((s, d) => s + d.achievement, 0);
      data.billingTotals = {
        totalTarget,
        totalAchievement,
        achievementPercentage: totalTarget > 0 ? totalAchievement / totalTarget : 0,
      };
    }

    if (data.monthlyCollection) {
      const achieved = data.monthlyCollection.filter(d => d.achievement !== null);
      const totalTarget = data.monthlyCollection.reduce((s, d) => s + d.target, 0);
      const totalAchievement = achieved.reduce((s, d) => s + d.achievement, 0);
      data.collectionTotals = {
        totalTarget,
        totalAchievement,
        achievementPercentage: totalTarget > 0 ? totalAchievement / totalTarget : 0,
      };
    }

    // ── Compute ARR & Service Rev from quarterly breakdown ──
    if (!data.annualMetrics) data.annualMetrics = {};

    if (data.quarterlyARR && data.quarterlyARR.length > 0) {
      const arrTarget = data.quarterlyARR.reduce((s, q) => s + q.target, 0);
      const arrAch = data.quarterlyARR.reduce((s, q) => s + q.achievement, 0);
      data.annualMetrics.arr = {
        label: 'ARR INR Cr',
        targetFY26: arrTarget,
        achievementTillDate: arrAch,
        unit: 'Cr',
      };
    }

    if (data.quarterlyServiceRev && data.quarterlyServiceRev.length > 0) {
      const srvTarget = data.quarterlyServiceRev.reduce((s, q) => s + q.target, 0);
      const srvAch = data.quarterlyServiceRev.reduce((s, q) => s + q.achievement, 0);
      data.annualMetrics.serviceRev = {
        label: 'Service Rev INR Cr',
        targetFY26: srvTarget,
        achievementTillDate: srvAch,
        unit: 'Cr',
      };
    }

    // ── Compute Pipeline Coverage ──
    const openPipeline = data._openPipeline || 0;
    if (data.annualMetrics && data.annualMetrics.arr) {
      const arrTarget = data.annualMetrics.arr.targetFY26 || 0;
      const arrAch = data.annualMetrics.arr.achievementTillDate || 0;
      const remainingTarget = arrTarget - arrAch;
      const coverage = remainingTarget > 0 ? openPipeline / remainingTarget : 0;
      data.pipelineCoverage = {
        openPipeline,
        remainingTarget: Math.max(0, remainingTarget),
        coverage,
      };
    } else {
      data.pipelineCoverage = { openPipeline, remainingTarget: 0, coverage: 0 };
    }
    delete data._openPipeline;

    console.log(`Excel parsed successfully: ${path.basename(filePath)} at ${new Date().toLocaleTimeString()}`);
    return data;
  } catch (err) {
    console.error(`Error parsing Excel (${path.basename(filePath)}):`, err.message);
    return null;
  }
}

function parseMonthlySheet(sheet) {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  const result = [];
  // skip title, blank, header (rows 0,1,2)
  for (let i = 3; i < rows.length; i++) {
    const row = rows[i];
    if (!row[0]) continue;
    const target = parseNum(row[1]);
    const achievement = row[2] === '' || row[2] === null || row[2] === undefined ? null : parseNum(row[2]);
    const percentage = (achievement !== null && target > 0) ? achievement / target : null;
    result.push({
      month: String(row[0]).trim(),
      target,
      achievement,
      percentage,
    });
  }
  return result;
}

function parseQuarterlySheet(sheet) {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  const result = [];
  // skip title, blank, header (rows 0,1,2)
  for (let i = 3; i < rows.length; i++) {
    const row = rows[i];
    if (!row[0]) continue;
    const target = parseNum(row[1]);
    const achievement = parseNum(row[2]);
    const percentage = target > 0 ? achievement / target : 0;
    result.push({
      quarter: String(row[0]).trim(),
      target,
      achievement,
      percentage,
    });
  }
  return result;
}

function parseNum(val) {
  if (val === '' || val === null || val === undefined) return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

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

        const newData = parseExcelData(filePath);
        if (newData) {
          if (!cachedData[func]) cachedData[func] = {};
          cachedData[func][fy] = newData;
          broadcastFYUpdate(func, fy);
          broadcastYears(func);
        }
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
