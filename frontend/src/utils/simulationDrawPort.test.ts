import { describe, expect, it } from "vitest";
import { createSeededSampleIndexDrawPort } from "../adapters/seededSampleIndexDrawPort";
import { createSimulationCommand } from "../domain/simulation";
import { createSimulationSeed } from "../domain/simulationValueObjects";
import { DeterministicSampleIndexDrawPort } from "../test/deterministicSampleIndexDrawPort";
import engineSource from "./simulation.ts?raw";
import {
  buildScenarioSamples,
  simulateBacklogToWeeks,
  simulateMonteCarloLocal,
  simulateWeeksToItems,
} from "./simulation";

function capturedCommand(mode: "backlog_to_weeks" | "weeks_to_items") {
  const seed = createSimulationSeed(246_813_579);
  return {
    seed,
    command: createSimulationCommand({
      throughputSamples: [0, 1, 3, 5, 8, 13],
      includeZeroWeeks: true,
      mode,
      backlogSize: mode === "backlog_to_weeks" ? 2800 : undefined,
      targetWeeks: mode === "weeks_to_items" ? 7 : undefined,
      nSims: 1000,
      seed,
    }),
  };
}

describe("sample index draw port in local engines", () => {
  it("drives backlog mode with an exact sequence, including censure", () => {
    const drawPort = new DeterministicSampleIndexDrawPort([
      1,
      1,
      ...Array.from({ length: 519 }, () => 0),
      ...Array.from({ length: 521 }, () => 0),
    ]);

    const result = simulateBacklogToWeeks([0, 2], 3, 2, drawPort);

    expect(result).toEqual({
      results: [2, 521],
      completedFlags: [true, false],
    });
    expect(drawPort.requests).toEqual(Array.from({ length: 523 }, () => 2));
    expect(drawPort.skippedDrawCounts).toEqual([519]);
    drawPort.assertExhausted();
  });

  it("drives weeks-to-items mode with an exact sequence", () => {
    const drawPort = new DeterministicSampleIndexDrawPort([0, 1, 2, 2, 1, 0]);

    expect(simulateWeeksToItems([2, 5, 9], 2, 3, drawPort)).toEqual([
      7,
      18,
      7,
    ]);
    expect(drawPort.requests).toEqual([3, 3, 3, 3, 3, 3]);
    drawPort.assertExhausted();
  });

  it("makes simulateMonteCarloLocal consume only its injected port", () => {
    const seed = createSimulationSeed(123);
    const command = createSimulationCommand({
      throughputSamples: [2, 2, 2, 2, 2, 2],
      includeZeroWeeks: true,
      mode: "backlog_to_weeks",
      backlogSize: 4,
      nSims: 1000,
      seed,
    });
    const drawPort = new DeterministicSampleIndexDrawPort(
      Array.from({ length: 1000 * 521 }, () => 0),
    );

    const result = simulateMonteCarloLocal(command, drawPort);

    expect(result.resultDistribution).toEqual([{ x: 2, count: 1000 }]);
    drawPort.assertExhausted();
  });

  it("makes buildScenarioSamples deterministic and verifies every bound", () => {
    const drawPort = new DeterministicSampleIndexDrawPort([1, 0, 0, 2, 1, 1]);

    expect(
      buildScenarioSamples(
        [
          [10, 20],
          [100, 200, 300],
        ],
        80,
        drawPort,
      ),
    ).toEqual({
      optimistic: [120, 310, 220],
      aligned: [96, 248, 176],
      friction: [96, 248, 176],
    });
    expect(drawPort.requests).toEqual([2, 3, 2, 3, 2, 3]);
    drawPort.assertExhausted();
  });

  it("detects excessive, insufficient and out-of-bound test consumption", () => {
    const invalidBound = new DeterministicSampleIndexDrawPort([0]);
    expect(() => invalidBound.drawSampleIndex(0)).toThrow("entier > 0");

    const excessive = new DeterministicSampleIndexDrawPort([]);
    expect(() => excessive.drawSampleIndex(1)).toThrow("excessive");

    const insufficient = new DeterministicSampleIndexDrawPort([0, 0]);
    insufficient.drawSampleIndex(1);
    expect(() => insufficient.assertExhausted()).toThrow("insuffisante");

    const outOfBounds = new DeterministicSampleIndexDrawPort([1]);
    expect(() => outOfBounds.drawSampleIndex(1)).toThrow("hors bornes");
  });

  it("keeps concrete generator construction outside engine logic", () => {
    expect(engineSource).not.toContain("createSeededRandom");
    expect(engineSource).not.toContain("createSeededSampleIndexDrawPort");
    expect(engineSource).not.toContain("Math.random");
    expect(engineSource).not.toContain("getRandomValues");
    expect(engineSource).not.toContain("0x6d2b79f5");
  });
});

describe("captured TypeScript non-regression references", () => {
  it("preserves the complete backlog result", () => {
    const { seed, command } = capturedCommand("backlog_to_weeks");

    expect(
      simulateMonteCarloLocal(
        command,
        createSeededSampleIndexDrawPort(seed),
      ),
    ).toEqual({
      resultKind: "weeks",
      samplesCount: 6,
      seed: 246_813_579,
      resultPercentiles: {},
      resultDistribution: [
        { x: 500, count: 1 },
        { x: 502, count: 2 },
        { x: 507, count: 2 },
        { x: 509, count: 1 },
        { x: 510, count: 2 },
        { x: 511, count: 2 },
        { x: 512, count: 1 },
        { x: 513, count: 2 },
        { x: 514, count: 3 },
        { x: 515, count: 1 },
        { x: 516, count: 2 },
        { x: 517, count: 2 },
        { x: 518, count: 7 },
        { x: 519, count: 1 },
        { x: 520, count: 1 },
        { x: 521, count: 3 },
      ],
      completionSummary: {
        completedCount: 33,
        censoredCount: 967,
        censoredRate: 0.967,
        horizonWeeks: 521,
      },
      throughputReliability: {
        cv: 0.8869,
        iqrRatio: 1.4375,
        slopeNorm: 0.5029,
        label: "fragile",
        samplesCount: 6,
      },
    });
  });

  it("preserves the complete weeks-to-items result", () => {
    const { seed, command } = capturedCommand("weeks_to_items");

    expect(
      simulateMonteCarloLocal(
        command,
        createSeededSampleIndexDrawPort(seed),
      ),
    ).toEqual({
      resultKind: "items",
      samplesCount: 6,
      seed: 246_813_579,
      resultPercentiles: { P50: 34, P70: 28, P90: 19 },
      riskScore: 0.4412,
      resultDistribution: [
        { x: 5, count: 2 },
        { x: 6, count: 1 },
        { x: 8, count: 2 },
        { x: 9, count: 1 },
        { x: 10, count: 3 },
        { x: 12, count: 5 },
        { x: 13, count: 7 },
        { x: 14, count: 8 },
        { x: 15, count: 14 },
        { x: 16, count: 15 },
        { x: 17, count: 15 },
        { x: 18, count: 15 },
        { x: 19, count: 15 },
        { x: 20, count: 20 },
        { x: 21, count: 19 },
        { x: 22, count: 23 },
        { x: 23, count: 27 },
        { x: 24, count: 22 },
        { x: 25, count: 26 },
        { x: 26, count: 29 },
        { x: 27, count: 28 },
        { x: 28, count: 28 },
        { x: 29, count: 30 },
        { x: 30, count: 23 },
        { x: 31, count: 34 },
        { x: 32, count: 43 },
        { x: 33, count: 40 },
        { x: 34, count: 32 },
        { x: 35, count: 19 },
        { x: 36, count: 35 },
        { x: 37, count: 31 },
        { x: 38, count: 32 },
        { x: 39, count: 20 },
        { x: 40, count: 20 },
        { x: 41, count: 30 },
        { x: 42, count: 19 },
        { x: 43, count: 33 },
        { x: 44, count: 21 },
        { x: 45, count: 23 },
        { x: 46, count: 26 },
        { x: 47, count: 18 },
        { x: 48, count: 31 },
        { x: 49, count: 10 },
        { x: 50, count: 14 },
        { x: 51, count: 9 },
        { x: 52, count: 9 },
        { x: 53, count: 10 },
        { x: 54, count: 3 },
        { x: 55, count: 12 },
        { x: 56, count: 12 },
        { x: 57, count: 5 },
        { x: 58, count: 10 },
        { x: 59, count: 1 },
        { x: 60, count: 6 },
        { x: 61, count: 4 },
        { x: 62, count: 1 },
        { x: 63, count: 4 },
        { x: 65, count: 2 },
        { x: 66, count: 1 },
        { x: 68, count: 1 },
        { x: 73, count: 1 },
      ],
      throughputReliability: {
        cv: 0.8869,
        iqrRatio: 1.4375,
        slopeNorm: 0.5029,
        label: "fragile",
        samplesCount: 6,
      },
    });
  });

  it("preserves the captured portfolio bootstrap samples", () => {
    const seed = createSimulationSeed(246_813_579);

    expect(
      buildScenarioSamples(
        [
          [0, 2, 5, 9],
          [1, 4, 8],
          [3, 6],
        ],
        75,
        createSeededSampleIndexDrawPort(seed),
      ),
    ).toEqual({
      optimistic: [4, 10, 12, 11],
      aligned: [3, 7, 9, 8],
      friction: [2, 5, 6, 6],
    });
  });
});
