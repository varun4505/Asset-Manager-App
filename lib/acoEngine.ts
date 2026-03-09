import { apiRequest } from "@/lib/query-client";

export interface DeliveryNode {
  id: number;
  label: string;
  priority: number;
  estimatedMinutes: number;
  risk: number;
  address: string;
  lat?: number;
  lng?: number;
}

export interface ACORoute {
  stops: DeliveryNode[];
  totalTime: number;
  breakAfterStop: number;
  iterations: number;
  tourLength: number;
  pheromoneStrength: number;
}

function localFallbackRoute(deliveries: number, fatigueScore: number): ACORoute {
  const stops = Array.from({ length: Math.max(2, deliveries) }, (_, i) => {
    const id = i + 1;
    const priority = (i % 3) + 1;
    const estimatedMinutes = 10 + (i % 4) * 6;
    const risk = Math.min(100, Math.round(fatigueScore * 0.55 + priority * 8 + estimatedMinutes * 0.5));
    return {
      id,
      label: `Delivery #${id}`,
      address: `Stop ${id}`,
      priority,
      estimatedMinutes,
      risk,
    };
  }).sort((a, b) => a.priority - b.priority || a.risk - b.risk);

  const totalTime = stops.reduce((acc, stop) => acc + stop.estimatedMinutes, 0);
  const breakAfterStop = fatigueScore > 65 ? 2 : fatigueScore > 35 ? 4 : 6;

  return {
    stops,
    totalTime,
    breakAfterStop: Math.min(Math.max(1, breakAfterStop), stops.length),
    iterations: 1,
    tourLength: totalTime,
    pheromoneStrength: 50,
  };
}

export async function runACO(
  deliveries: number,
  fatigueScore: number,
  nodes?: DeliveryNode[],
): Promise<ACORoute> {
  try {
    const response = await apiRequest("POST", "/api/soft/routes/optimize", {
      deliveries,
      fatigueScore,
      nodes,
    });
    return (await response.json()) as ACORoute;
  } catch {
    return localFallbackRoute(deliveries, fatigueScore);
  }
}

