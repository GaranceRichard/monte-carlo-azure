import type { ForecastMode, ForecastResponse, WeeklyThroughputRow } from "../types";

export type ChartPoint = { x: number; count: number; gauss: number };
export type ProbabilityPoint = { x: number; probability: number };
export type ThroughputPoint = { week: string; throughput: number };

export type TooltipBaseProps = {
  cursor: boolean;
  contentStyle: Record<string, string | number>;
  labelStyle: Record<string, string | number>;
  itemStyle: Record<string, string | number>;
};

export type SampleStats = {
  totalWeeks: number;
  zeroWeeks: number;
  usedWeeks: number;
};

export type StoredSimulationPrefs = {
  startDate?: string;
  endDate?: string;
  simulationMode?: ForecastMode;
  includeZeroWeeks?: boolean;
  backlogSize?: number;
  targetWeeks?: number;
  nSims?: number;
  capacityPercent?: number;
  reducedCapacityWeeks?: number;
};

export type SimulationHistoryEntry = {
  id: string;
  createdAt: string;
  selectedOrg: string;
  selectedProject: string;
  selectedTeam: string;
  startDate: string;
  endDate: string;
  simulationMode: ForecastMode;
  includeZeroWeeks: boolean;
  backlogSize: number;
  targetWeeks: number;
  nSims: number;
  capacityPercent: number;
  reducedCapacityWeeks: number;
  types: string[];
  doneStates: string[];
  sampleStats: SampleStats | null;
  weeklyThroughput: WeeklyThroughputRow[];
  result: ForecastResponse;
};
