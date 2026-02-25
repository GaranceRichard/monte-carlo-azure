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

export type SimulationForecastControls = {
  backlogSize: number | string;
  setBacklogSize: (value: number | string) => void;
  targetWeeks: number | string;
  setTargetWeeks: (value: number | string) => void;
  nSims: number | string;
  setNSims: (value: number | string) => void;
  simulationMode: ForecastMode;
  setSimulationMode: (value: ForecastMode) => void;
  includeZeroWeeks: boolean;
  setIncludeZeroWeeks: (value: boolean) => void;
  capacityPercent: number | string;
  setCapacityPercent: (value: number | string) => void;
  reducedCapacityWeeks: number | string;
  setReducedCapacityWeeks: (value: number | string) => void;
};

export type SimulationDateRange = {
  startDate: string;
  setStartDate: (value: string) => void;
  endDate: string;
  setEndDate: (value: string) => void;
};

export type SimulationResult = {
  result: ForecastResponse | null;
  displayPercentiles: Record<string, number>;
  throughputData: ThroughputPoint[];
  mcHistData: ChartPoint[];
  probabilityCurveData: ProbabilityPoint[];
  sampleStats: SampleStats | null;
};

export type ChartTab = "throughput" | "distribution" | "probability";
