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
  team: string;
  area_path: string;
  mode: ForecastMode;
  result_kind: ForecastKind;
  samples_count: number;
  result_percentiles: Record<string, number>;
  result_histogram: ForecastHistogramBucket[];
  weekly_throughput: WeeklyThroughputRow[];
  backlog_size?: number;
  target_weeks?: number;
};

export type ForecastRequestPayload = {
  org: string;
  project: string;
  mode: ForecastMode;
  team_name: string;
  area_path: string | null;
  start_date: string;
  end_date: string;
  backlog_size?: number;
  target_weeks?: number;
  done_states: string[];
  work_item_types: string[];
  n_sims: number;
};
