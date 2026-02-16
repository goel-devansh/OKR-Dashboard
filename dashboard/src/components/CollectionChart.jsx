import React from 'react';
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine, Area
} from 'recharts';
import { useKamDataContext } from '../data/KamDataContext';
import { formatCrore, getAchievementColor, downloadCSV } from '../utils/helpers';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <div className="chart-tooltip">
      <h4>{label}</h4>
      <div className="tooltip-row">
        <span className="tooltip-dot" style={{ background: '#8b5cf6' }} />
        Target: {formatCrore(data.target)}
      </div>
      {data.achievement !== null && (
        <>
          <div className="tooltip-row">
            <span className="tooltip-dot" style={{ background: '#06b6d4' }} />
            Achievement: {formatCrore(data.achievement)}
          </div>
          <div className="tooltip-row">
            <span className="tooltip-dot" style={{ background: getAchievementColor(data.percentage) }} />
            Achievement %: {(data.percentage * 100).toFixed(0)}%
          </div>
          <div className="tooltip-row">
            Variance: {formatCrore(data.achievement - data.target)}
          </div>
        </>
      )}
    </div>
  );
};

const CollectionChart = ({ dateRange, onDrillDown }) => {
  const { monthlyCollection, collectionTotals } = useKamDataContext();

  const filteredData = monthlyCollection.slice(dateRange[0], dateRange[1] + 1).map(d => ({
    ...d,
    percentDisplay: d.percentage !== null ? Math.round(d.percentage * 100) : null,
    variance: d.achievement !== null ? d.achievement - d.target : null,
  }));

  const handleClick = (data) => {
    if (data && data.activePayload) {
      onDrillDown?.('collection', data.activePayload[0]?.payload);
    }
  };

  return (
    <div className="chart-card">
      <div className="chart-header">
        <div>
          <h3>💰 On-Time Collection (INR Cr)</h3>
          <p className="chart-subtitle">Monthly target vs achievement with % overlay</p>
        </div>
        <div className="chart-actions">
          <span className="ytd-badge">
            YTD: {formatCrore(collectionTotals.totalAchievement)} / {formatCrore(collectionTotals.totalTarget)}
            <span style={{ color: getAchievementColor(collectionTotals.achievementPercentage), marginLeft: 8 }}>
              ({(collectionTotals.achievementPercentage * 100).toFixed(1)}%)
            </span>
          </span>
          <button
            className="export-btn"
            onClick={() => downloadCSV(monthlyCollection, 'collection_data.csv')}
            title="Export CSV"
          >
            📥 CSV
          </button>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={350}>
        <ComposedChart data={filteredData} onClick={handleClick}>
          <defs>
            <linearGradient id="collectionGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6b7280' }} />
          <YAxis yAxisId="left" tick={{ fontSize: 12, fill: '#6b7280' }} label={{ value: 'INR Cr', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#9ca3af' } }} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: '#6b7280' }} domain={[0, 200]} label={{ value: 'Achievement %', angle: 90, position: 'insideRight', style: { fontSize: 12, fill: '#9ca3af' } }} />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <ReferenceLine yAxisId="left" y={30} stroke="#94a3b8" strokeDasharray="5 5" label={{ value: 'Target Line', position: 'right', fontSize: 10, fill: '#94a3b8' }} />
          <Area yAxisId="left" type="monotone" dataKey="achievement" fill="url(#collectionGrad)" stroke="none" name="Collection Area" />
          <Bar yAxisId="left" dataKey="target" fill="#8b5cf6" opacity={0.3} name="Target" radius={[4, 4, 0, 0]} barSize={30} />
          <Bar yAxisId="left" dataKey="achievement" fill="#06b6d4" name="Achievement" radius={[4, 4, 0, 0]} barSize={30} />
          <Line yAxisId="right" type="monotone" dataKey="percentDisplay" stroke="#f97316" strokeWidth={2.5} dot={{ r: 5, fill: '#f97316' }} activeDot={{ r: 7 }} name="Achievement %" connectNulls={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default CollectionChart;
