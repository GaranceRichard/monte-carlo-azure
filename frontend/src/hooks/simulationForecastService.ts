import type { SimulationMode, SimulationResult } from "../domain/simulation";
import type { SampleStats, SimulationHistoryEntry } from "../domain/simulationHistory";
import {
  fetchTeamThroughputCore,
  runSimulationForecastCore,
  simulateForecastFromSamplesCore,
} from "./simulationForecastCore";

export type RunSimulationForecastParams = {
  demoMode?: boolean;
  seed?: number;
  selectedOrg: string;
  selectedProject: string;
  selectedTeam: string;
  pat: string;
  serverUrl: string;
  startDate: string;
  endDate: string;
  doneStates: string[];
  types: string[];
  includeZeroWeeks: boolean;
  simulationMode: SimulationMode;
  backlogSize: number | string;
  targetWeeks: number | string;
  nSims: number | string;
};

export type RunSimulationForecastResult = {
  weeklyThroughput: SimulationHistoryEntry["weeklyThroughput"];
  cycleTimeDaysData: NonNullable<SimulationHistoryEntry["cycleTimeDaysData"]>;
  sampleStats: SampleStats;
  result: SimulationResult;
  historyEntry: SimulationHistoryEntry;
  warning?: string;
};

export type FetchTeamThroughputResult = {
  weeklyThroughput: SimulationHistoryEntry["weeklyThroughput"];
  cycleTimeDaysData: NonNullable<SimulationHistoryEntry["cycleTimeDaysData"]>;
  throughputSamples: number[];
  sampleStats: SampleStats;
  warning?: string;
};

export type FetchTeamThroughputParams = {
  demoMode?: boolean;
  selectedOrg: string;
  selectedProject: string;
  selectedTeam: string;
  pat: string;
  serverUrl: string;
  startDate: string;
  endDate: string;
  doneStates: string[];
  types: string[];
  includeZeroWeeks: boolean;
};

export type SimulateFromSamplesParams = {
  demoMode?: boolean;
  seed?: number;
  throughputSamples: number[];
  includeZeroWeeks?: boolean;
  simulationMode: SimulationMode;
  backlogSize: number | string;
  targetWeeks: number | string;
  nSims: number | string;
};

export function fetchTeamThroughput(params: FetchTeamThroughputParams): Promise<FetchTeamThroughputResult> {
  return fetchTeamThroughputCore(params);
}

export function simulateForecastFromSamples(params: SimulateFromSamplesParams): Promise<SimulationResult> {
  return simulateForecastFromSamplesCore(params);
}

export function runSimulationForecast(params: RunSimulationForecastParams): Promise<RunSimulationForecastResult> {
  return runSimulationForecastCore(params);
}
