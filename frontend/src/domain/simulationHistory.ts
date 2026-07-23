import type { CycleTimePoint, WeeklyThroughputRow } from "../types";
import type { SimulationMode, SimulationResult } from "./simulation";

export type SampleStats = {
  totalWeeks: number;
  zeroWeeks: number;
  usedWeeks: number;
};

export type SimulationHistoryEntry = {
  schemaVersion: 2;
  id: string;
  seed: number | null;
  createdAt: string;
  selectedOrg: string;
  selectedProject: string;
  selectedTeam: string;
  startDate: string;
  endDate: string;
  simulationMode: SimulationMode;
  includeZeroWeeks: boolean;
  backlogSize: number;
  targetWeeks: number;
  nSims: number;
  types: string[];
  doneStates: string[];
  sampleStats: SampleStats | null;
  weeklyThroughput: WeeklyThroughputRow[];
  cycleTimeDaysData?: CycleTimePoint[];
  result: SimulationResult;
  warning?: string;
};
