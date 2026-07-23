export type SimulationMode = "backlog_to_weeks" | "weeks_to_items";
export type SimulationResultKind = "weeks" | "items";
export type ThroughputReliabilityLabel = "fiable" | "incertain" | "fragile" | "non fiable";

export type SimulationPercentiles = Partial<Record<"P50" | "P70" | "P90", number>>;

export type HistogramBucket = {
  x: number;
  count: number;
};

export type CompletionSummary = {
  completedCount: number;
  censoredCount: number;
  censoredRate: number;
  horizonWeeks: number;
};

export type ThroughputReliability = {
  cv: number;
  iqrRatio: number;
  slopeNorm: number;
  label: ThroughputReliabilityLabel;
  samplesCount: number;
};

export type SimulationCommand = {
  throughputSamples: number[];
  includeZeroWeeks: boolean;
  mode: SimulationMode;
  backlogSize?: number;
  targetWeeks?: number;
  nSims: number;
  seed: number;
};

export type SimulationResult = {
  resultKind: SimulationResultKind;
  samplesCount: number;
  seed: number;
  resultPercentiles: SimulationPercentiles;
  riskScore?: number;
  resultDistribution: HistogramBucket[];
  completionSummary?: CompletionSummary;
  throughputReliability?: ThroughputReliability;
};

export type ServerSimulationHistoryItem = {
  createdAt: string;
  lastSeen: string;
  mode: SimulationMode;
  seed?: number | null;
  backlogSize?: number | null;
  targetWeeks?: number | null;
  nSims: number;
  samplesCount: number;
  percentiles: SimulationPercentiles;
  distribution: HistogramBucket[];
  completionSummary?: CompletionSummary;
  includeZeroWeeks?: boolean;
  throughputReliability?: ThroughputReliability;
};
