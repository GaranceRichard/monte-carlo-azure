import type {
  ForecastRequestPayload,
  ForecastResponse,
  NamedEntity,
  TeamOptionResponse,
} from "./types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";
let adoPat = "";

type ErrorResponse = { detail?: string };

function toErrorMessage(data: unknown, fallback: string): string {
  if (data && typeof data === "object" && "detail" in data) {
    const detail = (data as ErrorResponse).detail;
    if (typeof detail === "string" && detail.trim()) return detail;
  }
  return fallback;
}

export function setAdoPat(pat: string): void {
  adoPat = (pat ?? "").trim();
}

export function clearAdoPat(): void {
  adoPat = "";
}

function authHeaders(): Record<string, string> {
  return adoPat ? { "x-ado-pat": adoPat } : {};
}

export async function checkPat(): Promise<{ status: string; message: string; user_name?: string }> {
  const r = await fetch(`${API_BASE}/auth/check`, {
    headers: authHeaders(),
  });
  const data: unknown = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(toErrorMessage(data, `GET /auth/check -> HTTP ${r.status}`));
  return data as { status: string; message: string; user_name?: string };
}

export async function getAccessibleOrgs(): Promise<NamedEntity[]> {
  const r = await fetch(`${API_BASE}/auth/orgs`, {
    headers: authHeaders(),
  });
  const data: unknown = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(toErrorMessage(data, `GET /auth/orgs -> HTTP ${r.status}`));
  if (data && typeof data === "object" && "orgs" in data) {
    return ((data as { orgs?: NamedEntity[] }).orgs ?? []) as NamedEntity[];
  }
  return [];
}

export async function getProjectsByOrg(org: string): Promise<NamedEntity[]> {
  const r = await fetch(`${API_BASE}/auth/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ org: org ?? "" }),
  });
  const data: unknown = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(toErrorMessage(data, `POST /auth/projects -> HTTP ${r.status}`));
  if (data && typeof data === "object" && "projects" in data) {
    return ((data as { projects?: NamedEntity[] }).projects ?? []) as NamedEntity[];
  }
  return [];
}

export async function getTeamsByProject(org: string, project: string): Promise<NamedEntity[]> {
  const r = await fetch(`${API_BASE}/auth/teams`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ org: org ?? "", project: project ?? "" }),
  });
  const data: unknown = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (r.status === 404) {
      throw new Error("Endpoint /auth/teams introuvable. Redemarre le terminal Back pour charger la derniere version.");
    }
    throw new Error(toErrorMessage(data, `POST /auth/teams -> HTTP ${r.status}`));
  }
  if (data && typeof data === "object" && "teams" in data) {
    return ((data as { teams?: NamedEntity[] }).teams ?? []) as NamedEntity[];
  }
  return [];
}

export async function getTeamOptions(org: string, project: string, team: string): Promise<TeamOptionResponse> {
  const r = await fetch(`${API_BASE}/auth/team-options`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ org: org ?? "", project: project ?? "", team: team ?? "" }),
  });
  const data: unknown = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(toErrorMessage(data, `POST /auth/team-options -> HTTP ${r.status}`));
  const typed = (data ?? {}) as {
    done_states?: string[];
    work_item_types?: string[];
    states_by_type?: Record<string, string[]>;
  };
  return {
    doneStates: typed.done_states ?? [],
    workItemTypes: typed.work_item_types ?? [],
    statesByType: typed.states_by_type ?? {},
  };
}

export async function getTeams(): Promise<NamedEntity[]> {
  const r = await fetch(`${API_BASE}/teams`, {
    headers: authHeaders(),
  });
  if (!r.ok) throw new Error(`GET /teams -> HTTP ${r.status}`);
  return (await r.json()) as NamedEntity[];
}

export async function getTeamSettings(teamName: string): Promise<unknown> {
  const r = await fetch(`${API_BASE}/teams/${encodeURIComponent(teamName)}/settings`, {
    headers: authHeaders(),
  });
  if (!r.ok) throw new Error(`GET /teams/{team}/settings -> HTTP ${r.status}`);
  return r.json();
}

export async function postForecast(payload: ForecastRequestPayload): Promise<ForecastResponse> {
  const r = await fetch(`${API_BASE}/forecast`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });

  const data: unknown = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(toErrorMessage(data, `POST /forecast -> HTTP ${r.status}`));
  return data as ForecastResponse;
}
