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
