const API_BASE = import.meta.env.VITE_API_BASE ?? "";


export async function getTeams() {
  const r = await fetch(`${API_BASE}/teams`);
  if (!r.ok) throw new Error(`GET /teams -> HTTP ${r.status}`);
  return r.json();
}

export async function getTeamSettings(teamName) {
  const r = await fetch(`${API_BASE}/teams/${encodeURIComponent(teamName)}/settings`);
  if (!r.ok) throw new Error(`GET /teams/{team}/settings -> HTTP ${r.status}`);
  return r.json();
}

export async function postForecast(payload) {
  const r = await fetch(`${API_BASE}/forecast`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.detail || `POST /forecast -> HTTP ${r.status}`);
  return data;
}


