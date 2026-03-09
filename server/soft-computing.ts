import { z } from "zod";
import {
  type AppConfig,
  type FatigueLevel,
  timeOfDaySchema,
  weatherConditionSchema,
} from "@shared/soft-config";

export const sessionInputsSchema = z.object({
  drivingHours: z.number().min(0).max(24),
  deliveriesCompleted: z.number().int().min(0).max(100),
  minutesSinceBreak: z.number().min(0).max(720),
  weather: weatherConditionSchema,
  timeOfDay: timeOfDaySchema,
  hungerLevel: z.number().min(1).max(5),
  shiftStartHour: z.number().int().min(0).max(23).optional(),
  shiftDurationHours: z.number().min(1).max(24).optional(),
});

export type SessionInputs = z.infer<typeof sessionInputsSchema>;

export interface FatigueResult {
  score: number;
  level: FatigueLevel;
  breakdown: Record<string, number>;
}

export interface BreakRecommendation {
  durationMinutes: number;
  urgency: "low" | "moderate" | "soon" | "immediate";
  message: string;
}

export interface PredictionResult {
  minutesRemaining: number | null;
  nextLevel: FatigueLevel;
  currentScore: number;
}

export const routeNodeSchema = z.object({
  id: z.number().int().positive().optional(),
  label: z.string().optional(),
  address: z.string().optional(),
  priority: z.number().int().min(1).max(5).optional(),
  estimatedMinutes: z.number().int().min(5).max(120).optional(),
  risk: z.number().min(0).max(100).optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

export type RouteNodeInput = z.infer<typeof routeNodeSchema>;

export const optimizeRouteRequestSchema = z.object({
  deliveries: z.number().int().min(1).max(60).optional(),
  fatigueScore: z.number().min(0).max(100),
  nodes: z.array(routeNodeSchema).optional(),
});

export type OptimizeRouteRequest = z.infer<typeof optimizeRouteRequestSchema>;

export interface DeliveryNode {
  id: number;
  label: string;
  priority: number;
  estimatedMinutes: number;
  risk: number;
  address: string;
  lat: number;
  lng: number;
}

export interface ASORoute {
  stops: DeliveryNode[];
  totalTime: number;
  breakAfterStop: number;
  iterations: number;
  tourLength: number;
  pheromoneStrength: number;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
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

export function getFatigueLevel(score: number, config: AppConfig): FatigueLevel {
  if (score <= config.fatigueThresholds.lowMax) return "low";
  if (score <= config.fatigueThresholds.mediumMax) return "medium";
  return "high";
}

export function calculateFatigue(inputs: SessionInputs, config: AppConfig): FatigueResult {
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

  const baseScore = total / count;
  const weatherAdj = config.fatigueFactors.weather[inputs.weather];
  const timeAdj = config.fatigueFactors.timeOfDay[inputs.timeOfDay];
  const hungerAdj = (inputs.hungerLevel - 1) * config.fatigueFactors.hungerStep;

  const rawScore = baseScore + weatherAdj + timeAdj + hungerAdj;
  const score = clamp(rawScore, 0, 100);
  const level = getFatigueLevel(score, config);

  return {
    score,
    level,
    breakdown: {
      drivingHours: clamp(inputs.drivingHours * 8, 0, 100),
      deliveries: clamp(inputs.deliveriesCompleted * 3.5, 0, 100),
      breakOverdue: clamp((inputs.minutesSinceBreak / 240) * 100, 0, 100),
      weather: clamp(weatherAdj * 2, 0, 100),
      timeOfDay: clamp(timeAdj * 2, 0, 100),
      hunger: clamp(hungerAdj * 2, 0, 100),
    },
  };
}

export function getBreakRecommendation(
  score: number,
  level: FatigueLevel,
  minutesSinceBreak: number,
  config: AppConfig,
): BreakRecommendation {
  const roundedScore = Math.round(score);
  if (level === "high") {
    const minutes = config.breakPolicy.high.recommendedDurationMinutes;
    return {
      durationMinutes: minutes,
      urgency: "immediate",
      message: `Stop now. High fatigue (${roundedScore}) detected. Take a ${minutes}-minute break.`,
    };
  }

  if (level === "medium") {
    const trigger = config.breakPolicy.medium.triggerMinutes;
    const remaining = Math.max(0, trigger - minutesSinceBreak);
    const soon = remaining <= config.breakPolicy.medium.soonWindowMinutes;
    const duration = config.breakPolicy.medium.recommendedDurationMinutes;
    return {
      durationMinutes: duration,
      urgency: soon ? "soon" : "moderate",
      message: soon
        ? `Take a ${duration}-minute break soon. Current score: ${roundedScore}.`
        : `Take a ${duration}-minute break within ${remaining} minutes.`,
    };
  }

  const nextBreak = Math.max(0, config.breakPolicy.low.nextBreakMinutes - minutesSinceBreak);
  return {
    durationMinutes: config.breakPolicy.low.recommendedDurationMinutes,
    urgency: "low",
    message: `Performing well. Next break in ${nextBreak} minutes.`,
  };
}

export function predictTimeToNextLevel(
  inputs: SessionInputs,
  config: AppConfig,
): PredictionResult {
  const { score, level } = calculateFatigue(inputs, config);
  const nextLevel: FatigueLevel = level === "low" ? "medium" : "high";
  const threshold = level === "low" ? config.fatigueThresholds.lowMax + 1 : level === "medium" ? config.fatigueThresholds.mediumMax + 1 : null;

  if (threshold === null || level === "high") {
    return { minutesRemaining: null, nextLevel: "high", currentScore: score };
  }

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
    const { score: simScore } = calculateFatigue(simInputs, config);
    if (simScore >= threshold) {
      return { minutesRemaining: simMinutes, nextLevel, currentScore: score };
    }
  }

  return { minutesRemaining: null, nextLevel, currentScore: score };
}

function euclideanDistance(a: DeliveryNode, b: DeliveryNode): number {
  const latDiff = a.lat - b.lat;
  const lngDiff = a.lng - b.lng;
  const kmApprox = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111;
  return Math.max(0.5, kmApprox);
}

function computeTourCost(
  tour: number[],
  nodes: DeliveryNode[],
  distances: number[][],
  config: AppConfig,
): number {
  let cost = 0;
  const { distanceWeight, riskWeight, priorityWeight } = config.aso;
  for (let i = 0; i < tour.length - 1; i++) {
    const from = tour[i];
    const to = tour[i + 1];
    const target = nodes[to];
    const priorityPenalty = 6 - target.priority;
    cost +=
      distances[from][to] * distanceWeight +
      target.risk * riskWeight +
      priorityPenalty * priorityWeight;
  }
  return cost;
}

function selectNextNode(probabilities: Array<{ nodeIndex: number; value: number }>): number {
  const total = probabilities.reduce((sum, p) => sum + p.value, 0);
  if (total <= 0) {
    return probabilities[Math.floor(Math.random() * probabilities.length)]!.nodeIndex;
  }

  const pick = Math.random() * total;
  let cumulative = 0;
  for (const prob of probabilities) {
    cumulative += prob.value;
    if (pick <= cumulative) return prob.nodeIndex;
  }

  return probabilities[probabilities.length - 1]!.nodeIndex;
}

function buildFallbackNodes(deliveries: number, fatigueScore: number): DeliveryNode[] {
  return Array.from({ length: deliveries }, (_, i) => {
    const id = i + 1;
    const priority = ((i % 3) + 1);
    const estimatedMinutes = 10 + (i % 4) * 6;
    const risk = clamp(Math.round(fatigueScore * 0.55 + priority * 7 + estimatedMinutes * 0.6), 0, 100);

    return {
      id,
      label: `Delivery #${id}`,
      address: `Stop ${id}`,
      priority,
      estimatedMinutes,
      risk,
      lat: 12.94 + i * 0.008,
      lng: 77.58 + (i % 4) * 0.01,
    };
  });
}

function normalizeInputNodes(
  nodes: RouteNodeInput[] | undefined,
  deliveries: number,
  fatigueScore: number,
): DeliveryNode[] {
  if (!nodes || nodes.length === 0) {
    return buildFallbackNodes(deliveries, fatigueScore);
  }

  return nodes.slice(0, deliveries).map((node, index) => {
    const id = node.id ?? index + 1;
    const priority = node.priority ?? ((index % 3) + 1);
    const estimatedMinutes = node.estimatedMinutes ?? (10 + (index % 4) * 6);
    const inferredRisk = clamp(
      Math.round(fatigueScore * 0.55 + priority * 7 + estimatedMinutes * 0.6),
      0,
      100,
    );

    return {
      id,
      label: node.label ?? `Delivery #${id}`,
      address: node.address ?? `Stop ${id}`,
      priority,
      estimatedMinutes,
      risk: Math.round(node.risk ?? inferredRisk),
      lat: node.lat ?? 12.94 + index * 0.008,
      lng: node.lng ?? 77.58 + (index % 4) * 0.01,
    };
  });
}

export function optimizeRouteASO(request: OptimizeRouteRequest, config: AppConfig): ASORoute {
  const deliveries = clamp(request.deliveries ?? 6, 2, 30);
  const fatigueScore = clamp(request.fatigueScore, 0, 100);
  const nodes = normalizeInputNodes(request.nodes, deliveries, fatigueScore);
  const nodeCount = nodes.length;

  if (nodeCount === 0) {
    return {
      stops: [],
      totalTime: 0,
      breakAfterStop: 1,
      iterations: 0,
      tourLength: 0,
      pheromoneStrength: 0,
    };
  }

  const pheromone = Array.from({ length: nodeCount }, () =>
    Array.from({ length: nodeCount }, () => 1),
  );
  const distances = Array.from({ length: nodeCount }, (_, i) =>
    Array.from({ length: nodeCount }, (_, j) => (i === j ? 0 : euclideanDistance(nodes[i]!, nodes[j]!))),
  );

  const ants = Math.max(8, Math.round(config.aso.ants));
  const iterations = Math.max(10, Math.round(config.aso.iterations));
  const alpha = config.aso.alpha;
  const beta = config.aso.beta;
  const evaporation = clamp(config.aso.evaporation, 0.05, 0.95);
  const q = Math.max(1, config.aso.q);

  let bestTour: number[] = [...Array(nodeCount).keys()];
  let bestCost = Number.POSITIVE_INFINITY;

  for (let iter = 0; iter < iterations; iter++) {
    const antTours: Array<{ tour: number[]; cost: number }> = [];

    for (let ant = 0; ant < ants; ant++) {
      const startNode = ant % nodeCount;
      const tour = [startNode];
      const visited = new Set<number>([startNode]);

      while (tour.length < nodeCount) {
        const current = tour[tour.length - 1]!;
        const probabilities: Array<{ nodeIndex: number; value: number }> = [];

        for (let candidate = 0; candidate < nodeCount; candidate++) {
          if (visited.has(candidate)) continue;
          const heuristic = 1 / (distances[current]![candidate]! + nodes[candidate]!.risk * 0.05 + 0.001);
          const value =
            Math.pow(pheromone[current]![candidate]!, alpha) *
            Math.pow(heuristic, beta);
          probabilities.push({ nodeIndex: candidate, value });
        }

        const nextNode = selectNextNode(probabilities);
        visited.add(nextNode);
        tour.push(nextNode);
      }

      const cost = computeTourCost(tour, nodes, distances, config);
      antTours.push({ tour, cost });

      if (cost < bestCost) {
        bestCost = cost;
        bestTour = tour;
      }
    }

    for (let i = 0; i < nodeCount; i++) {
      for (let j = 0; j < nodeCount; j++) {
        pheromone[i]![j] = pheromone[i]![j]! * (1 - evaporation);
      }
    }

    for (const antTour of antTours) {
      const deposit = q / Math.max(1, antTour.cost);
      for (let step = 0; step < antTour.tour.length - 1; step++) {
        const from = antTour.tour[step]!;
        const to = antTour.tour[step + 1]!;
        pheromone[from]![to] += deposit;
      }
    }
  }

  const orderedStops = bestTour.map((nodeIndex) => nodes[nodeIndex]!);
  const totalTime = orderedStops.reduce((sum, stop) => sum + stop.estimatedMinutes, 0);

  let breakAfterStop = 6;
  if (fatigueScore > config.fatigueThresholds.mediumMax) breakAfterStop = 2;
  else if (fatigueScore > config.fatigueThresholds.lowMax) breakAfterStop = 4;
  breakAfterStop = clamp(breakAfterStop, 1, Math.max(1, orderedStops.length));

  let pheromoneTotal = 0;
  let pheromoneEdges = 0;
  let pheromoneMax = 0;
  for (let i = 0; i < nodeCount; i++) {
    for (let j = 0; j < nodeCount; j++) {
      const value = pheromone[i]![j]!;
      pheromoneMax = Math.max(pheromoneMax, value);
    }
  }
  for (let step = 0; step < bestTour.length - 1; step++) {
    const from = bestTour[step]!;
    const to = bestTour[step + 1]!;
    pheromoneTotal += pheromone[from]![to]!;
    pheromoneEdges += 1;
  }
  const edgeAverage = pheromoneEdges > 0 ? pheromoneTotal / pheromoneEdges : 0;
  const pheromoneStrength = pheromoneMax > 0 ? Math.round((edgeAverage / pheromoneMax) * 100) : 0;

  return {
    stops: orderedStops,
    totalTime,
    breakAfterStop,
    iterations,
    tourLength: Math.round(bestCost),
    pheromoneStrength: clamp(pheromoneStrength, 0, 100),
  };
}
