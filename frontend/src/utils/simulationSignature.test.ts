import { describe, expect, it } from "vitest";
import type { SimulationHistoryEntry } from "../domain/simulationHistory";
import {
  buildHistoryEntrySignature,
  buildSimulationExecutionSnapshot,
  findLatestReusableSimulation,
  isReusableSimulationHistoryEntry,
} from "./simulationSignature";

function historyEntry(overrides: Partial<SimulationHistoryEntry> = {}): SimulationHistoryEntry {
  return {
    schemaVersion: 2,
    id: "history-1",
    seed: 42,
    createdAt: "2026-04-01T10:00:00.000Z",
    selectedOrg: "Org",
    selectedProject: "Projet",
    selectedTeam: "Equipe",
    startDate: "2026-01-01",
    endDate: "2026-03-31",
    simulationMode: "weeks_to_items",
    includeZeroWeeks: true,
    backlogSize: 100,
    targetWeeks: 3,
    nSims: 20_000,
    types: ["Story", "Bug"],
    doneStates: ["Done", "Closed"],
    sampleStats: { totalWeeks: 12, zeroWeeks: 1, usedWeeks: 12 },
    weeklyThroughput: [{ week: "2026-01-05", throughput: 8 }],
    cycleTimeDaysData: [],
    result: {
      resultKind: "items",
      samplesCount: 20_000,
      seed: 42,
      resultPercentiles: { P50: 20, P70: 18, P90: 15 },
      riskScore: 0.25,
      resultDistribution: [{ x: 15, count: 10 }],
    },
    ...overrides,
  };
}

describe("simulation signature", () => {
  it("normalizes ticket and state order and excludes seed and inactive objectives", () => {
    const entry = historyEntry();
    const reordered = {
      ...entry,
      seed: 99,
      backlogSize: 999,
      types: ["Bug", "Story"],
      doneStates: ["Closed", "Done"],
    };

    expect(buildHistoryEntrySignature(reordered)).toBe(buildHistoryEntrySignature(entry));
    expect(buildSimulationExecutionSnapshot(entry).parameters.objective).toEqual({
      kind: "targetWeeks",
      value: 3,
    });
  });

  it("finds the newest exact reusable entry", () => {
    const older = historyEntry({ id: "older", createdAt: "2026-04-01T10:00:00.000Z" });
    const newer = historyEntry({ id: "newer", createdAt: "2026-04-02T10:00:00.000Z" });
    const signature = buildHistoryEntrySignature(older);

    expect(findLatestReusableSimulation([older, newer], signature)?.id).toBe("newer");
  });

  it("ignores different and incomplete entries", () => {
    const complete = historyEntry();
    const different = historyEntry({ id: "different", targetWeeks: 4 });
    const incomplete = historyEntry({ id: "incomplete", cycleTimeDaysData: undefined });
    const signature = buildHistoryEntrySignature(complete);

    expect(isReusableSimulationHistoryEntry(incomplete)).toBe(false);
    expect(findLatestReusableSimulation([different, incomplete], signature)).toBeNull();
  });
});
