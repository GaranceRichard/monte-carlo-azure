import { describe, expect, it } from "vitest";
import { applyCapacityReductionToResult, computeRiskScoreFromPercentiles } from "./simulation";

describe("computeRiskScoreFromPercentiles", () => {
  it("returns 0 when P50 is missing or non-positive", () => {
    expect(computeRiskScoreFromPercentiles({ P90: 14 })).toBe(0);
    expect(computeRiskScoreFromPercentiles({ P50: 0, P90: 14 })).toBe(0);
    expect(computeRiskScoreFromPercentiles({ P50: -2, P90: 14 })).toBe(0);
  });

  it("computes normalized spread and clamps negative values", () => {
    expect(computeRiskScoreFromPercentiles({ P50: 10, P90: 14 })).toBe(0.4);
    expect(computeRiskScoreFromPercentiles({ P50: 10, P90: 8 })).toBe(0);
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

