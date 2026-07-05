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

  it("caps week probabilities at the real completion rate when simulations are censored", () => {
    const curve = buildProbabilityCurve(
      [
        { x: 10, count: 1 },
        { x: 12, count: 1 },
      ],
      "weeks",
      3,
    );

    expect(curve).toHaveLength(2);
    expect(curve[0]).toMatchObject({ x: 10 });
    expect(curve[1]).toMatchObject({ x: 12 });
    expect(curve[0]?.probability).toBeCloseTo(100 / 3, 5);
    expect(curve[1]?.probability).toBeCloseTo(200 / 3, 5);
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

  it.each([
    { visibleCount: 0, totalCount: 20, expectedMax: 0 },
    { visibleCount: 10, totalCount: 20, expectedMax: 50 },
    { visibleCount: 17, totalCount: 20, expectedMax: 85 },
    { visibleCount: 18, totalCount: 20, expectedMax: 90 },
    { visibleCount: 20, totalCount: 20, expectedMax: 100 },
  ])("matches the completion rate ceiling for weeks at $expectedMax%", ({ visibleCount, totalCount, expectedMax }) => {
    const points = visibleCount > 0 ? [{ x: 10, count: visibleCount }] : [];
    const curve = buildProbabilityCurve(points, "weeks", totalCount);

    if (expectedMax === 0) {
      expect(curve).toEqual([]);
      return;
    }

    expect(curve.at(-1)?.probability).toBeCloseTo(expectedMax, 5);
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

  it("matches the conservative survival percentiles for a known discrete distribution", () => {
    const points = [
      { x: 18, count: 1 },
      { x: 22, count: 1 },
      { x: 24, count: 1 },
      { x: 25, count: 1 },
      { x: 27, count: 1 },
    ];

    const p = buildAtLeastPercentiles(points, [50, 70, 90]);

    expect(p).toEqual({ P50: 24, P70: 22, P90: 18 });
  });
});
