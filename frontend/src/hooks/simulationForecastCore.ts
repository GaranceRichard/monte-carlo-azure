import { getTeamDeliveryDataDirect } from "../adoClient";
import { postSimulate } from "../api";
import {
  simulateResponseDtoToResult,
  simulationCommandToDto,
} from "../api/simulationMappers";
import { getDemoCycleTime, getDemoThroughputSamples, getDemoWeeklyThroughput } from "../demoData";
import type {
  SimulationCommand,
  SimulationResult,
} from "../domain/simulation";
import { toSafeNumber } from "../utils/math";
import {
  SIMULATION_THROUGHPUT_SAMPLES_MIN,
  validateSimulationInputContract,
} from "../simulationLimits";
import {
  computeRiskScoreFromPercentiles,
  generateSimulationSeed,
  simulateMonteCarloLocal,
} from "../utils/simulation";
import type {
  FetchTeamThroughputParams,
  FetchTeamThroughputResult,
  RunSimulationForecastParams,
  RunSimulationForecastResult,
  SimulateFromSamplesParams,
} from "./simulationForecastService";
import type { SampleStats, SimulationHistoryEntry } from "../domain/simulationHistory";

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
      cycleTimeDaysData: getDemoCycleTime(selectedTeam),
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
  if (throughputSamples.length < SIMULATION_THROUGHPUT_SAMPLES_MIN) {
    throw new Error(
      "Historique insuffisant pour une simulation fiable. Elargissez la periode selectionnee, verifiez les types et etats choisis, ou activez les semaines a 0 incluses.",
    );
  }

  return {
    weeklyThroughput: weekly,
    cycleTimeDaysData: throughputResponse.cycleTimeDaysData,
    throughputSamples,
    sampleStats,
    warning,
  };
}

export async function simulateForecastFromSamplesCore(
  params: SimulateFromSamplesParams,
): Promise<SimulationResult> {
  const {
    demoMode = false,
    seed,
    throughputSamples,
    includeZeroWeeks = true,
    simulationMode,
    backlogSize,
    targetWeeks,
    nSims,
  } = params;
  const simulationSeed = seed ?? generateSimulationSeed();
  const contract = validateSimulationInputContract({
    throughputSamples,
    includeZeroWeeks,
    mode: simulationMode,
    backlogSize,
    targetWeeks,
    nSims,
  });
  const command: SimulationCommand = {
    seed: simulationSeed,
    throughputSamples,
    includeZeroWeeks,
    mode: simulationMode,
    backlogSize: contract.backlogSize,
    targetWeeks: contract.targetWeeks,
    nSims: contract.nSims,
  };

  if (demoMode) {
    return simulateMonteCarloLocal(command);
  }

  const response = simulateResponseDtoToResult(
    await postSimulate(simulationCommandToDto(command)),
  );
  const resolvedRiskScore = response.riskScore
    ?? computeRiskScoreFromPercentiles(simulationMode, response.resultPercentiles);
  return {
    ...response,
    riskScore: resolvedRiskScore ?? undefined,
    resultDistribution: response.resultDistribution ?? [],
  };
}

export async function runSimulationForecastCore(
  params: RunSimulationForecastParams,
): Promise<RunSimulationForecastResult> {
  const {
    demoMode = false,
    seed,
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
    seed,
    throughputSamples: throughputData.throughputSamples,
    includeZeroWeeks,
    simulationMode,
    backlogSize,
    targetWeeks,
    nSims,
  });

  const historyEntry: SimulationHistoryEntry = {
    schemaVersion: 2,
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${String(adjusted.seed)}-${String(generateSimulationSeed())}`,
    seed: adjusted.seed,
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
    cycleTimeDaysData: throughputData.cycleTimeDaysData,
    result: adjusted,
    warning: throughputData.warning,
  };

  return {
    weeklyThroughput: throughputData.weeklyThroughput,
    cycleTimeDaysData: throughputData.cycleTimeDaysData,
    sampleStats: throughputData.sampleStats,
    result: adjusted,
    historyEntry,
    warning: throughputData.warning,
  };
}
