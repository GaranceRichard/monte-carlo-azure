import { describe, expect, it } from "vitest";
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
});
