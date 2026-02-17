// ============================================================
// Utility functions for KAM Dashboard
// ============================================================

/**
 * Format number as INR Crore
 */
export const formatCrore = (value, decimals = 1) => {
  if (value === null || value === undefined) return '—';
  return `₹${Number(value).toFixed(decimals)} Cr`;
};

/**
 * Format as percentage
 */
export const formatPercent = (value, decimals = 0) => {
  if (value === null || value === undefined) return '—';
  return `${(Number(value) * 100).toFixed(decimals)}%`;
};

/**
 * Get achievement color based on percentage threshold
 * Green: >100%, Yellow: 80-100%, Red: <80%
 */
export const getAchievementColor = (percentage) => {
  if (percentage === null || percentage === undefined) return '#9ca3af';
  if (percentage >= 1.0) return '#10b981'; // green
  if (percentage >= 0.8) return '#f59e0b'; // yellow/amber
  return '#ef4444'; // red
};

/**
 * Get achievement background color (lighter variant)
 */
export const getAchievementBgColor = (percentage) => {
  if (percentage === null || percentage === undefined) return '#f3f4f6';
  if (percentage >= 1.0) return '#d1fae5';
  if (percentage >= 0.8) return '#fef3c7';
  return '#fee2e2';
};

/**
 * Get achievement status text
 */
export const getAchievementStatus = (percentage) => {
  if (percentage === null || percentage === undefined) return 'No Data';
  if (percentage >= 1.0) return 'On Track';
  if (percentage >= 0.8) return 'At Risk';
  return 'Behind';
};

/**
 * Calculate cumulative values from monthly data
 */
export const calculateCumulative = (data, key) => {
  let cumulative = 0;
  return data.map(item => {
    if (item[key] !== null && item[key] !== undefined) {
      cumulative += item[key];
    }
    return { ...item, [`cumulative_${key}`]: cumulative };
  });
};

/**
 * Calculate linear regression for trend prediction
 */
export const linearRegression = (data) => {
  const n = data.length;
  if (n === 0) return { slope: 0, intercept: 0 };

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  data.forEach((y, x) => {
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  });

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  return { slope, intercept };
};

/**
 * Calculate Pearson correlation coefficient
 */
export const pearsonCorrelation = (x, y) => {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
    sumXY += x[i] * y[i];
    sumX2 += x[i] * x[i];
    sumY2 += y[i] * y[i];
  }

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  if (denominator === 0) return 0;
  return numerator / denominator;
};

/**
 * Calculate moving average
 */
export const movingAverage = (data, windowSize = 3) => {
  const result = [];
  for (let i = 0; i < data.length; i++) {
    if (i < windowSize - 1) {
      result.push(null);
    } else {
      let sum = 0;
      for (let j = i - windowSize + 1; j <= i; j++) {
        sum += data[j];
      }
      result.push(sum / windowSize);
    }
  }
  return result;
};

/**
 * Predict year-end value based on current trajectory
 */
export const predictYearEnd = (monthlyData, totalMonths = 12) => {
  const achieved = monthlyData.filter(d => d.achievement !== null);
  if (achieved.length === 0) return 0;

  const totalAchieved = achieved.reduce((sum, d) => sum + d.achievement, 0);
  const avgPerMonth = totalAchieved / achieved.length;
  const remaining = totalMonths - achieved.length;

  return totalAchieved + (avgPerMonth * remaining);
};

/**
 * CSV export helper
 */
export const downloadCSV = (data, filename) => {
  if (!data || data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(h => {
      const val = row[h];
      if (typeof val === 'string' && val.includes(',')) return `"${val}"`;
      return val ?? '';
    }).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
};
