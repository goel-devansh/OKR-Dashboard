import React from 'react';
import { useKamDataContext } from '../data/KamDataContext';
import { formatCrore, formatPercent, getAchievementColor } from '../utils/helpers';

const kpiConfig = [
  {
    key: 'arr',
    title: 'Total ARR',
    icon: '💰',
    format: (v) => formatCrore(v),
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  },
  {
    key: 'serviceRev',
    title: 'Service Revenue',
    icon: '📊',
    format: (v) => formatCrore(v),
    gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  },
  {
    key: 'ndr',
    title: 'NDR',
    icon: '📈',
    format: (v) => `${v}x`,
    gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  },
  {
    key: 'gdr',
    title: 'GDR',
    icon: '🛡️',
    format: (v) => `${v}x`,
    gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  },
  {
    key: 'nps',
    title: 'NPS Score',
    icon: '⭐',
    format: (v) => v,
    gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  },
];

const KPICards = () => {
  const { annualMetrics } = useKamDataContext();

  return (
    <div className="kpi-grid">
      {kpiConfig.map(({ key, title, icon, format, gradient }) => {
        const metric = annualMetrics[key];
        if (!metric) return null;
        const achievementPct = metric.achievementTillDate / metric.targetFY26;
        const isPositive = metric.achievementTillDate >= 0;
        const color = getAchievementColor(achievementPct);

        return (
          <div key={key} className="kpi-card" style={{ '--card-gradient': gradient }}>
            <div className="kpi-header">
              <span className="kpi-icon">{icon}</span>
              <span className="kpi-title">{title}</span>
            </div>
            <div className="kpi-value">
              {format(metric.achievementTillDate)}
            </div>
            <div className="kpi-target">
              Target: {format(metric.targetFY26)}
            </div>
            <div className="kpi-progress-bar">
              <div
                className="kpi-progress-fill"
                style={{
                  width: `${Math.min(Math.max(achievementPct * 100, 0), 100)}%`,
                  backgroundColor: color,
                }}
              />
            </div>
            <div className="kpi-footer">
              <span
                className="kpi-achievement"
                style={{ color }}
              >
                {isPositive ? '▲' : '▼'} {(achievementPct * 100).toFixed(1)}% achieved
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default KPICards;
