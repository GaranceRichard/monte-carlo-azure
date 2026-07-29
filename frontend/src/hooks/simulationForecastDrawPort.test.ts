import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSeededSampleIndexDrawPort } from "../adapters/seededSampleIndexDrawPort";
import { postSimulate } from "../api";
import { simulateForecastFromSamples } from "./simulationForecastService";

vi.mock("../api", () => ({
  postSimulate: vi.fn(),
}));

vi.mock("../adapters/seededSampleIndexDrawPort", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../adapters/seededSampleIndexDrawPort")
  >();
  return {
    ...actual,
    createSeededSampleIndexDrawPort: vi.fn(
      actual.createSeededSampleIndexDrawPort,
    ),
  };
});

const params = {
  seed: 123,
  throughputSamples: [3, 4, 5, 6, 7, 8],
  includeZeroWeeks: true,
  simulationMode: "weeks_to_items" as const,
  backlogSize: 120,
  targetWeeks: 6,
  nSims: 1000,
};

describe("simulation forecast draw-port composition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(postSimulate).mockResolvedValue({
      result_kind: "items",
      samples_count: 6,
      seed: 123,
      result_percentiles: { P50: 30, P70: 28, P90: 24 },
      risk_score: 0.2,
      result_distribution: [{ x: 30, count: 1000 }],
      throughput_reliability: {
        cv: 0.1,
        iqr_ratio: 0.1,
        slope_norm: 0,
        label: "fiable",
        samples_count: 6,
      },
    });
  });

  it("creates exactly one seeded adapter for each demo simulation", async () => {
    await simulateForecastFromSamples({ ...params, demoMode: true });

    expect(createSeededSampleIndexDrawPort).toHaveBeenCalledOnce();
    expect(createSeededSampleIndexDrawPort).toHaveBeenCalledWith(123);
    expect(postSimulate).not.toHaveBeenCalled();
  });

  it("does not create a local adapter for the HTTP path", async () => {
    await simulateForecastFromSamples(params);

    expect(createSeededSampleIndexDrawPort).not.toHaveBeenCalled();
    expect(postSimulate).toHaveBeenCalledOnce();
    expect(postSimulate).toHaveBeenCalledWith(
      expect.objectContaining({ seed: 123 }),
    );
  });
});
