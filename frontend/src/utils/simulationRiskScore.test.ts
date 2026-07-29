import { describe, expect, it } from "vitest";
import {
  createSimulationPercentiles,
  riskScoreFromPercentiles,
} from "../domain/simulationValueObjects";

function score(
  mode: "backlog_to_weeks" | "weeks_to_items",
  values: Readonly<Record<string, unknown>>,
) {
  return riskScoreFromPercentiles(
    mode,
    createSimulationPercentiles(mode, values),
  );
}

describe("riskScoreFromPercentiles authority", () => {
  it("computes both normalized spreads and preserves missing values", () => {
    expect(score("backlog_to_weeks", { P90: 14 })).toBeUndefined();
    expect(score("backlog_to_weeks", { P50: 0, P90: 14 })).toBeUndefined();
    expect(score("backlog_to_weeks", { P50: 10, P90: 14 })).toBe(0.4);
    expect(score("weeks_to_items", { P50: 24, P90: 18 })).toBe(0.25);
    expect(score("backlog_to_weeks", { P50: 32, P90: 33 })).toBe(0.0313);
    expect(score("weeks_to_items", { P50: 32, P90: 31 })).toBe(0.0313);
  });

  it.each([
    ["backlog_to_weeks", { P50: 10, P90: 8 }, "croissant"],
    ["weeks_to_items", { P50: 10, P90: 12 }, "decroissant"],
    ["weeks_to_items", { P50: -2, P90: 1 }, ">= 0"],
    ["weeks_to_items", { P50: 10, P90: Number.NaN }, "entier strict"],
  ] as const)("rejects invalid domain percentiles", (mode, values, message) => {
    expect(() => score(mode, values)).toThrow(message);
  });
});
