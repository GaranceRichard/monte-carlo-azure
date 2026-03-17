import { getTeamDeliveryDataDirect } from "../adoClient";
import { postSimulate } from "../api";
import { DEMO_CONFIG, getDemoCycleTime, getDemoThroughputSamples, getDemoWeeklyThroughput } from "../demoData";
import type {
  ForecastHistogramBucket,
  ForecastRequestPayload,
  ForecastResponse,
} from "../types";
import { toSafeNumber } from "../utils/math";
import { computeRiskScoreFromPercentiles, simulateMonteCarloLocal } from "../utils/simulation";
import type {
  FetchTeamThroughputParams,
  FetchTeamThroughputResult,
  RunSimulationForecastParams,
  RunSimulationForecastResult,
  SimulateFromSamplesParams,
} from "./simulationForecastService";
import type { SampleStats, SimulationHistoryEntry } from "./simulationTypes";

export async function fetchTeamThroughputCore(
  params: FetchTeamThroughputParams,
): Promise<FetchTeamThroughputResult> {
  const {
    demoMode = false,
    selectedOrg,
    selectedProject,
    selectedTeam,
    pat,
    serverUrl,
    startDate,
    endDate,
    doneStates,
    types,
    includeZeroWeeks,
  } = params;

  if (demoMode) {
    const weekly = getDemoWeeklyThroughput(selectedTeam);
    const throughputSamples = getDemoThroughputSamples(selectedTeam).filter((n) => (includeZeroWeeks ? n >= 0 : n > 0));
    return {
      weeklyThroughput: weekly,
      cycleTimeData: getDemoCycleTime(selectedTeam),
      throughputSamples,
      sampleStats: {
        totalWeeks: weekly.length,
        zeroWeeks: weekly.filter((row) => row.throughput === 0).length,
        usedWeeks: throughputSamples.length,
      },
    };
  }

  const throughputResponse = await getTeamDeliveryDataDirect(
    selectedOrg,
    selectedProject,
    selectedTeam,
    pat,
    startDate,
    endDate,
    doneStates,
    types,
    serverUrl,
  );
  const weekly = throughputResponse.weeklyThroughput;
  const warning = throughputResponse.warning;
  const throughputSamples = weekly.map((r) => r.throughput).filter((n) => (includeZeroWeeks ? n >= 0 : n > 0));
  const zeroWeeks = weekly.filter((r) => r.throughput === 0).length;
  const sampleStats: SampleStats = {
    totalWeeks: weekly.length,
    zeroWeeks,
    usedWeeks: throughputSamples.length,
  };
  if (throughputSamples.length < 6) {
    throw new Error(
      "Historique insuffisant pour une simulation fiable. Elargissez la periode selectionnee, verifiez les types et etats choisis, ou activez les semaines a 0 incluses.",
    );
  }

  return {
    weeklyThroughput: weekly,
    cycleTimeData: throughputResponse.cycleTimeData,
    throughputSamples,
    sampleStats,
    warning,
  };
}

export async function simulateForecastFromSamplesCore(
  params: SimulateFromSamplesParams,
): Promise<ForecastResponse> {
  const {
    demoMode = false,
    throughputSamples,
    includeZeroWeeks = true,
    simulationMode,
    backlogSize,
    targetWeeks,
    nSims,
    selectedOrg,
    selectedProject,
    selectedTeam,
    startDate,
    endDate,
    doneStates = [],
    types = [],
  } = params;

  if (demoMode) {
    return simulateMonteCarloLocal({
      throughputSamples,
      includeZeroWeeks,
      mode: simulationMode,
      backlogSize: simulationMode === "backlog_to_weeks" ? Number(backlogSize) : undefined,
      targetWeeks: simulationMode === "weeks_to_items" ? Number(targetWeeks) : undefined,
      nSims: Number(nSims),
    });
  }

  const payload: ForecastRequestPayload = {
    throughput_samples: throughputSamples,
    include_zero_weeks: includeZeroWeeks,
    mode: simulationMode,
    backlog_size: simulationMode === "backlog_to_weeks" ? Number(backlogSize) : undefined,
    target_weeks: simulationMode === "weeks_to_items" ? Number(targetWeeks) : undefined,
    n_sims: Number(nSims),
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
  return {
    result_kind: response.result_kind,
    samples_count: response.samples_count,
    result_percentiles: response.result_percentiles,
    risk_score: Number(response.risk_score ?? computeRiskScoreFromPercentiles(simulationMode, response.result_percentiles)),
    result_distribution: (response.result_distribution ?? []) as ForecastHistogramBucket[],
    throughput_reliability: response.throughput_reliability,
  };
}

export async function runSimulationForecastCore(
  params: RunSimulationForecastParams,
): Promise<RunSimulationForecastResult> {
  const {
    demoMode = false,
    selectedOrg,
    selectedProject,
    selectedTeam,
    pat,
    serverUrl,
    startDate,
    endDate,
    doneStates,
    types,
    includeZeroWeeks,
    simulationMode,
    backlogSize,
    targetWeeks,
    nSims,
  } = params;

  const throughputData = await fetchTeamThroughputCore({
    demoMode,
    selectedOrg,
    selectedProject,
    selectedTeam,
    pat,
    serverUrl,
    startDate,
    endDate,
    doneStates,
    types,
    includeZeroWeeks,
  });

  const adjusted = await simulateForecastFromSamplesCore({
    demoMode,
    throughputSamples: throughputData.throughputSamples,
    includeZeroWeeks,
    simulationMode,
    backlogSize,
    targetWeeks,
    nSims,
    selectedOrg,
    selectedProject: selectedProject || DEMO_CONFIG.project,
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
    types: [...types],
    doneStates: [...doneStates],
    sampleStats: throughputData.sampleStats,
    weeklyThroughput: throughputData.weeklyThroughput,
    cycleTimeData: throughputData.cycleTimeData,
    result: adjusted,
    warning: throughputData.warning,
  };

  return {
    weeklyThroughput: throughputData.weeklyThroughput,
    cycleTimeData: throughputData.cycleTimeData,
    sampleStats: throughputData.sampleStats,
    result: adjusted,
    historyEntry,
    warning: throughputData.warning,
  };
}
