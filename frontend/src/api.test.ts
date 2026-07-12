import { afterEach, describe, expect, it, vi } from "vitest";
import { postSimulate } from "./api";

describe("postSimulate", () => {
  afterEach(() => vi.restoreAllMocks());

  it("posts the public payload and returns a valid response", async () => {
    const data = { result_kind: "weeks", samples_count: 8, seed: 12, result_percentiles: { P50: 3 }, result_distribution: [] };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(data), { status: 200 }));

    await expect(postSimulate({ throughput_samples: [1, 2], mode: "backlog_to_weeks", backlog_size: 3, n_sims: 1000 })).resolves.toEqual(data);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/simulate$/), expect.objectContaining({ method: "POST", credentials: "include" }));
  });

  it("reports HTTP failures, including invalid JSON bodies", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("not json", { status: 502 }));
    await expect(postSimulate({ throughput_samples: [1], mode: "weeks_to_items", target_weeks: 2, n_sims: 1000 })).rejects.toThrow("HTTP 502");
  });

  it("keeps network errors observable to callers", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    await expect(postSimulate({ throughput_samples: [1], mode: "weeks_to_items", target_weeks: 2, n_sims: 1000 })).rejects.toThrow("offline");
  });
});
