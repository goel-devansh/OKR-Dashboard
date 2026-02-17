// ============================================================
// KAM (Key Account Management) OKR Dashboard Data
// Extracted from Excel: AE Dashboard - KAM 13.02.26
// ============================================================

// Annual KPI Metrics
// ARR and Service Rev are computed from quarterly breakdowns below
export const annualMetrics = {
  arr: { label: 'ARR INR Cr', targetFY26: 14.35*4, achievementTillDate: 5.2+6.8+4.53+2.5, unit: 'Cr' },
  serviceRev: { label: 'Service Rev INR Cr', targetFY26: 32.75*4, achievementTillDate: 30.5+31.2+35.8+23.5, unit: 'Cr' },
  ndr: { label: 'NDR', targetFY26: 1.20, achievementTillDate: 1.15, unit: 'x' },
  gdr: { label: 'GDR', targetFY26: 0.95, achievementTillDate: 0.88, unit: 'x' },
  nps: { label: 'NPS Score', targetFY26: 30, achievementTillDate: -11, unit: '' },
};

// Monthly On-time Billing Data (INR Cr)
export const monthlyBilling = [
  { month: "Apr'26", target: 25, achievement: 23, percentage: 0.92 },
  { month: "May'26", target: 25, achievement: 30, percentage: 1.20 },
  { month: "Jun'26", target: 25, achievement: 11, percentage: 0.44 },
  { month: "Jul'26", target: 25, achievement: 33, percentage: 1.32 },
  { month: "Aug'26", target: 25, achievement: 41, percentage: 1.64 },
  { month: "Sep'26", target: 25, achievement: 11, percentage: 0.44 },
  { month: "Oct'26", target: 25, achievement: 3, percentage: 0.12 },
  { month: "Nov'26", target: 25, achievement: 1, percentage: 0.04 },
  { month: "Dec'26", target: 25, achievement: 1, percentage: 0.04 },
  { month: "Jan'27", target: 25, achievement: 33, percentage: 1.32 },
  { month: "Feb'27", target: 25, achievement: null, percentage: null },
  { month: "Mar'27", target: 25, achievement: null, percentage: null },
];

// Monthly On-time Collection Data (INR Cr)
export const monthlyCollection = [
  { month: "Apr'26", target: 30, achievement: 32, percentage: 1.07 },
  { month: "May'26", target: 30, achievement: 12, percentage: 0.40 },
  { month: "Jun'26", target: 30, achievement: 32, percentage: 1.07 },
  { month: "Jul'26", target: 30, achievement: 12, percentage: 0.40 },
  { month: "Aug'26", target: 30, achievement: 22, percentage: 0.73 },
  { month: "Sep'26", target: 30, achievement: 22, percentage: 0.73 },
  { month: "Oct'26", target: 30, achievement: 23, percentage: 0.77 },
  { month: "Nov'26", target: 30, achievement: 44, percentage: 1.47 },
  { month: "Dec'26", target: 30, achievement: 30, percentage: 1.00 },
  { month: "Jan'27", target: 30, achievement: 32, percentage: 1.07 },
  { month: "Feb'27", target: 30, achievement: null, percentage: null },
  { month: "Mar'27", target: 30, achievement: null, percentage: null },
];

// Quarterly QBRs Held
export const quarterlyQBRs = [
  { quarter: 'Q1 FY26', target: 25, achievement: 22, percentage: 0.88 },
  { quarter: 'Q2 FY26', target: 25, achievement: 21, percentage: 0.84 },
  { quarter: 'Q3 FY26', target: 25, achievement: 20, percentage: 0.80 },
  { quarter: 'Q4 FY26', target: 25, achievement: 15, percentage: 0.60 },
];

// Quarterly Hero Stories
export const quarterlyHeroStories = [
  { quarter: 'Q1 FY26', target: 25, achievement: 22, percentage: 0.88 },
  { quarter: 'Q2 FY26', target: 25, achievement: 21, percentage: 0.84 },
  { quarter: 'Q3 FY26', target: 25, achievement: 20, percentage: 0.80 },
  { quarter: 'Q4 FY26', target: 25, achievement: 15, percentage: 0.60 },
];

// Quarterly ARR (INR Cr)
export const quarterlyARR = [
  { quarter: 'Q1 FY26', target: 14.35, achievement: 5.2, percentage: 5.2/14.35 },
  { quarter: 'Q2 FY26', target: 14.35, achievement: 6.8, percentage: 6.8/14.35 },
  { quarter: 'Q3 FY26', target: 14.35, achievement: 4.53, percentage: 4.53/14.35 },
  { quarter: 'Q4 FY26', target: 14.35, achievement: 2.5, percentage: 2.5/14.35 },
];

// Quarterly Service Revenue (INR Cr)
export const quarterlyServiceRev = [
  { quarter: 'Q1 FY26', target: 32.75, achievement: 30.5, percentage: 30.5/32.75 },
  { quarter: 'Q2 FY26', target: 32.75, achievement: 31.2, percentage: 31.2/32.75 },
  { quarter: 'Q3 FY26', target: 32.75, achievement: 35.8, percentage: 35.8/32.75 },
  { quarter: 'Q4 FY26', target: 32.75, achievement: 23.5, percentage: 23.5/32.75 },
];

// Account Owner Performance (YTD)
export const accountOwnerPerformance = [
  { name: 'Ansu Jain', arrAchievement: 0.78, billing: 15.68, collection: 15.82 },
  { name: 'Apoorv Anand', arrAchievement: 2.09, billing: 17.67, collection: 20.75 },
  { name: 'Bhavik Solani', arrAchievement: 0.70, billing: 48.31, collection: 50.37 },
  { name: 'Bhavna Sharma', arrAchievement: 0, billing: 22.27, collection: 27.64 },
  { name: 'Neel Neogi', arrAchievement: -0.85, billing: 2.92, collection: 3.45 },
  { name: 'Rajeswari Das', arrAchievement: -0.40, billing: 0, collection: 0 },
  { name: 'Rushi', arrAchievement: 1.20, billing: 13.37, collection: 16.02 },
  { name: 'Sachin Gupta', arrAchievement: -2.42, billing: 0.36, collection: 1.84 },
  { name: 'Samprus Mascaren', arrAchievement: -1.60, billing: 13.54, collection: 15.75 },
  { name: 'Vishwanath Gurav', arrAchievement: 19.53, billing: 65.99, collection: 77.98 },
];

// Billing & Collection totals
export const billingTotals = {
  totalTarget: 300,
  totalAchievement: 187,
  achievementPercentage: 187 / 300,
};

export const collectionTotals = {
  totalTarget: 360,
  totalAchievement: 261,
  achievementPercentage: 261 / 360,
};

// Pipeline Coverage (Open Pipeline / Remaining ARR Target)
export const pipelineCoverage = {
  openPipeline: 150,
  remainingTarget: 38.37,
  coverage: 3.91,
};

// Default OKR Weightages (editable from Excel)
export const defaultWeightages = {
  arr: { label: 'ARR', weight: 25 },
  serviceRev: { label: 'Service Revenue', weight: 20 },
  ndr: { label: 'NDR', weight: 10 },
  gdr: { label: 'GDR', weight: 10 },
  nps: { label: 'NPS Score', weight: 5 },
  billing: { label: 'On-time Billing', weight: 15 },
  collection: { label: 'On-time Collection', weight: 10 },
  qbr: { label: 'QBRs Held', weight: 3 },
  heroStories: { label: 'Hero Stories', weight: 2 },
  pipelineCoverage: { label: 'Pipeline Coverage', weight: 0 },
};
