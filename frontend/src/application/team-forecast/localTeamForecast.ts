import { getTeamDeliveryDataDirect } from "../../adoClient";
import { createSeededSampleIndexDrawPort } from "../../adapters/seededSampleIndexDrawPort";
import { postSimulate } from "../../api";
import {
  simulateResponseDtoToResult,
  simulationCommandToDto,
} from "../../api/simulationMappers";
import { getDemoCycleTime, getDemoThroughputSamples, getDemoWeeklyThroughput } from "../../demoData";
import type { SimulationResult } from "../../domain/simulation";
import { createSimulationCommand } from "../../domain/simulation";
import type { SampleStats, SimulationHistoryEntry } from "../../domain/simulationHistory";
import { createThroughputSamples } from "../../domain/simulationValueObjects";
import { toSafeNumber } from "../../utils/math";
import { simulateMonteCarloLocal } from "../../utils/simulation";
import { resolveSimulationSeed } from "../../simulationSeedResolver";
import type {
  FetchTeamThroughputParams,
  FetchTeamThroughputResult,
  RunSimulationForecastParams,
  RunSimulationForecastResult,
  SimulateFromSamplesParams,
  TeamForecast,
} from "./contract";

const INSUFFICIENT_HISTORY_MESSAGE =
  "Historique insuffisant pour une simulation fiable. Elargissez la periode selectionnee, verifiez les types et etats choisis, ou activez les semaines a 0 incluses.";

function throwTranslatedHistoryError(error: unknown): never {
  if (
    error instanceof Error
    && (
      error.message.startsWith("Historique insuffisant")
      || error.message.startsWith("throughput_samples doit contenir entre")
    )
  ) {
    throw new Error(INSUFFICIENT_HISTORY_MESSAGE);
  }
  throw error;
}

function usableThroughputCount(
  throughputSamples: readonly number[],
  includeZeroWeeks: boolean,
): number {
  try {
    return createThroughputSamples(
      throughputSamples,
      includeZeroWeeks,
    ).usableValues.length;
  } catch (error) {
    throwTranslatedHistoryError(error);
  }
}

function fetchDemoTeamThroughput(
  selectedTeam: string,
  includeZeroWeeks: boolean,
): FetchTeamThroughputResult {
  const weeklyThroughput = getDemoWeeklyThroughput(selectedTeam);
  const throughputSamples = getDemoThroughputSamples(selectedTeam);
  return {
    weeklyThroughput,
    cycleTimeDaysData: getDemoCycleTime(selectedTeam),
    throughputSamples,
    sampleStats: {
      totalWeeks: weeklyThroughput.length,
      zeroWeeks: weeklyThroughput.filter((row) => row.throughput === 0).length,
      usedWeeks: usableThroughputCount(throughputSamples, includeZeroWeeks),
    },
  };
}

async function fetchRemoteTeamThroughput(
  params: FetchTeamThroughputParams,
): Promise<FetchTeamThroughputResult> {
  const response = await getTeamDeliveryDataDirect(
    params.selectedOrg,
    params.selectedProject,
    params.selectedTeam,
    params.pat,
    params.startDate,
    params.endDate,
    params.doneStates,
    params.types,
    params.serverUrl,
  );
  const weeklyThroughput = response.weeklyThroughput;
  const throughputSamples = weeklyThroughput.map((row) => row.throughput);
  const sampleStats: SampleStats = {
    totalWeeks: weeklyThroughput.length,
    zeroWeeks: weeklyThroughput.filter((row) => row.throughput === 0).length,
    usedWeeks: usableThroughputCount(throughputSamples, params.includeZeroWeeks),
  };
  return {
    weeklyThroughput,
    cycleTimeDaysData: response.cycleTimeDaysData,
    throughputSamples,
    sampleStats,
    warning: response.warning,
  };
}

async function fetchTeamThroughput(
  params: FetchTeamThroughputParams,
): Promise<FetchTeamThroughputResult> {
  if (params.demoMode ?? false) {
    return fetchDemoTeamThroughput(params.selectedTeam, params.includeZeroWeeks);
  }
  return fetchRemoteTeamThroughput(params);
}

function simulationControlToNumber(
  value: number | string,
  fieldName: string,
): number {
  if (typeof value === "number") return value;
  if (value.trim() === "") throw new Error(`${fieldName} requis.`);
  return Number(value);
}

async function simulateForecastFromSamples(
  params: SimulateFromSamplesParams,
): Promise<SimulationResult> {
  const {
    demoMode = false,
    seed,
    throughputSamples,
    includeZeroWeeks = false,
    simulationMode,
    backlogSize,
    targetWeeks,
    nSims = 20_000,
  } = params;
  const command = createSimulationCommand({
    seed: resolveSimulationSeed(seed),
    throughputSamples,
    includeZeroWeeks,
    mode: simulationMode,
    backlogSize: simulationMode === "backlog_to_weeks"
      ? simulationControlToNumber(backlogSize, "backlog_size")
      : undefined,
    targetWeeks: simulationMode === "weeks_to_items"
      ? simulationControlToNumber(targetWeeks, "target_weeks")
      : undefined,
    nSims: simulationControlToNumber(nSims, "n_sims"),
  });

  if (demoMode) {
    return simulateMonteCarloLocal(
      command,
      createSeededSampleIndexDrawPort(command.seed),
    );
  }

  return simulateResponseDtoToResult(
    await postSimulate(simulationCommandToDto(command)),
    command.nSims,
  );
}

async function simulateForecastWithHistoryTranslation(
  params: RunSimulationForecastParams,
  throughputSamples: number[],
): Promise<SimulationResult> {
  try {
    return await simulateForecastFromSamples({ ...params, throughputSamples });
  } catch (error) {
    throwTranslatedHistoryError(error);
  }
}

function buildHistoryEntry(
  params: RunSimulationForecastParams,
  throughputData: FetchTeamThroughputResult,
  result: SimulationResult,
  createdAt: string,
): SimulationHistoryEntry {
  return {
    schemaVersion: 2,
    id: globalThis.crypto?.randomUUID?.() ?? `${createdAt}-${String(result.seed)}`,
    seed: result.seed,
    createdAt,
    selectedOrg: params.selectedOrg,
    selectedProject: params.selectedProject,
    selectedTeam: params.selectedTeam,
    startDate: params.startDate,
    endDate: params.endDate,
    simulationMode: params.simulationMode,
    includeZeroWeeks: params.includeZeroWeeks,
    backlogSize: toSafeNumber(params.backlogSize, 120),
    targetWeeks: toSafeNumber(params.targetWeeks, 12),
    nSims: toSafeNumber(params.nSims, 20_000),
    types: [...params.types],
    doneStates: [...params.doneStates],
    sampleStats: throughputData.sampleStats,
    weeklyThroughput: throughputData.weeklyThroughput,
    cycleTimeDaysData: throughputData.cycleTimeDaysData,
    result,
    warning: throughputData.warning,
  };
}

async function runSimulationForecast(
  params: RunSimulationForecastParams,
): Promise<RunSimulationForecastResult> {
  const throughputData = await fetchTeamThroughput(params);
  const result = await simulateForecastWithHistoryTranslation(
    params,
    throughputData.throughputSamples,
  );
  const historyEntry = buildHistoryEntry(
    params,
    throughputData,
    result,
    params.clock.now(),
  );

  return {
    weeklyThroughput: throughputData.weeklyThroughput,
    cycleTimeDaysData: throughputData.cycleTimeDaysData,
    sampleStats: throughputData.sampleStats,
    result,
    historyEntry,
    warning: throughputData.warning,
  };
}

export const localTeamForecast: TeamForecast = Object.freeze({
  fetchTeamThroughput,
  simulateForecastFromSamples,
  runSimulationForecast,
});
