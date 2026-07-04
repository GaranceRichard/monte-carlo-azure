import { afterEach, describe, expect, it, vi } from "vitest";
import { checkPatDirect, getTeamDeliveryDataDirect, getWeeklyThroughputDirect, listProjectsDirect } from "./adoClient";

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
    expect(result.cycleTimeData).toEqual([{ week: "2026-01-12", cycleTime: 1, count: 2 }]);
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
});
