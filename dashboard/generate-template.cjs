// ============================================================
// Generates Dashboard Input Excel Templates (Multi-Function)
// Run: node generate-template.cjs [FUNCTION] [FY]
//   node generate-template.cjs              → KAM FY26 (default)
//   node generate-template.cjs FY27         → KAM FY27 (backward compat)
//   node generate-template.cjs Sales FY26   → Sales FY26
//   node generate-template.cjs Finance FY27 → Finance FY27
// ============================================================
const XLSX = require('xlsx');
const path = require('path');

// ─── Parse arguments ─────────────────────────────────────────
let funcArg = 'KAM';
let fyArg = 'FY26';

const args = process.argv.slice(2);
if (args.length === 0) {
  // Defaults: KAM FY26
} else if (args.length === 1) {
  // Single arg: could be FY (e.g. "FY27") or function name (e.g. "Sales")
  if (/^FY\d{2}$/i.test(args[0])) {
    fyArg = args[0].toUpperCase();
  } else {
    funcArg = args[0].toUpperCase();
  }
} else {
  funcArg = args[0].toUpperCase();
  fyArg = args[1].toUpperCase();
}

const fyMatch = fyArg.match(/^FY(\d{2})$/i);
if (!fyMatch) {
  console.error(`Invalid FY format: "${fyArg}". Expected format: FY26, FY27, etc.`);
  process.exit(1);
}
const fyNum = parseInt(fyMatch[1], 10);
const fyLabel = `FY${fyNum}`;
const isBaseFY = (fyNum === 26);
const isKAM = (funcArg === 'KAM');

// ─── Supported functions ────────────────────────────────────
// Each function has its own unique sheet structure & metrics.
// Add new functions here as they are defined.
const SUPPORTED_FUNCTIONS = ['KAM'];

if (!SUPPORTED_FUNCTIONS.includes(funcArg)) {
  console.error(`\n  ❌ Function "${funcArg}" is not yet supported.\n`);
  console.error(`  Currently supported functions: ${SUPPORTED_FUNCTIONS.join(', ')}`);
  console.error('');
  console.error('  Each function has unique metrics and sheet structures.');
  console.error('  To add a new function:');
  console.error('    1. Define its metrics and sheets in generate-template.cjs');
  console.error('    2. Add the function name to SUPPORTED_FUNCTIONS');
  console.error('    3. Add the sheet-generation logic (like the KAM block)');
  console.error('    4. The server & dashboard will auto-discover the new Excel file');
  console.error('');
  process.exit(1);
}

// ─── Month helpers ──────────────────────────────────────────
const monthNames = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];

function getMonthLabels(fy) {
  const labels = [];
  for (let i = 0; i < 12; i++) {
    if (i < 9) {
      labels.push(`${monthNames[i]}'${fy}`);
    } else {
      labels.push(`${monthNames[i]}'${fy + 1}`);
    }
  }
  return labels;
}

function getQuarterLabels(fy) {
  return [`Q1 FY${fy}`, `Q2 FY${fy}`, `Q3 FY${fy}`, `Q4 FY${fy}`];
}

const months = getMonthLabels(fyNum);
const quarters = getQuarterLabels(fyNum);

// ─── Base FY26 achievement data (used only for KAM + FY26) ──
const baseBillingAchievements   = [23, 30, 11, 33, 41, 11, 3, 1, 1, 33, '', ''];
const baseCollectionAchievements = [32, 12, 32, 12, 22, 22, 23, 44, 30, 32, '', ''];
const baseQbrAchievements        = [22, 21, 20, 15];
const baseHeroAchievements       = [22, 21, 20, 15];
const baseQuarterlyArrAch        = [5.2, 6.8, 4.53, 2.5];
const baseQuarterlySrvAch        = [30.5, 31.2, 35.8, 23.5];
const baseAnnualKPIs = {
  // ARR and Service Rev are now computed from Quarterly ARR & Service Rev sheet
  ndr:        { target: 1.20,  ach: 1.15 },
  gdr:        { target: 0.95,  ach: 0.88 },
  nps:        { target: 30,    ach: -11 },
};
const baseOwnerData = [
  ['Ansu Jain',          0.78,  15.68, 15.82],
  ['Apoorv Anand',       2.09,  17.67, 20.75],
  ['Bhavik Solani',      0.70,  48.31, 50.37],
  ['Bhavna Sharma',      0,     22.27, 27.64],
  ['Neel Neogi',        -0.85,   2.92,  3.45],
  ['Rajeswari Das',     -0.40,   0,     0],
  ['Rushi',              1.20,  13.37, 16.02],
  ['Sachin Gupta',      -2.42,   0.36,  1.84],
  ['Samprus Mascaren',  -1.60,  13.54, 15.75],
  ['Vishwanath Gurav',  19.53,  65.99, 77.98],
];

// ─── Helpers for empty vs real data ─────────────────────────
const emptyArr = (n) => Array(n).fill('');
const useBaseData = isKAM && isBaseFY;

const wb = XLSX.utils.book_new();

// ════════════════════════════════════════════════════════════
// KAM template — full 9-sheet structure
// To add more functions, add an `else if (funcArg === 'SALES')`
// block with the Sales-specific sheets, and so on.
// ════════════════════════════════════════════════════════════

if (isKAM) {
  // ─── Sheet 1: Annual KPIs (ARR & Service Rev computed from quarterly sheet) ──
  const annualData = [
    ['KAM Dashboard - Annual KPIs', '', ''],
    ['', '', ''],
    ['Metric', `Target ${fyLabel}`, 'Achievement Till Date'],
    ['NDR',               baseAnnualKPIs.ndr.target,        useBaseData ? baseAnnualKPIs.ndr.ach        : ''],
    ['GDR',               baseAnnualKPIs.gdr.target,        useBaseData ? baseAnnualKPIs.gdr.ach        : ''],
    ['NPS Score',         baseAnnualKPIs.nps.target,        useBaseData ? baseAnnualKPIs.nps.ach        : ''],
    ['', '', ''],
    ['Open Pipeline as of Date (₹ Cr)', '', useBaseData ? 150 : ''],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(annualData);
  ws1['!cols'] = [{ wch: 22 }, { wch: 18 }, { wch: 22 }];
  ws1['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];
  XLSX.utils.book_append_sheet(wb, ws1, 'Annual KPIs');

  // ─── Sheet 2: Monthly Billing ────────────────────────────
  const billingTargets = Array(12).fill(25);
  const billingAchievements = useBaseData ? baseBillingAchievements : emptyArr(12);
  const billingData = [
    ['On-Time Billing (INR Cr)', '', ''],
    ['', '', ''],
    ['Month', 'Target INR Cr', 'Achievement INR Cr'],
    ...months.map((m, i) => [m, billingTargets[i], billingAchievements[i]]),
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(billingData);
  ws2['!cols'] = [{ wch: 12 }, { wch: 18 }, { wch: 22 }];
  ws2['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Monthly Billing');

  // ─── Sheet 3: Monthly Collection ─────────────────────────
  const collectionTargets = Array(12).fill(30);
  const collectionAchievements = useBaseData ? baseCollectionAchievements : emptyArr(12);
  const collectionData = [
    ['On-Time Collection (INR Cr)', '', ''],
    ['', '', ''],
    ['Month', 'Target INR Cr', 'Achievement INR Cr'],
    ...months.map((m, i) => [m, collectionTargets[i], collectionAchievements[i]]),
  ];
  const ws3 = XLSX.utils.aoa_to_sheet(collectionData);
  ws3['!cols'] = [{ wch: 12 }, { wch: 18 }, { wch: 22 }];
  ws3['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];
  XLSX.utils.book_append_sheet(wb, ws3, 'Monthly Collection');

  // ─── Sheet 4: Quarterly QBRs ─────────────────────────────
  const qbrTargets = Array(4).fill(25);
  const qbrAchievements = useBaseData ? baseQbrAchievements : emptyArr(4);
  const qbrData = [
    ['QBRs Held', '', ''],
    ['', '', ''],
    ['Quarter', 'Target', 'Achievement'],
    ...quarters.map((q, i) => [q, qbrTargets[i], qbrAchievements[i]]),
  ];
  const ws4 = XLSX.utils.aoa_to_sheet(qbrData);
  ws4['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 14 }];
  ws4['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];
  XLSX.utils.book_append_sheet(wb, ws4, 'Quarterly QBRs');

  // ─── Sheet 5: Hero Stories ───────────────────────────────
  const heroTargets = Array(4).fill(25);
  const heroAchievements = useBaseData ? baseHeroAchievements : emptyArr(4);
  const heroData = [
    ['Hero Stories', '', ''],
    ['', '', ''],
    ['Quarter', 'Target', 'Achievement'],
    ...quarters.map((q, i) => [q, heroTargets[i], heroAchievements[i]]),
  ];
  const ws5 = XLSX.utils.aoa_to_sheet(heroData);
  ws5['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 14 }];
  ws5['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];
  XLSX.utils.book_append_sheet(wb, ws5, 'Hero Stories');

  // ─── Sheet 6: Quarterly ARR & Service Revenue ────────────
  const arrTargets = Array(4).fill(14.35);
  const srvTargets = Array(4).fill(32.75);
  const arrAchievements = useBaseData ? baseQuarterlyArrAch : emptyArr(4);
  const srvAchievements = useBaseData ? baseQuarterlySrvAch : emptyArr(4);
  const quarterlyArrSrvData = [
    ['Quarterly ARR & Service Revenue (INR Cr)', '', '', '', ''],
    ['', '', '', '', ''],
    ['Quarter', 'ARR Target', 'ARR Achievement', 'Service Rev Target', 'Service Rev Achievement'],
    ...quarters.map((q, i) => [q, arrTargets[i], arrAchievements[i], srvTargets[i], srvAchievements[i]]),
  ];
  const ws6 = XLSX.utils.aoa_to_sheet(quarterlyArrSrvData);
  ws6['!cols'] = [{ wch: 12 }, { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 22 }];
  ws6['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];
  XLSX.utils.book_append_sheet(wb, ws6, 'Quarterly ARR & Service Rev');

  // ─── Sheet 7: Account Owner Performance ──────────────────
  const ownerRows = useBaseData
    ? baseOwnerData
    : baseOwnerData.map(row => [row[0], '', '', '']);
  const ownerData = [
    ['Account Owner Performance (YTD)', '', '', ''],
    ['', '', '', ''],
    ['Account Owner', 'ARR Achievement (Cr)', 'Billing (Cr)', 'Collection (Cr)'],
    ...ownerRows,
  ];
  const ws7 = XLSX.utils.aoa_to_sheet(ownerData);
  ws7['!cols'] = [{ wch: 22 }, { wch: 22 }, { wch: 16 }, { wch: 18 }];
  ws7['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];
  XLSX.utils.book_append_sheet(wb, ws7, 'Account Owners');

  // ─── Sheet 8: OKR Weightages ─────────────────────────────
  const weightageData = [
    ['OKR Weightages (Must total 100)', '', ''],
    ['', '', ''],
    ['Metric Key', 'Metric Label', 'Weight (%)'],
    ['arr', 'ARR', 25],
    ['serviceRev', 'Service Revenue', 20],
    ['ndr', 'NDR', 10],
    ['gdr', 'GDR', 10],
    ['nps', 'NPS Score', 5],
    ['billing', 'On-time Billing', 15],
    ['collection', 'On-time Collection', 10],
    ['qbr', 'QBRs Held', 3],
    ['heroStories', 'Hero Stories', 2],
    ['pipelineCoverage', 'Pipeline Coverage', 0],
  ];
  const ws8 = XLSX.utils.aoa_to_sheet(weightageData);
  ws8['!cols'] = [{ wch: 18 }, { wch: 22 }, { wch: 14 }];
  ws8['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];
  XLSX.utils.book_append_sheet(wb, ws8, 'Weightages');
}
// ── Add more functions here: ──
// else if (funcArg === 'SALES') { ... Sales-specific sheets ... }
// else if (funcArg === 'FINANCE') { ... Finance-specific sheets ... }

// ─── Sheet: Instructions (always included) ──────────────────
const instructionData = [
  [`${funcArg} Dashboard - Input File Instructions`],
  [''],
  [`Generated for: ${funcArg} ${fyLabel}`],
  [''],
  ['HOW TO UPDATE THE DASHBOARD:'],
  ['1. Edit the data in any of the sheets (Annual KPIs, Monthly Billing, Monthly Collection, Quarterly QBRs, Hero Stories, Quarterly ARR & Service Rev, Account Owners, Weightages)'],
  ['2. Save this Excel file'],
  ['3. The dashboard will automatically refresh within a few seconds!'],
  [''],
  ['IMPORTANT RULES:'],
  ['- Do NOT rename the sheets'],
  ['- Do NOT change the column headers (Row 3 in each sheet)'],
  ['- Keep the same row structure (months, quarters, etc.)'],
  ['- Leave cells EMPTY (not zero) for months with no data yet'],
  ['- The backend server must be running (node server.cjs)'],
  ['- Weightages MUST total 100%'],
  [''],
  ['SHEET DESCRIPTIONS:'],
  ['  Annual KPIs      -> ARR, Service Revenue, NDR, GDR, NPS Score'],
  ['  Monthly Billing   -> On-time billing target vs achievement (Apr-Mar)'],
  ['  Monthly Collection-> On-time collection target vs achievement (Apr-Mar)'],
  ['  Quarterly QBRs    -> QBRs held per quarter (Q1-Q4)'],
  ['  Hero Stories      -> Hero stories delivered per quarter (Q1-Q4)'],
  ['  Quarterly ARR & Service Rev -> Quarterly ARR and Service Revenue breakdown (Q1-Q4)'],
  ['  Account Owners    -> Per-account-owner YTD performance'],
  ['  Weightages        -> OKR metric weights (must total 100)'],
  [''],
  ['GENERATING TEMPLATES:'],
  ['  node generate-template.cjs                  (KAM FY26 with sample data)'],
  ['  node generate-template.cjs FY27             (KAM FY27 with empty achievements)'],
  ['  node generate-template.cjs KAM FY28         (KAM FY28 with empty achievements)'],
  ['  (Other functions like Sales, Finance will be added in the future)'],
  [''],
  ['FILE NAMING:'],
  [`  This file: ${funcArg}_Dashboard_${fyLabel}.xlsx`],
  ['  Pattern: {FUNCTION}_Dashboard_FY{NN}.xlsx'],
  ['  The server auto-discovers files matching this pattern.'],
];
const ws9 = XLSX.utils.aoa_to_sheet(instructionData);
ws9['!cols'] = [{ wch: 100 }];
XLSX.utils.book_append_sheet(wb, ws9, 'Instructions');

// ─── Write the file ──────────────────────────────────────────
const outputFile = `${funcArg}_Dashboard_${fyLabel}.xlsx`;
const outputPath = path.join(__dirname, outputFile);
XLSX.writeFile(wb, outputPath);

console.log(`Template Excel file created for ${funcArg} ${fyLabel}:`);
console.log(`   ${outputPath}`);
console.log('');
console.log('Sheets created:');
console.log('   1. Annual KPIs');
console.log('   2. Monthly Billing');
console.log('   3. Monthly Collection');
console.log('   4. Quarterly QBRs');
console.log('   5. Hero Stories');
console.log('   6. Quarterly ARR & Service Rev');
console.log('   7. Account Owners');
console.log('   8. Weightages');
console.log('   9. Instructions');
if (!isBaseFY) {
  console.log('');
  console.log(`NOTE: ${fyLabel} template has EMPTY achievement values.`);
  console.log('      Targets are carried over from FY26 as starting values.');
  console.log('      Fill in your actual data and save the file.');
}
