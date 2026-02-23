function adoHeaders(pat: string): Record<string, string> {
  return {
    Authorization: `Basic ${btoa(`:${pat}`)}`,
    "Content-Type": "application/json",
  };
}

function formatDateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const ADO = "https://dev.azure.com";
const VSSPS = "https://app.vssps.visualstudio.com";
const API = "api-version=7.1";

type AdoOrg = { name: string };
type AdoProject = { id: string; name: string };
type AdoTeam = { id: string; name: string };

export async function checkPatDirect(pat: string): Promise<{ displayName: string; id: string }> {
  const r = await fetch(`${VSSPS}/_apis/profile/profiles/me?${API}`, {
    headers: adoHeaders(pat),
  });
  if (!r.ok) throw new Error("PAT invalide ou insuffisant.");
  return r.json();
}

export async function listOrgsDirect(pat: string): Promise<AdoOrg[]> {
  const me = await checkPatDirect(pat);
  const memberId = me.id;

  const r = await fetch(`${VSSPS}/_apis/accounts?memberId=${memberId}&${API}`, {
    headers: adoHeaders(pat),
  });
  if (!r.ok) return [];
  const data = await r.json();
  return (data.value ?? []).map((a: { accountName?: string }) => ({ name: a.accountName ?? "" }));
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
  if (!r.ok) throw new Error("Impossible de lister les equipes.");
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
  _team: string,
  pat: string,
  startDate: string,
  endDate: string,
  doneStates: string[],
  workItemTypes: string[],
): Promise<{ week: string; throughput: number }[]> {
  const typeFilter = workItemTypes.length
    ? `AND [System.WorkItemType] IN (${workItemTypes.map((t) => `'${t.replace(/'/g, "''")}'`).join(",")})`
    : "";
  const stateFilter = doneStates.length
    ? `AND [System.State] IN (${doneStates.map((s) => `'${s.replace(/'/g, "''")}'`).join(",")})`
    : "";

  const wiql = {
    query: `
      SELECT [System.Id], [Microsoft.VSTS.Common.ClosedDate]
      FROM WorkItems
      WHERE [System.TeamProject] = '${project.replace(/'/g, "''")}'
      AND [Microsoft.VSTS.Common.ClosedDate] >= '${startDate}'
      AND [Microsoft.VSTS.Common.ClosedDate] <= '${endDate}'
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
