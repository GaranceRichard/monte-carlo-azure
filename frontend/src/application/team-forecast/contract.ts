import type { SimulationMode, SimulationResult } from "../../domain/simulation";
import type { SampleStats, SimulationHistoryEntry } from "../../domain/simulationHistory";
import type { FrontendClock } from "../../ports/clock";

export type RunSimulationForecastParams = {
  clock: FrontendClock;
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
  nSims?: number | string;
};

export type TeamForecast = Readonly<{
  fetchTeamThroughput: (
    params: FetchTeamThroughputParams,
  ) => Promise<FetchTeamThroughputResult>;
  simulateForecastFromSamples: (
    params: SimulateFromSamplesParams,
  ) => Promise<SimulationResult>;
  runSimulationForecast: (
    params: RunSimulationForecastParams,
  ) => Promise<RunSimulationForecastResult>;
}>;
