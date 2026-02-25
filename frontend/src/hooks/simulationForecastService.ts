import { getWeeklyThroughputDirect } from "../adoClient";
import { postSimulate } from "../api";
import type {
  ForecastHistogramBucket,
  ForecastMode,
  ForecastRequestPayload,
  ForecastResponse,
} from "../types";
import type { SampleStats, SimulationHistoryEntry } from "./simulationTypes";
import { clamp, toSafeNumber } from "../utils/math";
import { applyCapacityReductionToResult } from "../utils/simulation";

type RunSimulationForecastParams = {
  selectedOrg: string;
  selectedProject: string;
  selectedTeam: string;
  pat: string;
  startDate: string;
  endDate: string;
  doneStates: string[];
  types: string[];
  includeZeroWeeks: boolean;
  simulationMode: ForecastMode;
  backlogSize: number | string;
  targetWeeks: number | string;
  nSims: number | string;
  capacityPercent: number | string;
  reducedCapacityWeeks: number | string;
};

type RunSimulationForecastResult = {
  weeklyThroughput: SimulationHistoryEntry["weeklyThroughput"];
  sampleStats: SampleStats;
  result: ForecastResponse;
  historyEntry: SimulationHistoryEntry;
};

export async function runSimulationForecast(params: RunSimulationForecastParams): Promise<RunSimulationForecastResult> {
  const {
    selectedOrg,
    selectedProject,
    selectedTeam,
    pat,
    startDate,
    endDate,
    doneStates,
    types,
    includeZeroWeeks,
    simulationMode,
    backlogSize,
    targetWeeks,
    nSims,
    capacityPercent,
    reducedCapacityWeeks,
  } = params;

  const weekly = await getWeeklyThroughputDirect(
    selectedOrg,
    selectedProject,
    selectedTeam,
    pat,
    startDate,
    endDate,
    doneStates,
    types,
  );

  const throughputSamples = weekly.map((r) => r.throughput).filter((n) => (includeZeroWeeks ? n >= 0 : n > 0));
  const zeroWeeks = weekly.filter((r) => r.throughput === 0).length;
  const sampleStats: SampleStats = {
    totalWeeks: weekly.length,
    zeroWeeks,
    usedWeeks: throughputSamples.length,
  };
  if (throughputSamples.length < 6) {
    throw new Error(
      "Historique insuffisant pour une simulation fiable. Ã‰largissez la pÃ©riode sÃ©lectionnÃ©e, ou vÃ©rifiez les types et Ã©tats de rÃ©solution choisis.",
    );
  }

  const payload: ForecastRequestPayload = {
    throughput_samples: throughputSamples,
    include_zero_weeks: includeZeroWeeks,
    mode: simulationMode,
    backlog_size: simulationMode === "backlog_to_weeks" ? Number(backlogSize) : undefined,
    target_weeks: simulationMode === "weeks_to_items" ? Number(targetWeeks) : undefined,
    n_sims: Number(nSims),
  };

  const response = await postSimulate(payload);
  const normalized: ForecastResponse = {
    result_kind: response.result_kind,
    samples_count: response.samples_count,
    result_percentiles: response.result_percentiles,
    result_distribution: (response.result_distribution ?? []) as ForecastHistogramBucket[],
  };
  const adjusted = applyCapacityReductionToResult(
    normalized,
    simulationMode,
    toSafeNumber(targetWeeks, 12),
    toSafeNumber(capacityPercent, 100),
    toSafeNumber(reducedCapacityWeeks, 0),
  );

  const historyEntry: SimulationHistoryEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    selectedOrg,
    selectedProject,
    selectedTeam,
    startDate,
    endDate,
    simulationMode,
    includeZeroWeeks,
    backlogSize: toSafeNumber(backlogSize, 120),
    targetWeeks: toSafeNumber(targetWeeks, 12),
    nSims: toSafeNumber(nSims, 20_000),
    capacityPercent: clamp(toSafeNumber(capacityPercent, 100), 1, 100),
    reducedCapacityWeeks: clamp(toSafeNumber(reducedCapacityWeeks, 0), 0, 260),
    types: [...types],
    doneStates: [...doneStates],
    sampleStats,
    weeklyThroughput: weekly,
    result: adjusted,
  };

  return {
    weeklyThroughput: weekly,
    sampleStats,
    result: adjusted,
    historyEntry,
  };
}
