import type { ForecastMode, ForecastResponse } from "../types";
import { clamp } from "./math";

export function computeRiskScoreFromPercentiles(
  mode: ForecastMode,
  percentiles: Record<string, number>,
): number {
  const p50 = Number(percentiles?.P50 ?? 0);
  if (p50 <= 0) return 0;
  const p90 = Number(percentiles?.P90 ?? 0);
  if (mode === "weeks_to_items") {
    return Math.max(0, (p50 - p90) / p50);
  }
  return Math.max(0, (p90 - p50) / p50);
}

export function applyCapacityReductionToResult(
  response: ForecastResponse,
  mode: ForecastMode,
  targetWeeksValue: number,
  capacityPercentValue: number,
  reducedWeeksValue: number,
): ForecastResponse {
  const capacity = clamp(capacityPercentValue, 1, 100) / 100;
  const reducedWeeks = clamp(reducedWeeksValue, 0, 260);
  if (capacity >= 1 || reducedWeeks <= 0) return response;

  const lostWeeks = reducedWeeks * (1 - capacity);

  if (response.result_kind === "weeks") {
    const adjustedPercentiles = Object.fromEntries(
      Object.entries(response.result_percentiles).map(([key, value]) => [key, Number(value) + lostWeeks]),
    );
    return {
      ...response,
      result_percentiles: adjustedPercentiles,
      risk_score: computeRiskScoreFromPercentiles(mode, adjustedPercentiles),
      result_distribution: response.result_distribution.map((bucket) => ({
        ...bucket,
        x: Number(bucket.x) + lostWeeks,
      })),
    };
  }

  const horizon = Math.max(1, targetWeeksValue);
  const itemFactor = clamp((horizon - lostWeeks) / horizon, 0, 1);
  const adjustedPercentiles = Object.fromEntries(
    Object.entries(response.result_percentiles).map(([key, value]) => [key, Number(value) * itemFactor]),
  );
  return {
    ...response,
    result_percentiles: adjustedPercentiles,
    risk_score: computeRiskScoreFromPercentiles(mode, adjustedPercentiles),
    result_distribution: response.result_distribution.map((bucket) => ({
      ...bucket,
      x: Number(bucket.x) * itemFactor,
    })),
  };
}
