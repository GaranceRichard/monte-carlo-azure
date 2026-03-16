import { describe, expect, it, vi } from "vitest";
import {
  buildScenarioSamples,
  computeRiskLegend,
  computeRiskScoreFromPercentiles,
  computeThroughputReliability,
  simulateMonteCarloLocal,
} from "./simulation";
import { DEMO_TEAM_SAMPLES } from "../demoData";

describe("computeRiskScoreFromPercentiles", () => {
  it("returns 0 when P50 is missing or non-positive", () => {
    expect(computeRiskScoreFromPercentiles("backlog_to_weeks", { P90: 14 })).toBe(0);
    expect(computeRiskScoreFromPercentiles("backlog_to_weeks", { P50: 0, P90: 14 })).toBe(0);
    expect(computeRiskScoreFromPercentiles("weeks_to_items", { P50: -2, P90: 1 })).toBe(0);
  });

  it("computes normalized spread in backlog_to_weeks mode", () => {
    expect(computeRiskScoreFromPercentiles("backlog_to_weeks", { P50: 10, P90: 14 })).toBe(0.4);
    expect(computeRiskScoreFromPercentiles("backlog_to_weeks", { P50: 10, P90: 8 })).toBe(0);
  });

  it("computes normalized spread in weeks_to_items mode", () => {
    expect(computeRiskScoreFromPercentiles("weeks_to_items", { P50: 10, P90: 6 })).toBe(0.4);
    expect(computeRiskScoreFromPercentiles("weeks_to_items", { P50: 10, P90: 12 })).toBe(0);
  });
});

describe("buildScenarioSamples", () => {
  it("builds optimistic, aligned, friction and conservative samples for 2 teams", () => {
    const randomSpy = vi.spyOn(Math, "random");
    randomSpy
      .mockReturnValueOnce(0.1) // team1 -> 10
      .mockReturnValueOnce(0.8) // team2 -> 200
      .mockReturnValueOnce(0.6) // team1 -> 30
      .mockReturnValueOnce(0.2) // team2 -> 100
      .mockReturnValueOnce(0.3) // team1 -> 10
      .mockReturnValueOnce(0.9); // team2 -> 200

    const scenarios = buildScenarioSamples(
      [
        [10, 20, 30],
        [100, 200],
      ],
      80,
    );

    expect(scenarios.optimistic).toEqual([210, 120, 210]);
    expect(scenarios.aligned).toEqual([168, 96, 168]);
    expect(scenarios.friction).toEqual([134, 76, 134]);
    expect(scenarios.conservative).toEqual([210, 120, 210]);
    expect(scenarios.optimistic).toHaveLength(3);
    expect(scenarios.aligned).toHaveLength(3);
    expect(scenarios.friction).toHaveLength(3);
    expect(scenarios.conservative).toHaveLength(3);
    randomSpy.mockRestore();
  });

  it("uses same values for all scenarios with 1 team", () => {
    const randomSpy = vi.spyOn(Math, "random");
    randomSpy.mockReturnValue(0.1);

    const scenarios = buildScenarioSamples([[5, 8, 13]], 20);

    expect(scenarios.optimistic).toEqual(scenarios.aligned);
    expect(scenarios.aligned).toEqual(scenarios.friction);
    expect(scenarios.optimistic).toEqual(scenarios.conservative);
    randomSpy.mockRestore();
  });

  it("uses median * team count for conservative scenario with odd team count", () => {
    const randomSpy = vi.spyOn(Math, "random");
    randomSpy
      .mockReturnValueOnce(0.1) // 10
      .mockReturnValueOnce(0.1) // 30
      .mockReturnValueOnce(0.1); // 20

    const scenarios = buildScenarioSamples(
      [
        [10],
        [30],
        [20],
      ],
      80,
    );

    expect(scenarios.conservative).toEqual([60]); // median(10,20,30)=20, *3 => 60
    randomSpy.mockRestore();
  });

  it("uses median * team count for conservative scenario with even team count", () => {
    const randomSpy = vi.spyOn(Math, "random");
    randomSpy
      .mockReturnValueOnce(0.1) // 10
      .mockReturnValueOnce(0.1) // 20
      .mockReturnValueOnce(0.1) // 40
      .mockReturnValueOnce(0.1); // 80

    const scenarios = buildScenarioSamples(
      [
        [10],
        [20],
        [40],
        [80],
      ],
      80,
    );

    expect(scenarios.conservative).toEqual([120]); // median=(20+40)/2=30, *4 =>120
    randomSpy.mockRestore();
  });

  it("throws explicit error when teamSamples is empty", () => {
    expect(() => buildScenarioSamples([], 100)).toThrow("teamSamples ne peut pas etre vide");
  });

  it("throws explicit error when a team has no samples", () => {
    expect(() => buildScenarioSamples([[1, 2], []], 100)).toThrow(
      "chaque equipe doit contenir au moins un sample",
    );
  });
});

describe("computeRiskLegend", () => {
  it("covers fiable and incertain ranges", () => {
    expect(computeRiskLegend(0.1)).toBe("fiable");
    expect(computeRiskLegend(0.4)).toBe("incertain");
  });

  it("covers fragile and non fiable ranges", () => {
    expect(computeRiskLegend(0.7)).toBe("fragile");
    expect(computeRiskLegend(0.95)).toBe("non fiable");
  });
});

describe("computeThroughputReliability", () => {
  it("returns null for empty or non-finite samples", () => {
    expect(computeThroughputReliability([])).toBeNull();
    expect(computeThroughputReliability([Number.NaN, Number.POSITIVE_INFINITY])).toBeNull();
  });

  it("marks very short histories as non fiable", () => {
    const reliability = computeThroughputReliability([4, 4, 4, 4, 4]);

    expect(reliability).toMatchObject({
      label: "non fiable",
      samples_count: 5,
      cv: 0,
      iqr_ratio: 0,
      slope_norm: 0,
    });
  });

  it("marks highly volatile histories as fragile", () => {
    const reliability = computeThroughputReliability([0, 20, 0, 20, 0, 20, 0, 20]);

    expect(reliability?.label).toBe("fragile");
    expect(reliability?.cv).toBeGreaterThanOrEqual(1);
  });

  it("marks moderate variability as incertain", () => {
    const reliability = computeThroughputReliability([10, 11, 12, 13, 14, 15, 16, 17]);

    expect(reliability).toMatchObject({
      label: "incertain",
      samples_count: 8,
    });
    expect(Math.abs(reliability?.slope_norm ?? 0)).toBeGreaterThanOrEqual(0.05);
    expect(Math.abs(reliability?.slope_norm ?? 0)).toBeLessThan(0.1);
  });

  it("downgrades otherwise stable short histories to incertain", () => {
    const reliability = computeThroughputReliability([10, 10, 10, 10, 10, 10, 10]);

    expect(reliability).toMatchObject({
      label: "incertain",
      samples_count: 7,
      cv: 0,
      iqr_ratio: 0,
      slope_norm: 0,
    });
  });

  it("handles a single finite sample without slope computation", () => {
    const reliability = computeThroughputReliability([7]);

    expect(reliability).toMatchObject({
      label: "non fiable",
      samples_count: 1,
      cv: 0,
      iqr_ratio: 0,
      slope_norm: 0,
    });
  });

  it("handles zero-only histories with zero mean and quartiles", () => {
    const reliability = computeThroughputReliability([0, 0, 0, 0, 0, 0]);

    expect(reliability).toMatchObject({
      label: "non fiable",
      samples_count: 6,
      cv: 0,
      iqr_ratio: 0,
      slope_norm: 0,
    });
  });

  it("matches the expected reliability labels for demo teams", () => {
    expect(computeThroughputReliability(DEMO_TEAM_SAMPLES.Alpha)?.label).toBe("fiable");
    expect(computeThroughputReliability(DEMO_TEAM_SAMPLES.Beta)?.label).toBe("fragile");
    expect(computeThroughputReliability(DEMO_TEAM_SAMPLES.Gamma)?.label).toBe("incertain");
  });
});

describe("simulateMonteCarloLocal", () => {
  it("returns a backend-compatible structure in backlog mode", () => {
    const result = simulateMonteCarloLocal({
      throughputSamples: DEMO_TEAM_SAMPLES.Alpha,
      includeZeroWeeks: true,
      mode: "backlog_to_weeks",
      backlogSize: 120,
      nSims: 5000,
    });

    expect(result.result_kind).toBe("weeks");
    expect(result.samples_count).toBe(16);
    expect(Object.keys(result.result_percentiles)).toEqual(["P50", "P70", "P90"]);
    expect(result.result_distribution.length).toBeGreaterThan(0);
    expect(typeof result.risk_score).toBe("number");
    expect(result.throughput_reliability?.label).toBe("fiable");
  });

  it("returns a backend-compatible structure in target-weeks mode", () => {
    const result = simulateMonteCarloLocal({
      throughputSamples: DEMO_TEAM_SAMPLES.Gamma,
      includeZeroWeeks: true,
      mode: "weeks_to_items",
      targetWeeks: 12,
      nSims: 5000,
    });

    expect(result.result_kind).toBe("items");
    expect(result.result_percentiles.P50).toBeGreaterThan(0);
    expect(result.result_distribution.length).toBeGreaterThan(0);
    expect(result.throughput_reliability?.label).toBe("incertain");
  });

  it("rejects empty normalized samples for both zero-week modes", () => {
    expect(() =>
      simulateMonteCarloLocal({
        throughputSamples: [Number.NaN, Number.POSITIVE_INFINITY],
        includeZeroWeeks: true,
        mode: "backlog_to_weeks",
        backlogSize: 10,
        nSims: 10,
      }),
    ).toThrow(">= 0");

    expect(() =>
      simulateMonteCarloLocal({
        throughputSamples: [0, -1],
        includeZeroWeeks: false,
        mode: "backlog_to_weeks",
        backlogSize: 10,
        nSims: 10,
      }),
    ).toThrow("> 0");
  });

  it("aggregates histogram buckets when too many unique outcomes are produced", () => {
    const result = simulateMonteCarloLocal({
      throughputSamples: Array.from({ length: 250 }, (_value, index) => index),
      includeZeroWeeks: true,
      mode: "weeks_to_items",
      targetWeeks: 1,
      nSims: 1000,
    });

    expect(result.result_distribution.length).toBeLessThanOrEqual(100);
    expect(result.result_distribution.every((bucket) => Number.isInteger(bucket.x) && bucket.count > 0)).toBe(true);
    expect(result.result_distribution.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(1000);
  });

  it("falls back to 521 weeks when zero throughput never burns backlog", () => {
    const result = simulateMonteCarloLocal({
      throughputSamples: [0, 0, 0],
      includeZeroWeeks: true,
      mode: "backlog_to_weeks",
      backlogSize: 5,
      nSims: 3,
    });

    expect(result.result_kind).toBe("weeks");
    expect(result.result_percentiles).toEqual({ P50: 521, P70: 521, P90: 521 });
    expect(result.result_distribution).toEqual([{ x: 521, count: 3 }]);
    expect(result.throughput_reliability?.label).toBe("non fiable");
  });

  it("normalizes negative and fractional inputs for simulation guards", () => {
    const result = simulateMonteCarloLocal({
      throughputSamples: [1.9, 2.2, 3.8],
      includeZeroWeeks: false,
      mode: "weeks_to_items",
      targetWeeks: -3.4,
      nSims: 0.4,
    });

    expect(result.result_kind).toBe("items");
    expect(result.samples_count).toBe(3);
    expect(result.result_distribution.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(1);
    expect(result.result_percentiles.P50).toBeGreaterThanOrEqual(1);
  });
});
