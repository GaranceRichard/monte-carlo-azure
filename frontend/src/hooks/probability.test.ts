import { describe, expect, it } from "vitest";
import { buildAtLeastPercentiles, buildProbabilityCurve } from "./probability";

describe("buildProbabilityCurve", () => {
  it("returns empty array for empty points", () => {
    expect(buildProbabilityCurve([], "weeks")).toEqual([]);
    expect(buildProbabilityCurve([], "items")).toEqual([]);
  });

  it("returns empty array when total count is not positive", () => {
    const points = [
      { x: 10, count: 0 },
      { x: 12, count: 0 },
    ];
    expect(buildProbabilityCurve(points, "weeks")).toEqual([]);
    expect(buildProbabilityCurve(points, "items")).toEqual([]);
  });

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
  it("returns empty object for empty points", () => {
    expect(buildAtLeastPercentiles([], [50, 70, 90])).toEqual({});
  });

  it("returns empty object when total count is not positive", () => {
    const points = [
      { x: 49, count: 0 },
      { x: 56, count: 0 },
    ];
    expect(buildAtLeastPercentiles(points, [50, 70, 90])).toEqual({});
  });

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
