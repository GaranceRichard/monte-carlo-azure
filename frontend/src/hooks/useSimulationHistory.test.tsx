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
    id: "local-1",
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
      expect(result.current.simulationHistory).toEqual([localEntry]);
    });

    expect(storageGetItem).toHaveBeenCalledWith("mc_simulation_history_v2");
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
