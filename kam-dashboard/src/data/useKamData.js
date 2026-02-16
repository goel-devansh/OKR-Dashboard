// ============================================================
// useKamData Hook — Fetches data from backend API + WebSocket
// Falls back to hardcoded data if server is not running
// ============================================================
import { useState, useEffect, useRef, useCallback } from 'react';
import * as fallbackData from './kamData.js';

const API_URL = 'http://localhost:3001/api/data';
const WS_URL = 'ws://localhost:3001';

export function useKamData() {
  const [data, setData] = useState(null);
  const [isLive, setIsLive] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);
  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);

  // Build the data shape from API response
  const processApiData = useCallback((apiData) => {
    return {
      annualMetrics: apiData.annualMetrics || fallbackData.annualMetrics,
      monthlyBilling: apiData.monthlyBilling || fallbackData.monthlyBilling,
      monthlyCollection: apiData.monthlyCollection || fallbackData.monthlyCollection,
      quarterlyQBRs: apiData.quarterlyQBRs || fallbackData.quarterlyQBRs,
      quarterlyHeroStories: apiData.quarterlyHeroStories || fallbackData.quarterlyHeroStories,
      accountOwnerPerformance: apiData.accountOwnerPerformance || fallbackData.accountOwnerPerformance,
      billingTotals: apiData.billingTotals || fallbackData.billingTotals,
      collectionTotals: apiData.collectionTotals || fallbackData.collectionTotals,
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
      accountOwnerPerformance: fallbackData.accountOwnerPerformance,
      billingTotals: fallbackData.billingTotals,
      collectionTotals: fallbackData.collectionTotals,
    };
  }, []);

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
          if (message.type === 'data' && message.payload) {
            const processed = processApiData(message.payload);
            setData(processed);
            setLastUpdated(new Date());
            console.log('📊 Dashboard data updated from server');
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
    // Try to fetch from API first
    fetch(API_URL)
      .then(res => {
        if (!res.ok) throw new Error('API error');
        return res.json();
      })
      .then(apiData => {
        const processed = processApiData(apiData);
        setData(processed);
        setLastUpdated(new Date());
        setIsLive(true);
        console.log('✅ Loaded data from backend API');
        // Connect WebSocket for live updates
        connectWebSocket();
      })
      .catch(() => {
        console.log('ℹ️  Backend not running — using static data. Start server.cjs for live updates.');
        setData(getFallbackData());
        setLastUpdated(new Date());
        setIsLive(false);
        // Still try to connect WebSocket in case server starts later
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
  }, [processApiData, getFallbackData, connectWebSocket]);

  return {
    data,
    isLive,
    lastUpdated,
    error,
    // Direct accessors for convenience
    annualMetrics: data?.annualMetrics || fallbackData.annualMetrics,
    monthlyBilling: data?.monthlyBilling || fallbackData.monthlyBilling,
    monthlyCollection: data?.monthlyCollection || fallbackData.monthlyCollection,
    quarterlyQBRs: data?.quarterlyQBRs || fallbackData.quarterlyQBRs,
    quarterlyHeroStories: data?.quarterlyHeroStories || fallbackData.quarterlyHeroStories,
    accountOwnerPerformance: data?.accountOwnerPerformance || fallbackData.accountOwnerPerformance,
    billingTotals: data?.billingTotals || fallbackData.billingTotals,
    collectionTotals: data?.collectionTotals || fallbackData.collectionTotals,
  };
}
