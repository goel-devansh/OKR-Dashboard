const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

// Read the KAM OKR file
const files = [
  path.join(__dirname, '..', 'AE Dashboard - KAM 13.02.26_2.xlsx'),
  path.join(__dirname, '..', 'FY26 KAM Target.xlsx'),
  path.join(__dirname, '..', 'KAM OKR.xlsx'),
];

// Also check desktop
const desktopPath = path.join(__dirname, '..', '..');
const desktopFiles = [
  path.join(desktopPath, 'KAM OKR.xlsx'),
  path.join(desktopPath, 'ARR NRR File.xlsx'),
];

const allFiles = [...files, ...desktopFiles];

allFiles.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`FILE: ${path.basename(filePath)}`);
    console.log('='.repeat(80));

    const workbook = XLSX.readFile(filePath);

    workbook.SheetNames.forEach(sheetName => {
      console.log(`\n--- Sheet: ${sheetName} ---`);
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      // Print all rows
      data.forEach((row, idx) => {
        const nonEmpty = row.filter(cell => cell !== '');
        if (nonEmpty.length > 0) {
          console.log(`Row ${idx}: ${JSON.stringify(row)}`);
        }
      });
    });
  }
});
