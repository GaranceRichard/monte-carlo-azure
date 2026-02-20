const API_BASE = import.meta.env.VITE_API_BASE ?? "";
let adoPat = "";

export function setAdoPat(pat) {
  adoPat = (pat ?? "").trim();
}

export function clearAdoPat() {
  adoPat = "";
}

function authHeaders() {
  return adoPat ? { "x-ado-pat": adoPat } : {};
}

export async function checkPat() {
  const r = await fetch(`${API_BASE}/auth/check`, {
    headers: authHeaders(),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.detail || `GET /auth/check -> HTTP ${r.status}`);
  return data;
}

export async function getAccessibleOrgs() {
  const r = await fetch(`${API_BASE}/auth/orgs`, {
    headers: authHeaders(),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.detail || `GET /auth/orgs -> HTTP ${r.status}`);
  return data?.orgs ?? [];
}

export async function getProjectsByOrg(org) {
  const r = await fetch(`${API_BASE}/auth/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ org: org ?? "" }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.detail || `POST /auth/projects -> HTTP ${r.status}`);
  return data?.projects ?? [];
}

export async function getTeamsByProject(org, project) {
  const r = await fetch(`${API_BASE}/auth/teams`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ org: org ?? "", project: project ?? "" }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (r.status === 404) {
      throw new Error("Endpoint /auth/teams introuvable. Redemarre le terminal Back pour charger la derniere version.");
    }
    throw new Error(data?.detail || `POST /auth/teams -> HTTP ${r.status}`);
  }
  return data?.teams ?? [];
}

export async function getTeamOptions(org, project, team) {
  const r = await fetch(`${API_BASE}/auth/team-options`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ org: org ?? "", project: project ?? "", team: team ?? "" }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.detail || `POST /auth/team-options -> HTTP ${r.status}`);
  return {
    doneStates: data?.done_states ?? [],
    workItemTypes: data?.work_item_types ?? [],
    statesByType: data?.states_by_type ?? {},
  };
}


export async function getTeams() {
  const r = await fetch(`${API_BASE}/teams`, {
    headers: authHeaders(),
  });
  if (!r.ok) throw new Error(`GET /teams -> HTTP ${r.status}`);
  return r.json();
}

export async function getTeamSettings(teamName) {
  const r = await fetch(`${API_BASE}/teams/${encodeURIComponent(teamName)}/settings`, {
    headers: authHeaders(),
  });
  if (!r.ok) throw new Error(`GET /teams/{team}/settings -> HTTP ${r.status}`);
  return r.json();
}

export async function postForecast(payload) {
  const r = await fetch(`${API_BASE}/forecast`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });

  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.detail || `POST /forecast -> HTTP ${r.status}`);
  return data;
}


