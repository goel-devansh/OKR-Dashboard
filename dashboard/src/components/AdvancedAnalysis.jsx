import React from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ZAxis
} from 'recharts';
import { useKamDataContext } from '../data/KamDataContext';
import {
  linearRegression, pearsonCorrelation, predictYearEnd,
  getAchievementColor, formatCrore
} from '../utils/helpers';

const AdvancedAnalysis = () => {
  const { monthlyBilling, monthlyCollection, billingTotals, collectionTotals } = useKamDataContext();

  // Filter months with actual data
  const billingActual = monthlyBilling.filter(d => d.achievement !== null);
  const collectionActual = monthlyCollection.filter(d => d.achievement !== null);

  // Average achievement rates
  const avgBillingRate = billingActual.reduce((s, d) => s + d.percentage, 0) / billingActual.length;
  const avgCollectionRate = collectionActual.reduce((s, d) => s + d.percentage, 0) / collectionActual.length;

  // Best & Worst months
  const bestBillingMonth = billingActual.reduce((best, d) => d.percentage > best.percentage ? d : best, billingActual[0]);
  const worstBillingMonth = billingActual.reduce((worst, d) => d.percentage < worst.percentage ? d : worst, billingActual[0]);
  const bestCollectionMonth = collectionActual.reduce((best, d) => d.percentage > best.percentage ? d : best, collectionActual[0]);
  const worstCollectionMonth = collectionActual.reduce((worst, d) => d.percentage < worst.percentage ? d : worst, collectionActual[0]);

  // Trend analysis
  const billingTrend = linearRegression(billingActual.map(d => d.achievement));
  const collectionTrend = linearRegression(collectionActual.map(d => d.achievement));

  const billingTrendDir = billingTrend.slope > 0 ? 'Improving' : billingTrend.slope < -0.5 ? 'Declining' : 'Stable';
  const collectionTrendDir = collectionTrend.slope > 0 ? 'Improving' : collectionTrend.slope < -0.5 ? 'Declining' : 'Stable';

  // Predictions
  const predictedBilling = predictYearEnd(monthlyBilling);
  const predictedCollection = predictYearEnd(monthlyCollection);

  // Correlation
  const billingValues = billingActual.map(d => d.achievement);
  const collectionValues = collectionActual.slice(0, billingValues.length).map(d => d.achievement);
  const correlation = pearsonCorrelation(billingValues, collectionValues);

  // Scatter data for correlation chart
  const scatterData = billingActual.map((b, i) => {
    const c = collectionActual[i];
    return c ? { billing: b.achievement, collection: c.achievement, month: b.month } : null;
  }).filter(Boolean);

  // Variance analysis
  const totalBillingVariance = billingTotals.totalAchievement - billingTotals.totalTarget;
  const totalCollectionVariance = collectionTotals.totalAchievement - collectionTotals.totalTarget;

  const monthlyVariances = billingActual.map((b, i) => ({
    month: b.month,
    billingVar: b.achievement - b.target,
    collectionVar: collectionActual[i] ? collectionActual[i].achievement - collectionActual[i].target : 0,
  }));

  return (
    <div className="analysis-section">
      <div className="section-header">
        <h2>🔍 Advanced Analysis & Insights</h2>
        <p>Statistical analysis, trend predictions, and correlation insights</p>
      </div>

      <div className="analysis-grid">
        {/* Performance Summary */}
        <div className="analysis-card">
          <h4>📊 Achievement Summary</h4>
          <div className="analysis-metrics">
            <div className="analysis-row">
              <span>Avg Billing Achievement</span>
              <span style={{ color: getAchievementColor(avgBillingRate), fontWeight: 700 }}>
                {(avgBillingRate * 100).toFixed(1)}%
              </span>
            </div>
            <div className="analysis-row">
              <span>Avg Collection Achievement</span>
              <span style={{ color: getAchievementColor(avgCollectionRate), fontWeight: 700 }}>
                {(avgCollectionRate * 100).toFixed(1)}%
              </span>
            </div>
            <div className="analysis-divider" />
            <div className="analysis-row">
              <span>Best Billing Month</span>
              <span className="best-badge">{bestBillingMonth.month} ({(bestBillingMonth.percentage * 100).toFixed(0)}%)</span>
            </div>
            <div className="analysis-row">
              <span>Worst Billing Month</span>
              <span className="worst-badge">{worstBillingMonth.month} ({(worstBillingMonth.percentage * 100).toFixed(0)}%)</span>
            </div>
            <div className="analysis-row">
              <span>Best Collection Month</span>
              <span className="best-badge">{bestCollectionMonth.month} ({(bestCollectionMonth.percentage * 100).toFixed(0)}%)</span>
            </div>
            <div className="analysis-row">
              <span>Worst Collection Month</span>
              <span className="worst-badge">{worstCollectionMonth.month} ({(worstCollectionMonth.percentage * 100).toFixed(0)}%)</span>
            </div>
          </div>
        </div>

        {/* Trend & Prediction */}
        <div className="analysis-card">
          <h4>🔮 Trend & Year-End Prediction</h4>
          <div className="analysis-metrics">
            <div className="analysis-row">
              <span>Billing Trend</span>
              <span className={`trend-badge ${billingTrendDir.toLowerCase()}`}>
                {billingTrendDir === 'Improving' ? '📈' : billingTrendDir === 'Declining' ? '📉' : '➡️'} {billingTrendDir}
              </span>
            </div>
            <div className="analysis-row">
              <span>Collection Trend</span>
              <span className={`trend-badge ${collectionTrendDir.toLowerCase()}`}>
                {collectionTrendDir === 'Improving' ? '📈' : collectionTrendDir === 'Declining' ? '📉' : '➡️'} {collectionTrendDir}
              </span>
            </div>
            <div className="analysis-divider" />
            <div className="analysis-row">
              <span>Predicted Year-End Billing</span>
              <span style={{ fontWeight: 700, color: predictedBilling >= 300 ? '#10b981' : '#ef4444' }}>
                {formatCrore(predictedBilling)} <small>(Target: ₹300 Cr)</small>
              </span>
            </div>
            <div className="analysis-row">
              <span>Predicted Year-End Collection</span>
              <span style={{ fontWeight: 700, color: predictedCollection >= 360 ? '#10b981' : '#ef4444' }}>
                {formatCrore(predictedCollection)} <small>(Target: ₹360 Cr)</small>
              </span>
            </div>
            <div className="analysis-divider" />
            <div className="analysis-row">
              <span>Billing Gap to Target</span>
              <span style={{ color: totalBillingVariance >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                {totalBillingVariance >= 0 ? '+' : ''}{formatCrore(totalBillingVariance)}
              </span>
            </div>
            <div className="analysis-row">
              <span>Collection Gap to Target</span>
              <span style={{ color: totalCollectionVariance >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                {totalCollectionVariance >= 0 ? '+' : ''}{formatCrore(totalCollectionVariance)}
              </span>
            </div>
          </div>
        </div>

        {/* Correlation */}
        <div className="analysis-card correlation-card">
          <h4>🔗 Billing vs Collection Correlation</h4>
          <div className="correlation-value">
            <span className="corr-number">{correlation.toFixed(3)}</span>
            <span className="corr-label">
              {Math.abs(correlation) > 0.7 ? 'Strong' : Math.abs(correlation) > 0.4 ? 'Moderate' : 'Weak'}
              {correlation > 0 ? ' Positive' : ' Negative'} Correlation
            </span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="billing" name="Billing" type="number" tick={{ fontSize: 11, fill: '#6b7280' }} label={{ value: 'Billing (Cr)', position: 'bottom', fontSize: 11 }} />
              <YAxis dataKey="collection" name="Collection" type="number" tick={{ fontSize: 11, fill: '#6b7280' }} label={{ value: 'Collection (Cr)', angle: -90, position: 'insideLeft', fontSize: 11 }} />
              <ZAxis range={[80, 80]} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0]?.payload;
                  return (
                    <div className="chart-tooltip">
                      <h4>{d.month}</h4>
                      <div className="tooltip-row">Billing: ₹{d.billing} Cr</div>
                      <div className="tooltip-row">Collection: ₹{d.collection} Cr</div>
                    </div>
                  );
                }}
              />
              <Scatter data={scatterData} fill="#6366f1" strokeWidth={1} stroke="#4f46e5" />
            </ScatterChart>
          </ResponsiveContainer>
          <p className="correlation-insight">
            {Math.abs(correlation) > 0.5
              ? 'Billing and collection performance show a meaningful relationship — months with higher billing tend to have higher collections.'
              : 'Billing and collection performance show limited direct correlation — other factors may influence collection timing.'}
          </p>
        </div>
      </div>

      {/* Variance Table */}
      <div className="chart-card">
        <div className="chart-header">
          <div>
            <h3>📋 Monthly Variance Analysis</h3>
            <p className="chart-subtitle">Gap between target and actual achievement by month</p>
          </div>
        </div>
        <div className="variance-table-wrapper">
          <table className="variance-table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Billing Variance (Cr)</th>
                <th>Collection Variance (Cr)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {monthlyVariances.map(v => (
                <tr key={v.month}>
                  <td>{v.month}</td>
                  <td style={{ color: v.billingVar >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                    {v.billingVar >= 0 ? '+' : ''}{v.billingVar.toFixed(1)}
                  </td>
                  <td style={{ color: v.collectionVar >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                    {v.collectionVar >= 0 ? '+' : ''}{v.collectionVar.toFixed(1)}
                  </td>
                  <td>
                    <span
                      className="status-pill"
                      style={{
                        backgroundColor: v.billingVar >= 0 && v.collectionVar >= 0 ? '#d1fae5' : v.billingVar >= -5 && v.collectionVar >= -5 ? '#fef3c7' : '#fee2e2',
                        color: v.billingVar >= 0 && v.collectionVar >= 0 ? '#065f46' : v.billingVar >= -5 && v.collectionVar >= -5 ? '#92400e' : '#991b1b',
                      }}
                    >
                      {v.billingVar >= 0 && v.collectionVar >= 0 ? '✅ On Track' : v.billingVar >= -5 && v.collectionVar >= -5 ? '⚠️ At Risk' : '🔴 Behind'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Key Insights */}
      <div className="insights-card">
        <h4>💡 Key Takeaways</h4>
        <div className="insights-grid">
          <div className="insight-item">
            <span className="insight-icon">📊</span>
            <div>
              <strong>YTD Billing at {(billingTotals.achievementPercentage * 100).toFixed(0)}%</strong>
              <p>Achieved ₹{Number(billingTotals.totalAchievement).toFixed(1)} Cr out of ₹{Number(billingTotals.totalTarget).toFixed(1)} Cr target. Need ₹{(billingTotals.totalTarget - billingTotals.totalAchievement).toFixed(1)} Cr more in remaining months.</p>
            </div>
          </div>
          <div className="insight-item">
            <span className="insight-icon">💰</span>
            <div>
              <strong>Collection outperforms billing consistently</strong>
              <p>Collection rate ({(avgCollectionRate * 100).toFixed(0)}%) averages higher than billing rate ({(avgBillingRate * 100).toFixed(0)}%), indicating strong recovery post-billing.</p>
            </div>
          </div>
          <div className="insight-item">
            <span className="insight-icon">⚠️</span>
            <div>
              <strong>ARR achievement needs acceleration</strong>
              <p>Only ₹19.03 Cr achieved against ₹57.4 Cr target (33.2%). H2 pipeline of ₹23.98 Cr provides partial coverage.</p>
            </div>
          </div>
          <div className="insight-item">
            <span className="insight-icon">📉</span>
            <div>
              <strong>NPS Score requires urgent attention</strong>
              <p>Current NPS at -11 vs target of 30. This 41-point gap represents the largest deviation across all KPIs.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdvancedAnalysis;
