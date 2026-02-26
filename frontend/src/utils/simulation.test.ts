import { describe, expect, it } from "vitest";
import { applyCapacityReductionToResult, computeRiskScoreFromPercentiles } from "./simulation";

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
