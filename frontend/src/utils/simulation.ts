import type { ForecastMode, ThroughputReliability } from "../types";
import { clamp } from "./math";

export type ScenarioSamples = {
  optimistic: number[];
  aligned: number[];
  friction: number[];
  conservative: number[];
};

function pickBootstrapSample(samples: number[]): number {
  const randomIndex = Math.floor(Math.random() * samples.length);
  return samples[randomIndex] ?? 0;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] ?? 0;
  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0] ?? 0;
  const rank = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  const weight = rank - lower;
  const lowerValue = sorted[lower] ?? 0;
  const upperValue = sorted[upper] ?? lowerValue;
  return lowerValue + (upperValue - lowerValue) * weight;
}

export function buildScenarioSamples(teamSamples: number[][], alignmentRate: number): ScenarioSamples {
  if (!teamSamples.length) {
    throw new Error("buildScenarioSamples: teamSamples ne peut pas etre vide.");
  }
  if (teamSamples.some((samples) => !samples.length)) {
    throw new Error("buildScenarioSamples: chaque equipe doit contenir au moins un sample.");
  }

  const maxLength = Math.max(...teamSamples.map((samples) => samples.length));
  const safeRate = clamp(alignmentRate, 0, 100) / 100;
  const teamCount = teamSamples.length;
  const optimistic: number[] = [];
  const aligned: number[] = [];
  const friction: number[] = [];
  const conservative: number[] = [];

  for (let index = 0; index < maxLength; index += 1) {
    const draws = teamSamples.map((samples) => pickBootstrapSample(samples));
    const optimisticValue = draws.reduce((sum, value) => sum + value, 0);
    const conservativeValue = teamCount === 1 ? optimisticValue : median(draws) * teamCount;
    const alignedValue = teamCount === 1 ? optimisticValue : Math.floor(optimisticValue * safeRate);
    const frictionValue = teamCount === 1 ? alignedValue : Math.floor(optimisticValue * safeRate ** teamCount);
    optimistic.push(optimisticValue);
    conservative.push(conservativeValue);
    aligned.push(alignedValue);
    friction.push(frictionValue);
  }

  return { optimistic, aligned, friction, conservative };
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

export function computeThroughputReliability(samples: number[]): ThroughputReliability | null {
  if (!samples.length) return null;

  const values = samples.filter((value) => Number.isFinite(value));
  if (!values.length) return null;

  const sampleCount = values.length;
  const mean = values.reduce((sum, value) => sum + value, 0) / sampleCount;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / sampleCount;
  const std = Math.sqrt(variance);
  const q25 = percentile(values, 25);
  const q50 = percentile(values, 50);
  const q75 = percentile(values, 75);
  const cv = mean <= 0 ? 0 : std / mean;
  const iqrRatio = q50 <= 0 ? 0 : (q75 - q25) / q50;

  let slope = 0;
  if (sampleCount >= 2) {
    const xMean = (sampleCount - 1) / 2;
    const numerator = values.reduce((sum, value, index) => sum + (index - xMean) * (value - mean), 0);
    const denominator = values.reduce((sum, _value, index) => sum + (index - xMean) ** 2, 0);
    slope = denominator === 0 ? 0 : numerator / denominator;
  }
  const slopeNorm = mean <= 0 ? 0 : slope / mean;

  let label: ThroughputReliability["label"];
  if (sampleCount < 6 || cv >= 1.5 || slopeNorm <= -0.15 || mean <= 0) {
    label = "non fiable";
  } else if (cv >= 1 || iqrRatio >= 1 || Math.abs(slopeNorm) >= 0.1) {
    label = "fragile";
  } else if (cv >= 0.5 || iqrRatio >= 0.5 || Math.abs(slopeNorm) >= 0.05) {
    label = "incertain";
  } else {
    label = "fiable";
  }

  if (sampleCount < 8 && label === "fiable") {
    label = "incertain";
  }

  return {
    cv: Number(cv.toFixed(4)),
    iqr_ratio: Number(iqrRatio.toFixed(4)),
    slope_norm: Number(slopeNorm.toFixed(4)),
    label,
    samples_count: sampleCount,
  };
}
