import React, { createContext, useContext, useState, useMemo, useCallback, ReactNode, useEffect, useRef } from 'react';
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

export interface DriverProfile {
  name: string;
  vehicle: string;
  dailyGoal: number;
  company: string;
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
  sessionStartTime: number | null;
  sessionElapsedSeconds: number;
  startSession: () => void;
  endSession: () => void;
  incrementDelivery: () => void;
  safetyScore: number;
  currentStreak: number;
  profile: DriverProfile;
  updateProfile: (p: Partial<DriverProfile>) => void;
}

const DEFAULT_SESSION: SessionInputs = {
  drivingHours: 0,
  deliveriesCompleted: 0,
  minutesSinceBreak: 0,
  weather: 'clear',
  timeOfDay: 'morning',
  hungerLevel: 1,
};

const DEFAULT_PROFILE: DriverProfile = {
  name: '',
  vehicle: 'Motorcycle',
  dailyGoal: 20,
  company: '',
};

const FatigueContext = createContext<FatigueContextValue | null>(null);

const STORAGE_KEY = 'saferoute_history_v2';
const PROFILE_KEY = 'saferoute_profile';

export function FatigueProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionInputs>(DEFAULT_SESSION);
  const [history, setHistory] = useState<SessionRecord[]>([]);
  const [activeBreak, setActiveBreak] = useState(false);
  const [breakStartTime, setBreakStartTime] = useState<number | null>(null);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [sessionElapsedSeconds, setSessionElapsedSeconds] = useState(0);
  const [profile, setProfile] = useState<DriverProfile>(DEFAULT_PROFILE);

  const sessionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const breakMinuteTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) setHistory(JSON.parse(stored));
        const prof = await AsyncStorage.getItem(PROFILE_KEY);
        if (prof) setProfile(JSON.parse(prof));
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

  // Session elapsed timer
  useEffect(() => {
    if (isSessionActive && sessionStartTime) {
      sessionTimerRef.current = setInterval(() => {
        setSessionElapsedSeconds(Math.floor((Date.now() - sessionStartTime) / 1000));
      }, 1000);
    } else {
      if (sessionTimerRef.current) {
        clearInterval(sessionTimerRef.current);
        sessionTimerRef.current = null;
      }
      setSessionElapsedSeconds(0);
    }
    return () => {
      if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
    };
  }, [isSessionActive, sessionStartTime]);

  // Auto-increment minutes since break (every 60 seconds during session, not during active break)
  useEffect(() => {
    if (isSessionActive && !activeBreak) {
      breakMinuteTimerRef.current = setInterval(() => {
        setSession(prev => ({
          ...prev,
          minutesSinceBreak: Math.min(240, prev.minutesSinceBreak + 1),
          drivingHours: parseFloat((prev.drivingHours + 1 / 60).toFixed(3)),
        }));
      }, 60000);
    } else {
      if (breakMinuteTimerRef.current) {
        clearInterval(breakMinuteTimerRef.current);
        breakMinuteTimerRef.current = null;
      }
    }
    return () => {
      if (breakMinuteTimerRef.current) clearInterval(breakMinuteTimerRef.current);
    };
  }, [isSessionActive, activeBreak]);

  const { score, level, breakdown } = useMemo(
    () => calculateFatigue(session),
    [session]
  );

  const safetyScore = useMemo(() => {
    if (history.length === 0) return 100;
    const recentSessions = history.slice(0, 10);
    const avgScore = recentSessions.reduce((a, b) => a + b.score, 0) / recentSessions.length;
    const highRiskCount = recentSessions.filter(s => s.level === 'high').length;
    const penalty = highRiskCount * 8;
    return Math.max(0, Math.min(100, Math.round(100 - avgScore * 0.4 - penalty)));
  }, [history]);

  const currentStreak = useMemo(() => {
    let streak = 0;
    for (const s of history) {
      if (s.level !== 'high') streak++;
      else break;
    }
    return streak;
  }, [history]);

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
    const now = Date.now();
    setIsSessionActive(true);
    setSessionStartTime(now);
    setSession(DEFAULT_SESSION);

    const hour = new Date().getHours();
    let timeOfDay: TimeOfDay = 'morning';
    if (hour >= 12 && hour < 17) timeOfDay = 'afternoon';
    else if (hour >= 17 && hour < 21) timeOfDay = 'evening';
    else if (hour >= 21 || hour < 6) timeOfDay = 'night';
    setSession(prev => ({ ...prev, timeOfDay }));
  }, []);

  const endSession = useCallback(() => {
    setIsSessionActive(false);
    setSessionStartTime(null);
  }, []);

  const incrementDelivery = useCallback(() => {
    setSession(prev => ({
      ...prev,
      deliveriesCompleted: Math.min(30, prev.deliveriesCompleted + 1),
    }));
  }, []);

  const updateProfile = useCallback(async (updates: Partial<DriverProfile>) => {
    setProfile(prev => {
      const next = { ...prev, ...updates };
      AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
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
    sessionStartTime,
    sessionElapsedSeconds,
    startSession,
    endSession,
    incrementDelivery,
    safetyScore,
    currentStreak,
    profile,
    updateProfile,
  }), [session, updateSession, score, level, breakdown, history, saveSession, clearHistory, activeBreak, breakStartTime, startBreak, endBreak, isSessionActive, sessionStartTime, sessionElapsedSeconds, startSession, endSession, incrementDelivery, safetyScore, currentStreak, profile, updateProfile]);

  return <FatigueContext.Provider value={value}>{children}</FatigueContext.Provider>;
}

export function useFatigue() {
  const ctx = useContext(FatigueContext);
  if (!ctx) throw new Error('useFatigue must be used within FatigueProvider');
  return ctx;
}
