export function roundPositiveRatioHalfUp(
  numerator: number,
  denominator: number,
): number {
  const scale = 10_000n;
  const divisor = BigInt(denominator);
  const scaledNumerator = BigInt(numerator) * scale;
  let rounded = scaledNumerator / divisor;
  if ((scaledNumerator % divisor) * 2n >= divisor) rounded += 1n;
  return Number(rounded) / Number(scale);
}
