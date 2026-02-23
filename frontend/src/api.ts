const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export type SimulateRequest = {
  throughput_samples: number[];
  mode: "backlog_to_weeks" | "weeks_to_items";
  backlog_size?: number;
  target_weeks?: number;
  n_sims: number;
};

export type SimulateResponse = {
  result_kind: "weeks" | "items";
  result_percentiles: Record<string, number>;
  result_distribution: { x: number; count: number }[];
  samples_count: number;
};

export async function postSimulate(payload: SimulateRequest): Promise<SimulateResponse> {
  const r = await fetch(`${API_BASE}/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data as { detail?: string }).detail ?? `HTTP ${r.status}`);
  return data as SimulateResponse;
}
