import { describe, expect, it } from "vitest";
import {
  buildCorrelatedPortfolioSamples,
  buildCorrelatedPortfolioWeeklyThroughputs,
  buildScenarioSamples,
  computeFrictionExponent,
  computeFrictionFactor,
  computeFrictionRatePercent,
  computeRiskLegend,
  computeRiskScoreFromPercentiles,
  computeThroughputReliability,
  discretePercentiles,
  generateSimulationSeed,
  getProjectionReliabilityNotice,
  simulateMonteCarloLocal,
} from "./simulation";
import { DEMO_TEAM_SAMPLES } from "../demoData";

describe("computeRiskScoreFromPercentiles", () => {
  it("returns null when P50 is missing or non-positive", () => {
    expect(computeRiskScoreFromPercentiles("backlog_to_weeks", { P90: 14 })).toBeNull();
    expect(computeRiskScoreFromPercentiles("backlog_to_weeks", { P50: 0, P90: 14 })).toBeNull();
    expect(computeRiskScoreFromPercentiles("weeks_to_items", { P50: -2, P90: 1 })).toBeNull();
  });

  it("computes normalized spread in backlog_to_weeks mode", () => {
    expect(computeRiskScoreFromPercentiles("backlog_to_weeks", { P50: 10, P90: 14 })).toBe(0.4);
    expect(computeRiskScoreFromPercentiles("backlog_to_weeks", { P50: 10, P90: 8 })).toBe(0);
  });

  it("computes normalized spread in weeks_to_items mode", () => {
    expect(computeRiskScoreFromPercentiles("weeks_to_items", { P50: 24, P90: 18 })).toBe(0.25);
    expect(computeRiskScoreFromPercentiles("weeks_to_items", { P50: 10, P90: 6 })).toBe(0.4);
    expect(computeRiskScoreFromPercentiles("weeks_to_items", { P50: 10, P90: 12 })).toBe(0);
  });

  it("returns null when percentiles are incoherent or non-finite", () => {
    expect(computeRiskScoreFromPercentiles("backlog_to_weeks", { P50: 10, P90: 8 })).toBe(0);
    expect(computeRiskScoreFromPercentiles("weeks_to_items", { P50: 10, P90: 12 })).toBe(0);
    expect(computeRiskScoreFromPercentiles("weeks_to_items", { P50: 10, P90: Number.NaN })).toBeNull();
  });
});

describe("buildScenarioSamples", () => {
  it("clamps alignment rate before computing aligned and friction samples", () => {
    expect(buildScenarioSamples([[5], [7]], -25, 123)).toEqual({
      optimistic: [12],
      aligned: [0],
      friction: [0],
    });
    expect(buildScenarioSamples([[5], [7]], 140, 123)).toEqual({
      optimistic: [12],
      aligned: [12],
      friction: [12],
    });
  });

  it("builds optimistic, aligned and friction samples for 2 teams", () => {
    const scenarios = buildScenarioSamples(
      [
        [10, 20, 30],
        [100, 200],
      ],
      80,
      1431655765,
    );

    expect(scenarios.optimistic).toEqual([130, 120, 110]);
    expect(scenarios.aligned).toEqual([104, 96, 88]);
    expect(scenarios.friction).toEqual([104, 96, 88]);
    expect(scenarios.optimistic).toHaveLength(3);
    expect(scenarios.aligned).toHaveLength(3);
    expect(scenarios.friction).toHaveLength(3);
  });

  it("uses same values for all scenarios with 1 team", () => {
    const scenarios = buildScenarioSamples([[5, 8, 13]], 20, 123);

    expect(scenarios.optimistic).toEqual(scenarios.aligned);
    expect(scenarios.aligned).toEqual(scenarios.friction);
  });

  it("applies no friction penalty with one team, then starts at the second team", () => {
    expect(computeFrictionExponent(1)).toBe(0);
    expect(computeFrictionExponent(2)).toBe(1);
    expect(computeFrictionExponent(3)).toBe(2);
    expect(computeFrictionExponent(4)).toBe(3);

    expect(computeFrictionFactor(1, 80)).toBe(1);
    expect(computeFrictionFactor(2, 80)).toBe(0.8);
    expect(computeFrictionFactor(3, 80)).toBeCloseTo(0.64);
    expect(computeFrictionFactor(4, 80)).toBeCloseTo(0.512);

    expect(computeFrictionRatePercent(1, 80)).toBe(100);
    expect(computeFrictionRatePercent(2, 80)).toBe(80);
    expect(computeFrictionRatePercent(3, 80)).toBe(64);
    expect(computeFrictionRatePercent(4, 80)).toBe(51);
  });

  it("keeps the displayed friction percent aligned with the rounded sample factor", () => {
    const oneTeam = buildScenarioSamples([[101]], 80, 123);
    const twoTeams = buildScenarioSamples([[101], [100]], 80, 123);
    const threeTeams = buildScenarioSamples([[101], [100], [100]], 80, 123);
    const fourTeams = buildScenarioSamples([[101], [100], [100], [100]], 80, 123);

    expect(oneTeam.friction).toEqual([101]);
    expect(twoTeams.friction).toEqual([160]);
    expect(threeTeams.friction).toEqual([192]);
    expect(fourTeams.friction).toEqual([205]);

    expect(Math.round((oneTeam.friction[0] / oneTeam.optimistic[0]) * 100)).toBe(computeFrictionRatePercent(1, 80));
    expect(Math.round((twoTeams.friction[0] / twoTeams.optimistic[0]) * 100)).toBe(computeFrictionRatePercent(2, 80));
    expect(Math.round((threeTeams.friction[0] / threeTeams.optimistic[0]) * 100)).toBe(computeFrictionRatePercent(3, 80));
    expect(Math.round((fourTeams.friction[0] / fourTeams.optimistic[0]) * 100)).toBe(computeFrictionRatePercent(4, 80));

  });

  it("throws explicit error when teamSamples is empty", () => {
    expect(() => buildScenarioSamples([], 100, 123)).toThrow("teamSamples ne peut pas etre vide");
  });

  it("throws explicit error when a team has no samples", () => {
    expect(() => buildScenarioSamples([[1, 2], []], 100, 123)).toThrow(
      "chaque equipe doit contenir au moins un sample",
    );
  });
});

describe("generateSimulationSeed", () => {
  it("uses crypto.getRandomValues when available", () => {
    const originalCrypto = globalThis.crypto;
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: {
        getRandomValues(target: Uint32Array) {
          target[0] = 424242;
          return target;
        },
      },
    });

    expect(generateSimulationSeed()).toBe(424242);

    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: originalCrypto,
    });
  });

  it("falls back to Date.now when crypto.getRandomValues is unavailable", () => {
    const originalCrypto = globalThis.crypto;
    const originalDateNow = Date.now;
    Object.defineProperty(Date, "now", {
      configurable: true,
      value: () => 9876543210,
    });

    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: undefined,
    });

    expect(generateSimulationSeed()).toBe(1286608618);

    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: originalCrypto,
    });
    Object.defineProperty(Date, "now", {
      configurable: true,
      value: originalDateNow,
    });
  });
});

describe("buildCorrelatedPortfolioSamples", () => {
  it("sums aligned weekly throughput for two teams", () => {
    const weekly = buildCorrelatedPortfolioWeeklyThroughputs(
      [
        [
          { week: "2026-01-05", throughput: 10 },
          { week: "2026-01-12", throughput: 20 },
          { week: "2026-01-19", throughput: 30 },
        ],
        [
          { week: "2026-01-05", throughput: 5 },
          { week: "2026-01-12", throughput: 10 },
          { week: "2026-01-19", throughput: 15 },
        ],
      ],
      true,
    );

    expect(weekly).toEqual([
      { week: "2026-01-05", throughput: 15 },
      { week: "2026-01-12", throughput: 30 },
      { week: "2026-01-19", throughput: 45 },
    ]);
    expect(buildCorrelatedPortfolioSamples([weekly], true)).toEqual([15, 30, 45]);
  });

  it("keeps only the intersection of aligned weeks", () => {
    expect(
      buildCorrelatedPortfolioWeeklyThroughputs(
        [
          [
            { week: "2026-01-05", throughput: 10 },
            { week: "2026-01-12", throughput: 20 },
            { week: "2026-01-19", throughput: 30 },
          ],
          [
            { week: "2026-01-05", throughput: 5 },
            { week: "2026-01-19", throughput: 15 },
          ],
        ],
        true,
      ),
    ).toEqual([
      { week: "2026-01-05", throughput: 15 },
      { week: "2026-01-19", throughput: 45 },
    ]);
  });

  it("returns the same history for a single team", () => {
    const samples = buildCorrelatedPortfolioSamples(
      [[
        { week: "2026-01-05", throughput: 0 },
        { week: "2026-01-12", throughput: 3 },
        { week: "2026-01-19", throughput: 5 },
      ]],
      true,
    );

    expect(samples).toEqual([0, 3, 5]);
  });

  it("applies includeZeroWeeks after aggregating the portfolio total", () => {
    const teamWeekly = [
      [
        { week: "2026-01-05", throughput: 0 },
        { week: "2026-01-12", throughput: 2 },
      ],
      [
        { week: "2026-01-05", throughput: 0 },
        { week: "2026-01-12", throughput: 3 },
      ],
    ];

    expect(buildCorrelatedPortfolioSamples(teamWeekly, true)).toEqual([0, 5]);
    expect(buildCorrelatedPortfolioSamples(teamWeekly, false)).toEqual([5]);
  });

  it("is not mathematically forced to match optimistic independent draws", () => {
    const scenarios = buildScenarioSamples(
      [
        [1, 100],
        [50, 60],
      ],
      80,
      2004318071,
    );
    const correlated = buildCorrelatedPortfolioSamples(
      [
        [
          { week: "2026-01-05", throughput: 1 },
          { week: "2026-01-12", throughput: 100 },
        ],
        [
          { week: "2026-01-05", throughput: 50 },
          { week: "2026-01-12", throughput: 60 },
        ],
      ],
      true,
    );

    expect(scenarios.optimistic).toEqual([61, 150]);
    expect(correlated).toEqual([51, 160]);
    expect(correlated).not.toEqual(scenarios.optimistic);
  });

  it("throws an explicit error when no complete common week exists", () => {
    expect(() =>
      buildCorrelatedPortfolioSamples(
        [
          [{ week: "2026-01-05", throughput: 10 }],
          [{ week: "2026-01-12", throughput: 12 }],
        ],
        true,
      ),
    ).toThrow("aucune semaine commune complete");
  });

  it("throws when the correlated portfolio input is empty", () => {
    expect(() => buildCorrelatedPortfolioWeeklyThroughputs([], true)).toThrow("teamWeeklyThroughputs ne peut pas etre vide");
  });

  it("throws when one team has no usable weekly history", () => {
    expect(() =>
      buildCorrelatedPortfolioWeeklyThroughputs(
        [
          [{ week: "2026-01-05", throughput: 10 }],
          [],
        ],
        true,
      ),
    ).toThrow("n'a aucune semaine exploitable");
  });

  it("throws when a weekly row has an invalid week or throughput", () => {
    expect(() =>
      buildCorrelatedPortfolioWeeklyThroughputs(
        [
          [{ week: "", throughput: 10 }],
        ],
        true,
      ),
    ).toThrow("semaine invalide");

    expect(() =>
      buildCorrelatedPortfolioWeeklyThroughputs(
        [
          [{ week: "2026-01-05", throughput: Number.NaN }],
        ],
        true,
      ),
    ).toThrow("throughput invalide");
  });

  it("throws when one team contains the same week twice", () => {
    expect(() =>
      buildCorrelatedPortfolioWeeklyThroughputs(
        [
          [
            { week: "2026-01-05", throughput: 10 },
            { week: "2026-01-05", throughput: 12 },
          ],
        ],
        true,
      ),
    ).toThrow("semaine dupliquee");
  });

  it("throws when zero-week filtering removes every common weekly total", () => {
    const teamWeekly = [
      [
        { week: "2026-01-05", throughput: 0 },
        { week: "2026-01-12", throughput: 0 },
      ],
      [
        { week: "2026-01-05", throughput: 0 },
        { week: "2026-01-12", throughput: 0 },
      ],
    ];

    expect(buildCorrelatedPortfolioWeeklyThroughputs(teamWeekly, true)).toEqual([
      { week: "2026-01-05", throughput: 0 },
      { week: "2026-01-12", throughput: 0 },
    ]);
    expect(() => buildCorrelatedPortfolioWeeklyThroughputs(teamWeekly, false)).toThrow("total portefeuille > 0");
  });

  it("keeps ISO week timestamps aligned after normalization", () => {
    const teams = [
      [
        { week: "2026-01-05", throughput: 10 },
      ],
      [
        { week: "2026-01-05T00:00:00.000Z", throughput: 12 },
      ],
    ];

    expect(buildCorrelatedPortfolioWeeklyThroughputs(teams, true)).toEqual([{ week: "2026-01-05", throughput: 22 }]);
  });

  it("throws when includeZeroWeeks keeps only negative common totals", () => {
    expect(() =>
      buildCorrelatedPortfolioWeeklyThroughputs(
        [
          [{ week: "2026-01-05", throughput: -2 }],
          [{ week: "2026-01-05", throughput: -3 }],
        ],
        true,
      ),
    ).toThrow("total portefeuille >= 0");
  });
});

describe("computeRiskLegend", () => {
  it("covers fiable and incertain ranges", () => {
    expect(computeRiskLegend(0.1)).toBe("fiable");
    expect(computeRiskLegend(0.4)).toBe("incertain");
  });

  it("covers fragile and non fiable ranges", () => {
    expect(computeRiskLegend(0.7)).toBe("fragile");
    expect(computeRiskLegend(0.95)).toBe("non fiable");
  });
});

describe("computeThroughputReliability", () => {
  it("marks steep downward trends as non fiable", () => {
    const reliability = computeThroughputReliability([20, 18, 16, 14, 12, 10, 8, 6]);

    expect(reliability?.label).toBe("non fiable");
    expect(reliability?.slope_norm).toBeLessThanOrEqual(-0.15);
  });

  it("returns null for empty or non-finite samples", () => {
    expect(computeThroughputReliability([])).toBeNull();
    expect(computeThroughputReliability([Number.NaN, Number.POSITIVE_INFINITY])).toBeNull();
  });

  it("marks very short histories as non fiable", () => {
    const reliability = computeThroughputReliability([4, 4, 4, 4, 4]);

    expect(reliability).toMatchObject({
      label: "non fiable",
      samples_count: 5,
      cv: 0,
      iqr_ratio: 0,
      slope_norm: 0,
    });
  });

  it("marks highly volatile histories as fragile", () => {
    const reliability = computeThroughputReliability([0, 20, 0, 20, 0, 20, 0, 20]);

    expect(reliability?.label).toBe("fragile");
    expect(reliability?.cv).toBeGreaterThanOrEqual(1);
  });

  it("marks moderate variability as incertain", () => {
    const reliability = computeThroughputReliability([10, 11, 12, 13, 14, 15, 16, 17]);

    expect(reliability).toMatchObject({
      label: "incertain",
      samples_count: 8,
    });
    expect(Math.abs(reliability?.slope_norm ?? 0)).toBeGreaterThanOrEqual(0.05);
    expect(Math.abs(reliability?.slope_norm ?? 0)).toBeLessThan(0.1);
  });

  it("downgrades otherwise stable short histories to incertain", () => {
    const reliability = computeThroughputReliability([10, 10, 10, 10, 10, 10, 10]);

    expect(reliability).toMatchObject({
      label: "incertain",
      samples_count: 7,
      cv: 0,
      iqr_ratio: 0,
      slope_norm: 0,
    });
  });

  it("handles a single finite sample without slope computation", () => {
    const reliability = computeThroughputReliability([7]);

    expect(reliability).toMatchObject({
      label: "non fiable",
      samples_count: 1,
      cv: 0,
      iqr_ratio: 0,
      slope_norm: 0,
    });
  });

  it("handles zero-only histories with zero mean and quartiles", () => {
    const reliability = computeThroughputReliability([0, 0, 0, 0, 0, 0]);

    expect(reliability).toMatchObject({
      label: "non fiable",
      samples_count: 6,
      cv: 0,
      iqr_ratio: 0,
      slope_norm: 0,
    });
  });

  it("matches the expected reliability labels for demo teams", () => {
    expect(computeThroughputReliability(DEMO_TEAM_SAMPLES.Alpha)?.label).toBe("fiable");
    expect(computeThroughputReliability(DEMO_TEAM_SAMPLES.Beta)?.label).toBe("fragile");
    expect(computeThroughputReliability(DEMO_TEAM_SAMPLES.Gamma)?.label).toBe("incertain");
  });

  it("returns the expected rounded ratio values for the reference series", () => {
    expect(computeThroughputReliability([10, 20, 30, 40, 50, 60, 70, 80])).toEqual({
      cv: 0.5092,
      iqr_ratio: 0.7778,
      slope_norm: 0.2222,
      label: "fragile",
      samples_count: 8,
    });
  });
});

describe("getProjectionReliabilityNotice", () => {
  it("returns null when reliability is absent", () => {
    expect(getProjectionReliabilityNotice()).toBeNull();
    expect(getProjectionReliabilityNotice(null)).toBeNull();
  });

  it("returns the volatility notice when cv or iqr_ratio is high", () => {
    expect(
      getProjectionReliabilityNotice({
        cv: 1,
        iqr_ratio: 0.2,
        slope_norm: 0,
        label: "fragile",
        samples_count: 8,
      }),
    ).toContain("Historique trop volatil");

    expect(
      getProjectionReliabilityNotice({
        cv: 0.2,
        iqr_ratio: 1,
        slope_norm: 0,
        label: "fragile",
        samples_count: 8,
      }),
    ).toContain("Historique trop volatil");
  });

  it("returns the non fiable notice when the label is non fiable without high volatility", () => {
    expect(
      getProjectionReliabilityNotice({
        cv: 0.2,
        iqr_ratio: 0.3,
        slope_norm: 0,
        label: "non fiable",
        samples_count: 5,
      }),
    ).toContain("Projection non fiable");
  });

  it("returns null for reliable or uncertain non-volatile histories", () => {
    expect(
      getProjectionReliabilityNotice({
        cv: 0.2,
        iqr_ratio: 0.3,
        slope_norm: 0,
        label: "fiable",
        samples_count: 12,
      }),
    ).toBeNull();
  });
});

describe("simulateMonteCarloLocal", () => {
  it("omits backlog percentiles whose rank is not reachable in the total simulation population", () => {
    expect(discretePercentiles([521, 521], "backlog_to_weeks", [50, 70, 90], 3)).toEqual({ P50: 521 });
  });

  it("falls back to conservative backlog quantiles when the total simulation count is unavailable", () => {
    expect(discretePercentiles([3, 4, 6, 8, 10], "backlog_to_weeks", [50, 70, 90])).toEqual({
      P50: 6,
      P70: 8,
      P90: 10,
    });
  });

  it("keeps compact histograms unchanged when there are few unique outcomes", () => {
    const result = simulateMonteCarloLocal({
      seed: 123,
      throughputSamples: [2],
      includeZeroWeeks: false,
      mode: "backlog_to_weeks",
      backlogSize: 4,
      nSims: 3,
    });

    expect(result.result_distribution).toEqual([{ x: 2, count: 3 }]);
  });

  it("returns a backend-compatible structure in backlog mode", () => {
    const result = simulateMonteCarloLocal({
      seed: 123,
      throughputSamples: DEMO_TEAM_SAMPLES.Alpha,
      includeZeroWeeks: true,
      mode: "backlog_to_weeks",
      backlogSize: 120,
      nSims: 5000,
    });

    expect(result.result_kind).toBe("weeks");
    expect(result.samples_count).toBe(16);
    expect(Object.keys(result.result_percentiles)).toEqual(["P50", "P70", "P90"]);
    expect(result.result_distribution.length).toBeGreaterThan(0);
    expect(typeof result.risk_score).toBe("number");
    expect(result.throughput_reliability?.label).toBe("fiable");
  });

  it("returns a backend-compatible structure in target-weeks mode", () => {
    const result = simulateMonteCarloLocal({
      seed: 456,
      throughputSamples: DEMO_TEAM_SAMPLES.Gamma,
      includeZeroWeeks: true,
      mode: "weeks_to_items",
      targetWeeks: 12,
      nSims: 5000,
    });

    expect(result.result_kind).toBe("items");
    expect(result.result_percentiles.P50 ?? 0).toBeGreaterThan(0);
    expect(result.result_percentiles.P50 ?? 0).toBeGreaterThanOrEqual(result.result_percentiles.P70 ?? 0);
    expect(result.result_percentiles.P70 ?? 0).toBeGreaterThanOrEqual(result.result_percentiles.P90 ?? 0);
    expect(result.result_distribution.length).toBeGreaterThan(0);
    expect(result.throughput_reliability?.label).toBe("incertain");
  });

  it("keeps risk_score consistent with the returned business percentiles in both modes", () => {
    const backlogResult = simulateMonteCarloLocal({
      seed: 123,
      throughputSamples: DEMO_TEAM_SAMPLES.Alpha,
      includeZeroWeeks: true,
      mode: "backlog_to_weeks",
      backlogSize: 120,
      nSims: 2000,
    });
    const itemsResult = simulateMonteCarloLocal({
      seed: 456,
      throughputSamples: DEMO_TEAM_SAMPLES.Gamma,
      includeZeroWeeks: true,
      mode: "weeks_to_items",
      targetWeeks: 12,
      nSims: 2000,
    });

    expect(backlogResult.risk_score).toBe(
      Number(computeRiskScoreFromPercentiles("backlog_to_weeks", backlogResult.result_percentiles)?.toFixed(4)),
    );
    expect(itemsResult.risk_score).toBe(
      Number(computeRiskScoreFromPercentiles("weeks_to_items", itemsResult.result_percentiles)?.toFixed(4)),
    );
  });

  it("rejects empty normalized samples for both zero-week modes", () => {
    expect(() =>
      simulateMonteCarloLocal({
        seed: 123,
        throughputSamples: [Number.NaN, Number.POSITIVE_INFINITY],
        includeZeroWeeks: true,
        mode: "backlog_to_weeks",
        backlogSize: 10,
        nSims: 10,
      }),
    ).toThrow(">= 0");

    expect(() =>
      simulateMonteCarloLocal({
        seed: 123,
        throughputSamples: [0, -1],
        includeZeroWeeks: false,
        mode: "backlog_to_weeks",
        backlogSize: 10,
        nSims: 10,
      }),
    ).toThrow("> 0");
  });

  it("aggregates histogram buckets when too many unique outcomes are produced", () => {
    const result = simulateMonteCarloLocal({
      seed: 123,
      throughputSamples: Array.from({ length: 250 }, (_value, index) => index),
      includeZeroWeeks: true,
      mode: "weeks_to_items",
      targetWeeks: 1,
      nSims: 1000,
    });

    expect(result.result_distribution.length).toBeLessThanOrEqual(100);
    expect(result.result_distribution.every((bucket) => Number.isInteger(bucket.x) && bucket.count > 0)).toBe(true);
    expect(result.result_distribution.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(1000);
  });

  it("reports a fully censored backlog when zero throughput never burns backlog", () => {
    const result = simulateMonteCarloLocal({
      seed: 123,
      throughputSamples: [0, 0, 0],
      includeZeroWeeks: true,
      mode: "backlog_to_weeks",
      backlogSize: 5,
      nSims: 3,
    });

    expect(result.result_kind).toBe("weeks");
    expect(result.result_percentiles).toEqual({});
    expect(result.result_distribution).toEqual([]);
    expect(result.completion_summary).toEqual({
      completed_count: 0,
      censored_count: 3,
      censored_rate: 1,
      horizon_weeks: 521,
    });
    expect(result.risk_score).toBeUndefined();
    expect(result.throughput_reliability?.label).toBe("non fiable");
  });

  it("normalizes negative and fractional inputs for simulation guards", () => {
    const result = simulateMonteCarloLocal({
      seed: 123,
      throughputSamples: [1.9, 2.2, 3.8],
      includeZeroWeeks: false,
      mode: "weeks_to_items",
      targetWeeks: -3.4,
      nSims: 0.4,
    });

    expect(result.result_kind).toBe("items");
    expect(result.samples_count).toBe(3);
    expect(result.result_distribution.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(1);
    expect(result.result_percentiles.P50).toBeGreaterThanOrEqual(1);
  });
});
