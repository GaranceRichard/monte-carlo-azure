import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { storageGetItem, storageRemoveItem, storageSetItem } from "../storage";
import type { SimulationHistoryEntry } from "./simulationTypes";
import { useSimulationHistory } from "./useSimulationHistory";

vi.mock("../storage", () => ({
  storageGetItem: vi.fn(),
  storageRemoveItem: vi.fn(),
  storageSetItem: vi.fn(),
}));

function buildLocalEntry(
  overrides: Partial<SimulationHistoryEntry> = {},
): SimulationHistoryEntry {
  return {
    schemaVersion: 2,
    id: "local-1",
    seed: 123456,
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
    weeklyThroughput: [],
    result: {
      result_kind: "weeks",
      samples_count: 24,
      seed: 123456,
      result_percentiles: { P50: 7, P70: 9, P90: 12 },
      risk_score: 0.71,
      result_distribution: [],
    },
    ...overrides,
  };
}

describe("useSimulationHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(storageGetItem).mockReturnValue(null);
  });

  it("starts from local storage only", async () => {
    const localEntry = buildLocalEntry();
    vi.mocked(storageGetItem).mockReturnValue(JSON.stringify([localEntry]));

    const { result } = renderHook(() => useSimulationHistory());

    await waitFor(() => {
      expect(result.current.simulationHistory).toEqual([
        expect.objectContaining({
          ...localEntry,
          cycleTimeDaysData: [],
          warning: undefined,
        }),
      ]);
    });

    expect(storageGetItem).toHaveBeenCalledWith("mc_simulation_history_v2");
  });

  it("migrates versionless legacy cycle time weeks to schema v2 calendar days", async () => {
    vi.mocked(storageGetItem).mockReturnValue(
      JSON.stringify([
        {
          ...buildLocalEntry(),
          schemaVersion: undefined,
          cycleTimeData: [{ week: "2026-01-05", cycleTime: 2, count: 3 }],
        },
      ]),
    );

    const { result } = renderHook(() => useSimulationHistory());

    await waitFor(() => {
      expect(result.current.simulationHistory[0]?.schemaVersion).toBe(2);
      expect(result.current.simulationHistory[0]?.cycleTimeDaysData).toEqual([
        { week: "2026-01-05", cycleTimeDays: 14, count: 3 },
      ]);
    });
  });

  it("normalizes schema v2 stored entries with mixed weekly throughput and cycle time rows", async () => {
    vi.mocked(storageGetItem).mockReturnValue(
      JSON.stringify([
        {
          id: "local-2",
          createdAt: "2026-03-02T10:00:00Z",
          selectedOrg: "org-demo",
          selectedProject: "Projet A",
          selectedTeam: "Equipe Beta",
          startDate: "2026-01-01",
          endDate: "2026-02-01",
          simulationMode: "weeks_to_items",
          includeZeroWeeks: true,
          backlogSize: 12,
          targetWeeks: 6,
          nSims: "1234.9",
          types: ["Bug", 42],
          doneStates: ["Done", null],
          sampleStats: null,
          weeklyThroughput: [null, { week: "2026-01-05", throughput: 3 }, "skip-me"],
          cycleTimeDaysData: [
            null,
            { week: "2026-01-05T00:00:00Z", cycleTimeDays: "4.5", count: "2" },
            { week: "2026-01-12", cycleTime: 3, count: -4 },
            { week: "", cycleTimeDays: 8, count: 1 },
          ],
          result: undefined,
          warning: 404,
          schemaVersion: 2,
        },
      ]),
    );

    const { result } = renderHook(() => useSimulationHistory());

    await waitFor(() => {
      expect(result.current.simulationHistory).toEqual([
        {
          schemaVersion: 2,
          id: "local-2",
          seed: null,
          createdAt: "2026-03-02T10:00:00Z",
          selectedOrg: "org-demo",
          selectedProject: "Projet A",
          selectedTeam: "Equipe Beta",
          startDate: "2026-01-01",
          endDate: "2026-02-01",
          simulationMode: "weeks_to_items",
          includeZeroWeeks: true,
          backlogSize: 12,
          targetWeeks: 6,
          nSims: 1234,
          types: ["Bug"],
          doneStates: ["Done"],
          sampleStats: null,
          weeklyThroughput: [{ week: "2026-01-05", throughput: 3 }],
          cycleTimeDaysData: [
            { week: "2026-01-05", cycleTimeDays: 4.5, count: 2 },
            { week: "2026-01-12", cycleTimeDays: 3, count: 0 },
          ],
          result: {
            result_kind: "weeks",
            samples_count: 0,
            seed: 0,
            result_percentiles: {},
            result_distribution: [],
          },
          warning: undefined,
        },
      ]);
    });
  });

  it("skips non-object rows and preserves string warnings when optional collections are malformed", async () => {
    vi.mocked(storageGetItem).mockReturnValue(
      JSON.stringify([
        null,
        {
          id: "local-3",
          createdAt: "2026-03-03T10:00:00Z",
          selectedOrg: "org-demo",
          selectedProject: "Projet A",
          selectedTeam: "Equipe Gamma",
          startDate: "2026-01-01",
          endDate: "2026-02-01",
          simulationMode: "weeks_to_items",
          includeZeroWeeks: false,
          backlogSize: 5,
          targetWeeks: 2,
          nSims: 500,
          types: "Bug",
          doneStates: "Done",
          weeklyThroughput: "invalid",
          cycleTimeDaysData: "invalid",
          warning: "warning conserve",
          schemaVersion: 2,
        },
      ]),
    );

    const { result } = renderHook(() => useSimulationHistory());

    await waitFor(() => {
      expect(result.current.simulationHistory).toEqual([
        {
          schemaVersion: 2,
          id: "local-3",
          seed: null,
          createdAt: "2026-03-03T10:00:00Z",
          selectedOrg: "org-demo",
          selectedProject: "Projet A",
          selectedTeam: "Equipe Gamma",
          startDate: "2026-01-01",
          endDate: "2026-02-01",
          simulationMode: "weeks_to_items",
          includeZeroWeeks: false,
          backlogSize: 5,
          targetWeeks: 2,
          nSims: 500,
          types: [],
          doneStates: [],
          sampleStats: null,
          weeklyThroughput: [],
          cycleTimeDaysData: [],
          result: {
            result_kind: "weeks",
            samples_count: 0,
            seed: 0,
            result_percentiles: {},
            result_distribution: [],
          },
          warning: "warning conserve",
        },
      ]);
    });
  });

  it("falls back to empty local state when storage contains invalid JSON", async () => {
    vi.mocked(storageGetItem).mockReturnValue("{bad json");

    const { result } = renderHook(() => useSimulationHistory());

    await waitFor(() => {
      expect(result.current.simulationHistory).toEqual([]);
    });
  });

  it("ignores non-array stored values", async () => {
    vi.mocked(storageGetItem).mockReturnValue(JSON.stringify({ nope: true }));

    const { result } = renderHook(() => useSimulationHistory());

    await waitFor(() => {
      expect(result.current.simulationHistory).toEqual([]);
    });
  });

  it("pushes entries with max history size and clears storage", async () => {
    const { result } = renderHook(() => useSimulationHistory());

    for (let index = 0; index < 12; index += 1) {
      await act(async () => {
        result.current.pushSimulationHistory(buildLocalEntry({ id: `local-${index}`, selectedTeam: index % 2 ? "Equipe Beta" : "Equipe Alpha" }));
      });
    }

    expect(result.current.simulationHistory).toHaveLength(10);
    expect(result.current.simulationHistory[0].selectedTeam).toBe("Equipe Beta");
    expect(result.current.simulationHistory.filter((entry) => entry.selectedTeam === "Equipe Alpha")).toHaveLength(5);
    expect(result.current.simulationHistory.filter((entry) => entry.selectedTeam === "Equipe Beta")).toHaveLength(5);

    await act(async () => {
      result.current.clearSimulationHistory();
    });

    expect(result.current.simulationHistory).toEqual([]);
    expect(storageRemoveItem).toHaveBeenCalledWith("mc_simulation_history_v2");
  });

  it("uses a dedicated storage key in demo mode", async () => {
    renderHook(() => useSimulationHistory({ demoMode: true }));

    await waitFor(() => {
      expect(storageSetItem).toHaveBeenCalledWith("mc_demo_simulation_history_v1", "[]");
    });
  });
});
