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
import { applyCapacityReductionToResult, computeRiskScoreFromPercentiles } from "../utils/simulation";

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
  warning?: string;
};

type FetchTeamThroughputResult = {
  weeklyThroughput: SimulationHistoryEntry["weeklyThroughput"];
  throughputSamples: number[];
  sampleStats: SampleStats;
  warning?: string;
};

type FetchTeamThroughputParams = {
  selectedOrg: string;
  selectedProject: string;
  selectedTeam: string;
  pat: string;
  startDate: string;
  endDate: string;
  doneStates: string[];
  types: string[];
  includeZeroWeeks: boolean;
};

type SimulateFromSamplesParams = {
  throughputSamples: number[];
  includeZeroWeeks?: boolean;
  simulationMode: ForecastMode;
  backlogSize: number | string;
  targetWeeks: number | string;
  nSims: number | string;
  capacityPercent: number | string;
  reducedCapacityWeeks: number | string;
  selectedOrg?: string;
  selectedProject?: string;
  selectedTeam?: string;
  startDate?: string;
  endDate?: string;
  doneStates?: string[];
  types?: string[];
};

export async function fetchTeamThroughput(params: FetchTeamThroughputParams): Promise<FetchTeamThroughputResult> {
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
  } = params;

  const throughputResponse = await getWeeklyThroughputDirect(
    selectedOrg,
    selectedProject,
    selectedTeam,
    pat,
    startDate,
    endDate,
    doneStates,
    types,
  );
  const weekly = Array.isArray(throughputResponse) ? throughputResponse : throughputResponse.weeklyThroughput;
  const warning = Array.isArray(throughputResponse) ? undefined : throughputResponse.warning;
  const throughputSamples = weekly.map((r) => r.throughput).filter((n) => (includeZeroWeeks ? n >= 0 : n > 0));
  const zeroWeeks = weekly.filter((r) => r.throughput === 0).length;
  const sampleStats: SampleStats = {
    totalWeeks: weekly.length,
    zeroWeeks,
    usedWeeks: throughputSamples.length,
  };
  if (throughputSamples.length < 6) {
    throw new Error(
      "Historique insuffisant pour une simulation fiable. Elargissez la periode selectionnee, ou verifiez les types et etats de resolution choisis.",
    );
  }

  return {
    weeklyThroughput: weekly,
    throughputSamples,
    sampleStats,
    warning,
  };
}

export async function simulateForecastFromSamples(params: SimulateFromSamplesParams): Promise<ForecastResponse> {
  const {
    throughputSamples,
    includeZeroWeeks = true,
    simulationMode,
    backlogSize,
    targetWeeks,
    nSims,
    capacityPercent,
    reducedCapacityWeeks,
    selectedOrg,
    selectedProject,
    selectedTeam,
    startDate,
    endDate,
    doneStates = [],
    types = [],
  } = params;

  const payload: ForecastRequestPayload = {
    throughput_samples: throughputSamples,
    include_zero_weeks: includeZeroWeeks,
    mode: simulationMode,
    backlog_size: simulationMode === "backlog_to_weeks" ? Number(backlogSize) : undefined,
    target_weeks: simulationMode === "weeks_to_items" ? Number(targetWeeks) : undefined,
    n_sims: Number(nSims),
    capacity_percent: Number(capacityPercent),
    client_context: {
      selected_org: selectedOrg,
      selected_project: selectedProject,
      selected_team: selectedTeam,
      start_date: startDate,
      end_date: endDate,
      done_states: [...doneStates],
      types: [...types],
    },
  };

  const response = await postSimulate(payload);
  const normalized: ForecastResponse = {
    result_kind: response.result_kind,
    samples_count: response.samples_count,
    result_percentiles: response.result_percentiles,
    risk_score: Number(response.risk_score ?? computeRiskScoreFromPercentiles(simulationMode, response.result_percentiles)),
    result_distribution: (response.result_distribution ?? []) as ForecastHistogramBucket[],
  };

  return applyCapacityReductionToResult(
    normalized,
    simulationMode,
    toSafeNumber(targetWeeks, 12),
    toSafeNumber(capacityPercent, 100),
    toSafeNumber(reducedCapacityWeeks, 0),
  );
}

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

  const throughputData = await fetchTeamThroughput({
    selectedOrg,
    selectedProject,
    selectedTeam,
    pat,
    startDate,
    endDate,
    doneStates,
    types,
    includeZeroWeeks,
  });

  const adjusted = await simulateForecastFromSamples({
    throughputSamples: throughputData.throughputSamples,
    includeZeroWeeks,
    simulationMode,
    backlogSize,
    targetWeeks,
    nSims,
    capacityPercent,
    reducedCapacityWeeks,
    selectedOrg,
    selectedProject,
    selectedTeam,
    startDate,
    endDate,
    doneStates,
    types,
  });

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
    sampleStats: throughputData.sampleStats,
    weeklyThroughput: throughputData.weeklyThroughput,
    result: adjusted,
    warning: throughputData.warning,
  };

  return {
    weeklyThroughput: throughputData.weeklyThroughput,
    sampleStats: throughputData.sampleStats,
    result: adjusted,
    historyEntry,
    warning: throughputData.warning,
  };
}
