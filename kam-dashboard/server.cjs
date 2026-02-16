// ============================================================
// KAM Dashboard Backend Server
// Reads Excel file → Serves JSON API → Watches for changes
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
const EXCEL_PATH = path.join(__dirname, 'KAM_Dashboard_Input.xlsx');

app.use(cors());
app.use(express.json());

// ─── Excel Parser ────────────────────────────────────────────
function parseExcelData() {
  if (!fs.existsSync(EXCEL_PATH)) {
    console.error(`❌ Excel file not found at: ${EXCEL_PATH}`);
    return null;
  }

  try {
    const workbook = XLSX.readFile(EXCEL_PATH);
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

    // ── 6. Account Owners ──
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

    console.log(`✅ Excel parsed successfully at ${new Date().toLocaleTimeString()}`);
    return data;
  } catch (err) {
    console.error('❌ Error parsing Excel:', err.message);
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

// ─── API Routes ──────────────────────────────────────────────
let cachedData = parseExcelData();

app.get('/api/data', (req, res) => {
  if (!cachedData) {
    cachedData = parseExcelData();
  }
  if (!cachedData) {
    return res.status(500).json({ error: 'Failed to parse Excel file' });
  }
  res.json(cachedData);
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    excelFile: EXCEL_PATH,
    exists: fs.existsSync(EXCEL_PATH),
    lastParsed: new Date().toISOString(),
  });
});

// ─── HTTP + WebSocket Server ─────────────────────────────────
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`🔌 Dashboard client connected (total: ${clients.size})`);

  // Send current data immediately
  if (cachedData) {
    ws.send(JSON.stringify({ type: 'data', payload: cachedData }));
  }

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`🔌 Dashboard client disconnected (total: ${clients.size})`);
  });
});

function broadcastUpdate() {
  const message = JSON.stringify({ type: 'data', payload: cachedData });
  for (const ws of clients) {
    if (ws.readyState === 1) { // OPEN
      ws.send(message);
    }
  }
  console.log(`📡 Broadcasted update to ${clients.size} client(s)`);
}

// ─── File Watcher ────────────────────────────────────────────
let debounceTimer = null;

function watchExcelFile() {
  console.log(`👁️  Watching for changes: ${EXCEL_PATH}`);

  // Use fs.watch for better Windows compatibility
  fs.watch(EXCEL_PATH, { persistent: true }, (eventType) => {
    if (eventType === 'change' || eventType === 'rename') {
      // Debounce: Excel saves can trigger multiple events
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        console.log(`\n📝 Excel file changed! Reloading...`);
        const newData = parseExcelData();
        if (newData) {
          cachedData = newData;
          broadcastUpdate();
        }
      }, 1500); // Wait 1.5s for Excel to finish writing
    }
  });
}

// ─── Start Server ────────────────────────────────────────────
server.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║         KAM Dashboard Backend Server                ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log(`║  🌐 API:        http://localhost:${PORT}/api/data      ║`);
  console.log(`║  🔌 WebSocket:  ws://localhost:${PORT}                 ║`);
  console.log(`║  📊 Health:     http://localhost:${PORT}/api/health     ║`);
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log(`║  📁 Excel File: KAM_Dashboard_Input.xlsx            ║`);
  console.log('║                                                      ║');
  console.log('║  ✏️  Edit the Excel file and save it.                ║');
  console.log('║  The dashboard will auto-refresh!                    ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');

  if (fs.existsSync(EXCEL_PATH)) {
    watchExcelFile();
  } else {
    console.log('⚠️  Excel file not found. Run: node generate-template.cjs');
  }
});
