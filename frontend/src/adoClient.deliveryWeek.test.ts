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
  });
});
