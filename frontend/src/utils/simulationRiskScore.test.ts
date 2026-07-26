import { describe, expect, it } from "vitest";
import { createSimulationPercentiles } from "../domain/simulationValueObjects";
import { computeRiskScoreFromPercentiles } from "./simulation";

function score(
  mode: "backlog_to_weeks" | "weeks_to_items",
  values: Readonly<Record<string, unknown>>,
) {
  return computeRiskScoreFromPercentiles(
    mode,
    createSimulationPercentiles(mode, values),
  );
}

describe("computeRiskScoreFromPercentiles", () => {
  it("computes both normalized spreads and preserves missing values", () => {
    expect(score("backlog_to_weeks", { P90: 14 })).toBeNull();
    expect(score("backlog_to_weeks", { P50: 0, P90: 14 })).toBeNull();
    expect(score("backlog_to_weeks", { P50: 10, P90: 14 })).toBe(0.4);
    expect(score("weeks_to_items", { P50: 24, P90: 18 })).toBe(0.25);
  });

  it.each([
    ["backlog_to_weeks", { P50: 10, P90: 8 }, "croissant"],
    ["weeks_to_items", { P50: 10, P90: 12 }, "decroissant"],
    ["weeks_to_items", { P50: -2, P90: 1 }, ">= 0"],
    ["weeks_to_items", { P50: 10, P90: Number.NaN }, "entier strict"],
  ] as const)("rejects invalid domain percentiles", (mode, values, message) => {
    expect(() => score(mode, values)).toThrow(message);
  });

  it("does not let invalid presentation data produce a risk score", () => {
    expect(
      computeRiskScoreFromPercentiles(
        "backlog_to_weeks",
        { P50: 10, P70: Number.NaN } as never,
      ),
    ).toBeNull();
  });
});
