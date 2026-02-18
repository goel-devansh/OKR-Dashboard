// ============================================================
// useKamData Hook — Fetches data from backend API + WebSocket
// Supports multi-Function + multi-FY selection
// Falls back to hardcoded data if server is not running
// ============================================================
import { useState, useEffect, useRef, useCallback } from 'react';
import * as fallbackKamData from './kamData.js';
import * as fallbackSalesData from './salesData.js';

const API_URL = 'http://localhost:3001/api/data';
const YEARS_URL = 'http://localhost:3001/api/years';
const FUNCTIONS_URL = 'http://localhost:3001/api/functions';
const WS_URL = 'ws://localhost:3001';

// Map function names to their fallback data modules
const FALLBACK_MAP = {
  KAM: fallbackKamData,
  SALES: fallbackSalesData,
};

// Get the right fallback module for a function
function getFallbackModule(func) {
  return FALLBACK_MAP[func] || fallbackKamData;
}

export function useKamData() {
  const [data, setData] = useState(null);
  const [isLive, setIsLive] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true); // true during initial load
  const [availableFunctions, setAvailableFunctions] = useState(['KAM']);
  const [selectedFunction, setSelectedFunction] = useState('KAM');
  const [availableYears, setAvailableYears] = useState(['FY26']);
  const [selectedFY, setSelectedFY] = useState('FY26');
  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const selectedFYRef = useRef(selectedFY);
  const selectedFunctionRef = useRef(selectedFunction);

  // Keep refs in sync
  useEffect(() => { selectedFYRef.current = selectedFY; }, [selectedFY]);
  useEffect(() => { selectedFunctionRef.current = selectedFunction; }, [selectedFunction]);

  // Build the data shape from API response
  const processApiData = useCallback((apiData, func) => {
    const fb = getFallbackModule(func || selectedFunctionRef.current);
    return {
      annualMetrics: apiData.annualMetrics || fb.annualMetrics,
      monthlyBilling: apiData.monthlyBilling || fb.monthlyBilling,
      monthlyCollection: apiData.monthlyCollection || fb.monthlyCollection,
      quarterlyQBRs: apiData.quarterlyQBRs || fb.quarterlyQBRs,
      quarterlyHeroStories: apiData.quarterlyHeroStories || fb.quarterlyHeroStories,
      quarterlyNewLogos: apiData.quarterlyNewLogos || fb.quarterlyNewLogos || [],
      newLogosTotals: apiData.newLogosTotals || fb.newLogosTotals || {},
      quarterlyARR: apiData.quarterlyARR || fb.quarterlyARR,
      quarterlyServiceRev: apiData.quarterlyServiceRev || fb.quarterlyServiceRev,
      accountOwnerPerformance: apiData.accountOwnerPerformance || fb.accountOwnerPerformance,
      billingTotals: apiData.billingTotals || fb.billingTotals,
      collectionTotals: apiData.collectionTotals || fb.collectionTotals,
      weightages: apiData.weightages || fb.defaultWeightages,
      pipelineCoverage: apiData.pipelineCoverage || fb.pipelineCoverage,
      ragMetrics: apiData.ragMetrics || fb.defaultRagMetrics || {},
    };
  }, []);

  // Get fallback data (hardcoded) for a specific function
  const getFallbackData = useCallback((func) => {
    const fb = getFallbackModule(func || selectedFunctionRef.current);
    return {
      annualMetrics: fb.annualMetrics,
      monthlyBilling: fb.monthlyBilling,
      monthlyCollection: fb.monthlyCollection,
      quarterlyQBRs: fb.quarterlyQBRs,
      quarterlyHeroStories: fb.quarterlyHeroStories,
      quarterlyNewLogos: fb.quarterlyNewLogos || [],
      newLogosTotals: fb.newLogosTotals || {},
      quarterlyARR: fb.quarterlyARR,
      quarterlyServiceRev: fb.quarterlyServiceRev,
      accountOwnerPerformance: fb.accountOwnerPerformance,
      billingTotals: fb.billingTotals,
      collectionTotals: fb.collectionTotals,
      weightages: fb.defaultWeightages,
      pipelineCoverage: fb.pipelineCoverage,
      ragMetrics: fb.defaultRagMetrics || {},
    };
  }, []);

  // Fetch data for a specific function + FY
  const fetchFYData = useCallback((func, fy) => {
    return fetch(`${API_URL}?function=${func}&fy=${fy}`)
      .then(res => {
        if (!res.ok) throw new Error('API error');
        return res.json();
      })
      .then(apiData => {
        const processed = processApiData(apiData, func);
        setData(processed);
        setLastUpdated(new Date());
        setIsLive(true);
        setLoading(false);
        console.log(`✅ Loaded ${func}/${fy} data from backend API`);
      })
      .catch(() => {
        // Use function-specific fallback if available
        if (FALLBACK_MAP[func]) {
          console.log(`ℹ️  Backend not running — using static ${func} data. Start server.cjs for live updates.`);
          setData(getFallbackData(func));
          setLastUpdated(new Date());
          setIsLive(false);
        } else {
          console.log(`ℹ️  No data available for ${func}/${fy}`);
          setData(null);
        }
        setLoading(false);
      });
  }, [processApiData, getFallbackData]);

  // Fetch years for a function, then load data for default year
  const fetchYearsForFunction = useCallback((func) => {
    return fetch(`${YEARS_URL}?function=${func}`)
      .then(res => res.json())
      .then(yearData => {
        if (yearData.years && yearData.years.length > 0) {
          setAvailableYears(yearData.years);
          const fy = yearData.defaultYear || yearData.years[yearData.years.length - 1];
          setSelectedFY(fy);
          return fetchFYData(func, fy);
        } else {
          setAvailableYears([]);
          setSelectedFY('');
          setData(null);
        }
      })
      .catch(() => {
        // Server not running — use fallback for functions that have static data
        if (FALLBACK_MAP[func]) {
          setAvailableYears(['FY26']);
          setSelectedFY('FY26');
          return fetchFYData(func, 'FY26');
        }
      });
  }, [fetchFYData]);

  // Connect to WebSocket for live updates
  const connectWebSocket = useCallback(() => {
    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('🔌 Connected to Dashboard server (live updates active)');
        setIsLive(true);
        setError(null);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          // Handle functions list update
          if (message.type === 'functions' && message.functions) {
            setAvailableFunctions(message.functions);
            console.log('📋 Available functions:', message.functions);
          }

          // Handle years list update — only for the currently selected function
          if (message.type === 'years' && message.years) {
            const msgFunc = (message.function || '').toUpperCase();
            if (msgFunc === selectedFunctionRef.current) {
              setAvailableYears(message.years);
              if (message.defaultYear && !selectedFYRef.current) {
                setSelectedFY(message.defaultYear);
              }
              console.log(`📅 Available FY years for ${msgFunc}:`, message.years);
            }
          }

          // Handle data update — only for the currently selected function+FY
          if (message.type === 'data' && message.payload) {
            const msgFunc = (message.function || 'KAM').toUpperCase();
            const msgFY = message.fy || 'FY26';
            if (msgFunc === selectedFunctionRef.current && msgFY === selectedFYRef.current) {
              const processed = processApiData(message.payload, msgFunc);
              setData(processed);
              setLastUpdated(new Date());
              console.log(`📊 Dashboard data updated from server (${msgFunc}/${msgFY})`);
            }
          }
        } catch (e) {
          console.warn('Failed to parse WebSocket message:', e);
        }
      };

      ws.onclose = () => {
        console.log('🔌 Disconnected from server');
        setIsLive(false);
        wsRef.current = null;
        reconnectTimerRef.current = setTimeout(() => {
          console.log('🔄 Attempting to reconnect...');
          connectWebSocket();
        }, 5000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch (e) {
      setIsLive(false);
    }
  }, [processApiData]);

  // Initial fetch + WebSocket connection
  useEffect(() => {
    // Fetch available functions first
    fetch(FUNCTIONS_URL)
      .then(res => res.json())
      .then(funcData => {
        if (funcData.functions && funcData.functions.length > 0) {
          setAvailableFunctions(funcData.functions);
          const func = funcData.defaultFunction || funcData.functions[0];
          setSelectedFunction(func);
          return fetchYearsForFunction(func);
        }
      })
      .catch(() => {
        // Server not running — use fallback, show all functions with static data
        const staticFunctions = Object.keys(FALLBACK_MAP);
        setAvailableFunctions(staticFunctions);
        setSelectedFunction(staticFunctions[0]);
        fetchFYData(staticFunctions[0], 'FY26');
      })
      .finally(() => {
        connectWebSocket();
      });

    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, [fetchFYData, fetchYearsForFunction, connectWebSocket]);

  // Change function — switches function, re-fetches years & data
  const changeFunction = useCallback((func) => {
    setLoading(true); // Show loading state during switch
    setData(null);    // Clear stale data to prevent flash of wrong layout
    setSelectedFunction(func);
    fetchYearsForFunction(func);
  }, [fetchYearsForFunction]);

  // Change FY — re-fetches data for current function
  const changeFY = useCallback((fy) => {
    setSelectedFY(fy);
    fetchFYData(selectedFunctionRef.current, fy);
  }, [fetchFYData]);

  // Current fallback module for direct accessors
  const fb = getFallbackModule(selectedFunction);

  return {
    data,
    loading,
    isLive,
    lastUpdated,
    error,
    availableFunctions,
    selectedFunction,
    changeFunction,
    availableYears,
    selectedFY,
    changeFY,
    // Direct accessors for convenience
    annualMetrics: data?.annualMetrics || fb.annualMetrics,
    monthlyBilling: data?.monthlyBilling || fb.monthlyBilling,
    monthlyCollection: data?.monthlyCollection || fb.monthlyCollection,
    quarterlyQBRs: data?.quarterlyQBRs || fb.quarterlyQBRs,
    quarterlyHeroStories: data?.quarterlyHeroStories || fb.quarterlyHeroStories,
    quarterlyNewLogos: data?.quarterlyNewLogos || fb.quarterlyNewLogos || [],
    newLogosTotals: data?.newLogosTotals || fb.newLogosTotals || {},
    quarterlyARR: data?.quarterlyARR || fb.quarterlyARR,
    quarterlyServiceRev: data?.quarterlyServiceRev || fb.quarterlyServiceRev,
    accountOwnerPerformance: data?.accountOwnerPerformance || fb.accountOwnerPerformance,
    billingTotals: data?.billingTotals || fb.billingTotals,
    collectionTotals: data?.collectionTotals || fb.collectionTotals,
    weightages: data?.weightages || fb.defaultWeightages,
    pipelineCoverage: data?.pipelineCoverage || fb.pipelineCoverage,
    ragMetrics: data?.ragMetrics || fb.defaultRagMetrics || {},
  };
}
