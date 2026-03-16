import { describe, expect, it, vi } from "vitest";
import {
  buildScenarioSamples,
  computeRiskLegend,
  computeRiskScoreFromPercentiles,
  computeThroughputReliability,
} from "./simulation";

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
});
