import { describe, expect, it } from "vitest";
import { createThroughputReliability } from "./simulationValueObjects";
import { computeThroughputReliability } from "./throughputReliability";

describe("throughput reliability calculation", () => {
  it.each([
    [
      [1, 2, 3, 4, 5, 6],
      {
        cv: 0.488,
        iqrRatio: 0.7143,
        slopeNorm: 0.2857,
        label: "fragile",
        samplesCount: 6,
      },
    ],
    [
      [9, 9, 10, 10, 10, 11, 11],
      {
        cv: 0.0756,
        iqrRatio: 0.1,
        slopeNorm: 0.0357,
        label: "incertain",
        samplesCount: 7,
      },
    ],
    [
      [16, 17, 18, 19, 20, 21, 22, 23, 24],
      {
        cv: 0.1291,
        iqrRatio: 0.2,
        slopeNorm: 0.05,
        label: "incertain",
        samplesCount: 9,
      },
    ],
    [
      [12, 14, 16, 18, 20, 22, 24, 26, 28],
      {
        cv: 0.2582,
        iqrRatio: 0.4,
        slopeNorm: 0.1,
        label: "fragile",
        samplesCount: 9,
      },
    ],
    [
      [32, 29, 26, 23, 20, 17, 14, 11, 8],
      {
        cv: 0.3873,
        iqrRatio: 0.6,
        slopeNorm: -0.15,
        label: "non fiable",
        samplesCount: 9,
      },
    ],
    [
      [8, 3, 3, 3, 3, 3, 3, 3, 3, 8],
      {
        cv: 0.5,
        iqrRatio: 0,
        slopeNorm: 0,
        label: "incertain",
        samplesCount: 10,
      },
    ],
    [
      [6, 1, 1, 1, 1, 1, 1, 1, 1, 6],
      {
        cv: 1,
        iqrRatio: 0,
        slopeNorm: 0,
        label: "fragile",
        samplesCount: 10,
      },
    ],
    [
      [16, 1, 1, 1, 1, 1, 1, 1, 1, 16],
      {
        cv: 1.5,
        iqrRatio: 0,
        slopeNorm: 0,
        label: "non fiable",
        samplesCount: 10,
      },
    ],
    [
      [3, 4, 5, 5, 4, 3, 3, 4, 5],
      {
        cv: 0.2041,
        iqrRatio: 0.5,
        slopeNorm: 0.0083,
        label: "incertain",
        samplesCount: 9,
      },
    ],
  ] as const)(
    "uses population moments, linear quartiles and least-squares slope",
    (samples, expected) => {
      expect(computeThroughputReliability(samples)).toEqual(expected);
    },
  );

  it("rejects invalid sample histories at the calculation boundary", () => {
    expect(computeThroughputReliability([])).toBeNull();
    expect(() => computeThroughputReliability([Number.NaN])).toThrow("entiers finis");
    expect(() => computeThroughputReliability([Number.MAX_SAFE_INTEGER + 1])).toThrow(
      "entiers finis",
    );
    expect(() => computeThroughputReliability([-1])).toThrow("entiers finis");
  });

  it.each([
    [{ cv: 1, iqrRatio: 1, slopeNorm: -0.15, samplesCount: 8, mean: 1 }, "non fiable"],
    [{ cv: 1, iqrRatio: 0.5, slopeNorm: 0.05, samplesCount: 6, mean: 1 }, "fragile"],
    [{ cv: 0.5, iqrRatio: 0.5, slopeNorm: 0.05, samplesCount: 8, mean: 1 }, "incertain"],
  ] as const)("applies the normative category priority to overlapping thresholds", (metrics, label) => {
    expect(createThroughputReliability(metrics).label).toBe(label);
  });
});
