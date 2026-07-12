import { afterEach, describe, expect, it, vi } from "vitest";
import {
  checkPatDirect,
  getTeamDeliveryDataDirect,
  getTeamOptionsDirect,
  getWeeklyThroughputDirect,
  listOrgsDirect,
  listProjectsDirect,
  listTeamsDirect,
  resolvePatOrganizationScopeDirect,
} from "./adoClient";

describe("adoClient on-prem api-version", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses api-version 6.0 for on-prem PAT verification", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ value: [{ id: "p1", name: "Projet A" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await checkPatDirect("pat-token-abcdefghijklmnopqrstuvwxyz", "https://devops700.itp.extra/700", "700");

    expect(result.displayName).toBe("Utilisateur");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://devops700.itp.extra/700/_apis/projects?$top=1&api-version=6.0",
      expect.any(Object),
    );
  });

  it("uses api-version 6.0 for on-prem project listing", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ value: [{ id: "p1", name: "Projet A" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await listProjectsDirect("700", "pat-token-abcdefghijklmnopqrstuvwxyz", "https://devops700.itp.extra/700");

    expect(result).toEqual([{ id: "p1", name: "Projet A" }]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://devops700.itp.extra/700/_apis/projects?api-version=6.0",
      expect.any(Object),
    );
  });

  it("counts resolved items with ResolvedDate when ClosedDate is missing", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ values: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ workItems: [{ id: 101 }] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          value: [
            {
              id: 101,
              fields: {
                "Microsoft.VSTS.Common.ResolvedDate": "2026-01-14T10:00:00Z",
              },
            },
          ],
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          value: [
            { fields: { "System.ChangedDate": "2026-01-06T10:00:00Z", "System.State": "New" } },
            { fields: { "System.ChangedDate": "2026-01-08T10:00:00Z", "System.State": "Active" } },
            { fields: { "System.ChangedDate": "2026-01-14T10:00:00Z", "System.State": "Resolved" } },
          ],
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    const result = await getWeeklyThroughputDirect(
      "700",
      "Projet A",
      "Equipe A",
      "pat-token-abcdefghijklmnopqrstuvwxyz",
      "2026-01-01",
      "2026-01-31",
      ["Resolved"],
      ["Product Backlog Item"],
      "https://devops700.itp.extra/700",
    );

    expect(Array.isArray(result)).toBe(true);
    if (!Array.isArray(result)) return;
    expect(result.some((row) => row.throughput > 0)).toBe(true);
  });

  it("builds aggregated cycle time points from revisions", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ values: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ workItems: [{ id: 101 }, { id: 102 }] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          value: [
            { id: 101, fields: { "Microsoft.VSTS.Common.ClosedDate": "2026-01-15T10:00:00Z" } },
            { id: 102, fields: { "Microsoft.VSTS.Common.ClosedDate": "2026-01-16T10:00:00Z" } },
          ],
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          value: [
            { fields: { "System.ChangedDate": "2026-01-06T10:00:00Z", "System.State": "New" } },
            { fields: { "System.ChangedDate": "2026-01-08T10:00:00Z", "System.State": "Active" } },
            { fields: { "System.ChangedDate": "2026-01-15T10:00:00Z", "System.State": "Done" } },
          ],
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          value: [
            { fields: { "System.ChangedDate": "2026-01-07T10:00:00Z", "System.State": "New" } },
            { fields: { "System.ChangedDate": "2026-01-09T10:00:00Z", "System.State": "Active" } },
            { fields: { "System.ChangedDate": "2026-01-16T10:00:00Z", "System.State": "Done" } },
          ],
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    const result = await getTeamDeliveryDataDirect(
      "700",
      "Projet A",
      "Equipe A",
      "pat-token-abcdefghijklmnopqrstuvwxyz",
      "2026-01-01",
      "2026-01-31",
      ["Done"],
      ["Product Backlog Item"],
      "https://devops700.itp.extra/700",
    );

    expect(result.weeklyThroughput.some((row) => row.throughput > 0)).toBe(true);
    expect(result.cycleTimeDaysData).toEqual([{ week: "2026-01-12", cycleTimeDays: 7, count: 2 }]);
  });

  it("includes a week when startDate is monday and endDate is a completed sunday", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ values: [] }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ workItems: [] }), { status: 200, headers: { "Content-Type": "application/json" } }));

    const result = await getTeamDeliveryDataDirect(
      "700",
      "Projet A",
      "Equipe A",
      "pat-token-abcdefghijklmnopqrstuvwxyz",
      "2026-01-05",
      "2026-01-11",
      ["Done"],
      ["Bug"],
      "https://devops700.itp.extra/700",
    );

    expect(result.weeklyThroughput).toEqual([{ week: "2026-01-05", throughput: 0 }]);
  });

  it("excludes the partial week at the beginning when startDate is midweek", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ values: [] }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ workItems: [] }), { status: 200, headers: { "Content-Type": "application/json" } }));

    const result = await getTeamDeliveryDataDirect(
      "700",
      "Projet A",
      "Equipe A",
      "pat-token-abcdefghijklmnopqrstuvwxyz",
      "2026-01-07",
      "2026-01-25",
      ["Done"],
      ["Bug"],
      "https://devops700.itp.extra/700",
    );

    expect(String(fetchMock.mock.calls[1]?.[1]?.body ?? "")).toContain("[Microsoft.VSTS.Common.ClosedDate] >= '2026-01-12'");
    expect(result.weeklyThroughput.map((row) => row.week)).toEqual(["2026-01-12", "2026-01-19"]);
  });

  it("excludes the partial week at the end when endDate is midweek", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ values: [] }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ workItems: [] }), { status: 200, headers: { "Content-Type": "application/json" } }));

    const result = await getTeamDeliveryDataDirect(
      "700",
      "Projet A",
      "Equipe A",
      "pat-token-abcdefghijklmnopqrstuvwxyz",
      "2026-01-05",
      "2026-01-23",
      ["Done"],
      ["Bug"],
      "https://devops700.itp.extra/700",
    );

    expect(String(fetchMock.mock.calls[1]?.[1]?.body ?? "")).toContain("[Microsoft.VSTS.Common.ClosedDate] <= '2026-01-18'");
    expect(result.weeklyThroughput.map((row) => row.week)).toEqual(["2026-01-05", "2026-01-12"]);
  });

  it("returns an explicit warning when no complete week is available", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    const result = await getTeamDeliveryDataDirect(
      "700",
      "Projet A",
      "Equipe A",
      "pat-token-abcdefghijklmnopqrstuvwxyz",
      "2026-01-07",
      "2026-01-09",
      ["Done"],
      ["Bug"],
      "https://devops700.itp.extra/700",
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.weeklyThroughput).toEqual([]);
    expect(result.warning).toContain("Aucune semaine complete");
  });

  it("discovers the first valid on-prem collection from left to right", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock
      .mockResolvedValueOnce(new Response("{}", { status: 404 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ value: [{ id: "p1", name: "Projet A" }] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ value: [{ id: "p1", name: "Projet A" }] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    const result = await checkPatDirect(
      "pat-token-abcdefghijklmnopqrstuvwxyz",
      "https://serveur/tfs/collection/projet",
    );

    expect(result.displayName).toBe("Utilisateur");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://serveur/tfs/_apis/projects?$top=1&api-version=6.0");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://serveur/tfs/collection/_apis/projects?$top=1&api-version=6.0");
  });

  it("uses profile metadata and account pagination endpoint for Cloud organizations", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "member-id", displayName: "Ada" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: [{ accountName: "Org A" }, {}] }), { status: 200 }));
    await expect(listOrgsDirect("pat")).resolves.toEqual([{ name: "Org A" }, { name: "" }]);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://app.vssps.visualstudio.com/_apis/accounts?memberId=member-id&api-version=7.1");
  });

  it("handles restricted Cloud profile metadata and HTTP/network errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 401, headers: { "x-vss-userdata": "aad.person:Pat User" } }));
    await expect(checkPatDirect("pat")).resolves.toMatchObject({ id: "person", displayName: "Pat User", restrictedProfile: true });
    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    await expect(listProjectsDirect("org", "pat")).rejects.toThrow("Impossible de joindre Azure DevOps");
  });

  it("returns empty on-prem organizations and exposes empty project/team responses", async () => {
    await expect(listOrgsDirect("pat", "https://server/tfs/Collection")).resolves.toEqual([]);
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: [] }), { status: 200 }));
    await expect(listProjectsDirect("org", "pat")).resolves.toEqual([]);
    await expect(listTeamsDirect("org", "Missing", "pat")).rejects.toThrow('Projet "Missing" introuvable');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("loads type states and resolves Cloud organization scope", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: [{ name: "Bug" }, { name: "" }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: [{ name: "New" }, { name: "Done" }] }), { status: 200 }));
    await expect(getTeamOptionsDirect("org", "Projet A", "Equipe", "pat")).resolves.toEqual({ workItemTypes: ["Bug"], statesByType: { Bug: ["Done", "New"] } });
    expect(fetchMock.mock.calls[0]?.[0]).toContain("Projet%20A");

    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "member", displayName: "Ada" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: [{ accountName: "Org A" }] }), { status: 200 }));
    await expect(resolvePatOrganizationScopeDirect("pat")).resolves.toMatchObject({ displayName: "Ada", memberId: "member", scope: "global", organizations: [{ name: "Org A" }] });
  });

  it("keeps Cloud compatibility for incomplete profiles, empty accounts, and unavailable type states", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: [] }), { status: 200 }));
    await expect(resolvePatOrganizationScopeDirect("cloud-empty-profile")).resolves.toMatchObject({
      displayName: "Utilisateur",
      memberId: "",
      scope: "none",
      organizations: [],
    });
    expect(fetchMock).toHaveBeenCalledOnce();

    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: [{ name: "Bug" }, {}] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: [] }), { status: 503, statusText: "Offline" }));
    await expect(getTeamOptionsDirect("org", "Projet A", "Equipe", "partial-options")).resolves.toEqual({
      workItemTypes: ["Bug"],
      statesByType: {},
    });
  });

  it("reports HTTP failures and malformed project or team payloads through their public contracts", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("denied", { status: 403, statusText: "Forbidden" }));
    await expect(listProjectsDirect("org", "forbidden")).rejects.toThrow("403");

    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: [{ id: "p1", name: "Projet A" }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }));
    await expect(listTeamsDirect("org", "Projet A", "partial")).resolves.toEqual([]);

    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({ value: [] }), { status: 200 }));
    await expect(getTeamOptionsDirect("org", "Projet A", "Equipe", "missing-types")).resolves.toEqual({
      workItemTypes: [],
      statesByType: {},
    });
  });

  it("falls back safely when team area settings or item batches are incomplete", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("team settings offline"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ workItems: [{ id: 11 }] }), { status: 200 }))
      .mockRejectedValueOnce(new Error("batch offline"));
    const result = await getTeamDeliveryDataDirect(
      "org", "Project", "Team", "partial-batch", "2026-01-05", "2026-01-18", ["Done"], [],
    );
    expect(result.warning).toContain("historique partiel");
    expect(String(fetchMock.mock.calls[1]?.[1]?.body)).toContain("[System.AreaPath] UNDER 'Project\\\\Team'");
    expect(result.weeklyThroughput).toEqual([
      { week: "2026-01-05", throughput: 0 },
      { week: "2026-01-12", throughput: 0 },
    ]);
  });

  it("uses configured area paths and retains throughput when cycle-time revisions fail", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ values: [
        { value: "Project\\Team", includeChildren: false },
        { value: "Project\\Child", includeChildren: true },
        {},
      ] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ workItems: [{ id: 11 }, { id: 12 }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: [
        { id: 11, fields: { "Microsoft.VSTS.Common.ClosedDate": "2026-01-06T10:00:00Z" } },
        { fields: {} },
      ] }), { status: 200 }))
      .mockResolvedValueOnce(new Response("missing revision", { status: 404, statusText: "Not Found" }));
    const result = await getTeamDeliveryDataDirect(
      "org", "Project", "Team", "partial-revisions", "2026-01-05", "2026-01-18", ["Done"], ["Bug"],
    );

    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)).query).toContain("[System.AreaPath] = 'Project\\Team' OR [System.AreaPath] UNDER 'Project\\Child'");
    expect(result.weeklyThroughput[0]).toEqual({ week: "2026-01-05", throughput: 1 });
    expect(result.warning).toContain("cycle time");
  });

  it("supports on-prem local scopes when discovery succeeds or no collection can be reached", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: [{}] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: [{}] }), { status: 200 }));
    await expect(resolvePatOrganizationScopeDirect("onprem-scope", "https://server/tfs/Collection")).resolves.toMatchObject({
      scope: "local",
      organizations: [{ name: "tfs" }],
      resolvedServerUrl: "https://server/tfs",
    });

    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("missing", { status: 404 }));
    await expect(checkPatDirect("no-collection", "https://server/tfs")).resolves.toMatchObject({ restrictedProfile: true, id: "" });
  });

  it("deduplicates concurrent profile verification and reports unavailable profiles", async () => {
    let resolveResponse: (response: Response) => void = () => undefined;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise((resolve) => { resolveResponse = resolve; }));
    const first = checkPatDirect("shared-pat");
    const second = checkPatDirect("shared-pat");
    expect(fetchMock).toHaveBeenCalledOnce();
    resolveResponse(new Response(JSON.stringify({ id: "member" }), { status: 200 }));
    await expect(Promise.all([first, second])).resolves.toEqual([
      expect.objectContaining({ id: "member" }),
      expect.objectContaining({ id: "member" }),
    ]);

    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("denied", { status: 403, statusText: "Forbidden" }));
    await expect(checkPatDirect("denied-profile")).rejects.toThrow("403");
    await expect(checkPatDirect("denied-onprem", "https://server/tfs/Collection", "Collection")).rejects.toThrow("403");
  });

  it("keeps empty and invalid Azure data visible as safe public responses", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }));
    await expect(listOrgsDirect("no-member")).resolves.toEqual([]);

    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: [{ id: "p1", name: "Project" }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response("missing", { status: 404, statusText: "Not Found" }));
    await expect(listTeamsDirect("org", "Project", "team-error")).rejects.toThrow("404");

    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("missing", { status: 404, statusText: "Not Found" }));
    await expect(getTeamOptionsDirect("org", "Project", "Team", "types-error")).rejects.toThrow("404");
    await expect(getWeeklyThroughputDirect("org", "Project", "Team", "short-range", "2026-01-07", "2026-01-09", [], [])).resolves.toMatchObject({ warning: expect.any(String) });
  });

  it("returns partial delivery warnings for HTTP batches, missing dates, and network revision failures", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("unavailable", { status: 503, statusText: "Down" }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ workItems: [{ id: 1 }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response("batch unavailable", { status: 502, statusText: "Bad Gateway" }));
    const batchFailure = await getTeamDeliveryDataDirect("org", "Project", "Team", "batch-http", "2026-01-05", "2026-01-18", ["Done"], []);
    expect(batchFailure.warning).toContain("502");

    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ values: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ workItems: [{ id: 1 }, { id: 2 }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: [
        { id: 1, fields: { "Microsoft.VSTS.Common.ClosedDate": "not-a-date" } },
        { id: 2, fields: { "Microsoft.VSTS.Common.ClosedDate": "2026-01-06T10:00:00Z" } },
      ] }), { status: 200 }))
      .mockRejectedValueOnce(new Error("revisions offline"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: [] }), { status: 200 }));
    const revisionFailure = await getTeamDeliveryDataDirect("org", "Project", "Team", "revision-network", "2026-01-05", "2026-01-18", ["Done"], []);
    expect(revisionFailure.weeklyThroughput[0]).toEqual({ week: "2026-01-05", throughput: 1 });
    expect(revisionFailure.warning).toContain("erreur reseau");
  });

  it("continues on collection discovery network errors and exposes local restricted scopes", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("first collection offline"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: [{}] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: [{}] }), { status: 200 }));
    await expect(checkPatDirect("discovery-network", "https://network-server/tfs/Collection")).resolves.toMatchObject({
      restrictedProfile: true,
    });

    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("", { status: 401, headers: { "x-vss-userdata": "aad.member:Restricted User" } }),
    );
    await expect(resolvePatOrganizationScopeDirect("restricted-scope")).resolves.toMatchObject({
      scope: "local",
      memberId: "member",
      organizations: [],
    });

    await expect(listProjectsDirect("", "missing-collection", "https://network-server/tfs")).rejects.toThrow(
      "Collection Azure DevOps Server manquante",
    );
  });
});
