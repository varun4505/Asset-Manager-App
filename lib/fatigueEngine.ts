export type WeatherCondition = 'clear' | 'cloudy' | 'rain' | 'storm';
export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';
export type FatigueLevel = 'low' | 'medium' | 'high';

export interface SessionInputs {
  drivingHours: number;
  deliveriesCompleted: number;
  minutesSinceBreak: number;
  weather: WeatherCondition;
  timeOfDay: TimeOfDay;
  hungerLevel: number;
  shiftStartHour?: number;  // 0–23
  shiftDurationHours?: number; // planned shift length
}

function trapezoidMF(x: number, a: number, b: number, c: number, d: number): number {
  if (x <= a || x >= d) return 0;
  if (x >= b && x <= c) return 1;
  if (x < b) return (x - a) / (b - a);
  return (d - x) / (d - c);
}

function triangleMF(x: number, a: number, b: number, c: number): number {
  if (x <= a || x >= c) return 0;
  if (x <= b) return (x - a) / (b - a);
  return (c - x) / (c - b);
}

function fuzzifyDrivingHours(hours: number) {
  return {
    low: trapezoidMF(hours, 0, 0, 2, 4),
    medium: triangleMF(hours, 3, 5.5, 8),
    high: trapezoidMF(hours, 7, 9, 12, 12),
  };
}

function fuzzifyDeliveries(count: number) {
  return {
    few: trapezoidMF(count, 0, 0, 5, 10),
    moderate: triangleMF(count, 8, 15, 22),
    many: trapezoidMF(count, 18, 24, 30, 30),
  };
}

function fuzzifyBreakTime(minutes: number) {
  return {
    recent: trapezoidMF(minutes, 0, 0, 30, 60),
    moderate: triangleMF(minutes, 45, 90, 135),
    overdue: trapezoidMF(minutes, 110, 150, 240, 240),
  };
}

function weatherFactor(weather: WeatherCondition): number {
  switch (weather) {
    case 'clear': return 0;
    case 'cloudy': return 15;
    case 'rain': return 30;
    case 'storm': return 50;
  }
}

function timeOfDayFactor(time: TimeOfDay): number {
  switch (time) {
    case 'morning': return 5;
    case 'afternoon': return 10;
    case 'evening': return 20;
    case 'night': return 35;
  }
}

export interface SessionRecord {
  id: string;
  date: string;
  inputs: SessionInputs;
  score: number;
  level: FatigueLevel;
  deliveriesCompleted: number;
  durationMinutes: number;
  notes?: string;
  earningsRate?: number;
}

export function calculateFatigue(inputs: SessionInputs): {
  score: number;
  level: FatigueLevel;
  breakdown: Record<string, number>;
} {
  const dh = fuzzifyDrivingHours(inputs.drivingHours);
  const del = fuzzifyDeliveries(inputs.deliveriesCompleted);
  const brk = fuzzifyBreakTime(inputs.minutesSinceBreak);

  const lowFatigue =
    Math.min(dh.low, del.few, brk.recent) * 0 +
    Math.min(dh.low, del.few) * 5 +
    Math.min(dh.medium, del.moderate, brk.recent) * 25;

  const medFatigue =
    Math.min(dh.medium, del.moderate, brk.moderate) * 50 +
    Math.min(dh.high, del.few, brk.recent) * 40 +
    Math.min(dh.low, del.many, brk.moderate) * 45;

  const highFatigue =
    Math.min(dh.high, del.many, brk.overdue) * 100 +
    Math.min(dh.high, brk.overdue) * 90 +
    Math.min(dh.medium, del.many, brk.overdue) * 75;

  const total = lowFatigue + medFatigue + highFatigue;
  const count =
    (lowFatigue > 0 ? 1 : 0) +
    (medFatigue > 0 ? 1 : 0) +
    (highFatigue > 0 ? 1 : 0) || 1;

  let baseScore = total / count;

  const weatherAdj = weatherFactor(inputs.weather);
  const timeAdj = timeOfDayFactor(inputs.timeOfDay);
  const hungerAdj = (inputs.hungerLevel - 1) * 5;

  const rawScore = baseScore + weatherAdj + timeAdj + hungerAdj;
  const score = Math.min(100, Math.max(0, rawScore));

  const level: FatigueLevel =
    score <= 35 ? 'low' : score <= 65 ? 'medium' : 'high';

  return {
    score,
    level,
    breakdown: {
      drivingHours: Math.min(100, inputs.drivingHours * 8),
      deliveries: Math.min(100, inputs.deliveriesCompleted * 3.5),
      breakOverdue: Math.min(100, (inputs.minutesSinceBreak / 240) * 100),
      weather: weatherAdj * 2,
      timeOfDay: timeAdj * 2,
      hunger: hungerAdj * 2,
    },
  };
}

export function getBreakRecommendation(
  score: number,
  level: FatigueLevel,
  minutesSinceBreak: number,
): { durationMinutes: number; urgency: string; message: string } {
  if (level === 'high') {
    return {
      durationMinutes: 30,
      urgency: 'immediate',
      message: 'Stop now. High fatigue detected. Take a 30-minute break.',
    };
  }
  if (level === 'medium') {
    const remaining = Math.max(0, 90 - minutesSinceBreak);
    return {
      durationMinutes: 15,
      urgency: remaining < 20 ? 'soon' : 'moderate',
      message: `Take a 15-minute break ${remaining < 20 ? 'soon' : 'within ' + remaining + ' minutes'}.`,
    };
  }
  return {
    durationMinutes: 10,
    urgency: 'low',
    message: 'Performing well. Next break in ' + Math.max(0, 120 - minutesSinceBreak) + ' minutes.',
  };
}

export function predictTimeToNextLevel(inputs: SessionInputs): {
  minutesRemaining: number | null;
  nextLevel: FatigueLevel;
  currentScore: number;
} {
  const { score, level } = calculateFatigue(inputs);
  const nextLevel: FatigueLevel = level === 'low' ? 'medium' : level === 'medium' ? 'high' : 'high';
  const threshold = level === 'low' ? 36 : level === 'medium' ? 66 : null;

  if (threshold === null || level === 'high') {
    return { minutesRemaining: null, nextLevel: 'high', currentScore: score };
  }

  // Simulate forward in time by incrementing driving hours and break minutes
  let simMinutes = 0;
  const step = 5;
  const maxSimMinutes = 180;

  while (simMinutes < maxSimMinutes) {
    simMinutes += step;
    const simInputs: SessionInputs = {
      ...inputs,
      drivingHours: inputs.drivingHours + simMinutes / 60,
      minutesSinceBreak: inputs.minutesSinceBreak + simMinutes,
    };
    const { score: simScore } = calculateFatigue(simInputs);
    if (simScore >= threshold) {
      return { minutesRemaining: simMinutes, nextLevel, currentScore: score };
    }
  }

  return { minutesRemaining: null, nextLevel, currentScore: score };
}


