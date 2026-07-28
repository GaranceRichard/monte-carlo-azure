/**
 * Minimal engine need: select a valid index without exposing a seed or random
 * algorithm. Explicit skipping reserves unused logical simulation positions
 * without calculating their indices.
 */
export interface SampleIndexDrawPort {
  drawSampleIndex(sampleCount: number): number;
  skipSampleIndices(drawCount: number): void;
}
