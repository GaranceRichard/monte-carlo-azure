import { afterEach, describe, expect, it, vi } from "vitest";
import { getTeamDeliveryDataDirect } from "./adoClient";

describe("adoClient delivery calendar migration", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("groups throughput and Cycle Time with the same UTC ISO week at an offset boundary", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ values: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ workItems: [{ id: 101 }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        value: [{
          id: 101,
          fields: { "Microsoft.VSTS.Common.ClosedDate": "2026-01-05T00:30:00+02:00" },
        }],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        value: [
          { fields: { "System.ChangedDate": "2026-01-04T20:00:00Z", "System.State": "New" } },
          { fields: { "System.ChangedDate": "2026-01-05T00:00:00+02:00", "System.State": "Active" } },
          { fields: { "System.ChangedDate": "2026-01-04T22:30:00Z", "System.State": "Done" } },
        ],
      }), { status: 200 }));

    const result = await getTeamDeliveryDataDirect(
      "org",
      "Project",
      "Team",
      "pat",
      "2025-12-29",
      "2026-01-11",
      ["Done"],
      ["Bug"],
    );

    expect(result.weeklyThroughput).toEqual([
      { week: "2025-12-29", throughput: 1 },
      { week: "2026-01-05", throughput: 0 },
    ]);
    expect(result.cycleTimeDaysData).toEqual([
      { week: "2025-12-29", cycleTimeDays: 0.02, count: 1 },
    ]);
    expect(result.warning).toBeUndefined();
  });

  it("uses delivery continuity for successful but incomplete collection batches", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ values: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ workItems: [{ id: 1 }, { id: 2 }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: [
        { id: 2, fields: { "Microsoft.VSTS.Common.ClosedDate": "2026-01-06T10:00:00Z" } },
      ] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: [] }), { status: 200 }));

    const result = await getTeamDeliveryDataDirect(
      "org", "Project", "Team", "partial-success", "2026-01-05", "2026-01-18", ["Done"], [],
    );

    expect(result.warning).toContain("historique partiel");
    expect(result.warning).toContain("1/2 evenement(s)");
    expect(result.warning).toContain("1 rupture(s)");
    expect(result.warning).not.toContain("Collecte des work items interrompue");
  });

  it("uses delivery ambiguity for an unavailable event history", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ values: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ workItems: [{ id: 1 }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: [
        { id: 1, fields: { "Microsoft.VSTS.Common.ClosedDate": "2026-01-06T10:00:00Z" } },
      ] }), { status: 200 }))
      .mockRejectedValueOnce(new Error("revisions offline"));

    const result = await getTeamDeliveryDataDirect(
      "org", "Project", "Team", "ambiguous-revisions", "2026-01-05", "2026-01-18", ["Done"], [],
    );

    expect(result.warning).toContain("Historique ambigu");
    expect(result.warning).toContain("cycle time");
    expect(result.warning).toContain("erreur reseau");
  });

  it("delegates an impossible Azure lifecycle to the delivery chronology authority", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ values: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ workItems: [{ id: 101 }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        value: [{
          id: 101,
          fields: { "Microsoft.VSTS.Common.ClosedDate": "2026-01-04T21:00:00Z" },
        }],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        value: [
          { fields: { "System.ChangedDate": "2026-01-04T20:00:00Z", "System.State": "New" } },
          { fields: { "System.ChangedDate": "2026-01-04T22:00:00Z", "System.State": "Active" } },
          { fields: { "System.ChangedDate": "2026-01-04T22:30:00Z", "System.State": "Done" } },
        ],
      }), { status: 200 }));

    const result = await getTeamDeliveryDataDirect(
      "org",
      "Project",
      "Team",
      "pat",
      "2025-12-29",
      "2026-01-11",
      ["Done"],
      ["Bug"],
    );

    expect(result.weeklyThroughput).toEqual([
      { week: "2025-12-29", throughput: 0 },
      { week: "2026-01-05", throughput: 0 },
    ]);
    expect(result.cycleTimeDaysData).toEqual([]);
  });
});
