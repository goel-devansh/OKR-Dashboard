// ============================================================
// Generates the KAM Dashboard Input Excel Template
// Run: node generate-template.cjs [FY27]
// Default FY: FY26
// ============================================================
const XLSX = require('xlsx');
const path = require('path');

// ─── Parse FY argument ──────────────────────────────────────
const fyArg = process.argv[2] || 'FY26';
const fyMatch = fyArg.match(/^FY(\d{2})$/i);
if (!fyMatch) {
  console.error(`Invalid FY format: "${fyArg}". Expected format: FY26, FY27, etc.`);
  process.exit(1);
}
const fyNum = parseInt(fyMatch[1], 10);   // e.g. 26, 27
const fyLabel = `FY${fyNum}`;             // e.g. "FY26", "FY27"
const isBaseFY = (fyNum === 26);          // FY26 is the base with real data

// ─── Month helpers ──────────────────────────────────────────
// Financial year FYnn runs Apr'nn to Mar'(nn+1)
// e.g. FY26 => Apr'26 … Dec'26, Jan'27 … Mar'27
//      FY27 => Apr'27 … Dec'27, Jan'28 … Mar'28
const monthNames = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];

function getMonthLabels(fy) {
  const labels = [];
  for (let i = 0; i < 12; i++) {
    if (i < 9) {
      // Apr–Dec => same year as FY number
      labels.push(`${monthNames[i]}'${fy}`);
    } else {
      // Jan–Mar => FY number + 1
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

// ─── Base FY26 achievement data (used only for FY26) ────────
const baseBillingAchievements   = [23, 30, 11, 33, 41, 11, 3, 1, 1, 33, '', ''];
const baseCollectionAchievements = [32, 12, 32, 12, 22, 22, 23, 44, 30, 32, '', ''];
const baseQbrAchievements        = [22, 21, 20, 15];
const baseHeroAchievements       = [22, 21, 20, 15];
const baseQuarterlyArrAch        = [5.2, 6.8, 4.53, 2.5];
const baseQuarterlySrvAch        = [30.5, 31.2, 35.8, 23.5];
const baseAnnualKPIs = {
  arr:        { target: 57.4,  ach: 19.03 },
  serviceRev: { target: 131,   ach: 121 },
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
// For non-base FY: achievements are blank so the user fills them in
const emptyArr = (n) => Array(n).fill('');

const wb = XLSX.utils.book_new();

// ─── Sheet 1: Annual KPIs ────────────────────────────────────
const annualData = [
  ['KAM Dashboard - Annual KPIs', '', ''],
  ['', '', ''],
  ['Metric', `Target ${fyLabel}`, 'Achievement Till Date'],
  ['ARR INR Cr',        baseAnnualKPIs.arr.target,        isBaseFY ? baseAnnualKPIs.arr.ach        : ''],
  ['Service Rev INR Cr', baseAnnualKPIs.serviceRev.target, isBaseFY ? baseAnnualKPIs.serviceRev.ach : ''],
  ['NDR',               baseAnnualKPIs.ndr.target,        isBaseFY ? baseAnnualKPIs.ndr.ach        : ''],
  ['GDR',               baseAnnualKPIs.gdr.target,        isBaseFY ? baseAnnualKPIs.gdr.ach        : ''],
  ['NPS Score',         baseAnnualKPIs.nps.target,        isBaseFY ? baseAnnualKPIs.nps.ach        : ''],
];
const ws1 = XLSX.utils.aoa_to_sheet(annualData);
ws1['!cols'] = [{ wch: 22 }, { wch: 18 }, { wch: 22 }];
ws1['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];
XLSX.utils.book_append_sheet(wb, ws1, 'Annual KPIs');

// ─── Sheet 2: Monthly Billing ────────────────────────────────
const billingTargets = Array(12).fill(25);
const billingAchievements = isBaseFY ? baseBillingAchievements : emptyArr(12);

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

// ─── Sheet 3: Monthly Collection ─────────────────────────────
const collectionTargets = Array(12).fill(30);
const collectionAchievements = isBaseFY ? baseCollectionAchievements : emptyArr(12);

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

// ─── Sheet 4: Quarterly QBRs ─────────────────────────────────
const qbrTargets = Array(4).fill(25);
const qbrAchievements = isBaseFY ? baseQbrAchievements : emptyArr(4);

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

// ─── Sheet 5: Hero Stories ───────────────────────────────────
const heroTargets = Array(4).fill(25);
const heroAchievements = isBaseFY ? baseHeroAchievements : emptyArr(4);

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

// ─── Sheet 6: Quarterly ARR & Service Revenue ──────────────
const arrTargets = Array(4).fill(14.35);
const srvTargets = Array(4).fill(32.75);
const arrAchievements = isBaseFY ? baseQuarterlyArrAch : emptyArr(4);
const srvAchievements = isBaseFY ? baseQuarterlySrvAch : emptyArr(4);

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

// ─── Sheet 7: Account Owner Performance ─────────────────────
const ownerRows = isBaseFY
  ? baseOwnerData
  : baseOwnerData.map(row => [row[0], '', '', '']);  // keep names, blank achievements

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

// ─── Sheet 8: OKR Weightages ────────────────────────────────
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
];
const ws8 = XLSX.utils.aoa_to_sheet(weightageData);
ws8['!cols'] = [{ wch: 18 }, { wch: 22 }, { wch: 14 }];
ws8['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];
XLSX.utils.book_append_sheet(wb, ws8, 'Weightages');

// ─── Sheet 9: Instructions ──────────────────────────────────
const instructionData = [
  ['KAM Dashboard - Input File Instructions'],
  [''],
  [`Generated for: ${fyLabel}`],
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
  ['GENERATING A NEW FY TEMPLATE:'],
  ['  node generate-template.cjs FY27   (generates KAM_Dashboard_FY27.xlsx with empty achievements)'],
  ['  node generate-template.cjs FY28   (generates KAM_Dashboard_FY28.xlsx with empty achievements)'],
  ['  node generate-template.cjs        (defaults to FY26 with sample data)'],
];
const ws9 = XLSX.utils.aoa_to_sheet(instructionData);
ws9['!cols'] = [{ wch: 100 }];
XLSX.utils.book_append_sheet(wb, ws9, 'Instructions');

// ─── Write the file ──────────────────────────────────────────
const outputFile = `KAM_Dashboard_${fyLabel}.xlsx`;
const outputPath = path.join(__dirname, outputFile);
XLSX.writeFile(wb, outputPath);

console.log(`Template Excel file created for ${fyLabel}:`);
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
