import type {
  CompletionSummary,
  CycleTimePoint,
  ForecastMode,
  ForecastPercentiles,
  ForecastResponse,
  ThroughputReliability,
  WeeklyThroughputRow,
} from "../types";

export type ChartPoint = { x: number; count: number; gauss: number };
export type ProbabilityPoint = { x: number; probability: number };
export type ThroughputPoint = { week: string; throughput: number };
export type CycleTimeTrendPoint = {
  week: string;
  averageDays: number;
  lowerBoundDays: number;
  upperBoundDays: number;
  itemCount: number;
};
export type CycleTimeSummary = {
  itemCount: number;
  averageDays: number | null;
  hasSufficientData: boolean;
};

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
  simulationMode: ForecastMode;
  includeZeroWeeks: boolean;
  backlogSize: number;
  targetWeeks: number;
  nSims: number;
  types: string[];
  doneStates: string[];
  sampleStats: SampleStats | null;
  weeklyThroughput: WeeklyThroughputRow[];
  cycleTimeDaysData?: CycleTimePoint[];
  result: ForecastResponse;
  warning?: string;
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
};

export type SimulationDateRange = {
  startDate: string;
  setStartDate: (value: string) => void;
  endDate: string;
  setEndDate: (value: string) => void;
};

export type SimulationResult = {
  result: ForecastResponse | null;
  displayPercentiles: ForecastPercentiles;
  throughputData: ThroughputPoint[];
  cycleTimeDaysData: CycleTimePoint[];
  cycleTimeTrendData: CycleTimeTrendPoint[];
  cycleTimeSummary: CycleTimeSummary;
  mcHistData: ChartPoint[];
  probabilityCurveData: ProbabilityPoint[];
  sampleStats: SampleStats | null;
  warning: string;
  notice: string;
};

export type ChartTab = "cycle_time" | "throughput" | "distribution" | "probability";

export type PortfolioScenarioResult = {
  label: "Optimiste" | `Arrime (${number}%)` | `Friction (${number}%)` | "Historique corr\u00E9l\u00E9";
  hypothesis: string;
  seed: number;
  samples: number[];
  weeklyData: WeeklyThroughputRow[];
  percentiles: ForecastPercentiles;
  riskScore?: number;
  riskLegend?: "fiable" | "incertain" | "fragile" | "non fiable";
  distribution: DistributionBucket[];
  completionSummary?: CompletionSummary;
  throughputReliability?: ThroughputReliability | null;
};

type DistributionBucket = {
  x: number;
  count: number;
};

