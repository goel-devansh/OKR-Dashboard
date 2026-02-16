import React from 'react';
import { useKamDataContext } from '../data/KamDataContext';
import { formatCrore, getAchievementColor } from '../utils/helpers';

const DrillDownModal = ({ type, data, onClose }) => {
  const { monthlyBilling, monthlyCollection } = useKamDataContext();

  if (!data) return null;

  const monthIndex = monthlyBilling.findIndex(d => d.month === data.month);
  const billing = monthlyBilling[monthIndex];
  const collection = monthlyCollection[monthIndex];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>

        <h3>📋 Drill Down: {data.month}</h3>
        <p className="modal-subtitle">Detailed breakdown for the selected month</p>

        <div className="modal-grid">
          {/* Billing Details */}
          <div className="modal-section">
            <h4 style={{ color: '#6366f1' }}>📋 Billing Details</h4>
            <div className="modal-metric">
              <span>Target</span>
              <span>{formatCrore(billing?.target)}</span>
            </div>
            <div className="modal-metric">
              <span>Achievement</span>
              <span>{formatCrore(billing?.achievement)}</span>
            </div>
            <div className="modal-metric">
              <span>Achievement %</span>
              <span style={{ color: getAchievementColor(billing?.percentage), fontWeight: 700 }}>
                {billing?.percentage !== null ? `${(billing.percentage * 100).toFixed(0)}%` : '—'}
              </span>
            </div>
            <div className="modal-metric">
              <span>Variance</span>
              <span style={{ color: (billing?.achievement - billing?.target) >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                {billing?.achievement !== null ? `${(billing.achievement - billing.target) >= 0 ? '+' : ''}${(billing.achievement - billing.target).toFixed(1)} Cr` : '—'}
              </span>
            </div>
          </div>

          {/* Collection Details */}
          <div className="modal-section">
            <h4 style={{ color: '#06b6d4' }}>💰 Collection Details</h4>
            <div className="modal-metric">
              <span>Target</span>
              <span>{formatCrore(collection?.target)}</span>
            </div>
            <div className="modal-metric">
              <span>Achievement</span>
              <span>{formatCrore(collection?.achievement)}</span>
            </div>
            <div className="modal-metric">
              <span>Achievement %</span>
              <span style={{ color: getAchievementColor(collection?.percentage), fontWeight: 700 }}>
                {collection?.percentage !== null ? `${(collection.percentage * 100).toFixed(0)}%` : '—'}
              </span>
            </div>
            <div className="modal-metric">
              <span>Variance</span>
              <span style={{ color: (collection?.achievement - collection?.target) >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                {collection?.achievement !== null ? `${(collection.achievement - collection.target) >= 0 ? '+' : ''}${(collection.achievement - collection.target).toFixed(1)} Cr` : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* MoM Change */}
        {monthIndex > 0 && billing?.achievement !== null && (
          <div className="modal-section mom-section">
            <h4>📈 Month-over-Month Change</h4>
            <div className="mom-grid">
              <div className="mom-item">
                <span>Billing MoM</span>
                {(() => {
                  const prev = monthlyBilling[monthIndex - 1];
                  if (!prev || prev.achievement === null) return <span>—</span>;
                  const change = billing.achievement - prev.achievement;
                  return (
                    <span style={{ color: change >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                      {change >= 0 ? '▲' : '▼'} {formatCrore(Math.abs(change))}
                    </span>
                  );
                })()}
              </div>
              <div className="mom-item">
                <span>Collection MoM</span>
                {(() => {
                  const prev = monthlyCollection[monthIndex - 1];
                  if (!prev || prev.achievement === null) return <span>—</span>;
                  const change = collection.achievement - prev.achievement;
                  return (
                    <span style={{ color: change >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                      {change >= 0 ? '▲' : '▼'} {formatCrore(Math.abs(change))}
                    </span>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DrillDownModal;
