import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';
import { useKamDataContext } from '../data/KamDataContext';
import { getAchievementColor, downloadCSV } from '../utils/helpers';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="chart-tooltip">
      <h4>{label}</h4>
      {payload.map((entry, i) => (
        <div key={i} className="tooltip-row">
          <span className="tooltip-dot" style={{ background: entry.color }} />
          {entry.name}: {entry.value}
        </div>
      ))}
    </div>
  );
};

const QuarterlyChart = () => {
  const { quarterlyQBRs, quarterlyHeroStories } = useKamDataContext();

  // Combine QBRs and Hero Stories into unified data
  const combinedData = quarterlyQBRs.map((qbr, i) => ({
    quarter: qbr.quarter,
    qbrTarget: qbr.target,
    qbrAchievement: qbr.achievement,
    qbrPct: qbr.percentage,
    heroTarget: quarterlyHeroStories[i].target,
    heroAchievement: quarterlyHeroStories[i].achievement,
    heroPct: quarterlyHeroStories[i].percentage,
  }));

  const qbrTotal = quarterlyQBRs.reduce((sum, q) => sum + q.achievement, 0);
  const qbrTargetTotal = quarterlyQBRs.reduce((sum, q) => sum + q.target, 0);
  const heroTotal = quarterlyHeroStories.reduce((sum, q) => sum + q.achievement, 0);
  const heroTargetTotal = quarterlyHeroStories.reduce((sum, q) => sum + q.target, 0);

  return (
    <div className="quarterly-section">
      {/* QBRs Held */}
      <div className="chart-card half-card">
        <div className="chart-header">
          <div>
            <h3>📝 QBRs Held</h3>
            <p className="chart-subtitle">Quarterly Business Reviews - Target vs Achievement</p>
          </div>
          <div className="chart-actions">
            <span className="ytd-badge">
              YTD: {qbrTotal}/{qbrTargetTotal}
              <span style={{ color: getAchievementColor(qbrTotal / qbrTargetTotal), marginLeft: 8 }}>
                ({((qbrTotal / qbrTargetTotal) * 100).toFixed(0)}%)
              </span>
            </span>
            <button
              className="export-btn"
              onClick={() => downloadCSV(quarterlyQBRs, 'qbr_data.csv')}
            >
              📥 CSV
            </button>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={combinedData} barGap={8}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="quarter" tick={{ fontSize: 12, fill: '#6b7280' }} />
            <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar dataKey="qbrTarget" name="Target" fill="#c7d2fe" radius={[4, 4, 0, 0]} barSize={35} />
            <Bar dataKey="qbrAchievement" name="Achievement" radius={[4, 4, 0, 0]} barSize={35}>
              {combinedData.map((entry, index) => (
                <Cell key={index} fill={getAchievementColor(entry.qbrPct)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {/* Per-quarter achievement badges */}
        <div className="quarter-badges">
          {quarterlyQBRs.map(q => (
            <div key={q.quarter} className="quarter-badge" style={{ backgroundColor: getAchievementColor(q.percentage) + '22', borderColor: getAchievementColor(q.percentage) }}>
              <span className="badge-quarter">{q.quarter}</span>
              <span className="badge-value" style={{ color: getAchievementColor(q.percentage) }}>{(q.percentage * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Hero Stories */}
      <div className="chart-card half-card">
        <div className="chart-header">
          <div>
            <h3>🌟 Hero Stories</h3>
            <p className="chart-subtitle">Success stories delivered per quarter</p>
          </div>
          <div className="chart-actions">
            <span className="ytd-badge">
              YTD: {heroTotal}/{heroTargetTotal}
              <span style={{ color: getAchievementColor(heroTotal / heroTargetTotal), marginLeft: 8 }}>
                ({((heroTotal / heroTargetTotal) * 100).toFixed(0)}%)
              </span>
            </span>
            <button
              className="export-btn"
              onClick={() => downloadCSV(quarterlyHeroStories, 'hero_stories_data.csv')}
            >
              📥 CSV
            </button>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={combinedData} barGap={8}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="quarter" tick={{ fontSize: 12, fill: '#6b7280' }} />
            <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar dataKey="heroTarget" name="Target" fill="#fde68a" radius={[4, 4, 0, 0]} barSize={35} />
            <Bar dataKey="heroAchievement" name="Achievement" radius={[4, 4, 0, 0]} barSize={35}>
              {combinedData.map((entry, index) => (
                <Cell key={index} fill={getAchievementColor(entry.heroPct)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="quarter-badges">
          {quarterlyHeroStories.map(q => (
            <div key={q.quarter} className="quarter-badge" style={{ backgroundColor: getAchievementColor(q.percentage) + '22', borderColor: getAchievementColor(q.percentage) }}>
              <span className="badge-quarter">{q.quarter}</span>
              <span className="badge-value" style={{ color: getAchievementColor(q.percentage) }}>{(q.percentage * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default QuarterlyChart;
