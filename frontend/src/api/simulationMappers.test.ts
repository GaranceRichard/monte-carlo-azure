import { describe, expect, it } from "vitest";
import type { SimulationCommand } from "../domain/simulation";
import {
  simulateResponseDtoToResult,
  simulationCommandToDto,
  simulationHistoryItemDtoToModel,
} from "./simulationMappers";

const command: SimulationCommand = {
  throughputSamples: [0, 2, 4, 6, 8, 10],
  includeZeroWeeks: true,
  mode: "backlog_to_weeks",
  backlogSize: 80,
  targetWeeks: undefined,
  nSims: 20000,
  seed: 123456,
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
      result_distribution: [{ x: 8, count: 4 }],
      completion_summary: {
        completed_count: 4,
        censored_count: 2,
        censored_rate: 0.3333,
        horizon_weeks: 521,
      },
      throughput_reliability: {
        cv: 0.2,
        iqr_ratio: 0.3,
        slope_norm: -0.02,
        label: "fiable",
        samples_count: 6,
      },
    })).toEqual({
      resultKind: "weeks",
      samplesCount: 6,
      seed: 123456,
      resultPercentiles: { P50: 8, P70: 10, P90: 13 },
      riskScore: 0.625,
      resultDistribution: [{ x: 8, count: 4 }],
      completionSummary: {
        completedCount: 4,
        censoredCount: 2,
        censoredRate: 0.3333,
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
      result_distribution: [],
    });
    const history = simulationHistoryItemDtoToModel({
      created_at: "2026-02-26T10:00:00Z",
      last_seen: "2026-02-26T10:00:00Z",
      mode: "weeks_to_items",
      n_sims: 20000,
      samples_count: 6,
      percentiles: { P50: 30 },
      distribution: [],
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
      distribution: [{ x: 8, count: 4 }],
      completion_summary: {
        completed_count: 4,
        censored_count: 2,
        censored_rate: 0.3333,
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
    expect(result).not.toHaveProperty("throughputReliability");
    expect(history).not.toHaveProperty("seed");
    expect(history).not.toHaveProperty("backlogSize");
    expect(history).not.toHaveProperty("completionSummary");
    expect(completeHistory).toMatchObject({
      seed: null,
      backlogSize: 80,
      targetWeeks: null,
      includeZeroWeeks: true,
      completionSummary: { completedCount: 4, censoredCount: 2 },
      throughputReliability: { iqrRatio: 0.3, samplesCount: 6 },
    });
  });
});
