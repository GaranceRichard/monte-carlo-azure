import type { ForecastMode, ForecastResponse } from "../types";
import { clamp } from "./math";

export type ScenarioSamples = {
  optimiste: number[];
  arrime: number[];
  conservateur: number[];
};

function pickBootstrapSample(samples: number[]): number {
  const randomIndex = Math.floor(Math.random() * samples.length);
  return samples[randomIndex] ?? 0;
}

export function buildScenarioSamples(teamSamples: number[][], arrimageRate: number): ScenarioSamples {
  if (!teamSamples.length) {
    throw new Error("buildScenarioSamples: teamSamples ne peut pas etre vide.");
  }
  if (teamSamples.some((samples) => !samples.length)) {
    throw new Error("buildScenarioSamples: chaque equipe doit contenir au moins un sample.");
  }

  const maxLength = Math.max(...teamSamples.map((samples) => samples.length));
  const safeRate = clamp(arrimageRate, 0, 100) / 100;
  const optimiste: number[] = [];
  const arrime: number[] = [];
  const conservateur: number[] = [];

  for (let index = 0; index < maxLength; index += 1) {
    const draws = teamSamples.map((samples) => pickBootstrapSample(samples));
    const optimisticValue = draws.reduce((sum, value) => sum + value, 0);
    const conservativeValue = Math.min(...draws);
    optimiste.push(optimisticValue);
    conservateur.push(conservativeValue);
    arrime.push(draws.length === 1 ? optimisticValue : Math.floor(optimisticValue * safeRate));
  }

  return { optimiste, arrime, conservateur };
}

export function computeRiskLegend(score: number): "fiable" | "incertain" | "fragile" | "non fiable" {
  if (score <= 0.2) return "fiable";
  if (score <= 0.5) return "incertain";
  if (score <= 0.8) return "fragile";
  return "non fiable";
}

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
