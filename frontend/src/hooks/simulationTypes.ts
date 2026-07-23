import type {
  CompletionSummary,
  HistogramBucket,
  SimulationMode,
  SimulationPercentiles,
  SimulationResult as DomainSimulationResult,
  ThroughputReliability,
} from "../domain/simulation";
import type { SampleStats } from "../domain/simulationHistory";
import type {
  CycleTimePoint,
  WeeklyThroughputRow,
} from "../types";
import type { DecisionLanguage } from "../utils/decisionLanguage";

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

export type StoredSimulationPrefs = {
  startDate?: string;
  endDate?: string;
  simulationMode?: SimulationMode;
  includeZeroWeeks?: boolean;
  backlogSize?: number;
  targetWeeks?: number;
  nSims?: number;
};

export type SimulationForecastControls = {
  backlogSize: number | string;
  setBacklogSize: (value: number | string) => void;
  targetWeeks: number | string;
  setTargetWeeks: (value: number | string) => void;
  nSims: number | string;
  setNSims: (value: number | string) => void;
  simulationMode: SimulationMode;
  setSimulationMode: (value: SimulationMode) => void;
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
  result: DomainSimulationResult | null;
  displayPercentiles: SimulationPercentiles;
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
  percentiles: SimulationPercentiles;
  riskScore?: number;
  riskLegend?: "fiable" | "incertain" | "fragile" | "non fiable";
  distribution: HistogramBucket[];
  completionSummary?: CompletionSummary;
  throughputReliability?: ThroughputReliability | null;
  decisionDiagnostic?: DecisionLanguage;
};

