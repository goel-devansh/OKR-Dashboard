// ============================================================
// KAM Dashboard Backend Server (Multi-FY Support)
// Reads Excel files → Serves JSON API → Watches for changes
// Supports: KAM_Dashboard_FY*.xlsx and KAM_Dashboard_Input.xlsx
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

// Pattern for multi-FY files: KAM_Dashboard_FY*.xlsx
const FY_FILE_PATTERN = /^KAM_Dashboard_FY(\d+)\.xlsx$/i;
// Fallback single file (treated as FY26)
const FALLBACK_FILE = 'KAM_Dashboard_Input.xlsx';
const FALLBACK_FY = 'FY26';

app.use(cors());
app.use(express.json());

// ─── Multi-FY Data Store ────────────────────────────────────
// { FY26: {...data...}, FY27: {...data...} }
let cachedDataByFY = {};
let defaultYear = null;

// ─── Discover all FY Excel files ────────────────────────────
function discoverFYFiles() {
  const files = {};

  // Scan for KAM_Dashboard_FY*.xlsx files
  const allFiles = fs.readdirSync(PROJECT_DIR);
  for (const filename of allFiles) {
    const match = filename.match(FY_FILE_PATTERN);
    if (match) {
      const fyNum = match[1];
      const fyKey = `FY${fyNum}`;
      files[fyKey] = path.join(PROJECT_DIR, filename);
    }
  }

  // Fallback: if no FY files found, use KAM_Dashboard_Input.xlsx as FY26
  if (Object.keys(files).length === 0) {
    const fallbackPath = path.join(PROJECT_DIR, FALLBACK_FILE);
    if (fs.existsSync(fallbackPath)) {
      files[FALLBACK_FY] = fallbackPath;
    }
  }

  return files;
}

// ─── Determine the FY key from a file path ──────────────────
function getFYFromFilePath(filePath) {
  const filename = path.basename(filePath);
  const match = filename.match(FY_FILE_PATTERN);
  if (match) {
    return `FY${match[1]}`;
  }
  if (filename.toLowerCase() === FALLBACK_FILE.toLowerCase()) {
    return FALLBACK_FY;
  }
  return null;
}

// ─── Get the default (latest) FY year ───────────────────────
function computeDefaultYear(years) {
  if (!years || years.length === 0) return null;
  // Sort numerically descending by the number portion, pick the latest
  const sorted = [...years].sort((a, b) => {
    const numA = parseInt(a.replace(/\D/g, ''), 10) || 0;
    const numB = parseInt(b.replace(/\D/g, ''), 10) || 0;
    return numB - numA;
  });
  return sorted[0];
}

// ─── Get sorted list of available years ─────────────────────
function getAvailableYears() {
  const years = Object.keys(cachedDataByFY).filter(fy => cachedDataByFY[fy] !== null);
  // Sort ascending by number
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
      const header = metricRows[0]; // Metric, Target FY26, Achievement Till Date

      data.annualMetrics = {};
      const metricKeyMap = {
        'ARR INR Cr': 'arr',
        'Service Rev INR Cr': 'serviceRev',
        'NDR': 'ndr',
        'GDR': 'gdr',
        'NPS Score': 'nps',
      };

      const unitMap = {
        'arr': 'Cr',
        'serviceRev': 'Cr',
        'ndr': 'x',
        'gdr': 'x',
        'nps': '',
      };

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
      }
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

// ─── Initial Load: Parse all FY files ────────────────────────
function loadAllFYData() {
  const fyFiles = discoverFYFiles();
  cachedDataByFY = {};

  for (const [fyKey, filePath] of Object.entries(fyFiles)) {
    const data = parseExcelData(filePath);
    if (data) {
      cachedDataByFY[fyKey] = data;
    }
  }

  const years = getAvailableYears();
  defaultYear = computeDefaultYear(years);

  if (years.length > 0) {
    console.log(`Loaded FY data: ${years.join(', ')} (default: ${defaultYear})`);
  } else {
    console.log('No FY data files found.');
  }
}

loadAllFYData();

// ─── API Routes ──────────────────────────────────────────────

// GET /api/years - list available financial years
app.get('/api/years', (req, res) => {
  const years = getAvailableYears();
  res.json({
    years,
    defaultYear: defaultYear || null,
  });
});

// GET /api/data?fy=FY26 - get data for a specific FY (or default)
app.get('/api/data', (req, res) => {
  const requestedFY = req.query.fy || defaultYear;

  if (!requestedFY) {
    return res.status(500).json({ error: 'No FY data available' });
  }

  // If the requested FY is not cached, try to reload
  if (!cachedDataByFY[requestedFY]) {
    // Attempt a fresh scan and parse
    const fyFiles = discoverFYFiles();
    if (fyFiles[requestedFY]) {
      const data = parseExcelData(fyFiles[requestedFY]);
      if (data) {
        cachedDataByFY[requestedFY] = data;
        const years = getAvailableYears();
        defaultYear = computeDefaultYear(years);
      }
    }
  }

  const data = cachedDataByFY[requestedFY];
  if (!data) {
    return res.status(404).json({ error: `No data found for ${requestedFY}` });
  }

  res.json(data);
});

app.get('/api/health', (req, res) => {
  const fyFiles = discoverFYFiles();
  const years = getAvailableYears();
  res.json({
    status: 'ok',
    availableYears: years,
    defaultYear: defaultYear,
    fyFiles: Object.fromEntries(
      Object.entries(fyFiles).map(([fy, fp]) => [fy, path.basename(fp)])
    ),
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

  // Send available years immediately
  const years = getAvailableYears();
  ws.send(JSON.stringify({
    type: 'years',
    years,
    defaultYear: defaultYear,
  }));

  // Send default year's data immediately
  if (defaultYear && cachedDataByFY[defaultYear]) {
    ws.send(JSON.stringify({
      type: 'data',
      fy: defaultYear,
      payload: cachedDataByFY[defaultYear],
    }));
  }

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`Dashboard client disconnected (total: ${clients.size})`);
  });
});

function broadcastYears() {
  const years = getAvailableYears();
  const message = JSON.stringify({
    type: 'years',
    years,
    defaultYear: defaultYear,
  });
  for (const ws of clients) {
    if (ws.readyState === 1) { // OPEN
      ws.send(message);
    }
  }
}

function broadcastFYUpdate(fyKey) {
  const data = cachedDataByFY[fyKey];
  if (!data) return;

  const message = JSON.stringify({
    type: 'data',
    fy: fyKey,
    payload: data,
  });
  for (const ws of clients) {
    if (ws.readyState === 1) { // OPEN
      ws.send(message);
    }
  }
  console.log(`Broadcasted ${fyKey} update to ${clients.size} client(s)`);
}

// ─── File Watcher ────────────────────────────────────────────
const debounceTimers = {};
const activeWatchers = new Map(); // filePath -> fs.FSWatcher

function watchFile(filePath) {
  if (activeWatchers.has(filePath)) return; // already watching

  if (!fs.existsSync(filePath)) return;

  const fyKey = getFYFromFilePath(filePath);
  if (!fyKey) return;

  console.log(`Watching: ${path.basename(filePath)} (${fyKey})`);

  const watcher = fs.watch(filePath, { persistent: true }, (eventType) => {
    if (eventType === 'change' || eventType === 'rename') {
      // Debounce per file: Excel saves can trigger multiple events
      if (debounceTimers[filePath]) clearTimeout(debounceTimers[filePath]);
      debounceTimers[filePath] = setTimeout(() => {
        console.log(`\nExcel file changed: ${path.basename(filePath)} - Reloading...`);

        // Check if file still exists (might have been deleted)
        if (!fs.existsSync(filePath)) {
          console.log(`File removed: ${path.basename(filePath)}`);
          delete cachedDataByFY[fyKey];
          const years = getAvailableYears();
          defaultYear = computeDefaultYear(years);
          broadcastYears();
          // Stop watching this file
          const w = activeWatchers.get(filePath);
          if (w) {
            w.close();
            activeWatchers.delete(filePath);
          }
          return;
        }

        const newData = parseExcelData(filePath);
        if (newData) {
          cachedDataByFY[fyKey] = newData;
          const years = getAvailableYears();
          const newDefault = computeDefaultYear(years);
          if (newDefault !== defaultYear) {
            defaultYear = newDefault;
            broadcastYears();
          }
          broadcastFYUpdate(fyKey);
        }
      }, 1500); // Wait 1.5s for Excel to finish writing
    }
  });

  activeWatchers.set(filePath, watcher);
}

function watchAllFYFiles() {
  const fyFiles = discoverFYFiles();
  for (const [fyKey, filePath] of Object.entries(fyFiles)) {
    watchFile(filePath);
  }

  // Also watch the project directory for new FY files being added
  fs.watch(PROJECT_DIR, { persistent: true }, (eventType, filename) => {
    if (!filename) return;

    // Check if a new FY file was added
    const match = filename.match(FY_FILE_PATTERN);
    const isFallback = filename.toLowerCase() === FALLBACK_FILE.toLowerCase();

    if (match || isFallback) {
      const fullPath = path.join(PROJECT_DIR, filename);
      const fyKey = getFYFromFilePath(fullPath);

      if (fyKey && fs.existsSync(fullPath) && !activeWatchers.has(fullPath)) {
        // New FY file detected - parse and start watching
        console.log(`\nNew FY file detected: ${filename}`);
        const data = parseExcelData(fullPath);
        if (data) {
          cachedDataByFY[fyKey] = data;
          const years = getAvailableYears();
          defaultYear = computeDefaultYear(years);
          broadcastYears();
          broadcastFYUpdate(fyKey);
          watchFile(fullPath);
        }
      }
    }
  });
}

// ─── Start Server ────────────────────────────────────────────
server.listen(PORT, () => {
  const years = getAvailableYears();
  const fyFiles = discoverFYFiles();

  console.log('');
  console.log('========================================================');
  console.log('         KAM Dashboard Backend Server (Multi-FY)        ');
  console.log('========================================================');
  console.log(`  API:        http://localhost:${PORT}/api/data?fy=FY26`);
  console.log(`  Years API:  http://localhost:${PORT}/api/years`);
  console.log(`  WebSocket:  ws://localhost:${PORT}`);
  console.log(`  Health:     http://localhost:${PORT}/api/health`);
  console.log('--------------------------------------------------------');
  if (years.length > 0) {
    console.log(`  Available FYs: ${years.join(', ')}`);
    console.log(`  Default FY:    ${defaultYear}`);
    console.log('  Files:');
    for (const [fy, fp] of Object.entries(fyFiles)) {
      console.log(`    ${fy} -> ${path.basename(fp)}`);
    }
  } else {
    console.log('  No FY data files found.');
    console.log(`  Place KAM_Dashboard_FY26.xlsx (or KAM_Dashboard_Input.xlsx)`);
    console.log(`  in: ${PROJECT_DIR}`);
  }
  console.log('--------------------------------------------------------');
  console.log('  Edit any Excel file and save it.');
  console.log('  The dashboard will auto-refresh!');
  console.log('========================================================');
  console.log('');

  watchAllFYFiles();
});
