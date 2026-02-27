import { describe, expect, it, vi } from "vitest";
import {
  applyCapacityReductionToResult,
  buildScenarioSamples,
  computeRiskLegend,
  computeRiskScoreFromPercentiles,
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

describe("applyCapacityReductionToResult", () => {
  it("returns same object when there is no effective reduction", () => {
    const input = {
      result_kind: "weeks" as const,
      samples_count: 6,
      result_percentiles: { P50: 8, P70: 10, P90: 13 },
      risk_score: 0.625,
      result_distribution: [{ x: 8, count: 10 }],
    };
    expect(applyCapacityReductionToResult(input, "backlog_to_weeks", 12, 100, 4)).toBe(input);
    expect(applyCapacityReductionToResult(input, "backlog_to_weeks", 12, 80, 0)).toBe(input);
  });
});

describe("buildScenarioSamples", () => {
  it("builds optimistic, arrime, friction and conservative samples for 2 teams", () => {
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

    expect(scenarios.optimiste).toEqual([210, 120, 210]);
    expect(scenarios.arrime).toEqual([168, 96, 168]);
    expect(scenarios.friction).toEqual([134, 76, 134]);
    expect(scenarios.conservateur).toEqual([210, 120, 210]);
    expect(scenarios.optimiste).toHaveLength(3);
    expect(scenarios.arrime).toHaveLength(3);
    expect(scenarios.friction).toHaveLength(3);
    expect(scenarios.conservateur).toHaveLength(3);
    randomSpy.mockRestore();
  });

  it("uses same values for all scenarios with 1 team", () => {
    const randomSpy = vi.spyOn(Math, "random");
    randomSpy.mockReturnValue(0.1);

    const scenarios = buildScenarioSamples([[5, 8, 13]], 20);

    expect(scenarios.optimiste).toEqual(scenarios.arrime);
    expect(scenarios.arrime).toEqual(scenarios.friction);
    expect(scenarios.optimiste).toEqual(scenarios.conservateur);
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

    expect(scenarios.conservateur).toEqual([60]); // median(10,20,30)=20, *3 => 60
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

    expect(scenarios.conservateur).toEqual([120]); // median=(20+40)/2=30, *4 =>120
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
