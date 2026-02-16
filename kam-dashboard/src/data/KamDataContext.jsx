// ============================================================
// KamDataContext — Provides live data to all components
// ============================================================
import React, { createContext, useContext } from 'react';
import { useKamData } from './useKamData.js';

const KamDataContext = createContext(null);

export function KamDataProvider({ children }) {
  const kamData = useKamData();

  return (
    <KamDataContext.Provider value={kamData}>
      {children}
    </KamDataContext.Provider>
  );
}

export function useKamDataContext() {
  const context = useContext(KamDataContext);
  if (!context) {
    throw new Error('useKamDataContext must be used within a KamDataProvider');
  }
  return context;
}
