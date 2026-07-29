import { describe, expect, it } from "vitest";

import { buildHistogram, HISTOGRAM_MAX_BUCKETS } from "./histogram";

describe("buildHistogram", () => {
  it("keeps exact histograms unchanged", () => {
    expect(buildHistogram([4, 1, 4, 2, 1, 4])).toEqual([
      { x: 1, count: 2 },
      { x: 2, count: 1 },
      { x: 4, count: 3 },
    ]);
    expect(buildHistogram([])).toEqual([]);
  });

  it("uses clipped inclusive bounds for the continuous 0..100 range", () => {
    const buckets = buildHistogram(Array.from({ length: 101 }, (_value, index) => index));

    expect(buckets).toEqual(Array.from({ length: 51 }, (_value, index) => ({
      x: index * 2,
      count: index === 50 ? 1 : 2,
    })));
    expect(buckets).toHaveLength(51);
    expect(buckets.reduce((mass, bucket) => mass + bucket.count, 0)).toBe(101);
  });

  it.each([
    [10_000, [{ x: 50, count: 100 }, { x: 9_999, count: 1 }]],
    [1_000_000, [{ x: 5_000, count: 100 }, { x: 995_049, count: 1 }]],
  ] as const)("clips the extreme right bound for a discontinuous range ending at %i", (maximum, expected) => {
    const values = [...Array.from({ length: 100 }, (_value, index) => index), maximum];
    const buckets = buildHistogram(values);

    expect(buckets).toEqual(expected);
    expect(buckets.length).toBeLessThanOrEqual(HISTOGRAM_MAX_BUCKETS);
    expect(buckets.every((bucket) => bucket.count > 0)).toBe(true);
    expect(buckets.every((bucket, index) => index === 0 || buckets[index - 1]!.x < bucket.x)).toBe(true);
    expect(buckets.reduce((mass, bucket) => mass + bucket.count, 0)).toBe(values.length);
  });
});
