import type { ForecastMode, ForecastResponse } from "../types";
import type { SampleStats, SimulationHistoryEntry } from "./simulationTypes";
import {
  fetchTeamThroughputCore,
  runSimulationForecastCore,
  simulateForecastFromSamplesCore,
} from "./simulationForecastCore";

export type RunSimulationForecastParams = {
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
  simulationMode: ForecastMode;
  backlogSize: number | string;
  targetWeeks: number | string;
  nSims: number | string;
};

export type RunSimulationForecastResult = {
  weeklyThroughput: SimulationHistoryEntry["weeklyThroughput"];
  cycleTimeData: NonNullable<SimulationHistoryEntry["cycleTimeData"]>;
  sampleStats: SampleStats;
  result: ForecastResponse;
  historyEntry: SimulationHistoryEntry;
  warning?: string;
};

export type FetchTeamThroughputResult = {
  weeklyThroughput: SimulationHistoryEntry["weeklyThroughput"];
  cycleTimeData: NonNullable<SimulationHistoryEntry["cycleTimeData"]>;
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
  throughputSamples: number[];
  includeZeroWeeks?: boolean;
  simulationMode: ForecastMode;
  backlogSize: number | string;
  targetWeeks: number | string;
  nSims: number | string;
  selectedOrg?: string;
  selectedProject?: string;
  selectedTeam?: string;
  startDate?: string;
  endDate?: string;
  doneStates?: string[];
  types?: string[];
};

export function fetchTeamThroughput(params: FetchTeamThroughputParams): Promise<FetchTeamThroughputResult> {
  return fetchTeamThroughputCore(params);
}

export function simulateForecastFromSamples(params: SimulateFromSamplesParams): Promise<ForecastResponse> {
  return simulateForecastFromSamplesCore(params);
}

export function runSimulationForecast(params: RunSimulationForecastParams): Promise<RunSimulationForecastResult> {
  return runSimulationForecastCore(params);
}
