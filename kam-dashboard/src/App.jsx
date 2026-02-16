import React, { useState, useCallback } from 'react';
import { KamDataProvider, useKamDataContext } from './data/KamDataContext';
import KPICards from './components/KPICards';
import BillingChart from './components/BillingChart';
import CollectionChart from './components/CollectionChart';
import QuarterlyChart from './components/QuarterlyChart';
import CumulativeChart from './components/CumulativeChart';
import AdvancedAnalysis from './components/AdvancedAnalysis';
import DrillDownModal from './components/DrillDownModal';
import './App.css';

const MONTHS = [
  "Apr'26", "May'26", "Jun'26", "Jul'26", "Aug'26", "Sep'26",
  "Oct'26", "Nov'26", "Dec'26", "Jan'27", "Feb'27", "Mar'27"
];

function DashboardContent() {
  const { isLive, lastUpdated } = useKamDataContext();
  const [viewMode, setViewMode] = useState('monthly');
  const [dateRange, setDateRange] = useState([0, 11]);
  const [drillDown, setDrillDown] = useState(null);
  const [activeSection, setActiveSection] = useState('all');

  const handleDrillDown = useCallback((type, data) => {
    setDrillDown({ type, data });
  }, []);

  const closeDrillDown = useCallback(() => {
    setDrillDown(null);
  }, []);

  const handleRangeChange = (which, value) => {
    const idx = parseInt(value);
    if (which === 'start') {
      setDateRange([idx, Math.max(idx, dateRange[1])]);
    } else {
      setDateRange([Math.min(dateRange[0], idx), idx]);
    }
  };

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-left">
          <h1>KAM Dashboard</h1>
          <p className="header-subtitle">Key Account Management OKR Tracker — FY26</p>
        </div>
        <div className="header-right">
          <span className={`live-indicator ${isLive ? 'live' : 'static'}`}>
            <span className="live-dot" />
            {isLive ? 'LIVE' : 'STATIC'}
          </span>
          {lastUpdated && (
            <span className="header-date">
              Updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <span className="header-badge">INR (Cr)</span>
        </div>
      </header>

      {/* Live Data Banner */}
      {isLive && (
        <div className="live-banner">
          <span>Connected to backend server. Edit <strong>KAM_Dashboard_Input.xlsx</strong> and save — changes appear here automatically.</span>
        </div>
      )}

      {/* Filters Bar */}
      <div className="filters-bar">
        <div className="filter-group">
          <label>View Mode</label>
          <div className="toggle-group">
            <button
              className={`toggle-btn ${viewMode === 'monthly' ? 'active' : ''}`}
              onClick={() => setViewMode('monthly')}
            >
              Monthly
            </button>
            <button
              className={`toggle-btn ${viewMode === 'quarterly' ? 'active' : ''}`}
              onClick={() => setViewMode('quarterly')}
            >
              Quarterly
            </button>
          </div>
        </div>

        <div className="filter-group">
          <label>Section</label>
          <div className="toggle-group">
            {[
              { key: 'all', label: 'All' },
              { key: 'billing', label: 'Billing' },
              { key: 'collection', label: 'Collection' },
              { key: 'quarterly', label: 'QBR & Stories' },
              { key: 'analysis', label: 'Analysis' },
            ].map(s => (
              <button
                key={s.key}
                className={`toggle-btn ${activeSection === s.key ? 'active' : ''}`}
                onClick={() => setActiveSection(s.key)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {viewMode === 'monthly' && (
          <div className="filter-group date-range-filter">
            <label>Date Range</label>
            <div className="date-selectors">
              <select
                value={dateRange[0]}
                onChange={(e) => handleRangeChange('start', e.target.value)}
                className="date-select"
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i}>{m}</option>
                ))}
              </select>
              <span className="range-separator">to</span>
              <select
                value={dateRange[1]}
                onChange={(e) => handleRangeChange('end', e.target.value)}
                className="date-select"
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i}>{m}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* KPI Summary Cards */}
      <KPICards />

      {/* Charts Section */}
      <div className="charts-section">
        {(activeSection === 'all' || activeSection === 'billing') && viewMode === 'monthly' && (
          <BillingChart dateRange={dateRange} onDrillDown={handleDrillDown} />
        )}

        {(activeSection === 'all' || activeSection === 'collection') && viewMode === 'monthly' && (
          <CollectionChart dateRange={dateRange} onDrillDown={handleDrillDown} />
        )}

        {(activeSection === 'all' || activeSection === 'quarterly') && (
          <QuarterlyChart />
        )}

        {(activeSection === 'all' || activeSection === 'billing' || activeSection === 'collection') && viewMode === 'monthly' && (
          <CumulativeChart dateRange={dateRange} />
        )}

        {(activeSection === 'all' || activeSection === 'analysis') && (
          <AdvancedAnalysis />
        )}
      </div>

      {/* Drill Down Modal */}
      {drillDown && (
        <DrillDownModal
          type={drillDown.type}
          data={drillDown.data}
          onClose={closeDrillDown}
        />
      )}

      {/* Footer */}
      <footer className="dashboard-footer">
        <p>
          KAM OKR Dashboard — FY2026
          {isLive ? ' | Live from Excel' : ' | Static Data'}
          {lastUpdated ? ` | Last update: ${lastUpdated.toLocaleString()}` : ''}
        </p>
      </footer>
    </div>
  );
}

function App() {
  return (
    <KamDataProvider>
      <DashboardContent />
    </KamDataProvider>
  );
}

export default App;
