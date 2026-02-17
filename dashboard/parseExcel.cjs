// ============================================================
// Shared Excel Parsing Logic
// Used by: server.cjs (runtime) and generateStaticData.cjs (build-time)
// ============================================================
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

function parseNum(val) {
  if (val === '' || val === null || val === undefined) return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
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

function parseExcelData(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`Excel file not found at: ${filePath}`);
    return null;
  }

  try {
    // Read file into buffer first to avoid holding a file lock
    // This lets Excel / OneDrive save the file while the server is running
    const fileBuffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const data = {};

    // -- 1. Annual KPIs --
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

    // -- 2. Monthly Billing --
    const billingSheet = workbook.Sheets['Monthly Billing'];
    if (billingSheet) {
      data.monthlyBilling = parseMonthlySheet(billingSheet);
    }

    // -- 3. Monthly Collection --
    const collectionSheet = workbook.Sheets['Monthly Collection'];
    if (collectionSheet) {
      data.monthlyCollection = parseMonthlySheet(collectionSheet);
    }

    // -- 4. Quarterly QBRs --
    const qbrSheet = workbook.Sheets['Quarterly QBRs'];
    if (qbrSheet) {
      data.quarterlyQBRs = parseQuarterlySheet(qbrSheet);
    }

    // -- 5. Hero Stories --
    const heroSheet = workbook.Sheets['Hero Stories'];
    if (heroSheet) {
      data.quarterlyHeroStories = parseQuarterlySheet(heroSheet);
    }

    // -- 6. Quarterly ARR & Service Revenue --
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

    // -- 7. Account Owners --
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

    // -- 8. Weightages --
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

    // -- Compute totals --
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

    // -- Compute ARR & Service Rev from quarterly breakdown --
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

    // -- Compute Pipeline Coverage --
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
    if (err.code === 'EBUSY' || (err.message && err.message.includes('EBUSY'))) {
      console.error(`  File locked (Excel open?): ${path.basename(filePath)} -- will retry`);
    } else {
      console.error(`  Error parsing Excel (${path.basename(filePath)}):`, err.message);
    }
    return null;
  }
}

module.exports = { parseExcelData, parseMonthlySheet, parseQuarterlySheet, parseNum };
