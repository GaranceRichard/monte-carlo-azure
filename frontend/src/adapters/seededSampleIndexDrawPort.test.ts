import { describe, expect, it } from "vitest";
import { createSimulationSeed } from "../domain/simulationValueObjects";
import { createSeededSampleIndexDrawPort } from "./seededSampleIndexDrawPort";

function legacyCreateSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("createSeededSampleIndexDrawPort", () => {
  it("reproduces exactly the previous createSeededRandom suite", () => {
    const seed = createSimulationSeed(2_468_135_79);
    const sampleCounts = [1, 2, 7, 521, 6, 100, 3, 4, 17, 6];
    const legacyRandom = legacyCreateSeededRandom(seed);
    const expected = sampleCounts.map(
      (sampleCount) => Math.floor(legacyRandom() * sampleCount),
    );
    const drawPort = createSeededSampleIndexDrawPort(seed);

    expect(
      sampleCounts.map((sampleCount) => drawPort.drawSampleIndex(sampleCount)),
    ).toEqual(expected);
  });

  it("always returns integer indices inside the requested bound", () => {
    const drawPort = createSeededSampleIndexDrawPort(
      createSimulationSeed(4_294_967_295),
    );

    for (let draw = 0; draw < 1000; draw += 1) {
      const sampleIndex = drawPort.drawSampleIndex(6);
      expect(Number.isInteger(sampleIndex)).toBe(true);
      expect(sampleIndex).toBeGreaterThanOrEqual(0);
      expect(sampleIndex).toBeLessThan(6);
    }
  });

  it.each([0, -1, 1.5, Number.NaN])(
    "rejects invalid sampleCount %s without normalization",
    (sampleCount) => {
      const drawPort = createSeededSampleIndexDrawPort(createSimulationSeed(1));

      expect(() => drawPort.drawSampleIndex(sampleCount)).toThrow(
        "sampleCount doit etre un entier > 0",
      );
    },
  );
});
