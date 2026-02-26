export type AppStep = "pat" | "org" | "projects" | "teams" | "simulation";

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

export type ForecastResponse = {
  result_kind: ForecastKind;
  samples_count: number;
  result_percentiles: Record<string, number>;
  risk_score?: number;
  result_distribution: ForecastHistogramBucket[];
};

export type ForecastRequestPayload = {
  throughput_samples: number[];
  include_zero_weeks?: boolean;
  mode: ForecastMode;
  backlog_size?: number;
  target_weeks?: number;
  n_sims: number;
  capacity_percent?: number;
  client_context?: {
    selected_org?: string;
    selected_project?: string;
    selected_team?: string;
    start_date?: string;
    end_date?: string;
    done_states?: string[];
    types?: string[];
  };
};
