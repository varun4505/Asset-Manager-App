import { apiRequest } from "@/lib/query-client";
import {
  calculateFatigue,
  getBreakRecommendation,
  predictTimeToNextLevel,
  type BreakRecommendation,
  type FatigueLevel,
  type FatigueResult,
  type PredictionResult,
  type SessionInputs,
} from "@/lib/fatigueEngine";

export async function evaluateFatigueRemote(
  inputs: SessionInputs,
): Promise<FatigueResult> {
  try {
    const response = await apiRequest("POST", "/api/soft/fatigue/evaluate", inputs);
    return (await response.json()) as FatigueResult;
  } catch {
    return calculateFatigue(inputs);
  }
}

export async function predictFatigueRemote(
  inputs: SessionInputs,
): Promise<PredictionResult> {
  try {
    const response = await apiRequest("POST", "/api/soft/fatigue/predict", inputs);
    return (await response.json()) as PredictionResult;
  } catch {
    return predictTimeToNextLevel(inputs);
  }
}

export async function getBreakRecommendationRemote(
  score: number,
  level: FatigueLevel,
  minutesSinceBreak: number,
): Promise<BreakRecommendation> {
  try {
    const response = await apiRequest(
      "POST",
      "/api/soft/fatigue/break-recommendation",
      {
        score,
        level,
        minutesSinceBreak,
      },
    );
    return (await response.json()) as BreakRecommendation;
  } catch {
    return getBreakRecommendation(score, level, minutesSinceBreak);
  }
}
