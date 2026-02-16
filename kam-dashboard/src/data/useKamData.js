// ============================================================
// useKamData Hook — Fetches data from backend API + WebSocket
// Supports multi-FY (Financial Year) selection
// Falls back to hardcoded data if server is not running
// ============================================================
import { useState, useEffect, useRef, useCallback } from 'react';
import * as fallbackData from './kamData.js';

const API_URL = 'http://localhost:3001/api/data';
const YEARS_URL = 'http://localhost:3001/api/years';
const WS_URL = 'ws://localhost:3001';

export function useKamData() {
  const [data, setData] = useState(null);
  const [isLive, setIsLive] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);
  const [availableYears, setAvailableYears] = useState(['FY26']);
  const [selectedFY, setSelectedFY] = useState('FY26');
  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const selectedFYRef = useRef(selectedFY);

  // Keep ref in sync
  useEffect(() => { selectedFYRef.current = selectedFY; }, [selectedFY]);

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

  // Fetch data for a specific FY
  const fetchFYData = useCallback((fy) => {
    return fetch(`${API_URL}?fy=${fy}`)
      .then(res => {
        if (!res.ok) throw new Error('API error');
        return res.json();
      })
      .then(apiData => {
        const processed = processApiData(apiData);
        setData(processed);
        setLastUpdated(new Date());
        setIsLive(true);
        console.log(`✅ Loaded ${fy} data from backend API`);
      })
      .catch(() => {
        if (fy === 'FY26') {
          console.log('ℹ️  Backend not running — using static data. Start server.cjs for live updates.');
          setData(getFallbackData());
          setLastUpdated(new Date());
          setIsLive(false);
        } else {
          console.log(`ℹ️  No data available for ${fy}`);
        }
      });
  }, [processApiData, getFallbackData]);

  // Connect to WebSocket for live updates
  const connectWebSocket = useCallback(() => {
    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('🔌 Connected to KAM Dashboard server (live updates active)');
        setIsLive(true);
        setError(null);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          // Handle years list update
          if (message.type === 'years' && message.years) {
            setAvailableYears(message.years);
            if (message.defaultYear && !selectedFYRef.current) {
              setSelectedFY(message.defaultYear);
            }
            console.log('📅 Available FY years:', message.years);
          }

          // Handle data update
          if (message.type === 'data' && message.payload) {
            const messageFY = message.fy || 'FY26';
            // Only update if this is for the currently selected FY
            if (messageFY === selectedFYRef.current) {
              const processed = processApiData(message.payload);
              setData(processed);
              setLastUpdated(new Date());
              console.log(`📊 Dashboard data updated from server (${messageFY})`);
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
        // Reconnect after 5 seconds
        reconnectTimerRef.current = setTimeout(() => {
          console.log('🔄 Attempting to reconnect...');
          connectWebSocket();
        }, 5000);
      };

      ws.onerror = () => {
        // Will trigger onclose
        ws.close();
      };
    } catch (e) {
      setIsLive(false);
    }
  }, [processApiData]);

  // Initial fetch + WebSocket connection
  useEffect(() => {
    // Fetch available years first, then data
    fetch(YEARS_URL)
      .then(res => res.json())
      .then(yearData => {
        if (yearData.years && yearData.years.length > 0) {
          setAvailableYears(yearData.years);
          const fy = yearData.defaultYear || yearData.years[yearData.years.length - 1];
          setSelectedFY(fy);
          return fetchFYData(fy);
        }
      })
      .catch(() => {
        // Server not running — use fallback
        fetchFYData('FY26');
      })
      .finally(() => {
        connectWebSocket();
      });

    // Cleanup
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, [fetchFYData, connectWebSocket]);

  // Re-fetch when FY selection changes
  const changeFY = useCallback((fy) => {
    setSelectedFY(fy);
    fetchFYData(fy);
  }, [fetchFYData]);

  return {
    data,
    isLive,
    lastUpdated,
    error,
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
