import { afterEach, describe, expect, it, vi } from "vitest";
import { getTeamDeliveryDataDirect } from "./adoClient";

describe("adoClient delivery diagnostics", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the untouched period diagnostics when no complete week is available", async () => {
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
    expect(result.diagnostics.periods).toEqual([
      { code: "partial_initial_period", periodStatus: "partial_initial_and_final" },
      { code: "partial_final_period", periodStatus: "partial_initial_and_final" },
    ]);
    expect(result.warning).toBeUndefined();
  });
});
