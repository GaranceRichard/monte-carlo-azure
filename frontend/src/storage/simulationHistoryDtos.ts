import type { CycleTimePoint, WeeklyThroughputRow } from "../types";

export type StoredSimulationResultDto = {
  result_kind: "weeks" | "items";
  samples_count: number;
  seed: number;
  result_percentiles: Partial<Record<"P50" | "P70" | "P90", number>>;
  risk_score?: number;
  result_distribution: { x: number; count: number }[];
  completion_summary?: {
    completed_count: number;
    censored_count: number;
    censored_rate: number;
    horizon_weeks: number;
  };
  throughput_reliability?: {
    cv: number;
    iqr_ratio: number;
    slope_norm: number;
    label: "fiable" | "incertain" | "fragile" | "non fiable";
    samples_count: number;
  };
};

export type SimulationHistoryEntryDto = {
  schemaVersion: 2;
  id: string;
  seed: number | null;
  createdAt: string;
  selectedOrg: string;
  selectedProject: string;
  selectedTeam: string;
  startDate: string;
  endDate: string;
  simulationMode: "backlog_to_weeks" | "weeks_to_items";
  includeZeroWeeks: boolean;
  backlogSize: number;
  targetWeeks: number;
  nSims: number;
  types: string[];
  doneStates: string[];
  sampleStats: { totalWeeks: number; zeroWeeks: number; usedWeeks: number } | null;
  weeklyThroughput: WeeklyThroughputRow[];
  cycleTimeDaysData?: CycleTimePoint[];
  result: StoredSimulationResultDto;
  warning?: string;
};
