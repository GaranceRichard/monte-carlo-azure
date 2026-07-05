export type AppStep = "pat" | "org" | "projects" | "teams" | "simulation" | "portfolio";

export type NamedEntity = {
  id?: string;
  name?: string;
};

export type TeamOptionResponse = {
  doneStates: string[];
  workItemTypes: string[];
  statesByType: Record<string, string[]>;
};

export type ForecastMode = "backlog_to_weeks" | "weeks_to_items";
export type ForecastKind = "weeks" | "items";

export type ForecastHistogramBucket = {
  x: number;
  count: number;
};

export type WeeklyThroughputRow = {
  week: string;
  throughput: number;
};

export type CycleTimePoint = {
  week: string;
  cycleTimeDays: number;
  count: number;
};

export type ThroughputReliabilityLabel = "fiable" | "incertain" | "fragile" | "non fiable";

export type ThroughputReliability = {
  cv: number;
  iqr_ratio: number;
  slope_norm: number;
  label: ThroughputReliabilityLabel;
  samples_count: number;
};

export type ForecastPercentiles = Partial<Record<"P50" | "P70" | "P90", number>>;

export type CompletionSummary = {
  completed_count: number;
  censored_count: number;
  censored_rate: number;
  horizon_weeks: number;
};

export type ForecastResponse = {
  result_kind: ForecastKind;
  samples_count: number;
  seed: number;
  result_percentiles: ForecastPercentiles;
  risk_score?: number;
  result_distribution: ForecastHistogramBucket[];
  completion_summary?: CompletionSummary;
  throughput_reliability?: ThroughputReliability;
};

export type ForecastRequestPayload = {
  throughput_samples: number[];
  include_zero_weeks?: boolean;
  mode: ForecastMode;
  backlog_size?: number;
  target_weeks?: number;
  n_sims: number;
  seed?: number;
};
