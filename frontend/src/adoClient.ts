import { formatDateLocal } from "./date";

function adoHeaders(pat: string): Record<string, string> {
  return {
    Authorization: `Basic ${btoa(`:${pat}`)}`,
    "Content-Type": "application/json",
  };
}

const ADO = "https://dev.azure.com";
const VSSPS = "https://app.vssps.visualstudio.com";
const API = "api-version=7.1";

type AdoOrg = { name: string };
type AdoProject = { id: string; name: string };
type AdoTeam = { id: string; name: string };
type TeamFieldValue = { value?: string; includeChildren?: boolean };
type ProfileMe = { id?: string; publicAlias?: string; displayName?: string };
type ResolvedPatProfile = {
  displayName: string;
  id: string;
  publicAlias?: string;
  restrictedProfile?: boolean;
};
const profileLookupInFlight = new Map<string, Promise<ResolvedPatProfile>>();

function escWiql(value: string): string {
  return value.replace(/'/g, "''");
}

async function getTeamAreaPathFilterClause(
  org: string,
  project: string,
  team: string,
  pat: string,
): Promise<string> {
  const fallbackPath = `${project}\\${team}`;

  try {
    const teamEncoded = encodeURIComponent(team);
    const r = await fetch(
      `${ADO}/${org}/${project}/${teamEncoded}/_apis/work/teamsettings/teamfieldvalues?${API}`,
      { headers: adoHeaders(pat) },
    );
    if (!r.ok) {
      return `AND [System.AreaPath] UNDER '${escWiql(fallbackPath)}'`;
    }

    const data = await r.json();
    const values: TeamFieldValue[] = data?.values ?? [];
    const clauses = values
      .map((entry) => {
        const path = (entry.value || "").trim();
        if (!path) return "";
        if (entry.includeChildren === false) {
          return `[System.AreaPath] = '${escWiql(path)}'`;
        }
        return `[System.AreaPath] UNDER '${escWiql(path)}'`;
      })
      .filter(Boolean);

    if (!clauses.length) {
      return `AND [System.AreaPath] UNDER '${escWiql(fallbackPath)}'`;
    }

    return `AND (${clauses.join(" OR ")})`;
  } catch {
    return `AND [System.AreaPath] UNDER '${escWiql(fallbackPath)}'`;
  }
}

export async function checkPatDirect(pat: string): Promise<ResolvedPatProfile> {
  const existing = profileLookupInFlight.get(pat);
  if (existing) return existing;

  const task = (async (): Promise<ResolvedPatProfile> => {
  const r = await fetch(`${VSSPS}/_apis/profile/profiles/me?${API}`, {
    headers: adoHeaders(pat),
  });
  if (r.ok) {
    const profile = await r.json() as ProfileMe;
    return {
      displayName: profile.displayName || "Utilisateur",
      id: profile.id || "",
      publicAlias: profile.publicAlias || "",
      restrictedProfile: false,
    };
  }

  // For some org-scoped PATs, profile endpoint answers 401 but still exposes identity metadata.
  const userData = r.headers.get("x-vss-userdata") || "";
  const sepIdx = userData.indexOf(":");
  if (r.status === 401 && sepIdx > -1) {
    const rawId = userData.slice(0, sepIdx).trim();
    const rawName = userData.slice(sepIdx + 1).trim();
    if (rawName) {
      return {
        id: rawId.replace(/^aad\./i, ""),
        displayName: rawName,
        publicAlias: "",
        restrictedProfile: true,
      };
    }
  }

  throw new Error("PAT invalide ou insuffisant.");
  })();

  profileLookupInFlight.set(pat, task);
  try {
    return await task;
  } finally {
    profileLookupInFlight.delete(pat);
  }
}

async function listOrgsByMemberId(memberId: string, pat: string): Promise<AdoOrg[]> {
  if (!memberId) return [];
  const r = await fetch(`${VSSPS}/_apis/accounts?memberId=${encodeURIComponent(memberId)}&${API}`, {
    headers: adoHeaders(pat),
  });
  if (!r.ok) return [];
  const data = await r.json();
  return (data.value ?? []).map((a: { accountName?: string }) => ({ name: a.accountName ?? "" }));
}

export async function listOrgsDirect(pat: string): Promise<AdoOrg[]> {
  const me = await checkPatDirect(pat);
  const memberId = me.id || me.publicAlias || "";
  return listOrgsByMemberId(memberId, pat);
}

export async function resolvePatOrganizationScopeDirect(pat: string): Promise<{
  displayName: string;
  memberId: string;
  organizations: AdoOrg[];
  scope: "none" | "local" | "global";
}> {
  const me = await checkPatDirect(pat);
  if (me.restrictedProfile) {
    return {
      displayName: me.displayName || "Utilisateur",
      memberId: me.id || "",
      organizations: [],
      scope: "none",
    };
  }
  const memberId = me.id || me.publicAlias || "";
  if (!memberId) {
    return { displayName: me.displayName || "Utilisateur", memberId: "", organizations: [], scope: "none" };
  }
  const organizations = await listOrgsByMemberId(memberId, pat);
  const scope = organizations.length > 1 ? "global" : organizations.length === 1 ? "local" : "none";
  return {
    displayName: me.displayName || "Utilisateur",
    memberId,
    organizations,
    scope,
  };
}

export async function listProjectsDirect(org: string, pat: string): Promise<AdoProject[]> {
  const r = await fetch(`${ADO}/${org}/_apis/projects?${API}`, {
    headers: adoHeaders(pat),
  });
  if (!r.ok) throw new Error(`Organisation "${org}" inaccessible avec ce PAT.`);
  const data = await r.json();
  return data.value ?? [];
}

export async function listTeamsDirect(org: string, project: string, pat: string): Promise<AdoTeam[]> {
  const projects = await listProjectsDirect(org, pat);
  const proj = projects.find((p) => p.name === project);
  if (!proj) throw new Error(`Projet "${project}" introuvable.`);

  const r = await fetch(`${ADO}/${org}/_apis/projects/${proj.id}/teams?${API}`, {
    headers: adoHeaders(pat),
  });
  if (!r.ok) throw new Error("Impossible de lister les équipes.");
  const data = await r.json();
  return data.value ?? [];
}

export async function getTeamOptionsDirect(
  org: string,
  project: string,
  _team: string,
  pat: string,
): Promise<{ workItemTypes: string[]; statesByType: Record<string, string[]> }> {
  const typesResp = await fetch(`${ADO}/${org}/${project}/_apis/wit/workitemtypes?${API}`, {
    headers: adoHeaders(pat),
  });
  if (!typesResp.ok) throw new Error("Impossible de charger les types de tickets.");

  const typesData = await typesResp.json();
  const witTypes: string[] = (typesData.value ?? []).map((t: { name?: string }) => t.name ?? "").filter(Boolean);

  const statesByType: Record<string, string[]> = {};
  await Promise.all(
    witTypes.map(async (type) => {
      const encoded = encodeURIComponent(type);
      const r = await fetch(`${ADO}/${org}/${project}/_apis/wit/workitemtypes/${encoded}/states?${API}`, {
        headers: adoHeaders(pat),
      });
      if (!r.ok) return;
      const d = await r.json();
      statesByType[type] = (d.value ?? []).map((s: { name?: string }) => s.name ?? "").filter(Boolean).sort();
    }),
  );

  return { workItemTypes: witTypes.sort(), statesByType };
}

export async function getWeeklyThroughputDirect(
  org: string,
  project: string,
  team: string,
  pat: string,
  startDate: string,
  endDate: string,
  doneStates: string[],
  workItemTypes: string[],
): Promise<{ week: string; throughput: number }[]> {
  const teamAreaFilter = await getTeamAreaPathFilterClause(org, project, team, pat);
  const typeFilter = workItemTypes.length
    ? `AND [System.WorkItemType] IN (${workItemTypes.map((t) => `'${escWiql(t)}'`).join(",")})`
    : "";
  const stateFilter = doneStates.length
    ? `AND [System.State] IN (${doneStates.map((s) => `'${escWiql(s)}'`).join(",")})`
    : "";

  const wiql = {
    query: `
      SELECT [System.Id], [Microsoft.VSTS.Common.ClosedDate]
      FROM WorkItems
      WHERE [System.TeamProject] = '${escWiql(project)}'
      AND [Microsoft.VSTS.Common.ClosedDate] >= '${startDate}'
      AND [Microsoft.VSTS.Common.ClosedDate] <= '${endDate}'
      ${teamAreaFilter}
      ${typeFilter}
      ${stateFilter}
      ORDER BY [Microsoft.VSTS.Common.ClosedDate]
    `,
  };

  const wiqlResp = await fetch(`${ADO}/${org}/${project}/_apis/wit/wiql?${API}`, {
    method: "POST",
    headers: adoHeaders(pat),
    body: JSON.stringify(wiql),
  });
  if (!wiqlResp.ok) throw new Error("Erreur lors de la requete WIQL.");

  const wiqlData = await wiqlResp.json();
  const items: { id: number }[] = wiqlData.workItems ?? [];
  if (!items.length) return [];

  const ids = items.map((i) => i.id);
  const batches: number[][] = [];
  for (let i = 0; i < ids.length; i += 200) batches.push(ids.slice(i, i + 200));

  const allItems: { closedDate: string }[] = [];
  await Promise.all(
    batches.map(async (batch) => {
      const r = await fetch(
        `${ADO}/${org}/${project}/_apis/wit/workitems?ids=${batch.join(",")}&fields=Microsoft.VSTS.Common.ClosedDate&${API}`,
        { headers: adoHeaders(pat) },
      );
      if (!r.ok) return;
      const d = await r.json();
      (d.value ?? []).forEach((item: { fields?: Record<string, string> }) => {
        const date = item.fields?.["Microsoft.VSTS.Common.ClosedDate"];
        if (date) allItems.push({ closedDate: date });
      });
    }),
  );

  const weekMap = new Map<string, number>();
  allItems.forEach(({ closedDate }) => {
    const d = new Date(closedDate);
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const key = formatDateLocal(monday);
    weekMap.set(key, (weekMap.get(key) ?? 0) + 1);
  });

  const result: { week: string; throughput: number }[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  const cursor = new Date(start);
  cursor.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7));
  while (cursor <= end) {
    const key = formatDateLocal(cursor);
    result.push({ week: key, throughput: weekMap.get(key) ?? 0 });
    cursor.setDate(cursor.getDate() + 7);
  }
  return result;
}

