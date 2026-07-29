import { describe, expect, it } from "vitest";
import {
  createSimulationCommand,
  createSimulationCommandFromNormalizedInput,
} from "./simulation";
import simulationSource from "./simulation.ts?raw";
import valueObjectSource from "./simulationValueObjects.ts?raw";
import {
  createBacklogSize,
  createCompletionSummary,
  createHistogram,
  createSimulationCount,
  createSimulationHorizon,
  createSimulationPercentiles,
  createSimulationSeed,
  createThroughputReliability,
  createThroughputSamples,
  riskScoreFromPercentiles,
  roundHalfUp,
  SIMULATION_BACKLOG_SIZE_MAX,
  SIMULATION_HORIZON_WEEKS_MAX,
  SIMULATION_N_SIMS_MAX,
  SIMULATION_N_SIMS_MIN,
  SIMULATION_SEED_MAX,
  SIMULATION_THROUGHPUT_SAMPLES_MAX,
} from "./simulationValueObjects";
import type {
  ThroughputSamples,
} from "./simulationValueObjects";

describe("bounded statistical value objects", () => {
  it.each([
    [createSimulationSeed, 0, SIMULATION_SEED_MAX],
    [createSimulationCount, SIMULATION_N_SIMS_MIN, SIMULATION_N_SIMS_MAX],
    [createBacklogSize, 1, SIMULATION_BACKLOG_SIZE_MAX],
    [createSimulationHorizon, 1, SIMULATION_HORIZON_WEEKS_MAX],
  ])("accepts the inclusive bounds", (factory, minimum, maximum) => {
    expect(factory(minimum)).toBe(minimum);
    expect(factory(maximum)).toBe(maximum);
  });

  it.each([
    [createSimulationSeed, 0, SIMULATION_SEED_MAX],
    [createSimulationCount, SIMULATION_N_SIMS_MIN, SIMULATION_N_SIMS_MAX],
    [createBacklogSize, 1, SIMULATION_BACKLOG_SIZE_MAX],
    [createSimulationHorizon, 1, SIMULATION_HORIZON_WEEKS_MAX],
  ])("rejects out-of-bounds and non-integer values", (factory, minimum, maximum) => {
    [
      minimum - 1,
      maximum + 1,
      true,
      "12",
      12.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
    ].forEach((invalid) => {
      expect(() => factory(invalid)).toThrow();
    });
  });

  it("requires runtime factories for opaque value-object types", () => {
    // @ts-expect-error A structural object cannot construct ThroughputSamples directly.
    const invalidSamples: ThroughputSamples = {
      rawValues: [1, 2, 3, 4, 5, 6],
      usableValues: [1, 2, 3, 4, 5, 6],
      includeZeroWeeks: false,
    };

    expect(invalidSamples.rawValues).toHaveLength(6);
  });

  it("rejects unsafe JavaScript integers at unbounded integer boundaries", () => {
    const unsafeInteger = Number.MAX_SAFE_INTEGER + 1;
    expect(() =>
      createSimulationPercentiles("backlog_to_weeks", { P50: unsafeInteger })
    ).toThrow("entier strict");
    expect(() => createHistogram([{ x: unsafeInteger, count: 1 }], 1)).toThrow("entier strict");
    expect(() => createHistogram([{ x: 1, count: unsafeInteger }], unsafeInteger)).toThrow(
      "entier strict",
    );
  });
});

describe("throughput samples", () => {
  it("validates raw values before zero processing and freezes both collections", () => {
    const included = createThroughputSamples([0, 1, 2, 3, 4, 5], true);
    const excluded = createThroughputSamples([0, 1, 2, 3, 4, 5, 6], false);

    expect(included.usableValues).toEqual([0, 1, 2, 3, 4, 5]);
    expect(excluded.usableValues).toEqual([1, 2, 3, 4, 5, 6]);
    expect(Object.isFrozen(included)).toBe(true);
    expect(Object.isFrozen(included.rawValues)).toBe(true);
    expect(Object.isFrozen(included.usableValues)).toBe(true);
  });

  it.each([
    true,
    "4",
    4.5,
    -1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ])("rejects invalid values without filtering them", (invalid) => {
    expect(() => createThroughputSamples([0, 1, 2, 3, 4, invalid], false)).toThrow();
  });

  it("enforces raw and usable limits", () => {
    expect(createThroughputSamples(Array.from({ length: 6 }, () => 1), false).usableValues).toHaveLength(6);
    expect(
      createThroughputSamples(
        Array.from({ length: SIMULATION_THROUGHPUT_SAMPLES_MAX }, () => 1),
        false,
      ).rawValues,
    ).toHaveLength(SIMULATION_THROUGHPUT_SAMPLES_MAX);
    expect(() => createThroughputSamples([1, 2, 3, 4, 5], false)).toThrow("entre 6 et 521");
    expect(() =>
      createThroughputSamples(
        Array.from({ length: SIMULATION_THROUGHPUT_SAMPLES_MAX + 1 }, () => 1),
        false,
      ),
    ).toThrow("entre 6 et 521");
    expect(() => createThroughputSamples([0, 1, 2, 3, 4, 5], false)).toThrow("non nulles");
    expect(createThroughputSamples([0, 0, 0, 0, 0, 0], true).usableValues).toHaveLength(6);
  });

  it("requires a strict boolean zero-week flag", () => {
    expect(() => createThroughputSamples([1, 2, 3, 4, 5, 6], 1)).toThrow("booleen strict");
    expect(() => createThroughputSamples(null, false)).toThrow("collection");
  });
});

describe("resolved simulation commands", () => {
  const common = {
    throughputSamples: [1, 2, 3, 4, 5, 6],
    includeZeroWeeks: false,
    nSims: 1000,
    seed: createSimulationSeed(0),
  };

  it("requires only the active mode parameter", () => {
    const backlog = createSimulationCommand({
      ...common,
      mode: "backlog_to_weeks",
      backlogSize: 10,
    });
    const horizon = createSimulationCommand({
      ...common,
      mode: "weeks_to_items",
      targetWeeks: 12,
    });

    expect(backlog).toMatchObject({ backlogSize: 10 });
    expect(backlog).not.toHaveProperty("targetWeeks");
    expect(horizon).toMatchObject({ targetWeeks: 12 });
    expect(horizon).not.toHaveProperty("backlogSize");
    expect(Object.isFrozen(backlog)).toBe(true);

    expect(() => createSimulationCommand({
      ...common,
      mode: "backlog_to_weeks",
      backlogSize: 10,
      targetWeeks: "inactive",
    })).toThrow("absent");
    expect(() => createSimulationCommand({
      ...common,
      mode: "weeks_to_items",
      backlogSize: "inactive",
      targetWeeks: 12,
    })).toThrow("absent");
  });

  it("rejects invalid modes and missing active parameters", () => {
    expect(() =>
      createSimulationCommand({
        ...common,
        mode: "invalid" as never,
        backlogSize: 10,
      }),
    ).toThrow("mode");
    expect(() =>
      createSimulationCommand({
        ...common,
        mode: "backlog_to_weeks",
      }),
    ).toThrow("backlog_size");
    expect(() =>
      createSimulationCommand({
        ...common,
        mode: "weeks_to_items",
      }),
    ).toThrow("target_weeks");
    expect(() =>
      createSimulationCommand({
        ...common,
        mode: "backlog_to_weeks",
        backlogSize: 10,
        unknown: true,
      } as never),
    ).toThrow("champs inconnus");
  });

  it("consumes the closed fully resolved corpus 1.0 input shape", () => {
    expect(createSimulationCommandFromNormalizedInput({
      throughput_samples: [0, 1, 2, 3, 4, 5],
      include_zero_weeks: true,
      mode: "backlog_to_weeks",
      backlog_size: 10,
      n_sims: 1000,
    }, createSimulationSeed(0))).toMatchObject({
      mode: "backlog_to_weeks",
      backlogSize: 10,
      seed: 0,
    });
    expect(createSimulationCommandFromNormalizedInput({
      throughput_samples: [0, 1, 2, 3, 4, 5, 6],
      include_zero_weeks: false,
      mode: "weeks_to_items",
      target_weeks: 521,
      n_sims: 200000,
    }, createSimulationSeed(SIMULATION_SEED_MAX))).toMatchObject({
      mode: "weeks_to_items",
      targetWeeks: 521,
      seed: SIMULATION_SEED_MAX,
    });
  });

  it.each([
    [null, createSimulationSeed(0)],
    [{
      throughput_samples: [1, 2, 3, 4, 5, 6],
      include_zero_weeks: false,
      mode: "backlog_to_weeks",
      backlog_size: 10,
      n_sims: 1000,
      unknown: true,
    }, createSimulationSeed(0)],
    [{
      throughput_samples: [1, 2, 3, 4, 5, 6],
      mode: "backlog_to_weeks",
      backlog_size: 10,
      n_sims: 1000,
    }, createSimulationSeed(0)],
    [{
      throughput_samples: [1, 2, 3, 4, 5, 6],
      include_zero_weeks: false,
      mode: "backlog_to_weeks",
      target_weeks: 12,
      n_sims: 1000,
    }, createSimulationSeed(0)],
    [{
      throughput_samples: [1, 2, 3, 4, 5, 6],
      include_zero_weeks: false,
      mode: "backlog_to_weeks",
      backlog_size: 10,
      target_weeks: 12,
      n_sims: 1000,
    }, createSimulationSeed(0)],
    [{
      throughput_samples: [1, 2, 3, 4, 5, 6],
      include_zero_weeks: false,
      mode: "invalid",
      n_sims: 1000,
    }, createSimulationSeed(0)],
  ])("rejects open, unresolved or invalid normalized inputs", (input, seed) => {
    expect(() => createSimulationCommandFromNormalizedInput(input, seed)).toThrow();
  });
});

describe("percentiles", () => {
  it("keeps the public key set closed, preserves absences and enforces mode order", () => {
    const backlog = createSimulationPercentiles("backlog_to_weeks", { P50: 5, P90: 9 });
    const items = createSimulationPercentiles(
      "weeks_to_items",
      { P50: 9, P70: 7, P90: 5 },
    );

    expect(backlog).toEqual({ P50: 5, P90: 9 });
    expect(backlog).not.toHaveProperty("P70");
    expect(items).toEqual({ P50: 9, P70: 7, P90: 5 });
    expect(Object.isFrozen(items)).toBe(true);
  });

  it.each([
    ["invalid", { P50: 4 }, "mode"],
    ["backlog_to_weeks", { P80: 4 }, "uniquement"],
    ["backlog_to_weeks", { P50: true }, "entier strict"],
    ["backlog_to_weeks", { P50: -1 }, ">= 0"],
    ["backlog_to_weeks", { P50: 9, P90: 5 }, "croissant"],
    ["weeks_to_items", { P50: 5, P90: 9 }, "decroissant"],
  ] as const)("rejects invalid keys, values and order", (mode, values, message) => {
    expect(() => createSimulationPercentiles(mode as never, values)).toThrow(message);
  });

  it("derives a half-up risk score only when P50 and P90 are usable", () => {
    expect(
      riskScoreFromPercentiles(
        "backlog_to_weeks",
        createSimulationPercentiles("backlog_to_weeks", { P50: 6, P90: 10 }),
      ),
    ).toBe(0.6667);
    expect(riskScoreFromPercentiles("backlog_to_weeks", undefined)).toBeUndefined();
    expect(
      riskScoreFromPercentiles(
        "backlog_to_weeks",
        createSimulationPercentiles("backlog_to_weeks", { P90: 10 }),
      ),
    ).toBeUndefined();
    expect(
      riskScoreFromPercentiles(
        "backlog_to_weeks",
        createSimulationPercentiles("backlog_to_weeks", { P50: 0, P90: 10 }),
      ),
    ).toBeUndefined();
    expect(roundHalfUp(0.00005)).toBe(0.0001);
    expect(roundHalfUp(-0.00005)).toBe(-0.0001);
  });
  it("rounds exact decimal midpoints without binary floating-point drift", () => {
    expect(roundHalfUp(1.005, 2)).toBe(1.01);
    expect(roundHalfUp(-1.005, 2)).toBe(-1.01);
    expect(roundHalfUp(1.004999999999, 2)).toBe(1);
    expect(roundHalfUp(1.005000000001, 2)).toBe(1.01);
    expect(roundHalfUp(1.499949999, 4)).toBe(1.4999);
    expect(roundHalfUp(1.49995, 4)).toBe(1.5);
    expect(roundHalfUp(1.499950001, 4)).toBe(1.5);
    expect(() => roundHalfUp(1, -1)).toThrow("decimalPlaces");
  });
});
describe("throughput reliability", () => {
  it.each([
    [{ cv: 1.49994, iqrRatio: 0, slopeNorm: 0, samplesCount: 8, mean: 1 }, "fragile"],
    [{ cv: 1.49995, iqrRatio: 0, slopeNorm: 0, samplesCount: 8, mean: 1 }, "non fiable"],
    [{ cv: 0.99995, iqrRatio: 0, slopeNorm: 0, samplesCount: 8, mean: 1 }, "fragile"],
    [{ cv: 0.49995, iqrRatio: 0, slopeNorm: 0, samplesCount: 8, mean: 1 }, "incertain"],
    [{ cv: 0, iqrRatio: 0.49995, slopeNorm: 0, samplesCount: 8, mean: 1 }, "incertain"],
    [{ cv: 0, iqrRatio: 0, slopeNorm: -0.14995, samplesCount: 8, mean: 1 }, "non fiable"],
    [{ cv: 0, iqrRatio: 0, slopeNorm: 0.04995, samplesCount: 8, mean: 1 }, "incertain"],
    [{ cv: 0, iqrRatio: 0, slopeNorm: 0, samplesCount: 7, mean: 1 }, "incertain"],
    [{ cv: 0, iqrRatio: 0, slopeNorm: 0, samplesCount: 8, mean: 1 }, "fiable"],
    [{ cv: 0, iqrRatio: 0, slopeNorm: 0, samplesCount: 8, mean: 0 }, "non fiable"],
    [{ cv: 0, iqrRatio: 0, slopeNorm: 0, samplesCount: 5, mean: 1 }, "non fiable"],
  ] as const)("normalizes before applying category priority", (metrics, expected) => {
    const reliability = createThroughputReliability(metrics);
    expect(reliability.label).toBe(expected);
    expect(Object.isFrozen(reliability)).toBe(true);
  });
  it.each([
    { cv: Number.NaN },
    { iqrRatio: Number.POSITIVE_INFINITY },
    { slopeNorm: "0" },
    { cv: -0.1 },
    { iqrRatio: -0.1 },
    { samplesCount: true },
    { samplesCount: -1 },
    { mean: Number.NEGATIVE_INFINITY },
  ])("rejects invalid metrics", (override) => {
    expect(() =>
      createThroughputReliability({
        cv: 0.2,
        iqrRatio: 0.3,
        slopeNorm: 0,
        samplesCount: 8,
        mean: 10,
        ...override,
      }),
    ).toThrow();
  });

  it("accepts only the closed serialized label set", () => {
    expect(
      createThroughputReliability({
        cv: 0.2,
        iqrRatio: 0.3,
        slopeNorm: 0,
        samplesCount: 8,
        label: "fiable",
      }).label,
    ).toBe("fiable");
    expect(() =>
      createThroughputReliability({
        cv: 0.2,
        iqrRatio: 0.3,
        slopeNorm: 0,
        samplesCount: 8,
        label: "stable",
      }),
    ).toThrow("label");
  });
});

describe("histograms", () => {
  it("accepts exact and aggregated histograms while freezing every bucket", () => {
    const exact = createHistogram([{ x: 1, count: 2 }, { x: 3, count: 1 }], 3);
    const aggregated = createHistogram(
      Array.from({ length: 100 }, (_value, index) => ({ x: index * 2, count: 1 })),
      100,
    );

    expect(exact).toEqual([{ x: 1, count: 2 }, { x: 3, count: 1 }]);
    expect(aggregated).toHaveLength(100);
    expect(Object.isFrozen(exact)).toBe(true);
    expect(Object.isFrozen(exact[0])).toBe(true);
  });

  it.each([
    [[{ x: true, count: 1 }], 1, "entier strict"],
    [[{ x: 1, count: 1.5 }], 1, "entier strict"],
    [[{ x: 1, count: 0 }], 0, "strictement positif"],
    [[{ x: 2, count: 1 }, { x: 1, count: 1 }], 2, "croissant"],
    [[{ x: 1, count: 1 }, { x: 1, count: 1 }], 2, "croissant"],
    [[{ x: 1, count: 1 }], 2, "masse"],
    [[{ x: 1, count: 1 }], -1, ">= 0"],
    [[{ x: 1, count: 1 }], true, "entier strict"],
  ] as const)("rejects invalid buckets, order and mass", (buckets, mass, message) => {
    expect(() => createHistogram(buckets, mass)).toThrow(message);
  });

  it("rejects more than one hundred buckets", () => {
    expect(() =>
      createHistogram(
        Array.from({ length: 101 }, (_value, index) => ({ x: index, count: 1 })),
        101,
      ),
    ).toThrow("au plus 100");
  });
});

describe("completion summary", () => {
  it.each([
    [1000, 0, 0],
    [667, 333, 0.333],
    [0, 1000, 1],
  ])("supports complete, partial and fully censored counts", (completed, censored, rate) => {
    const summary = createCompletionSummary({
      completedCount: completed,
      censoredCount: censored,
      nSims: createSimulationCount(1000),
    });
    expect(summary).toEqual({
      completedCount: completed,
      censoredCount: censored,
      censoredRate: rate,
      horizonWeeks: 521,
    });
    expect(Object.isFrozen(summary)).toBe(true);
  });

  it("rounds half up and rejects inconsistent counts, rates and horizon", () => {
    expect(
      createCompletionSummary({
        completedCount: 19_999,
        censoredCount: 1,
        nSims: createSimulationCount(20_000),
      }).censoredRate,
    ).toBe(0.0001);

    expect(() =>
      createCompletionSummary({
        completedCount: 999,
        censoredCount: 0,
        nSims: createSimulationCount(1000),
      }),
    ).toThrow("egal a nSims");
    expect(() =>
      createCompletionSummary({
        completedCount: -1,
        censoredCount: 1001,
        nSims: createSimulationCount(1000),
      }),
    ).toThrow(">= 0");
    expect(() =>
      createCompletionSummary({
        completedCount: true,
        censoredCount: 999,
        nSims: createSimulationCount(1000),
      }),
    ).toThrow("entier strict");
    expect(() =>
      createCompletionSummary({
        completedCount: 1000,
        censoredCount: 0,
        nSims: createSimulationCount(1000),
        horizonWeeks: 520,
      }),
    ).toThrow("contrat 1.0");
    expect(() =>
      createCompletionSummary({
        completedCount: 667,
        censoredCount: 333,
        nSims: createSimulationCount(1000),
        censoredRate: 0.3,
      }),
    ).toThrow("derive");
  });
});

describe("domain independence", () => {
  it("does not depend on UI, HTTP, persistence or numeric frameworks", () => {
    ["react", "fastapi", "pydantic", "mongodb", "localstorage", "numpy", "api/"].forEach(
      (forbidden) => {
        expect(simulationSource.toLowerCase()).not.toContain(forbidden);
        expect(valueObjectSource.toLowerCase()).not.toContain(forbidden);
      },
    );
  });
});
