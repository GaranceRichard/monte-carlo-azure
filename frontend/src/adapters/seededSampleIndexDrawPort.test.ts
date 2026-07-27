import { describe, expect, it } from "vitest";
import contractJson from "../../../contracts/mca-prng-v1-vectors.json";
import { createSimulationSeed } from "../domain/simulationValueObjects";
import { createSeededSampleIndexDrawPort, MCA_PRNG_CONTRACT_ID } from "./seededSampleIndexDrawPort";










describe("createSeededSampleIndexDrawPort", () => {
  it("reproduces exactly the previous createSeededRandom suite", () => {
    verifyCapturedContract();
  });











  it("always returns integer indices inside the requested bound", () => {
    verifyBoundsAndContinuity();
  });










  it.each([0, -1, 1.5, Number.NaN])(
    "rejects invalid sampleCount %s without normalization",
    (sampleCount) => {
      const drawPort = createSeededSampleIndexDrawPort(createSimulationSeed(1));

      expect(() => drawPort.drawSampleIndex(sampleCount)).toThrow(
        "sampleCount doit etre un entier > 0",
      );
      for (const invalid of [
        Number.POSITIVE_INFINITY,
        Number.NEGATIVE_INFINITY,
        "6",
        null,
        undefined,
        true,
      ]) {
        expect(() =>
          drawPort.drawSampleIndex(invalid as unknown as number)
        ).toThrow("sampleCount doit etre un entier > 0");
      }
    },
  );
});

type CanonicalVector = {
  seed: number;
  uint32: number[];
  sampleIndices: Record<string, number[]>;
};

type PrngContract = {
  contractId: string;
  version: number;
  drawsPerSeed: number;
  sampleCounts: number[];
  vectors: CanonicalVector[];
};

const contract = contractJson as PrngContract;
const UINT32_SAMPLE_COUNT = 2 ** 32;
const productionSources = import.meta.glob("../**/*.{ts,tsx}", {
  eager: true,
  import: "default",
  query: "?raw",
}) as Record<string, string>;

function drawMany(
  drawPort: ReturnType<typeof createSeededSampleIndexDrawPort>,
  sampleCount: number,
  drawCount: number,
): number[] {
  return Array.from(
    { length: drawCount },
    () => drawPort.drawSampleIndex(sampleCount),
  );
}

function verifyCapturedContract(): void {
  expect(contract).toMatchObject({
    contractId: MCA_PRNG_CONTRACT_ID,
    version: 1,
    drawsPerSeed: 16,
    sampleCounts: [
      1,
      2,
      3,
      6,
      17,
      8_589_934_592,
      9_223_372_036_854_775_808,
    ],
  });
  expect(contract.vectors.map(({ seed }) => seed)).toEqual([
    0,
    1,
    4_294_967_295,
    246_813_579,
  ]);

  for (const { seed, uint32, sampleIndices } of contract.vectors) {
    expect(uint32).toHaveLength(contract.drawsPerSeed);
    expect(
      drawMany(
        createSeededSampleIndexDrawPort(createSimulationSeed(seed)),
        UINT32_SAMPLE_COUNT,
        contract.drawsPerSeed,
      ),
    ).toEqual(uint32);

    for (const sampleCount of contract.sampleCounts) {
      const expected = Object.entries(sampleIndices).find(
        ([serializedSampleCount]) =>
          Number(serializedSampleCount) === sampleCount,
      )?.[1];
      expect(expected).toHaveLength(contract.drawsPerSeed);
      const actual = drawMany(
        createSeededSampleIndexDrawPort(createSimulationSeed(seed)),
        sampleCount,
        contract.drawsPerSeed,
      );
      expect(actual).toEqual(expected);
      expect(
        actual.every(
          (sampleIndex) =>
            Number.isInteger(sampleIndex)
            && sampleIndex >= 0
            && sampleIndex < sampleCount,
        ),
      ).toBe(true);
    }
  }

  const incrementToken = ["0x6d2b", "79f5"].join("");
  const multiplicationToken = ["Math", "imul"].join(".");
  const implementationSources = Object.entries(productionSources).filter(
    ([path, source]) =>
      !/\.(?:test|spec)\.[jt]sx?$/.test(path)
      && !path.includes("/test/")
      && (
        source.includes(incrementToken)
        || source.includes(multiplicationToken)
      ),
  );
  expect(implementationSources).toHaveLength(1);
  expect(implementationSources[0]?.[0]).toContain(
    "seededSampleIndexDrawPort.ts",
  );
  expect(implementationSources[0]?.[1].split(incrementToken)).toHaveLength(2);
  expect(implementationSources[0]?.[1].split(multiplicationToken)).toHaveLength(3);
}

function verifyBoundsAndContinuity(): void {
  const drawPort = createSeededSampleIndexDrawPort(
    createSimulationSeed(4_294_967_295),
  );
  for (let draw = 0; draw < 1000; draw += 1) {
    const sampleIndex = drawPort.drawSampleIndex(6);
    expect(Number.isInteger(sampleIndex)).toBe(true);
    expect(sampleIndex).toBeGreaterThanOrEqual(0);
    expect(sampleIndex).toBeLessThan(6);
  }

  const seed = createSimulationSeed(246_813_579);
  const singleGroup = createSeededSampleIndexDrawPort(seed);
  const splitGroups = createSeededSampleIndexDrawPort(seed);
  const expected = drawMany(singleGroup, 17, contract.drawsPerSeed);
  const actual = [
    ...drawMany(splitGroups, 17, 3),
    ...drawMany(splitGroups, 17, 5),
    ...drawMany(splitGroups, 17, 8),
  ];
  expect(actual).toEqual(expected);
  expect(actual).toEqual(
    contract.vectors.find(({ seed: vectorSeed }) => vectorSeed === seed)
      ?.sampleIndices["17"],
  );
}
