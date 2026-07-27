import type { SampleIndexDrawPort } from "../domain/sampleIndexDrawPort";

export class DeterministicSampleIndexDrawPort implements SampleIndexDrawPort {
  readonly requests: number[] = [];
  private position = 0;

  constructor(private readonly sampleIndices: readonly number[]) {}

  drawSampleIndex(sampleCount: number): number {
    if (!Number.isInteger(sampleCount) || sampleCount <= 0) {
      throw new Error("sampleCount de test doit etre un entier > 0.");
    }
    if (this.position >= this.sampleIndices.length) {
      throw new Error("consommation excessive d'indices.");
    }
    const sampleIndex = this.sampleIndices[this.position];
    if (
      !Number.isInteger(sampleIndex)
      || sampleIndex < 0
      || sampleIndex >= sampleCount
    ) {
      throw new Error("indice de test hors bornes.");
    }

    this.requests.push(sampleCount);
    this.position += 1;
    return sampleIndex;
  }

  assertExhausted(): void {
    if (this.position !== this.sampleIndices.length) {
      throw new Error("consommation insuffisante d'indices.");
    }
  }
}
