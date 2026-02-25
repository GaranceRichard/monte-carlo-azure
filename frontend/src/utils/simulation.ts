import type { ForecastMode, ForecastResponse } from "../types";
import { clamp } from "./math";

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
    return {
      ...response,
      result_percentiles: Object.fromEntries(
        Object.entries(response.result_percentiles).map(([key, value]) => [key, Number(value) + lostWeeks]),
      ),
      result_distribution: response.result_distribution.map((bucket) => ({
        ...bucket,
        x: Number(bucket.x) + lostWeeks,
      })),
    };
  }

  const horizon = Math.max(1, targetWeeksValue);
  const itemFactor = clamp((horizon - lostWeeks) / horizon, 0, 1);
  return {
    ...response,
    result_percentiles: Object.fromEntries(
      Object.entries(response.result_percentiles).map(([key, value]) => [key, Number(value) * itemFactor]),
    ),
    result_distribution: response.result_distribution.map((bucket) => ({
      ...bucket,
      x: Number(bucket.x) * itemFactor,
    })),
  };
}
