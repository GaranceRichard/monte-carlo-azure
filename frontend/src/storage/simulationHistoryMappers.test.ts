import { describe, expect, it } from "vitest";
import type { SimulationHistoryEntry } from "../domain/simulationHistory";
import {
  parseSimulationHistory,
  simulationHistoryDtoToModel,
  simulationHistoryModelToDto,
} from "./simulationHistoryMappers";

function historyEntry(): SimulationHistoryEntry {
  return {
    schemaVersion: 2,
    id: "history-1",
    seed: 123,
    createdAt: "2026-03-01T10:00:00Z",
    selectedOrg: "org-demo",
    selectedProject: "Projet A",
    selectedTeam: "Equipe Alpha",
    startDate: "2026-01-01",
    endDate: "2026-02-01",
    simulationMode: "backlog_to_weeks",
    includeZeroWeeks: false,
    backlogSize: 70,
    targetWeeks: 0,
    nSims: 2000,
    types: ["Bug"],
    doneStates: ["Done"],
    sampleStats: { totalWeeks: 24, zeroWeeks: 0, usedWeeks: 24 },
    weeklyThroughput: [{ week: "2026-01-05", throughput: 5 }],
    cycleTimeDaysData: [{ week: "2026-01-05", cycleTimeDays: 4, count: 2 }],
    result: {
      resultKind: "weeks",
      samplesCount: 24,
      seed: 123,
      resultPercentiles: { P50: 7, P70: 9, P90: 12 },
      riskScore: 0.71,
      resultDistribution: [{ x: 7, count: 4 }],
      completionSummary: {
        completedCount: 4,
        censoredCount: 0,
        censoredRate: 0,
        horizonWeeks: 521,
      },
      throughputReliability: {
        cv: 0.2,
        iqrRatio: 0.3,
        slopeNorm: -0.02,
        label: "fiable",
        samplesCount: 24,
      },
    },
  };
}

describe("simulation history storage mappers", () => {
  it("writes the unchanged schema v2 JSON and reads it back to the business model", () => {
    const model = historyEntry();
    const dto = simulationHistoryModelToDto(model);

    expect(dto.schemaVersion).toBe(2);
    expect(dto.result).toEqual({
      result_kind: "weeks",
      samples_count: 24,
      seed: 123,
      result_percentiles: { P50: 7, P70: 9, P90: 12 },
      risk_score: 0.71,
      result_distribution: [{ x: 7, count: 4 }],
      completion_summary: {
        completed_count: 4,
        censored_count: 0,
        censored_rate: 0,
        horizon_weeks: 521,
      },
      throughput_reliability: {
        cv: 0.2,
        iqr_ratio: 0.3,
        slope_norm: -0.02,
        label: "fiable",
        samples_count: 24,
      },
    });
    expect(simulationHistoryDtoToModel(dto)).toEqual(model);
  });

  it("preserves the legacy versionless cycle-time migration", () => {
    const stored = simulationHistoryModelToDto(historyEntry());
    const parsed = parseSimulationHistory(JSON.stringify([{
      ...stored,
      schemaVersion: undefined,
      cycleTimeDaysData: undefined,
      cycleTimeData: [{ week: "2026-01-05", cycleTime: 2, count: 3 }],
    }]));

    expect(parsed[0]?.schemaVersion).toBe(2);
    expect(parsed[0]?.cycleTimeDaysData).toEqual([
      { week: "2026-01-05", cycleTimeDays: 14, count: 3 },
    ]);
  });
});
