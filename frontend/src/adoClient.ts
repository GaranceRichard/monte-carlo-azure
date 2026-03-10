import { formatDateLocal } from "./date";
import {
  formatAdoHttpErrorMessage,
  toAdoHttpError,
  toAdoNetworkError,
  type AdoErrorContext,
} from "./adoErrors";
import {
  ADO_CLOUD_BASE_URL,
  ADO_CLOUD_PROFILE_BASE_URL,
  buildOnPremCollectionUrl,
  extractOnPremCollectionName,
  getAdoDeploymentTarget,
  listOnPremCollectionCandidates,
  normalizeAdoServerUrl,
} from "./adoPlatform";

function adoHeaders(pat: string): Record<string, string> {
  return {
    Authorization: `Basic ${btoa(`:${pat}`)}`,
    "Content-Type": "application/json",
  };
}

const CLOUD_API = "api-version=7.1";
const ONPREM_API = "api-version=6.0";

type AdoOrg = { name: string };
type AdoProject = { id: string; name: string };
type AdoTeam = { id: string; name: string };
type TeamFieldValue = { value?: string; includeChildren?: boolean };
type ProfileMe = { id?: string; publicAlias?: string; displayName?: string };
type WeeklyThroughputRow = { week: string; throughput: number };
type WeeklyThroughputResponse = WeeklyThroughputRow[] | { weeklyThroughput: WeeklyThroughputRow[]; warning?: string };
type ResolvedPatProfile = {
  displayName: string;
  id: string;
  publicAlias?: string;
  restrictedProfile?: boolean;
};
const profileLookupInFlight = new Map<string, Promise<ResolvedPatProfile>>();
const onPremCollectionDiscoveryInFlight = new Map<string, Promise<DiscoveredOnPremCollection | null>>();

type AdoRuntimeContext = {
  deploymentTarget: "cloud" | "onprem";
  serverUrl: string;
  collectionName: string;
  collectionUrl: string;
  profileUrl: string;
};

type DiscoveredOnPremCollection = {
  collectionName: string;
  collectionUrl: string;
  resolvedServerUrl: string;
};

function escWiql(value: string): string {
  return value.replace(/'/g, "''");
}

function buildCompletionDateFilter(startDate: string, endDate: string): string {
  return `AND (
      (
        [Microsoft.VSTS.Common.ClosedDate] >= '${startDate}'
        AND [Microsoft.VSTS.Common.ClosedDate] <= '${endDate}'
      )
      OR (
        [Microsoft.VSTS.Common.ResolvedDate] >= '${startDate}'
        AND [Microsoft.VSTS.Common.ResolvedDate] <= '${endDate}'
      )
    )`;
}

function getAdoRuntimeContext(serverUrl?: string, collectionName?: string): AdoRuntimeContext {
  const normalizedServerUrl = normalizeAdoServerUrl(serverUrl);
  const deploymentTarget = getAdoDeploymentTarget(normalizedServerUrl);

  if (deploymentTarget === "cloud") {
    const org = (collectionName ?? "").trim();
    return {
      deploymentTarget,
      serverUrl: ADO_CLOUD_BASE_URL,
      collectionName: org,
      collectionUrl: org ? `${ADO_CLOUD_BASE_URL}/${encodeURIComponent(org)}` : ADO_CLOUD_BASE_URL,
      profileUrl: ADO_CLOUD_PROFILE_BASE_URL,
    };
  }

  const resolvedCollectionName = (collectionName ?? "").trim() || extractOnPremCollectionName(normalizedServerUrl);
  const collectionUrl = buildOnPremCollectionUrl(normalizedServerUrl, resolvedCollectionName);
  return {
    deploymentTarget,
    serverUrl: normalizedServerUrl,
    collectionName: resolvedCollectionName,
    collectionUrl,
    profileUrl: normalizedServerUrl,
  };
}

function getApiVersionQuery(runtime: AdoRuntimeContext): string {
  return runtime.deploymentTarget === "onprem" ? ONPREM_API : CLOUD_API;
}

async function discoverOnPremCollection(serverUrl: string, pat: string): Promise<DiscoveredOnPremCollection | null> {
  const normalizedServerUrl = normalizeAdoServerUrl(serverUrl);
  const cacheKey = `${normalizedServerUrl}::${pat}`;
  const existing = onPremCollectionDiscoveryInFlight.get(cacheKey);
  if (existing) return existing;

  const task = (async (): Promise<DiscoveredOnPremCollection | null> => {
    const candidates = listOnPremCollectionCandidates(normalizedServerUrl);
    for (const candidate of candidates) {
      try {
        const response = await adoFetch(
          `${candidate.collectionUrl}/_apis/projects?$top=1&${ONPREM_API}`,
          { headers: adoHeaders(pat) },
          {
            operation: "detection de la collection Azure DevOps Server",
            org: candidate.collectionName,
            requiredScopes: ["Project and Team (Read)"],
          },
        );
        if (response.ok) {
          return {
            collectionName: candidate.collectionName,
            collectionUrl: candidate.collectionUrl,
            resolvedServerUrl: candidate.collectionUrl,
          };
        }
      } catch {
        continue;
      }
    }
    return null;
  })();

  onPremCollectionDiscoveryInFlight.set(cacheKey, task);
  try {
    return await task;
  } finally {
    onPremCollectionDiscoveryInFlight.delete(cacheKey);
  }
}

async function adoFetch(url: string, init: RequestInit, context: AdoErrorContext): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (error: unknown) {
    throw toAdoNetworkError(error, context);
  }
}

async function getTeamAreaPathFilterClause(
  org: string,
  project: string,
  team: string,
  pat: string,
  serverUrl?: string,
): Promise<string> {
  const runtime = getAdoRuntimeContext(serverUrl, org);
  const api = getApiVersionQuery(runtime);
  const fallbackPath = `${project}\\${team}`;

  try {
    const teamEncoded = encodeURIComponent(team);
    const r = await fetch(
      `${runtime.collectionUrl}/${encodeURIComponent(project)}/${teamEncoded}/_apis/work/teamsettings/teamfieldvalues?${api}`,
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

export async function checkPatDirect(pat: string, serverUrl?: string, collectionName?: string): Promise<ResolvedPatProfile> {
  const cacheKey = `${normalizeAdoServerUrl(serverUrl)}::${(collectionName ?? "").trim()}::${pat}`;
  const existing = profileLookupInFlight.get(cacheKey);
  if (existing) return existing;

  const task = (async (): Promise<ResolvedPatProfile> => {
    const runtime = getAdoRuntimeContext(serverUrl, collectionName);
    if (runtime.deploymentTarget === "onprem") {
      const explicitCollectionName = (collectionName ?? "").trim();
      const discovered =
        explicitCollectionName
          ? {
            collectionName: runtime.collectionName,
            collectionUrl: runtime.collectionUrl,
            resolvedServerUrl: runtime.collectionUrl,
          }
          : await discoverOnPremCollection(runtime.serverUrl, pat);
      if (!discovered?.collectionUrl) {
        return {
          displayName: "Utilisateur",
          id: "",
          publicAlias: "",
          restrictedProfile: true,
        };
      }

      const context: AdoErrorContext = {
        operation: "verification du PAT",
        org: discovered.collectionName,
        requiredScopes: ["Project and Team (Read)"],
      };
      const response = await adoFetch(
        `${discovered.collectionUrl}/_apis/projects?$top=1&${ONPREM_API}`,
        { headers: adoHeaders(pat) },
        context,
      );
      if (!response.ok) throw toAdoHttpError(response, context);
      return {
        displayName: "Utilisateur",
        id: "",
        publicAlias: "",
        restrictedProfile: true,
      };
    }

    const context: AdoErrorContext = {
      operation: "verification du PAT",
      requiredScopes: ["Profile (Read)"],
    };
    const r = await adoFetch(`${runtime.profileUrl}/_apis/profile/profiles/me?${CLOUD_API}`, { headers: adoHeaders(pat) }, context);
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

    throw toAdoHttpError(r, context);
  })();

  profileLookupInFlight.set(cacheKey, task);
  try {
    return await task;
  } finally {
    profileLookupInFlight.delete(cacheKey);
  }
}

async function listOrgsByMemberId(memberId: string, pat: string): Promise<AdoOrg[]> {
  if (!memberId) return [];
  const r = await fetch(`${ADO_CLOUD_PROFILE_BASE_URL}/_apis/accounts?memberId=${encodeURIComponent(memberId)}&${CLOUD_API}`, {
    headers: adoHeaders(pat),
  });
  if (!r.ok) return [];
  const data = await r.json();
  return (data.value ?? []).map((a: { accountName?: string }) => ({ name: a.accountName ?? "" }));
}

export async function listOrgsDirect(pat: string, serverUrl?: string): Promise<AdoOrg[]> {
  const runtime = getAdoRuntimeContext(serverUrl);
  if (runtime.deploymentTarget === "onprem") return [];
  const me = await checkPatDirect(pat, serverUrl);
  const memberId = me.id || me.publicAlias || "";
  return listOrgsByMemberId(memberId, pat);
}

export async function resolvePatOrganizationScopeDirect(pat: string, serverUrl?: string): Promise<{
  displayName: string;
  memberId: string;
  organizations: AdoOrg[];
  scope: "none" | "local" | "global";
  resolvedServerUrl?: string;
}> {
  const runtime = getAdoRuntimeContext(serverUrl);
  const discoveredOnPremCollection =
    runtime.deploymentTarget === "onprem" ? await discoverOnPremCollection(runtime.serverUrl, pat) : null;
  const onPremCollectionName = discoveredOnPremCollection?.collectionName || extractOnPremCollectionName(serverUrl);
  const me = await checkPatDirect(pat, serverUrl, onPremCollectionName);
  if (runtime.deploymentTarget === "onprem") {
    return {
      displayName: me.displayName || "Utilisateur",
      memberId: me.id || "",
      organizations: onPremCollectionName ? [{ name: onPremCollectionName }] : [],
      scope: "local",
      resolvedServerUrl: discoveredOnPremCollection?.resolvedServerUrl,
    };
  }
  if (me.restrictedProfile) {
    return {
      displayName: me.displayName || "Utilisateur",
      memberId: me.id || "",
      organizations: [],
      scope: "local",
    };
  }
  const memberId = me.id || me.publicAlias || "";
  if (!memberId) {
    return { displayName: me.displayName || "Utilisateur", memberId: "", organizations: [], scope: "none" };
  }
  const organizations = await listOrgsByMemberId(memberId, pat);
  const scope = organizations.length > 0 ? "global" : "none";
  return {
    displayName: me.displayName || "Utilisateur",
    memberId,
    organizations,
    scope,
  };
}

export async function listProjectsDirect(org: string, pat: string, serverUrl?: string): Promise<AdoProject[]> {
  const runtime = getAdoRuntimeContext(serverUrl, org);
  const api = getApiVersionQuery(runtime);
  const context: AdoErrorContext = {
    operation: "chargement des projets",
    org,
    requiredScopes: ["Project and Team (Read)"],
  };
  if (!runtime.collectionUrl) {
    throw new Error("Collection Azure DevOps Server manquante. Saisissez-la pour continuer.");
  }
  const r = await adoFetch(`${runtime.collectionUrl}/_apis/projects?${api}`, { headers: adoHeaders(pat) }, context);
  if (!r.ok) throw toAdoHttpError(r, context);
  const data = await r.json();
  return data.value ?? [];
}

export async function listTeamsDirect(org: string, project: string, pat: string, serverUrl?: string): Promise<AdoTeam[]> {
  const runtime = getAdoRuntimeContext(serverUrl, org);
  const api = getApiVersionQuery(runtime);
  const projects = await listProjectsDirect(org, pat, serverUrl);
  const proj = projects.find((p) => p.name === project);
  if (!proj) throw new Error(`Projet "${project}" introuvable.`);

  const context: AdoErrorContext = {
    operation: "chargement des equipes",
    org,
    project,
    requiredScopes: ["Project and Team (Read)"],
  };
  const r = await adoFetch(
    `${runtime.collectionUrl}/_apis/projects/${proj.id}/teams?${api}`,
    { headers: adoHeaders(pat) },
    context,
  );
  if (!r.ok) throw toAdoHttpError(r, context);
  const data = await r.json();
  return data.value ?? [];
}

export async function getTeamOptionsDirect(
  org: string,
  project: string,
  _team: string,
  pat: string,
  serverUrl?: string,
): Promise<{ workItemTypes: string[]; statesByType: Record<string, string[]> }> {
  const runtime = getAdoRuntimeContext(serverUrl, org);
  const api = getApiVersionQuery(runtime);
  const context: AdoErrorContext = {
    operation: "chargement des types de tickets",
    org,
    project,
    requiredScopes: ["Work Items (Read)"],
  };
  const typesResp = await adoFetch(
    `${runtime.collectionUrl}/${encodeURIComponent(project)}/_apis/wit/workitemtypes?${api}`,
    { headers: adoHeaders(pat) },
    context,
  );
  if (!typesResp.ok) throw toAdoHttpError(typesResp, context);

  const typesData = await typesResp.json();
  const witTypes: string[] = (typesData.value ?? []).map((t: { name?: string }) => t.name ?? "").filter(Boolean);

  const statesByType: Record<string, string[]> = {};
  await Promise.all(
    witTypes.map(async (type) => {
      const encoded = encodeURIComponent(type);
      const r = await adoFetch(`${runtime.collectionUrl}/${encodeURIComponent(project)}/_apis/wit/workitemtypes/${encoded}/states?${api}`, {
        headers: adoHeaders(pat),
      }, {
        operation: `chargement des etats pour le type "${type}"`,
        org,
        project,
        requiredScopes: ["Work Items (Read)"],
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
  serverUrl?: string,
): Promise<WeeklyThroughputResponse> {
  const runtime = getAdoRuntimeContext(serverUrl, org);
  const api = getApiVersionQuery(runtime);
  const teamAreaFilter = await getTeamAreaPathFilterClause(org, project, team, pat, serverUrl);
  const typeFilter = workItemTypes.length
    ? `AND [System.WorkItemType] IN (${workItemTypes.map((t) => `'${escWiql(t)}'`).join(",")})`
    : "";
  const stateFilter = doneStates.length
    ? `AND [System.State] IN (${doneStates.map((s) => `'${escWiql(s)}'`).join(",")})`
    : "";

  const wiql = {
    query: `
      SELECT [System.Id], [Microsoft.VSTS.Common.ClosedDate], [Microsoft.VSTS.Common.ResolvedDate]
      FROM WorkItems
      WHERE [System.TeamProject] = '${escWiql(project)}'
      ${buildCompletionDateFilter(startDate, endDate)}
      ${teamAreaFilter}
      ${typeFilter}
      ${stateFilter}
      ORDER BY [Microsoft.VSTS.Common.ClosedDate]
    `,
  };

  const wiqlContext: AdoErrorContext = {
    operation: "requete WIQL (historique de fermeture)",
    org,
    project,
    team,
    requiredScopes: ["Work Items (Read)"],
  };
  const wiqlResp = await adoFetch(`${runtime.collectionUrl}/${encodeURIComponent(project)}/_apis/wit/wiql?${api}`, {
    method: "POST",
    headers: adoHeaders(pat),
    body: JSON.stringify(wiql),
  }, wiqlContext);
  if (!wiqlResp.ok) throw toAdoHttpError(wiqlResp, wiqlContext);

  const wiqlData = await wiqlResp.json();
  const items: { id: number }[] = wiqlData.workItems ?? [];
  if (!items.length) return [];

  const ids = items.map((i) => i.id);
  const batches: number[][] = [];
  for (let i = 0; i < ids.length; i += 200) batches.push(ids.slice(i, i + 200));

  const allItems: { completionDate: string }[] = [];
  const batchFailures: { status: number | null; statusText: string }[] = [];
  await Promise.all(
    batches.map(async (batch) => {
      const itemContext: AdoErrorContext = {
        operation: "chargement des work items par lots",
        org,
        project,
        team,
        requiredScopes: ["Work Items (Read)"],
      };

      let r: Response;
      try {
        r = await adoFetch(
          `${runtime.collectionUrl}/${encodeURIComponent(project)}/_apis/wit/workitems?ids=${batch.join(",")}&fields=Microsoft.VSTS.Common.ClosedDate,Microsoft.VSTS.Common.ResolvedDate&${api}`,
          { headers: adoHeaders(pat) },
          itemContext,
        );
      } catch {
        batchFailures.push({ status: null, statusText: "erreur reseau" });
        return;
      }

      if (!r.ok) {
        batchFailures.push({ status: r.status, statusText: r.statusText });
        return;
      }

      const d = await r.json();
      (d.value ?? []).forEach((item: { fields?: Record<string, string> }) => {
        const completionDate =
          item.fields?.["Microsoft.VSTS.Common.ClosedDate"] ||
          item.fields?.["Microsoft.VSTS.Common.ResolvedDate"];
        if (completionDate) allItems.push({ completionDate });
      });
    }),
  );

  const weekMap = new Map<string, number>();
  allItems.forEach(({ completionDate }) => {
    const d = new Date(completionDate);
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const key = formatDateLocal(monday);
    weekMap.set(key, (weekMap.get(key) ?? 0) + 1);
  });

  const result: WeeklyThroughputRow[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  const cursor = new Date(start);
  cursor.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7));
  while (cursor <= end) {
    const key = formatDateLocal(cursor);
    result.push({ week: key, throughput: weekMap.get(key) ?? 0 });
    cursor.setDate(cursor.getDate() + 7);
  }

  if (!batchFailures.length) return result;

  const firstFailure = batchFailures[0];
  const firstFailureDetail = firstFailure.status === null
    ? "erreur reseau"
    : formatAdoHttpErrorMessage(
      firstFailure.status,
      {
        operation: "chargement des work items par lots",
        org,
        project,
        team,
        requiredScopes: ["Work Items (Read)"],
      },
      firstFailure.statusText,
    );

  return {
    weeklyThroughput: result,
    warning:
      `${batchFailures.length}/${batches.length} lot(s) de work items n'ont pas pu etre charges. ` +
      `La simulation utilise un historique partiel. Exemple: ${firstFailureDetail}`,
  };
}
