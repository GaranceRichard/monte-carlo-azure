import {
  getApiBase,
  normalizeSimulateResponse,
  readJsonOr,
  toApiErrorMessage,
} from "./apiHelpers";
import type { CompletionSummary, ForecastPercentiles, ForecastRequestPayload, ForecastResponse, ThroughputReliability } from "./types";

const API_BASE = getApiBase();

export type SimulateRequest = ForecastRequestPayload;

export type SimulateResponse = ForecastResponse;

export type SimulationStatsHistoryItem = {
  created_at: string;
  last_seen: string;
  mode: "backlog_to_weeks" | "weeks_to_items";
  seed?: number | null;
  backlog_size?: number | null;
  target_weeks?: number | null;
  n_sims: number;
  samples_count: number;
  percentiles: ForecastPercentiles;
  distribution: { x: number; count: number }[];
  completion_summary?: CompletionSummary;
  include_zero_weeks?: boolean;
  throughput_reliability?: ThroughputReliability;
};

export async function postSimulate(payload: SimulateRequest): Promise<SimulateResponse> {
  const response = await fetch(`${API_BASE}/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const data = await readJsonOr(response, {} as { detail?: string } & SimulateResponse);
  if (!response.ok) throw new Error(toApiErrorMessage(response.status, data));
  return normalizeSimulateResponse(data);
}
