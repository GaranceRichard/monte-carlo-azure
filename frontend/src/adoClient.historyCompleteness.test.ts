import { afterEach, describe, expect, it, vi } from "vitest";
import { getTeamDeliveryDataDirect } from "./adoClient";

function completePeriodArguments(): Parameters<typeof getTeamDeliveryDataDirect> {
  return [
    "org",
    "Project",
    "Team",
    "pat",
    "2026-01-05",
    "2026-01-18",
    ["Done"],
    ["Bug"],
  ];
}

describe("adoClient delivery-history completeness", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps a collected period without deliveries complete with zero throughput", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ values: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ workItems: [] }), { status: 200 }));

    const result = await getTeamDeliveryDataDirect(...completePeriodArguments());

    expect(result.weeklyThroughput).toEqual([
      { week: "2026-01-05", throughput: 0 },
      { week: "2026-01-12", throughput: 0 },
    ]);
    expect(result.historyCompleteness).toEqual({
      status: "complete",
      code: "delivery_history_complete",
      requiredItemCount: 0,
      observedItemCount: 0,
      missingItemIds: [],
    });
  });

  it("retains a complete diagnostic when every required delivery fact is observed", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ values: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ workItems: [{ id: 101 }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        value: [{
          id: 101,
          fields: { "Microsoft.VSTS.Common.ClosedDate": "2026-01-06T10:00:00Z" },
        }],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: [] }), { status: 200 }));

    const result = await getTeamDeliveryDataDirect(...completePeriodArguments());

    expect(result.historyCompleteness).toEqual({
      status: "complete",
      code: "delivery_history_complete",
      requiredItemCount: 1,
      observedItemCount: 1,
      missingItemIds: [],
    });
  });

  it("keeps absence explicit when no complete period is available", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    const result = await getTeamDeliveryDataDirect(
      "org",
      "Project",
      "Team",
      "pat",
      "2026-01-07",
      "2026-01-09",
      ["Done"],
      ["Bug"],
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.historyCompleteness.status).toBe("absent");
  });

  it("retains an incomplete diagnostic when a required item cannot be loaded", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ values: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ workItems: [{ id: 101 }] }), { status: 200 }))
      .mockRejectedValueOnce(new Error("batch offline"));

    const result = await getTeamDeliveryDataDirect(...completePeriodArguments());

    expect(result.historyCompleteness).toEqual({
      status: "incomplete",
      code: "delivery_history_incomplete",
      requiredItemCount: 1,
      observedItemCount: 0,
      missingItemIds: ["101"],
    });
    expect(result.warning).toContain("historique partiel");
  });
});
