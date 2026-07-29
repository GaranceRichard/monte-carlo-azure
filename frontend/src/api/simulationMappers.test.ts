import { describe, expect, it } from "vitest";
import { createSimulationCommand } from "../domain/simulation";
import { createSimulationSeed } from "../domain/simulationValueObjects";
import {
  simulateResponseDtoToResult,
  simulationCommandToDto,
  simulationHistoryItemDtoToModel,
} from "./simulationMappers";

const command = createSimulationCommand({
  throughputSamples: [0, 2, 4, 6, 8, 10],
  includeZeroWeeks: true,
  mode: "backlog_to_weeks",
  backlogSize: 80,
  targetWeeks: undefined,
  nSims: 20000,
  seed: createSimulationSeed(123456),
});
const reliabilityDto = {
  cv: 0.2,
  iqr_ratio: 0.3,
  slope_norm: -0.02,
  label: "fiable" as const,
  samples_count: 6,
};

describe("simulation HTTP mappers", () => {
  it("maps a business command to the unchanged public request DTO", () => {
    const dto = simulationCommandToDto(command);

    expect(JSON.parse(JSON.stringify(dto))).toEqual({
      throughput_samples: [0, 2, 4, 6, 8, 10],
      include_zero_weeks: true,
      mode: "backlog_to_weeks",
      backlog_size: 80,
      n_sims: 20000,
      seed: 123456,
    });
  });

  it("maps a complete response DTO to the camelCase business result", () => {
    expect(simulateResponseDtoToResult({
      result_kind: "weeks",
      samples_count: 6,
      seed: 123456,
      result_percentiles: { P50: 8, P70: 10, P90: 13 },
      risk_score: 0.625,
      result_distribution: [{ x: 8, count: 800 }],
      completion_summary: {
        completed_count: 800,
        censored_count: 200,
        censored_rate: 0.2,
        horizon_weeks: 521,
      },
      throughput_reliability: {
        cv: 0.2,
        iqr_ratio: 0.3,
        slope_norm: -0.02,
        label: "fiable",
        samples_count: 6,
      },
    }, 1000)).toEqual({
      resultKind: "weeks",
      samplesCount: 6,
      seed: 123456,
      resultPercentiles: { P50: 8, P70: 10, P90: 13 },
      riskScore: 0.625,
      resultDistribution: [{ x: 8, count: 800 }],
      completionSummary: {
        completedCount: 800,
        censoredCount: 200,
        censoredRate: 0.2,
        horizonWeeks: 521,
      },
      throughputReliability: {
        cv: 0.2,
        iqrRatio: 0.3,
        slopeNorm: -0.02,
        label: "fiable",
        samplesCount: 6,
      },
    });
  });

  it("keeps absent optional response and history values absent", () => {
    const result = simulateResponseDtoToResult({
      result_kind: "items",
      samples_count: 6,
      seed: 7,
      result_percentiles: { P50: 30 },
      result_distribution: [{ x: 30, count: 1000 }],
      throughput_reliability: reliabilityDto,
    }, 1000);
    const history = simulationHistoryItemDtoToModel({
      created_at: "2026-02-26T10:00:00Z",
      last_seen: "2026-02-26T10:00:00Z",
      mode: "weeks_to_items",
      n_sims: 20000,
      samples_count: 6,
      percentiles: { P50: 30 },
      distribution: [{ x: 30, count: 20000 }],
    });
    const completeHistory = simulationHistoryItemDtoToModel({
      created_at: "2026-02-27T10:00:00Z",
      last_seen: "2026-02-27T11:00:00Z",
      mode: "backlog_to_weeks",
      seed: null,
      backlog_size: 80,
      target_weeks: null,
      n_sims: 20000,
      samples_count: 6,
      percentiles: { P50: 8, P70: 10, P90: 13 },
      distribution: [{ x: 8, count: 18000 }],
      completion_summary: {
        completed_count: 18000,
        censored_count: 2000,
        censored_rate: 0.1,
        horizon_weeks: 521,
      },
      include_zero_weeks: true,
      throughput_reliability: {
        cv: 0.2,
        iqr_ratio: 0.3,
        slope_norm: -0.02,
        label: "fiable",
        samples_count: 6,
      },
    });

    expect(result).not.toHaveProperty("riskScore");
    expect(result).not.toHaveProperty("completionSummary");
    expect(result.throughputReliability).toEqual({
      cv: 0.2,
      iqrRatio: 0.3,
      slopeNorm: -0.02,
      label: "fiable",
      samplesCount: 6,
    });
    expect(history).not.toHaveProperty("seed");
    expect(history).not.toHaveProperty("backlogSize");
    expect(history).not.toHaveProperty("completionSummary");
    expect(completeHistory).toMatchObject({
      seed: null,
      backlogSize: 80,
      targetWeeks: null,
      includeZeroWeeks: true,
      completionSummary: { completedCount: 18000, censoredCount: 2000 },
      throughputReliability: { iqrRatio: 0.3, samplesCount: 6 },
    });
  });

  it("derives a response mass when needed and rejects completion in the wrong mode", () => {
    expect(simulateResponseDtoToResult({
      result_kind: "items",
      samples_count: 6,
      seed: 7,
      result_percentiles: { P50: 30 },
      result_distribution: [{ x: 30, count: 1000 }],
      throughput_reliability: reliabilityDto,
    }).resultDistribution).toEqual([{ x: 30, count: 1000 }]);

    expect(() => simulateResponseDtoToResult({
      result_kind: "weeks",
      samples_count: 6,
      seed: 7,
      result_percentiles: {},
      result_distribution: [{ x: 30, count: 1000 }],
    }, 1000)).toThrow("completion_summary est requis");
    expect(() => simulateResponseDtoToResult({
      result_kind: "items",
      samples_count: 6,
      seed: 7,
      result_percentiles: { P50: 30 },
      result_distribution: [{ x: 30, count: 1000 }],
      throughput_reliability: reliabilityDto,
      completion_summary: {
        completed_count: 1000,
        censored_count: 0,
        censored_rate: 0,
        horizon_weeks: 521,
      },
    }, 1000)).toThrow("completion_summary est interdit");

    expect(() => simulationHistoryItemDtoToModel({
      created_at: "2026-02-26T10:00:00Z",
      last_seen: "2026-02-26T10:00:00Z",
      mode: "weeks_to_items",
      n_sims: 1000,
      samples_count: 6,
      percentiles: { P50: 30 },
      distribution: [{ x: 30, count: 999 }],
    })).toThrow("masse totale");
  });

  it.each([
    [{}, "throughput_reliability"],
    [{ risk_score: null }, "risk_score"],
    [{ risk_score: Number.NaN }, "risk_score"],
    [{ completion_summary: null }, "completion_summary"],
    [{ result_percentiles: { P50: 30, P80: 10 } }, "result_percentiles"],
    [{ result_distribution: [{ x: 30, count: 1000, extra: true }] }, "bucket"],
    [{ throughput_reliability: { ...reliabilityDto, extra: true } }, "throughput_reliability"],
    [{ unknown: true }, "champs inconnus"],
  ])("rejects absent sentinels and open canonical response shapes", (override, message) => {
    const base = {
      result_kind: "items",
      samples_count: 6,
      seed: 7,
      result_percentiles: { P50: 30 },
      result_distribution: [{ x: 30, count: 1000 }],
      throughput_reliability: reliabilityDto,
    };
    const value = Object.keys(override).length === 0
      ? { ...base, throughput_reliability: undefined }
      : { ...base, ...override };

    expect(() => simulateResponseDtoToResult(value, 1000)).toThrow(message);
  });
});
