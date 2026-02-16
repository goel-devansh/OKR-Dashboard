import React from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { useKamDataContext } from '../data/KamDataContext';

const CumulativeChart = ({ dateRange }) => {
  const { monthlyBilling, monthlyCollection } = useKamDataContext();
  // Build cumulative data
  let cumBilling = 0;
  let cumCollection = 0;
  let cumBillingTarget = 0;
  let cumCollectionTarget = 0;

  const data = monthlyBilling.slice(dateRange[0], dateRange[1] + 1).map((bill, i) => {
    const coll = monthlyCollection[dateRange[0] + i];
    cumBillingTarget += bill.target;
    cumCollectionTarget += coll.target;
    if (bill.achievement !== null) cumBilling += bill.achievement;
    if (coll.achievement !== null) cumCollection += coll.achievement;

    return {
      month: bill.month,
      cumulativeBilling: bill.achievement !== null ? cumBilling : null,
      cumulativeCollection: coll.achievement !== null ? cumCollection : null,
      cumulativeBillingTarget: cumBillingTarget,
      cumulativeCollectionTarget: cumCollectionTarget,
    };
  });

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload) return null;
    return (
      <div className="chart-tooltip">
        <h4>{label}</h4>
        {payload.map((entry, i) => (
          <div key={i} className="tooltip-row">
            <span className="tooltip-dot" style={{ background: entry.color }} />
            {entry.name}: ₹{entry.value?.toFixed(1)} Cr
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="chart-card">
      <div className="chart-header">
        <div>
          <h3>📈 Cumulative Billing & Collection Trends</h3>
          <p className="chart-subtitle">Stacked area showing YTD cumulative trajectory vs targets</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={380}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="cumBillingGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="cumCollectionGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6b7280' }} />
          <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} label={{ value: 'INR Cr (Cumulative)', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#9ca3af' } }} />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Area type="monotone" dataKey="cumulativeBillingTarget" name="Billing Target" stroke="#a5b4fc" strokeDasharray="5 5" fill="none" strokeWidth={2} connectNulls />
          <Area type="monotone" dataKey="cumulativeCollectionTarget" name="Collection Target" stroke="#67e8f9" strokeDasharray="5 5" fill="none" strokeWidth={2} connectNulls />
          <Area type="monotone" dataKey="cumulativeBilling" name="Cumulative Billing" stroke="#6366f1" fill="url(#cumBillingGrad)" strokeWidth={2.5} dot={{ r: 4 }} connectNulls />
          <Area type="monotone" dataKey="cumulativeCollection" name="Cumulative Collection" stroke="#06b6d4" fill="url(#cumCollectionGrad)" strokeWidth={2.5} dot={{ r: 4 }} connectNulls />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default CumulativeChart;
