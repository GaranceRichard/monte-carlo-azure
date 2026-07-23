export type SimulationModeDto = "backlog_to_weeks" | "weeks_to_items";
export type SimulationResultKindDto = "weeks" | "items";
export type ThroughputReliabilityLabelDto = "fiable" | "incertain" | "fragile" | "non fiable";
export type SimulationPercentilesDto = Partial<Record<"P50" | "P70" | "P90", number>>;

export type HistogramBucketDto = {
  x: number;
  count: number;
};

export type CompletionSummaryDto = {
  completed_count: number;
  censored_count: number;
  censored_rate: number;
  horizon_weeks: number;
};

export type ThroughputReliabilityDto = {
  cv: number;
  iqr_ratio: number;
  slope_norm: number;
  label: ThroughputReliabilityLabelDto;
  samples_count: number;
};

export type SimulateRequestDto = {
  throughput_samples: number[];
  include_zero_weeks?: boolean;
  mode: SimulationModeDto;
  backlog_size?: number;
  target_weeks?: number;
  n_sims: number;
  seed?: number;
};

export type SimulateResponseDto = {
  result_kind: SimulationResultKindDto;
  samples_count: number;
  seed: number;
  result_percentiles: SimulationPercentilesDto;
  risk_score?: number;
  result_distribution: HistogramBucketDto[];
  completion_summary?: CompletionSummaryDto;
  throughput_reliability?: ThroughputReliabilityDto;
};

export type SimulationHistoryItemDto = {
  created_at: string;
  last_seen: string;
  mode: SimulationModeDto;
  seed?: number | null;
  backlog_size?: number | null;
  target_weeks?: number | null;
  n_sims: number;
  samples_count: number;
  percentiles: SimulationPercentilesDto;
  distribution: HistogramBucketDto[];
  completion_summary?: CompletionSummaryDto;
  include_zero_weeks?: boolean;
  throughput_reliability?: ThroughputReliabilityDto;
};
