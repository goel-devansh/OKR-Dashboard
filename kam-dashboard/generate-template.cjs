// ============================================================
// Generates the KAM Dashboard Input Excel Template
// Run: node generate-template.js
// ============================================================
const XLSX = require('xlsx');
const path = require('path');

const wb = XLSX.utils.book_new();

// ─── Sheet 1: Annual KPIs ────────────────────────────────────
const annualData = [
  ['KAM Dashboard - Annual KPIs', '', ''],
  ['', '', ''],
  ['Metric', 'Target FY26', 'Achievement Till Date'],
  ['ARR INR Cr', 57.4, 19.03],
  ['Service Rev INR Cr', 131, 121],
  ['NDR', 1.20, 1.15],
  ['GDR', 0.95, 0.88],
  ['NPS Score', 30, -11],
];
const ws1 = XLSX.utils.aoa_to_sheet(annualData);
ws1['!cols'] = [{ wch: 22 }, { wch: 18 }, { wch: 22 }];
// Merge title row
ws1['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];
XLSX.utils.book_append_sheet(wb, ws1, 'Annual KPIs');

// ─── Sheet 2: Monthly Billing ────────────────────────────────
const billingData = [
  ['On-Time Billing (INR Cr)', '', ''],
  ['', '', ''],
  ['Month', 'Target INR Cr', 'Achievement INR Cr'],
  ["Apr'26", 25, 23],
  ["May'26", 25, 30],
  ["Jun'26", 25, 11],
  ["Jul'26", 25, 33],
  ["Aug'26", 25, 41],
  ["Sep'26", 25, 11],
  ["Oct'26", 25, 3],
  ["Nov'26", 25, 1],
  ["Dec'26", 25, 1],
  ["Jan'27", 25, 33],
  ["Feb'27", 25, ''],
  ["Mar'27", 25, ''],
];
const ws2 = XLSX.utils.aoa_to_sheet(billingData);
ws2['!cols'] = [{ wch: 12 }, { wch: 18 }, { wch: 22 }];
ws2['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];
XLSX.utils.book_append_sheet(wb, ws2, 'Monthly Billing');

// ─── Sheet 3: Monthly Collection ─────────────────────────────
const collectionData = [
  ['On-Time Collection (INR Cr)', '', ''],
  ['', '', ''],
  ['Month', 'Target INR Cr', 'Achievement INR Cr'],
  ["Apr'26", 30, 32],
  ["May'26", 30, 12],
  ["Jun'26", 30, 32],
  ["Jul'26", 30, 12],
  ["Aug'26", 30, 22],
  ["Sep'26", 30, 22],
  ["Oct'26", 30, 23],
  ["Nov'26", 30, 44],
  ["Dec'26", 30, 30],
  ["Jan'27", 30, 32],
  ["Feb'27", 30, ''],
  ["Mar'27", 30, ''],
];
const ws3 = XLSX.utils.aoa_to_sheet(collectionData);
ws3['!cols'] = [{ wch: 12 }, { wch: 18 }, { wch: 22 }];
ws3['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];
XLSX.utils.book_append_sheet(wb, ws3, 'Monthly Collection');

// ─── Sheet 4: Quarterly QBRs ─────────────────────────────────
const qbrData = [
  ['QBRs Held', '', ''],
  ['', '', ''],
  ['Quarter', 'Target', 'Achievement'],
  ['Q1 FY26', 25, 22],
  ['Q2 FY26', 25, 21],
  ['Q3 FY26', 25, 20],
  ['Q4 FY26', 25, 15],
];
const ws4 = XLSX.utils.aoa_to_sheet(qbrData);
ws4['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 14 }];
ws4['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];
XLSX.utils.book_append_sheet(wb, ws4, 'Quarterly QBRs');

// ─── Sheet 5: Hero Stories ───────────────────────────────────
const heroData = [
  ['Hero Stories', '', ''],
  ['', '', ''],
  ['Quarter', 'Target', 'Achievement'],
  ['Q1 FY26', 25, 22],
  ['Q2 FY26', 25, 21],
  ['Q3 FY26', 25, 20],
  ['Q4 FY26', 25, 15],
];
const ws5 = XLSX.utils.aoa_to_sheet(heroData);
ws5['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 14 }];
ws5['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];
XLSX.utils.book_append_sheet(wb, ws5, 'Hero Stories');

// ─── Sheet 6: Account Owner Performance ─────────────────────
const ownerData = [
  ['Account Owner Performance (YTD)', '', '', ''],
  ['', '', '', ''],
  ['Account Owner', 'ARR Achievement (Cr)', 'Billing (Cr)', 'Collection (Cr)'],
  ['Ansu Jain', 0.78, 15.68, 15.82],
  ['Apoorv Anand', 2.09, 17.67, 20.75],
  ['Bhavik Solani', 0.70, 48.31, 50.37],
  ['Bhavna Sharma', 0, 22.27, 27.64],
  ['Neel Neogi', -0.85, 2.92, 3.45],
  ['Rajeswari Das', -0.40, 0, 0],
  ['Rushi', 1.20, 13.37, 16.02],
  ['Sachin Gupta', -2.42, 0.36, 1.84],
  ['Samprus Mascaren', -1.60, 13.54, 15.75],
  ['Vishwanath Gurav', 19.53, 65.99, 77.98],
];
const ws6 = XLSX.utils.aoa_to_sheet(ownerData);
ws6['!cols'] = [{ wch: 22 }, { wch: 22 }, { wch: 16 }, { wch: 18 }];
ws6['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];
XLSX.utils.book_append_sheet(wb, ws6, 'Account Owners');

// ─── Sheet 7: Instructions ──────────────────────────────────
const instructionData = [
  ['KAM Dashboard - Input File Instructions'],
  [''],
  ['HOW TO UPDATE THE DASHBOARD:'],
  ['1. Edit the data in any of the sheets (Annual KPIs, Monthly Billing, Monthly Collection, Quarterly QBRs, Hero Stories, Account Owners)'],
  ['2. Save this Excel file'],
  ['3. The dashboard will automatically refresh within a few seconds!'],
  [''],
  ['IMPORTANT RULES:'],
  ['- Do NOT rename the sheets'],
  ['- Do NOT change the column headers (Row 3 in each sheet)'],
  ['- Keep the same row structure (months, quarters, etc.)'],
  ['- Leave cells EMPTY (not zero) for months with no data yet'],
  ['- The backend server must be running (node server.js)'],
  [''],
  ['SHEET DESCRIPTIONS:'],
  ['  Annual KPIs      → ARR, Service Revenue, NDR, GDR, NPS Score'],
  ['  Monthly Billing   → On-time billing target vs achievement (Apr-Mar)'],
  ['  Monthly Collection→ On-time collection target vs achievement (Apr-Mar)'],
  ['  Quarterly QBRs    → QBRs held per quarter (Q1-Q4)'],
  ['  Hero Stories      → Hero stories delivered per quarter (Q1-Q4)'],
  ['  Account Owners    → Per-account-owner YTD performance'],
];
const ws7 = XLSX.utils.aoa_to_sheet(instructionData);
ws7['!cols'] = [{ wch: 80 }];
XLSX.utils.book_append_sheet(wb, ws7, 'Instructions');

// ─── Write the file ──────────────────────────────────────────
const outputPath = path.join(__dirname, 'KAM_Dashboard_Input.xlsx');
XLSX.writeFile(wb, outputPath);
console.log(`✅ Template Excel file created at:\n   ${outputPath}`);
console.log('\n📋 Sheets created:');
console.log('   1. Annual KPIs');
console.log('   2. Monthly Billing');
console.log('   3. Monthly Collection');
console.log('   4. Quarterly QBRs');
console.log('   5. Hero Stories');
console.log('   6. Account Owners');
console.log('   7. Instructions');
