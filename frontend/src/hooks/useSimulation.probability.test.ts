import { describe, expect, it } from "vitest";
import { buildAtLeastPercentiles, buildProbabilityCurve } from "./useSimulation";

describe("buildProbabilityCurve", () => {
  it("returns increasing cumulative probabilities for weeks", () => {
    const points = [
      { x: 10, count: 2 },
      { x: 12, count: 1 },
      { x: 15, count: 1 },
    ];

    const curve = buildProbabilityCurve(points, "weeks");

    expect(curve).toHaveLength(3);
    expect(curve[0].x).toBe(10);
    expect(curve[0].probability).toBeCloseTo(50, 5);
    expect(curve[1].probability).toBeCloseTo(75, 5);
    expect(curve[2].probability).toBeCloseTo(100, 5);
  });

  it("returns decreasing 'at least' probabilities for items", () => {
    const points = [
      { x: 49, count: 2 },
      { x: 56, count: 1 },
      { x: 66, count: 1 },
    ];

    const curve = buildProbabilityCurve(points, "items");

    expect(curve).toHaveLength(3);
    expect(curve[0].x).toBe(49);
    expect(curve[0].probability).toBeCloseTo(100, 5);
    expect(curve[1].probability).toBeCloseTo(50, 5);
    expect(curve[2].probability).toBeCloseTo(25, 5);
  });
});

describe("buildAtLeastPercentiles", () => {
  it("computes at-least percentiles from histogram buckets", () => {
    const points = [
      { x: 49, count: 2 },
      { x: 56, count: 1 },
      { x: 66, count: 1 },
    ];

    const p = buildAtLeastPercentiles(points, [50, 70, 90]);

    expect(p.P50).toBe(56);
    expect(p.P70).toBe(49);
    expect(p.P90).toBe(49);
  });
});
