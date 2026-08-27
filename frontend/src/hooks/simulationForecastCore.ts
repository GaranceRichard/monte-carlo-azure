import { getTeamDeliveryDataDirect } from "../adoClient";
import { createSeededSampleIndexDrawPort } from "../adapters/seededSampleIndexDrawPort";
import { postSimulate } from "../api";
import {
  simulateResponseDtoToResult,
  simulationCommandToDto,
} from "../api/simulationMappers";
import { getDemoCycleTime, getDemoThroughputSamples, getDemoWeeklyThroughput } from "../demoData";
import type {
  SimulationResult,
} from "../domain/simulation";
import { createSimulationCommand } from "../domain/simulation";
import { createThroughputSamples } from "../domain/simulationValueObjects";
import { toSafeNumber } from "../utils/math";
import {
  simulateMonteCarloLocal,
} from "../utils/simulation";
import { resolveSimulationSeed } from "./simulationSeedResolver";
import type {
  FetchTeamThroughputParams,
  FetchTeamThroughputResult,
  RunSimulationForecastParams,
  RunSimulationForecastResult,
  SimulateFromSamplesParams,
} from "./simulationForecastService";
import type { SampleStats, SimulationHistoryEntry } from "../domain/simulationHistory";

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
    const throughputSamples = getDemoThroughputSamples(selectedTeam);
    return {
      weeklyThroughput: weekly,
      cycleTimeDaysData: getDemoCycleTime(selectedTeam),
      throughputSamples,
      sampleStats: {
        totalWeeks: weekly.length,
        zeroWeeks: weekly.filter((row) => row.throughput === 0).length,
        usedWeeks: usableThroughputCount(throughputSamples, includeZeroWeeks),
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
  const throughputSamples = weekly.map((r) => r.throughput);
  const zeroWeeks = weekly.filter((r) => r.throughput === 0).length;
  const sampleStats: SampleStats = {
    totalWeeks: weekly.length,
    zeroWeeks,
    usedWeeks: usableThroughputCount(throughputSamples, includeZeroWeeks),
  };
  return {
    weeklyThroughput: weekly,
    cycleTimeDaysData: throughputResponse.cycleTimeDaysData,
    throughputSamples,
    sampleStats,
    warning,
  };
}

function simulationControlToNumber(
  value: number | string,
  fieldName: string,
): number {
  if (typeof value === "number") return value;
  if (value.trim() === "") throw new Error(`${fieldName} requis.`);
  return Number(value);
}

export async function simulateForecastFromSamplesCore(
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
  const simulationSeed = resolveSimulationSeed(seed);
  const command = createSimulationCommand({
    seed: simulationSeed,
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
    return await simulateForecastFromSamplesCore({
      ...params,
      throughputSamples,
    });
  } catch (error) {
    throwTranslatedHistoryError(error);
  }
}

export async function runSimulationForecastCore(
  params: RunSimulationForecastParams,
): Promise<RunSimulationForecastResult> {
  const {
    demoMode = false, clock,
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

  const adjusted = await simulateForecastWithHistoryTranslation(
    params,
    throughputData.throughputSamples,
  );
  const createdAt = clock.now();
  const historyEntry: SimulationHistoryEntry = {
    schemaVersion: 2,
    id: globalThis.crypto?.randomUUID?.() ?? `${createdAt}-${String(adjusted.seed)}`,
    seed: adjusted.seed,
    createdAt,
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
