const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export type SimulateRequest = {
  throughput_samples: number[];
  include_zero_weeks?: boolean;
  mode: "backlog_to_weeks" | "weeks_to_items";
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

export type SimulateResponse = {
  result_kind: "weeks" | "items";
  result_percentiles: Record<string, number>;
  risk_score?: number;
  result_distribution: { x: number; count: number }[];
  samples_count: number;
};

export type SimulationHistoryItem = {
  created_at: string;
  last_seen: string;
  mode: "backlog_to_weeks" | "weeks_to_items";
  backlog_size?: number | null;
  target_weeks?: number | null;
  n_sims: number;
  capacity_percent: number;
  samples_count: number;
  percentiles: Record<string, number>;
  distribution: { x: number; count: number }[];
  selected_org?: string | null;
  selected_project?: string | null;
  selected_team?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  done_states?: string[];
  types?: string[];
  include_zero_weeks?: boolean;
};

export async function postSimulate(payload: SimulateRequest): Promise<SimulateResponse> {
  const r = await fetch(`${API_BASE}/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data as { detail?: string }).detail ?? `HTTP ${r.status}`);
  return data as SimulateResponse;
}

export async function getSimulationHistory(): Promise<SimulationHistoryItem[]> {
  const r = await fetch(`${API_BASE}/simulations/history`, {
    method: "GET",
    credentials: "include",
  });
  const data = await r.json().catch(() => []);
  if (!r.ok) throw new Error((data as { detail?: string }).detail ?? `HTTP ${r.status}`);
  return Array.isArray(data) ? (data as SimulationHistoryItem[]) : [];
}
