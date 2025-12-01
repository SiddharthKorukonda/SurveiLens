import { useState, useEffect, useCallback } from 'react';
import type { TriageState, TriageMap } from '../types';

const STORAGE_KEY = 'surveilens_triage';

// Load triage map from localStorage
function loadTriage(): TriageMap {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load triage from localStorage:', e);
  }
  return {};
}

// Save triage map to localStorage
function saveTriage(triage: TriageMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(triage));
  } catch (e) {
    console.error('Failed to save triage to localStorage:', e);
  }
}

// Clear all triage data for a specific server (standalone function)
export function clearTriageForServer(serverId: string): void {
  const triage = loadTriage();
  const next: TriageMap = {};
  for (const [key, value] of Object.entries(triage)) {
    if (!key.startsWith(`${serverId}:`)) {
      next[key] = value;
    }
  }
  saveTriage(next);
  console.log('[useTriage] Cleared triage data for server:', serverId);
}

export function useTriage(serverId: string) {
  const [triageMap, setTriageMap] = useState<TriageMap>(() => loadTriage());

  // Persist to localStorage whenever triage changes
  useEffect(() => {
    saveTriage(triageMap);
  }, [triageMap]);

  // Generate a key for the triage map
  const getKey = useCallback((alertId: string) => {
    return `${serverId}:${alertId}`;
  }, [serverId]);

  // Get triage state for an alert
  const getTriage = useCallback((alertId: string): TriageState => {
    const key = getKey(alertId);
    return triageMap[key] || null;
  }, [triageMap, getKey]);

  // Set triage state for an alert
  const setTriage = useCallback((alertId: string, state: TriageState) => {
    const key = getKey(alertId);
    setTriageMap(prev => ({
      ...prev,
      [key]: state,
    }));
  }, [getKey]);

  // Clear triage for an alert
  const clearTriage = useCallback((alertId: string) => {
    const key = getKey(alertId);
    setTriageMap(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, [getKey]);

  // Clear all triage for this server
  const clearAllTriage = useCallback(() => {
    setTriageMap(prev => {
      const next: TriageMap = {};
      for (const [key, value] of Object.entries(prev)) {
        if (!key.startsWith(`${serverId}:`)) {
          next[key] = value;
        }
      }
      return next;
    });
  }, [serverId]);

  // Count untriaged alerts
  const countUntriaged = useCallback((alertIds: string[]): number => {
    return alertIds.filter(id => !getTriage(id)).length;
  }, [getTriage]);

  return {
    getTriage,
    setTriage,
    clearTriage,
    clearAllTriage,
    countUntriaged,
  };
}

