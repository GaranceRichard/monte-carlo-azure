import { afterEach, describe, expect, it, vi } from "vitest";
import { checkPatDirect, getWeeklyThroughputDirect, listProjectsDirect } from "./adoClient";

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
              fields: {
                "Microsoft.VSTS.Common.ResolvedDate": "2026-01-14T10:00:00Z",
              },
            },
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
