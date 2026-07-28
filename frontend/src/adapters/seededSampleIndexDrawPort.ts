import type { SampleIndexDrawPort } from "../domain/sampleIndexDrawPort";
import type { SimulationSeed } from "../domain/simulationValueObjects";

export const MCA_PRNG_CONTRACT_ID = "mca-prng-v1";

const STATE_INCREMENT = 0x6d2b79f5;

export function createSeededSampleIndexDrawPort(
  seed: SimulationSeed,
): SampleIndexDrawPort {
  let state = seed >>> 0;

  return Object.freeze({
    drawSampleIndex(sampleCount: number): number {
      if (!Number.isInteger(sampleCount) || sampleCount <= 0) {
        throw new Error("sampleCount doit etre un entier > 0.");
      }
      state = (state + STATE_INCREMENT) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
      const randomValue = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      return Math.floor(randomValue * sampleCount);
    },
    skipSampleIndices(drawCount: number): void {
      if (!Number.isSafeInteger(drawCount) || drawCount <= 0) {
        throw new Error("drawCount doit etre un entier > 0.");
      }
      state = (state + Math.imul(STATE_INCREMENT, drawCount)) | 0;
    },
  });
}
