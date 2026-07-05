import type {
  CompletionSummary,
  ForecastMode,
  ForecastPercentiles,
  ForecastResponse,
  ThroughputReliability,
  WeeklyThroughputRow,
} from "../types";
import { clamp } from "./math";

export type ScenarioSamples = {
  optimistic: number[];
  aligned: number[];
  friction: number[];
};

function normalizeAlignmentRate(alignmentRate: number): number {
  return clamp(alignmentRate, 0, 100) / 100;
}

export function computeFrictionExponent(teamCount: number): number {
  return Math.max(0, Math.floor(teamCount) - 1);
}

export function computeFrictionFactor(teamCount: number, alignmentRate: number): number {
  return normalizeAlignmentRate(alignmentRate) ** computeFrictionExponent(teamCount);
}

export function computeFrictionRatePercent(teamCount: number, alignmentRate: number): number {
  return Math.round(computeFrictionFactor(teamCount, alignmentRate) * 100);
}

export const SIMULATION_SEED_MAX = 0xffffffff;

export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateSimulationSeed(): number {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.getRandomValues) {
    return cryptoApi.getRandomValues(new Uint32Array(1))[0] ?? 0;
  }
  return Date.now() >>> 0;
}

function pickBootstrapSample(samples: number[], random: () => number): number {
  const randomIndex = Math.floor(random() * samples.length);
  return samples[randomIndex] ?? 0;
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

function normalizeSamples(samples: number[], includeZeroWeeks: boolean): number[] {
  const normalized = samples.filter((value) => Number.isFinite(value) && (includeZeroWeeks ? value >= 0 : value > 0));
  if (!normalized.length) {
    throw new Error(
      includeZeroWeeks
        ? "throughput_samples ne contient aucune valeur >= 0"
        : "throughput_samples ne contient aucune valeur > 0",
    );
  }
  return normalized.map((value) => Math.floor(value));
}

function histogramBuckets(values: number[], maxBuckets = 100): { x: number; count: number }[] {
  if (!values.length) return [];

  const counts = new Map<number, number>();
  values.forEach((value) => {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  });
  const unique = Array.from(counts.entries()).sort((a, b) => a[0] - b[0]);
  if (unique.length <= maxBuckets) {
    return unique.map(([x, count]) => ({ x, count }));
  }

  const minValue = unique[0]?.[0] ?? 0;
  const maxValue = unique[unique.length - 1]?.[0] ?? 0;
  const bucketWidth = Math.max(1, Math.ceil((maxValue - minValue + 1) / maxBuckets));
  const buckets = new Map<number, number>();

  values.forEach((value) => {
    const bucketIndex = Math.floor((value - minValue) / bucketWidth);
    const left = minValue + bucketIndex * bucketWidth;
    const center = Math.round(left + bucketWidth / 2);
    buckets.set(center, (buckets.get(center) ?? 0) + 1);
  });

  return Array.from(buckets.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([x, count]) => ({ x, count }));
}

function discreteQuantile(values: number[], q: number, mode: "higher" | "lower"): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rawIndex = q * (sorted.length - 1);
  const index = mode === "higher" ? Math.ceil(rawIndex) : Math.floor(rawIndex);
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))] ?? 0;
}

function discretePercentiles(
  values: number[],
  simulationMode: ForecastMode,
  ps: number[],
) : ForecastPercentiles {
  if (!values.length) return {};
  return Object.fromEntries(
    ps.map((p) => {
      if (simulationMode === "weeks_to_items") {
        return [`P${p}`, discreteQuantile(values, (100 - p) / 100, "lower")];
      }
      return [`P${p}`, discreteQuantile(values, p / 100, "higher")];
    }),
  );
}

export function simulateMonteCarloLocal({
  throughputSamples,
  includeZeroWeeks = true,
  mode,
  backlogSize,
  targetWeeks,
  nSims,
  seed,
}: {
  throughputSamples: number[];
  includeZeroWeeks?: boolean;
  mode: ForecastMode;
  backlogSize?: number;
  targetWeeks?: number;
  nSims: number;
  seed: number;
}): ForecastResponse {
  const samples = normalizeSamples(throughputSamples, includeZeroWeeks);
  const safeNSims = Math.max(1, Math.floor(nSims));
  const safeBacklog = Math.max(1, Math.floor(backlogSize ?? 0));
  const safeWeeks = Math.max(1, Math.floor(targetWeeks ?? 0));
  const random = createSeededRandom(seed);
  const results = new Array<number>(safeNSims);
  const completedFlags = new Array<boolean>(safeNSims).fill(true);
  let completionSummary: CompletionSummary | undefined;

  for (let i = 0; i < safeNSims; i += 1) {
    if (mode === "backlog_to_weeks") {
      let remaining = safeBacklog;
      let weeks = 0;
      while (remaining > 0 && weeks < 521) {
        const nextSample = samples[Math.floor(random() * samples.length)] ?? 0;
        remaining -= nextSample;
        weeks += 1;
      }
      results[i] = weeks || 521;
      completedFlags[i] = remaining <= 0;
      continue;
    }

    let delivered = 0;
    for (let week = 0; week < safeWeeks; week += 1) {
      delivered += samples[Math.floor(random() * samples.length)] ?? 0;
    }
    results[i] = delivered;
  }

  let distributionValues = results;
  if (mode === "backlog_to_weeks") {
    const horizonWeeks = 521;
    distributionValues = results.filter((_value, index) => completedFlags[index]);
    const completedCount = distributionValues.length;
    const censoredCount = results.length - completedCount;
    completionSummary = {
      completed_count: completedCount,
      censored_count: censoredCount,
      censored_rate: Number((censoredCount / results.length).toFixed(4)),
      horizon_weeks: horizonWeeks,
    };
  }

  const resultPercentiles = discretePercentiles(
    mode === "backlog_to_weeks" ? distributionValues : results,
    mode,
    [50, 70, 90],
  );
  const resolvedRiskScore = computeRiskScoreFromPercentiles(mode, resultPercentiles);
  return {
    result_kind: mode === "backlog_to_weeks" ? "weeks" : "items",
    samples_count: samples.length,
    seed,
    result_percentiles: resultPercentiles,
    risk_score: resolvedRiskScore == null ? undefined : Number(resolvedRiskScore.toFixed(4)),
    result_distribution: histogramBuckets(mode === "backlog_to_weeks" ? distributionValues : results),
    completion_summary: completionSummary,
    throughput_reliability: computeThroughputReliability(samples) ?? undefined,
  };
}

export function buildScenarioSamples(teamSamples: number[][], alignmentRate: number, seed: number): ScenarioSamples {
  if (!teamSamples.length) {
    throw new Error("buildScenarioSamples: teamSamples ne peut pas etre vide.");
  }
  if (teamSamples.some((samples) => !samples.length)) {
    throw new Error("buildScenarioSamples: chaque equipe doit contenir au moins un sample.");
  }

  const maxLength = Math.max(...teamSamples.map((samples) => samples.length));
  const teamCount = teamSamples.length;
  const safeRate = normalizeAlignmentRate(alignmentRate);
  const frictionFactor = computeFrictionFactor(teamCount, alignmentRate);
  const random = createSeededRandom(seed);
  const optimistic: number[] = [];
  const aligned: number[] = [];
  const friction: number[] = [];

  for (let index = 0; index < maxLength; index += 1) {
    const draws = teamSamples.map((samples) => pickBootstrapSample(samples, random));
    const optimisticValue = draws.reduce((sum, value) => sum + value, 0);
    const alignedValue = teamCount === 1 ? optimisticValue : Math.floor(optimisticValue * safeRate);
    const frictionValue = Math.floor(optimisticValue * frictionFactor);
    optimistic.push(optimisticValue);
    aligned.push(alignedValue);
    friction.push(frictionValue);
  }

  return { optimistic, aligned, friction };
}

function normalizeWeeklyThroughputRow(row: WeeklyThroughputRow, teamIndex: number): { week: string; throughput: number } {
  const week = String(row.week ?? "").slice(0, 10);
  const throughput = Number(row.throughput);

  if (!week) {
    throw new Error(`buildCorrelatedPortfolioSamples: semaine invalide pour l'equipe ${String(teamIndex + 1)}.`);
  }
  if (!Number.isFinite(throughput)) {
    throw new Error(`buildCorrelatedPortfolioSamples: throughput invalide pour la semaine ${week}.`);
  }

  return { week, throughput: Math.floor(throughput) };
}

export function buildCorrelatedPortfolioWeeklyThroughputs(
  teamWeeklyThroughputs: WeeklyThroughputRow[][],
  includeZeroWeeks: boolean,
): WeeklyThroughputRow[] {
  if (!teamWeeklyThroughputs.length) {
    throw new Error("buildCorrelatedPortfolioSamples: teamWeeklyThroughputs ne peut pas etre vide.");
  }

  const normalizedTeams = teamWeeklyThroughputs.map((rows, teamIndex) => {
    if (!rows.length) {
      throw new Error(`Historique corr\u00E9l\u00E9 indisponible: l'equipe ${String(teamIndex + 1)} n'a aucune semaine exploitable.`);
    }

    const seenWeeks = new Set<string>();
    return rows.map((row) => {
      const normalized = normalizeWeeklyThroughputRow(row, teamIndex);
      if (seenWeeks.has(normalized.week)) {
        throw new Error(`Historique corr\u00E9l\u00E9 indisponible: semaine dupliquee detectee (${normalized.week}).`);
      }
      seenWeeks.add(normalized.week);
      return normalized;
    });
  });

  const commonWeeks = normalizedTeams.reduce<Set<string>>((intersection, rows, teamIndex) => {
    const teamWeeks = new Set(rows.map((row) => row.week));
    if (teamIndex === 0) return teamWeeks;
    return new Set(Array.from(intersection).filter((week) => teamWeeks.has(week)));
  }, new Set<string>());

  if (!commonWeeks.size) {
    throw new Error("Historique corr\u00E9l\u00E9 indisponible: aucune semaine commune complete n'est disponible pour toutes les equipes.");
  }

  const orderedWeeks = normalizedTeams[0]
    .map((row) => row.week)
    .filter((week) => commonWeeks.has(week));

  const weeklyMaps = normalizedTeams.map((rows) => new Map(rows.map((row) => [row.week, row.throughput])));
  const alignedWeeklyTotals = orderedWeeks.map((week) => ({
    week,
    throughput: weeklyMaps.reduce((sum, teamMap) => sum + (teamMap.get(week) ?? 0), 0),
  }));

  const filteredWeeklyTotals = alignedWeeklyTotals.filter((row) => (includeZeroWeeks ? row.throughput >= 0 : row.throughput > 0));

  if (!filteredWeeklyTotals.length) {
    if (includeZeroWeeks) {
      throw new Error("Historique corr\u00E9l\u00E9 indisponible: aucune semaine commune complete ne produit un total portefeuille >= 0.");
    }
    throw new Error("Historique corr\u00E9l\u00E9 indisponible: aucune semaine commune complete ne produit un total portefeuille > 0.");
  }

  return filteredWeeklyTotals;
}

export function buildCorrelatedPortfolioSamples(
  teamWeeklyThroughputs: WeeklyThroughputRow[][],
  includeZeroWeeks: boolean,
): number[] {
  return buildCorrelatedPortfolioWeeklyThroughputs(teamWeeklyThroughputs, includeZeroWeeks).map((row) => row.throughput);
}

export function computeRiskLegend(score: number): "fiable" | "incertain" | "fragile" | "non fiable" {
  if (score <= 0.2) return "fiable";
  if (score <= 0.5) return "incertain";
  if (score <= 0.8) return "fragile";
  return "non fiable";
}

export function computeRiskScoreFromPercentiles(
  mode: ForecastMode,
  percentiles: ForecastPercentiles,
): number | null {
  const p50 = Number(percentiles?.P50 ?? 0);
  const p90 = Number(percentiles?.P90 ?? 0);
  if (!Number.isFinite(p50) || !Number.isFinite(p90) || p50 <= 0) return null;
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

export function getProjectionReliabilityNotice(reliability?: ThroughputReliability | null): string | null {
  if (!reliability) return null;
  if (reliability.cv >= 1 || reliability.iqr_ratio >= 1) {
    return "Historique trop volatil pour fonder une projection fiable. Les percentiles restent utiles pour explorer des scenarios, pas pour soutenir un engagement.";
  }
  if (reliability.label === "non fiable") {
    return "Projection non fiable: l'historique disponible est trop court ou trop degrade pour soutenir un engagement.";
  }
  return null;
}

