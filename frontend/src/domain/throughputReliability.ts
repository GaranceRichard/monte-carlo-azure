import type { ThroughputReliability } from "./simulationValueObjects";
import { createThroughputReliability } from "./simulationValueObjects";

function linearQuantile(sortedValues: readonly number[], level: number): number {
  const position = (sortedValues.length - 1) * level;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.min(lowerIndex + 1, sortedValues.length - 1);
  const weight = position - lowerIndex;
  const lowerValue = sortedValues[lowerIndex] ?? 0;
  const upperValue = sortedValues[upperIndex] ?? lowerValue;
  return lowerValue + weight * (upperValue - lowerValue);
}

export function computeThroughputReliability(
  samples: readonly number[],
): ThroughputReliability | null {
  if (samples.length === 0) return null;
  if (samples.some((value) => !Number.isSafeInteger(value) || value < 0)) {
    throw new Error("throughput_samples doit contenir uniquement des entiers finis >= 0.");
  }
  const values = [...samples];
  const samplesCount = values.length;
  const mean = values.reduce((sum, value) => sum + value, 0) / samplesCount;
  const variance = values.reduce(
    (sum, value) => sum + (value - mean) ** 2,
    0,
  ) / samplesCount;
  const sortedValues = [...values].sort((left, right) => left - right);
  const q25 = linearQuantile(sortedValues, 0.25);
  const median = linearQuantile(sortedValues, 0.5);
  const q75 = linearQuantile(sortedValues, 0.75);

  const meanX = (samplesCount - 1) / 2;
  const slopeNumerator = values.reduce(
    (sum, value, index) => sum + (index - meanX) * (value - mean),
    0,
  );
  const slopeDenominator = values.reduce(
    (sum, _value, index) => sum + (index - meanX) ** 2,
    0,
  );
  const slope = slopeDenominator > 0 ? slopeNumerator / slopeDenominator : 0;
  return createThroughputReliability({
    cv: mean > 0 ? Math.sqrt(variance) / mean : 0,
    iqrRatio: median > 0 ? (q75 - q25) / median : 0,
    slopeNorm: mean > 0 ? slope / mean : 0,
    samplesCount,
    mean,
  });
}
