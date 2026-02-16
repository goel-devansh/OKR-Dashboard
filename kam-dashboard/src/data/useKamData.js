// ============================================================
// useKamData Hook — Fetches data from backend API + WebSocket
// Supports multi-Function + multi-FY selection
// Falls back to hardcoded data if server is not running
// ============================================================
import { useState, useEffect, useRef, useCallback } from 'react';
import * as fallbackData from './kamData.js';

const API_URL = 'http://localhost:3001/api/data';
const YEARS_URL = 'http://localhost:3001/api/years';
const FUNCTIONS_URL = 'http://localhost:3001/api/functions';
const WS_URL = 'ws://localhost:3001';

export function useKamData() {
  const [data, setData] = useState(null);
  const [isLive, setIsLive] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);
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
  const processApiData = useCallback((apiData) => {
    return {
      annualMetrics: apiData.annualMetrics || fallbackData.annualMetrics,
      monthlyBilling: apiData.monthlyBilling || fallbackData.monthlyBilling,
      monthlyCollection: apiData.monthlyCollection || fallbackData.monthlyCollection,
      quarterlyQBRs: apiData.quarterlyQBRs || fallbackData.quarterlyQBRs,
      quarterlyHeroStories: apiData.quarterlyHeroStories || fallbackData.quarterlyHeroStories,
      quarterlyARR: apiData.quarterlyARR || fallbackData.quarterlyARR,
      quarterlyServiceRev: apiData.quarterlyServiceRev || fallbackData.quarterlyServiceRev,
      accountOwnerPerformance: apiData.accountOwnerPerformance || fallbackData.accountOwnerPerformance,
      billingTotals: apiData.billingTotals || fallbackData.billingTotals,
      collectionTotals: apiData.collectionTotals || fallbackData.collectionTotals,
      weightages: apiData.weightages || fallbackData.defaultWeightages,
    };
  }, []);

  // Get fallback data (hardcoded)
  const getFallbackData = useCallback(() => {
    return {
      annualMetrics: fallbackData.annualMetrics,
      monthlyBilling: fallbackData.monthlyBilling,
      monthlyCollection: fallbackData.monthlyCollection,
      quarterlyQBRs: fallbackData.quarterlyQBRs,
      quarterlyHeroStories: fallbackData.quarterlyHeroStories,
      quarterlyARR: fallbackData.quarterlyARR,
      quarterlyServiceRev: fallbackData.quarterlyServiceRev,
      accountOwnerPerformance: fallbackData.accountOwnerPerformance,
      billingTotals: fallbackData.billingTotals,
      collectionTotals: fallbackData.collectionTotals,
      weightages: fallbackData.defaultWeightages,
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
        const processed = processApiData(apiData);
        setData(processed);
        setLastUpdated(new Date());
        setIsLive(true);
        console.log(`✅ Loaded ${func}/${fy} data from backend API`);
      })
      .catch(() => {
        if (func === 'KAM' && fy === 'FY26') {
          console.log('ℹ️  Backend not running — using static data. Start server.cjs for live updates.');
          setData(getFallbackData());
          setLastUpdated(new Date());
          setIsLive(false);
        } else {
          console.log(`ℹ️  No data available for ${func}/${fy}`);
          setData(null);
        }
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
        // Server not running
        if (func === 'KAM') {
          setAvailableYears(['FY26']);
          setSelectedFY('FY26');
          return fetchFYData('KAM', 'FY26');
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
              const processed = processApiData(message.payload);
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
        // Server not running — use fallback
        setAvailableFunctions(['KAM']);
        setSelectedFunction('KAM');
        fetchFYData('KAM', 'FY26');
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
    setSelectedFunction(func);
    fetchYearsForFunction(func);
  }, [fetchYearsForFunction]);

  // Change FY — re-fetches data for current function
  const changeFY = useCallback((fy) => {
    setSelectedFY(fy);
    fetchFYData(selectedFunctionRef.current, fy);
  }, [fetchFYData]);

  return {
    data,
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
    annualMetrics: data?.annualMetrics || fallbackData.annualMetrics,
    monthlyBilling: data?.monthlyBilling || fallbackData.monthlyBilling,
    monthlyCollection: data?.monthlyCollection || fallbackData.monthlyCollection,
    quarterlyQBRs: data?.quarterlyQBRs || fallbackData.quarterlyQBRs,
    quarterlyHeroStories: data?.quarterlyHeroStories || fallbackData.quarterlyHeroStories,
    quarterlyARR: data?.quarterlyARR || fallbackData.quarterlyARR,
    quarterlyServiceRev: data?.quarterlyServiceRev || fallbackData.quarterlyServiceRev,
    accountOwnerPerformance: data?.accountOwnerPerformance || fallbackData.accountOwnerPerformance,
    billingTotals: data?.billingTotals || fallbackData.billingTotals,
    collectionTotals: data?.collectionTotals || fallbackData.collectionTotals,
    weightages: data?.weightages || fallbackData.defaultWeightages,
  };
}
