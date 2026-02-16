// ============================================================
// KAM (Key Account Management) OKR Dashboard Data
// Extracted from Excel: AE Dashboard - KAM 13.02.26
// ============================================================

// Annual KPI Metrics
export const annualMetrics = {
  arr: { label: 'ARR INR Cr', targetFY26: 57.4, achievementTillDate: 19.03, unit: 'Cr' },
  serviceRev: { label: 'Service Rev INR Cr', targetFY26: 131, achievementTillDate: 121, unit: 'Cr' },
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

// ARR Summary by Quarter
export const arrQuarterly = {
  q1: { target: 9.3, booked: 0.03, openPipe: 0.98, achievement: 0.003 },
  q2: { target: 13.95, booked: 19.83, openPipe: 1.0, achievement: 1.42 },
  q3: { target: 11.625, booked: -0.71, openPipe: 7.38, achievement: -0.06 },
  q4: { target: 11.625, booked: 0, openPipe: 23.98, achievement: 0 },
  fy26: { target: 46.5, booked: 19.16, openPipe: 33.34, achievement: 0.41 },
};

// Top Pipeline Opportunities
export const topOpportunities = [
  { name: 'RBI Gold 8 Upgrade', account: 'Reserve Bank of India', owner: 'Vishwanath Gurav', arr: 5.0 },
  { name: 'Upgrade + AI - TP Bank', account: 'Tien Phong Commercial JSB', owner: 'Ansu Jain', arr: 3.28 },
  { name: 'Corporate Banking - TP Bank', account: 'Tien Phong Commercial JSB', owner: 'Ansu Jain', arr: 2.05 },
  { name: 'WBS Corporate CRMNEXT', account: 'Security Bank Corp', owner: 'Bhavna Sharma', arr: 2.0 },
  { name: 'HDFC Corporate CRM', account: 'HDFC Bank Limited', owner: 'Bhavik Solani', arr: 1.6 },
  { name: 'QIB Cloud Native CRM', account: 'Qatar Islamic Bank', owner: 'Apoorv Anand', arr: 1.5 },
];

// Booked ARR Details
export const bookedARR = [
  { account: 'SBI Life', amount: 19.5 },
  { account: 'Bank Dhofar', amount: 2.1 },
  { account: 'Bank Danamon', amount: 0.13 },
  { account: 'IIAB', amount: 0.6 },
  { account: 'RBL', amount: 0.8 },
  { account: 'HDFC Bank', amount: 0.2 },
  { account: 'Ujjivan', amount: 0.12 },
];

// Contraction & Churn
export const contractionChurn = [
  { account: 'Adira', amount: -2.4 },
  { account: 'TU Cibil', amount: -0.85 },
  { account: 'Nippon', amount: -0.4 },
  { account: 'KLI', amount: -0.2 },
  { account: 'BDO Unibank', amount: -1.4 },
  { account: 'IDFC', amount: -1.2 },
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
