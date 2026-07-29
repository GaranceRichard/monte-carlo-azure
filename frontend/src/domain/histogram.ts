export const HISTOGRAM_MAX_BUCKETS = 100;

export type HistogramBucketValue = Readonly<{
  x: number;
  count: number;
}>;

export function buildHistogram(values: readonly number[]): HistogramBucketValue[] {
  if (!values.length) return [];

  const countsByValue = new Map<number, number>();
  values.forEach((value) => {
    countsByValue.set(value, (countsByValue.get(value) ?? 0) + 1);
  });
  const exactBuckets = Array.from(countsByValue.entries()).sort((left, right) => left[0] - right[0]);
  if (exactBuckets.length <= HISTOGRAM_MAX_BUCKETS) {
    return exactBuckets.map(([x, count]) => ({ x, count }));
  }

  const minimum = exactBuckets[0]?.[0] ?? 0;
  const maximum = exactBuckets[exactBuckets.length - 1]?.[0] ?? 0;
  const width = Math.floor((maximum - minimum) / HISTOGRAM_MAX_BUCKETS) + 1;
  const countsByIndex = new Map<number, number>();
  exactBuckets.forEach(([value, count]) => {
    const index = Math.floor((value - minimum) / width);
    countsByIndex.set(index, (countsByIndex.get(index) ?? 0) + count);
  });

  return Array.from(countsByIndex.entries())
    .sort((left, right) => left[0] - right[0])
    .map(([index, count]) => {
      const left = minimum + index * width;
      const right = Math.min(maximum, left + width - 1);
      const x = Math.floor((left + right) / 2);
      return { x, count };
    });
}
