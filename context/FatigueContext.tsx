import React, { createContext, useContext, useState, useMemo, useCallback, ReactNode, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { calculateFatigue, SessionInputs, FatigueLevel, WeatherCondition, TimeOfDay } from '@/lib/fatigueEngine';

export interface SessionRecord {
  id: string;
  date: string;
  inputs: SessionInputs;
  score: number;
  level: FatigueLevel;
  deliveriesCompleted: number;
  durationMinutes: number;
}

interface FatigueContextValue {
  session: SessionInputs;
  updateSession: (updates: Partial<SessionInputs>) => void;
  fatigueScore: number;
  fatigueLevel: FatigueLevel;
  breakdown: Record<string, number>;
  history: SessionRecord[];
  saveSession: () => Promise<void>;
  clearHistory: () => Promise<void>;
  activeBreak: boolean;
  breakStartTime: number | null;
  startBreak: () => void;
  endBreak: () => void;
  isSessionActive: boolean;
  setSessionActive: (active: boolean) => void;
  sessionStartTime: number | null;
  startSession: () => void;
  endSession: () => void;
}

const DEFAULT_SESSION: SessionInputs = {
  drivingHours: 0,
  deliveriesCompleted: 0,
  minutesSinceBreak: 0,
  weather: 'clear',
  timeOfDay: 'morning',
  hungerLevel: 1,
};

const FatigueContext = createContext<FatigueContextValue | null>(null);

const STORAGE_KEY = 'saferoute_history';

export function FatigueProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionInputs>(DEFAULT_SESSION);
  const [history, setHistory] = useState<SessionRecord[]>([]);
  const [activeBreak, setActiveBreak] = useState(false);
  const [breakStartTime, setBreakStartTime] = useState<number | null>(null);
  const [isSessionActive, setSessionActive] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) setHistory(JSON.parse(stored));
      } catch {}
    };
    load();

    const hour = new Date().getHours();
    let timeOfDay: TimeOfDay = 'morning';
    if (hour >= 12 && hour < 17) timeOfDay = 'afternoon';
    else if (hour >= 17 && hour < 21) timeOfDay = 'evening';
    else if (hour >= 21 || hour < 6) timeOfDay = 'night';
    setSession(prev => ({ ...prev, timeOfDay }));
  }, []);

  const { score, level, breakdown } = useMemo(
    () => calculateFatigue(session),
    [session]
  );

  const updateSession = useCallback((updates: Partial<SessionInputs>) => {
    setSession(prev => ({ ...prev, ...updates }));
  }, []);

  const saveSession = useCallback(async () => {
    const record: SessionRecord = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      inputs: { ...session },
      score,
      level,
      deliveriesCompleted: session.deliveriesCompleted,
      durationMinutes: sessionStartTime
        ? Math.floor((Date.now() - sessionStartTime) / 60000)
        : Math.floor(session.drivingHours * 60),
    };
    const updated = [record, ...history].slice(0, 50);
    setHistory(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }, [session, score, level, history, sessionStartTime]);

  const clearHistory = useCallback(async () => {
    setHistory([]);
    await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  const startBreak = useCallback(() => {
    setActiveBreak(true);
    setBreakStartTime(Date.now());
  }, []);

  const endBreak = useCallback(() => {
    setActiveBreak(false);
    setBreakStartTime(null);
    setSession(prev => ({ ...prev, minutesSinceBreak: 0 }));
  }, []);

  const startSession = useCallback(() => {
    setSessionActive(true);
    setSessionStartTime(Date.now());
    setSession(DEFAULT_SESSION);
  }, []);

  const endSession = useCallback(() => {
    setSessionActive(false);
    setSessionStartTime(null);
  }, []);

  const value = useMemo<FatigueContextValue>(() => ({
    session,
    updateSession,
    fatigueScore: score,
    fatigueLevel: level,
    breakdown,
    history,
    saveSession,
    clearHistory,
    activeBreak,
    breakStartTime,
    startBreak,
    endBreak,
    isSessionActive,
    setSessionActive,
    sessionStartTime,
    startSession,
    endSession,
  }), [session, updateSession, score, level, breakdown, history, saveSession, clearHistory, activeBreak, breakStartTime, startBreak, endBreak, isSessionActive, sessionStartTime, startSession, endSession]);

  return <FatigueContext.Provider value={value}>{children}</FatigueContext.Provider>;
}

export function useFatigue() {
  const ctx = useContext(FatigueContext);
  if (!ctx) throw new Error('useFatigue must be used within FatigueProvider');
  return ctx;
}
