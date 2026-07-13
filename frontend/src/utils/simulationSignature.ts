import type { ForecastMode } from "../types";
import type { SimulationHistoryEntry } from "../hooks/simulationTypes";

export type SimulationSignatureInput = {
  selectedOrg: string;
  selectedProject: string;
  selectedTeam: string;
  startDate: string;
  endDate: string;
  simulationMode: ForecastMode;
  includeZeroWeeks: boolean;
  backlogSize: number | string;
  targetWeeks: number | string;
  nSims: number | string;
  types: readonly string[];
  doneStates: readonly string[];
};

export type CanonicalSimulationParameters = {
  selectedOrg: string;
  selectedProject: string;
  selectedTeam: string;
  startDate: string;
  endDate: string;
  simulationMode: ForecastMode;
  includeZeroWeeks: boolean;
  objective: { kind: "backlogSize" | "targetWeeks"; value: number };
  nSims: number;
  types: string[];
  doneStates: string[];
};

export type SimulationExecutionSnapshot = {
  signature: string;
  parameters: CanonicalSimulationParameters;
};

function normalizeValues(values: readonly string[]): string[] {
  return [...values].sort((left, right) => left.localeCompare(right));
}

export function canonicalizeSimulationParameters(
  input: SimulationSignatureInput,
): CanonicalSimulationParameters {
  return {
    selectedOrg: input.selectedOrg,
    selectedProject: input.selectedProject,
    selectedTeam: input.selectedTeam,
    startDate: input.startDate,
    endDate: input.endDate,
    simulationMode: input.simulationMode,
    includeZeroWeeks: input.includeZeroWeeks,
    objective: input.simulationMode === "weeks_to_items"
      ? { kind: "targetWeeks", value: Number(input.targetWeeks) }
      : { kind: "backlogSize", value: Number(input.backlogSize) },
    nSims: Number(input.nSims),
    types: normalizeValues(input.types),
    doneStates: normalizeValues(input.doneStates),
  };
}

export function buildSimulationExecutionSnapshot(
  input: SimulationSignatureInput,
): SimulationExecutionSnapshot {
  const parameters = canonicalizeSimulationParameters(input);
  return { parameters, signature: JSON.stringify(parameters) };
}

export function buildHistoryEntrySignature(entry: SimulationHistoryEntry): string {
  return buildSimulationExecutionSnapshot(entry).signature;
}

function hasFinitePercentiles(entry: SimulationHistoryEntry): boolean {
  const values = Object.values(entry.result.result_percentiles ?? {});
  return values.length > 0
    && values.every((value) => typeof value === "number" && Number.isFinite(value));
}

export function isReusableSimulationHistoryEntry(entry: SimulationHistoryEntry): boolean {
  const expectedResultKind = entry.simulationMode === "weeks_to_items" ? "items" : "weeks";
  const result = entry.result;
  const hasRiskInputs = typeof result.result_percentiles?.P50 === "number"
    && Number.isFinite(result.result_percentiles.P50)
    && typeof result.result_percentiles?.P90 === "number"
    && Number.isFinite(result.result_percentiles.P90);
  const hasCompletionSummary = entry.simulationMode !== "backlog_to_weeks"
    || Boolean(
      result.completion_summary
      && Number.isFinite(result.completion_summary.completed_count)
      && Number.isFinite(result.completion_summary.censored_count)
      && Number.isFinite(result.completion_summary.censored_rate)
      && Number.isFinite(result.completion_summary.horizon_weeks),
    );

  return entry.schemaVersion === 2
    && Boolean(entry.id && entry.createdAt && entry.selectedOrg && entry.selectedProject && entry.selectedTeam)
    && Boolean(entry.startDate && entry.endDate)
    && entry.types.length > 0
    && entry.doneStates.length > 0
    && Number.isFinite(entry.nSims)
    && entry.nSims > 0
    && typeof entry.seed === "number"
    && Number.isFinite(entry.seed)
    && Boolean(entry.sampleStats)
    && Number.isFinite(entry.sampleStats?.totalWeeks)
    && Number.isFinite(entry.sampleStats?.zeroWeeks)
    && Number.isFinite(entry.sampleStats?.usedWeeks)
    && Number(entry.sampleStats?.usedWeeks) > 0
    && entry.weeklyThroughput.length > 0
    && entry.weeklyThroughput.every((point) => Boolean(point.week) && Number.isFinite(point.throughput))
    && Array.isArray(entry.cycleTimeDaysData)
    && result.result_kind === expectedResultKind
    && result.samples_count > 0
    && Number.isFinite(result.seed)
    && result.seed === entry.seed
    && Boolean(result.result_percentiles)
    && hasFinitePercentiles(entry)
    && Array.isArray(result.result_distribution)
    && result.result_distribution.every((point) => Number.isFinite(point.x) && Number.isFinite(point.count))
    && (!hasRiskInputs || (typeof result.risk_score === "number" && Number.isFinite(result.risk_score)))
    && hasCompletionSummary;
}

export function findLatestReusableSimulation(
  history: readonly SimulationHistoryEntry[],
  signature: string,
): SimulationHistoryEntry | null {
  return [...history]
    .filter((entry) => (
      buildHistoryEntrySignature(entry) === signature
      && isReusableSimulationHistoryEntry(entry)
    ))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null;
}
