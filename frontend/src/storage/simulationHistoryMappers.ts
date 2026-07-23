import type { SimulationResult } from "../domain/simulation";
import type { SimulationHistoryEntry } from "../domain/simulationHistory";
import type {
  SimulationHistoryEntryDto,
  StoredSimulationResultDto,
} from "./simulationHistoryDtos";

const CURRENT_SIM_HISTORY_SCHEMA_VERSION = 2;

type LegacyCycleTimePoint = {
  week?: unknown;
  cycleTime?: unknown;
  cycleTimeDays?: unknown;
  count?: unknown;
};

type LegacySimulationHistoryEntry = Record<string, unknown> & {
  schemaVersion?: unknown;
  cycleTimeData?: unknown;
  cycleTimeDaysData?: unknown;
};

function toFiniteNumber(value: unknown, fallback = 0): number {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function toOptionalSeed(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function toWeeklyThroughput(
  value: unknown,
): SimulationHistoryEntry["weeklyThroughput"] {
  return Array.isArray(value)
    ? value.filter((item) => item && typeof item === "object") as SimulationHistoryEntry["weeklyThroughput"]
    : [];
}

function toOptionalWarning(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function normalizeCycleTimeDaysData(value: unknown, schemaVersion?: unknown) {
  if (!Array.isArray(value)) return [];
  const shouldMigrateWeeksToDays = schemaVersion == null;

  return value
    .filter((point): point is LegacyCycleTimePoint => Boolean(point && typeof point === "object"))
    .map((point) => {
      const week = String(point.week ?? "").slice(0, 10);
      const legacyCycleTimeDays = toFiniteNumber(point.cycleTimeDays, Number.NaN);
      const legacyCycleTimeWeeks = toFiniteNumber(point.cycleTime, Number.NaN);
      const baseCycleTimeDays = Number.isFinite(legacyCycleTimeDays)
        ? legacyCycleTimeDays
        : Number.isFinite(legacyCycleTimeWeeks)
          ? legacyCycleTimeWeeks
          : 0;

      return {
        week,
        cycleTimeDays: Number((shouldMigrateWeeksToDays ? baseCycleTimeDays * 7 : baseCycleTimeDays).toFixed(2)),
        count: Math.max(0, Math.floor(toFiniteNumber(point.count))),
      };
    })
    .filter((point) => point.week);
}

function storedResultToModel(value: unknown): SimulationResult {
  const result = value && typeof value === "object"
    ? value as Partial<StoredSimulationResultDto>
    : {};
  return {
    resultKind: result.result_kind === "items" ? "items" : "weeks",
    samplesCount: toFiniteNumber(result.samples_count),
    seed: toFiniteNumber(result.seed),
    resultPercentiles: result.result_percentiles ?? {},
    ...(typeof result.risk_score === "number" ? { riskScore: result.risk_score } : {}),
    resultDistribution: Array.isArray(result.result_distribution) ? result.result_distribution : [],
    ...(result.completion_summary
      ? {
          completionSummary: {
            completedCount: result.completion_summary.completed_count,
            censoredCount: result.completion_summary.censored_count,
            censoredRate: result.completion_summary.censored_rate,
            horizonWeeks: result.completion_summary.horizon_weeks,
          },
        }
      : {}),
    ...(result.throughput_reliability
      ? {
          throughputReliability: {
            cv: result.throughput_reliability.cv,
            iqrRatio: result.throughput_reliability.iqr_ratio,
            slopeNorm: result.throughput_reliability.slope_norm,
            label: result.throughput_reliability.label,
            samplesCount: result.throughput_reliability.samples_count,
          },
        }
      : {}),
  };
}

function simulationResultToStorageDto(result: SimulationResult): StoredSimulationResultDto {
  return {
    result_kind: result.resultKind,
    samples_count: result.samplesCount,
    seed: result.seed,
    result_percentiles: result.resultPercentiles,
    ...(result.riskScore === undefined ? {} : { risk_score: result.riskScore }),
    result_distribution: result.resultDistribution,
    ...(result.completionSummary === undefined
      ? {}
      : {
          completion_summary: {
            completed_count: result.completionSummary.completedCount,
            censored_count: result.completionSummary.censoredCount,
            censored_rate: result.completionSummary.censoredRate,
            horizon_weeks: result.completionSummary.horizonWeeks,
          },
        }),
    ...(result.throughputReliability === undefined
      ? {}
      : {
          throughput_reliability: {
            cv: result.throughputReliability.cv,
            iqr_ratio: result.throughputReliability.iqrRatio,
            slope_norm: result.throughputReliability.slopeNorm,
            label: result.throughputReliability.label,
            samples_count: result.throughputReliability.samplesCount,
          },
        }),
  };
}

export function simulationHistoryDtoToModel(value: unknown): SimulationHistoryEntry | null {
  if (!value || typeof value !== "object") return null;
  const entry = value as LegacySimulationHistoryEntry;
  return {
    schemaVersion: CURRENT_SIM_HISTORY_SCHEMA_VERSION,
    id: String(entry.id ?? ""),
    seed: toOptionalSeed(entry.seed),
    createdAt: String(entry.createdAt ?? ""),
    selectedOrg: String(entry.selectedOrg ?? ""),
    selectedProject: String(entry.selectedProject ?? ""),
    selectedTeam: String(entry.selectedTeam ?? ""),
    startDate: String(entry.startDate ?? ""),
    endDate: String(entry.endDate ?? ""),
    simulationMode: entry.simulationMode === "weeks_to_items" ? "weeks_to_items" : "backlog_to_weeks",
    includeZeroWeeks: Boolean(entry.includeZeroWeeks),
    backlogSize: toFiniteNumber(entry.backlogSize),
    targetWeeks: toFiniteNumber(entry.targetWeeks),
    nSims: Math.max(1, Math.floor(toFiniteNumber(entry.nSims, 1))),
    types: toStringArray(entry.types),
    doneStates: toStringArray(entry.doneStates),
    sampleStats: (entry.sampleStats ?? null) as SimulationHistoryEntry["sampleStats"],
    weeklyThroughput: toWeeklyThroughput(entry.weeklyThroughput),
    cycleTimeDaysData: normalizeCycleTimeDaysData(
      entry.cycleTimeDaysData ?? entry.cycleTimeData,
      entry.schemaVersion,
    ),
    result: storedResultToModel(entry.result),
    warning: toOptionalWarning(entry.warning),
  };
}

export function simulationHistoryModelToDto(
  entry: SimulationHistoryEntry,
): SimulationHistoryEntryDto {
  return {
    schemaVersion: CURRENT_SIM_HISTORY_SCHEMA_VERSION,
    id: entry.id,
    seed: entry.seed,
    createdAt: entry.createdAt,
    selectedOrg: entry.selectedOrg,
    selectedProject: entry.selectedProject,
    selectedTeam: entry.selectedTeam,
    startDate: entry.startDate,
    endDate: entry.endDate,
    simulationMode: entry.simulationMode,
    includeZeroWeeks: entry.includeZeroWeeks,
    backlogSize: entry.backlogSize,
    targetWeeks: entry.targetWeeks,
    nSims: entry.nSims,
    types: entry.types,
    doneStates: entry.doneStates,
    sampleStats: entry.sampleStats,
    weeklyThroughput: entry.weeklyThroughput,
    ...(entry.cycleTimeDaysData === undefined ? {} : { cycleTimeDaysData: entry.cycleTimeDaysData }),
    result: simulationResultToStorageDto(entry.result),
    ...(entry.warning === undefined ? {} : { warning: entry.warning }),
  };
}

export function parseSimulationHistory(raw: string | null): SimulationHistoryEntry[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(simulationHistoryDtoToModel)
      .filter((entry): entry is SimulationHistoryEntry => entry !== null);
  } catch {
    return [];
  }
}
