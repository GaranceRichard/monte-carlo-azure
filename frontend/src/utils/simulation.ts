import type {
  SimulationCommand,
  SimulationMode,
  SimulationPercentiles,
  SimulationResult,
  ThroughputReliability,
} from "../domain/simulation";
import type { SampleIndexDrawPort } from "../domain/sampleIndexDrawPort";
import type { WeeklyThroughputRow } from "../types";
import {
  createCompletionSummary,
  createHistogram,
  createSimulationPercentiles,
  createThroughputReliability,
  riskScoreFromPercentiles,
  SIMULATION_HORIZON_WEEKS_MAX,
} from "../domain/simulationValueObjects";
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

export { SIMULATION_SEED_MAX } from "../domain/simulationValueObjects";

function pickBootstrapSample(
  samples: number[],
  drawPort: SampleIndexDrawPort,
): number {
  return samples[drawPort.drawSampleIndex(samples.length)] ?? 0;
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

export function discretePercentiles(
  values: number[],
  simulationMode: SimulationMode,
  ps: readonly (50 | 70 | 90)[],
  totalCount?: number,
) : SimulationPercentiles {
  if (simulationMode !== "backlog_to_weeks" && simulationMode !== "weeks_to_items") {
    throw new Error("mode de simulation invalide.");
  }
  const sorted = [...values].sort((a, b) => a - b);
  if (simulationMode === "backlog_to_weeks") {
    if (
      !Number.isSafeInteger(totalCount)
      || (totalCount ?? 0) <= 0
      || (totalCount ?? 0) < values.length
    ) {
      throw new Error("totalCount doit etre un entier couvrant la population totale.");
    }
  } else if (totalCount !== undefined) {
    throw new Error("totalCount est interdit pour weeks_to_items.");
  }
  const percentileValues = Object.fromEntries(
    ps.flatMap((p) => {
      if (simulationMode === "weeks_to_items") {
        if (!sorted.length) return [];
        const index = Math.floor(((100 - p) * (sorted.length - 1)) / 100);
        return [[`P${p}`, sorted[index]]];
      }
      const rank = Math.ceil((p * (totalCount ?? 0)) / 100);
      if (sorted.length < rank) {
        return [];
      }
      return [[`P${p}`, sorted[rank - 1]]];
    }),
  );
  return createSimulationPercentiles(simulationMode, percentileValues);
}

export function simulateBacklogToWeeks(
  samples: readonly number[],
  backlogSize: number,
  nSims: number,
  drawPort: SampleIndexDrawPort,
): { completedWeeks: number[]; simulationCount: number } {
  const completedWeeks: number[] = [];
  for (let index = 0; index < nSims; index += 1) {
    let remaining = backlogSize;
    let weeks = 0;
    while (remaining > 0 && weeks < SIMULATION_HORIZON_WEEKS_MAX) {
      remaining -= samples[drawPort.drawSampleIndex(samples.length)] ?? 0;
      weeks += 1;
    }
    const unusedDrawSlots = SIMULATION_HORIZON_WEEKS_MAX - weeks;
    if (unusedDrawSlots > 0) {
      drawPort.skipSampleIndices(unusedDrawSlots);
    }
    if (remaining <= 0) {
      completedWeeks.push(weeks);
    }
  }
  return { completedWeeks, simulationCount: nSims };
}

export function simulateWeeksToItems(
  samples: readonly number[],
  targetWeeks: number,
  nSims: number,
  drawPort: SampleIndexDrawPort,
): number[] {
  const results = new Array<number>(nSims);
  for (let index = 0; index < nSims; index += 1) {
    let delivered = 0;
    for (let week = 0; week < targetWeeks; week += 1) {
      delivered += samples[drawPort.drawSampleIndex(samples.length)] ?? 0;
    }
    results[index] = delivered;
  }
  return results;
}

export function simulateMonteCarloLocal(
  command: SimulationCommand,
  drawPort: SampleIndexDrawPort,
): SimulationResult {
  const samples = command.throughputSamples.usableValues;
  const backlogSimulation = command.mode === "backlog_to_weeks"
    ? simulateBacklogToWeeks(samples, command.backlogSize, command.nSims, drawPort)
    : undefined;
  const results = command.mode === "backlog_to_weeks"
    ? backlogSimulation!.completedWeeks
    : simulateWeeksToItems(samples, command.targetWeeks, command.nSims, drawPort);
  const distributionValues = results;
  const completionSummary = backlogSimulation === undefined
    ? undefined
    : createCompletionSummary({
        completedCount: distributionValues.length,
        censoredCount: backlogSimulation.simulationCount - distributionValues.length,
        nSims: command.nSims,
      });
  const resultPercentiles = discretePercentiles(
    distributionValues,
    command.mode,
    [50, 70, 90],
    backlogSimulation?.simulationCount,
  );
  const riskScore = riskScoreFromPercentiles(command.mode, resultPercentiles);
  const throughputReliability = computeThroughputReliability(samples)!;
  return Object.freeze({
    resultKind: command.mode === "backlog_to_weeks" ? "weeks" : "items",
    samplesCount: samples.length,
    seed: command.seed,
    resultPercentiles,
    ...(riskScore === undefined ? {} : { riskScore }),
    resultDistribution: createHistogram(
      histogramBuckets(distributionValues),
      distributionValues.length,
    ),
    ...(completionSummary === undefined ? {} : { completionSummary }),
    throughputReliability,
  });
}

export function buildScenarioSamples(
  teamSamples: number[][],
  alignmentRate: number,
  drawPort: SampleIndexDrawPort,
): ScenarioSamples {
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
  const optimistic: number[] = [];
  const aligned: number[] = [];
  const friction: number[] = [];

  for (let index = 0; index < maxLength; index += 1) {
    const draws = teamSamples.map((samples) => pickBootstrapSample(samples, drawPort));
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

export function computeThroughputReliability(samples: readonly number[]): ThroughputReliability | null {
  if (!samples.length) return null;
  if (samples.some((value) => !Number.isInteger(value) || value < 0)) {
    throw new Error("throughput_samples doit contenir uniquement des entiers finis >= 0.");
  }
  const values = [...samples];

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

  return createThroughputReliability({
    cv,
    iqrRatio,
    slopeNorm,
    samplesCount: sampleCount,
    mean,
  });
}

export function getProjectionReliabilityNotice(reliability?: ThroughputReliability | null): string | null {
  if (!reliability) return null;
  if (reliability.cv >= 1 || reliability.iqrRatio >= 1) {
    return "Historique trop volatil pour fonder une projection fiable. Les percentiles restent utiles pour explorer des scenarios, pas pour soutenir un engagement.";
  }
  if (reliability.label === "non fiable") {
    return "Projection non fiable: l'historique disponible est trop court ou trop degrade pour soutenir un engagement.";
  }
  return null;
}
