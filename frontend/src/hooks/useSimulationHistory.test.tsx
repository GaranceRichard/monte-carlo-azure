import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSimulationHistory } from "./useSimulationHistory";
import { getSimulationHistory, type SimulationHistoryItem } from "../api";
import { storageGetItem, storageRemoveItem, storageSetItem } from "../storage";

vi.mock("../api", () => ({
  getSimulationHistory: vi.fn(),
}));

vi.mock("../storage", () => ({
  storageGetItem: vi.fn(),
  storageRemoveItem: vi.fn(),
  storageSetItem: vi.fn(),
}));

function buildRemoteItem(overrides: Partial<SimulationHistoryItem> = {}): SimulationHistoryItem {
  return {
    created_at: "2026-02-26T10:00:00Z",
    last_seen: "2026-02-26T10:00:00Z",
    mode: "backlog_to_weeks",
    backlog_size: 70,
    target_weeks: null,
    n_sims: 2000,
    samples_count: 24,
    percentiles: { P50: 7, P70: 9, P90: 12 },
    distribution: [{ x: 7, count: 5 }],
    selected_org: "org-demo",
    selected_project: "Projet A",
    selected_team: "Equipe Alpha",
    start_date: "2026-01-01",
    end_date: "2026-02-01",
    done_states: ["Done"],
    types: ["Bug"],
    include_zero_weeks: false,
    throughput_reliability: { cv: 0.22, iqr_ratio: 0.3, slope_norm: -0.02, label: "fiable", samples_count: 24 },
    ...overrides,
  };
}

describe("useSimulationHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(storageGetItem).mockReturnValue(null);
    vi.mocked(getSimulationHistory).mockResolvedValue([]);
  });

  it("starts empty when storage is empty and remote history is empty", async () => {
    const { result } = renderHook(() => useSimulationHistory());

    await waitFor(() => {
      expect(result.current.simulationHistory).toEqual([]);
    });

    expect(storageSetItem).toHaveBeenCalledWith("mc_simulation_history_v2", "[]");
  });

  it("keeps local history when remote history also exists", async () => {
    const localEntry = {
      id: "local-1",
      createdAt: "2026-03-01T10:00:00Z",
      selectedOrg: "org-demo",
      selectedProject: "Projet A",
      selectedTeam: "Equipe Alpha",
      startDate: "2026-01-01",
      endDate: "2026-02-01",
      simulationMode: "weeks_to_items",
      includeZeroWeeks: true,
      backlogSize: 0,
      targetWeeks: 12,
      nSims: 4000,
      types: ["Bug"],
      doneStates: ["Done"],
      sampleStats: { totalWeeks: 30, zeroWeeks: 1, usedWeeks: 29 },
      weeklyThroughput: [],
      result: {
        result_kind: "items",
        samples_count: 30,
        result_percentiles: { P50: 38, P70: 44, P90: 52 },
        risk_score: 0.2,
        result_distribution: [],
      },
    };
    vi.mocked(storageGetItem).mockReturnValue(JSON.stringify([localEntry]));
    vi.mocked(getSimulationHistory).mockResolvedValue([buildRemoteItem()]);

    const { result } = renderHook(() => useSimulationHistory());

    await waitFor(() => {
      expect(result.current.simulationHistory).toHaveLength(1);
    });

    expect(result.current.simulationHistory[0].id).toBe("local-1");
  });

  it("maps remote backlog history when no local history exists", async () => {
    vi.mocked(getSimulationHistory).mockResolvedValue([buildRemoteItem()]);

    const { result } = renderHook(() => useSimulationHistory());

    await waitFor(() => {
      expect(result.current.simulationHistory).toHaveLength(1);
    });

    expect(result.current.simulationHistory[0]).toMatchObject({
      id: "remote-2026-02-26T10:00:00Z-0",
      simulationMode: "backlog_to_weeks",
      selectedTeam: "Equipe Alpha",
      backlogSize: 70,
      targetWeeks: 0,
      includeZeroWeeks: false,
      nSims: 2000,
      result: expect.objectContaining({
        result_kind: "weeks",
        throughput_reliability: expect.objectContaining({ label: "fiable" }),
      }),
      sampleStats: { totalWeeks: 24, zeroWeeks: 0, usedWeeks: 24 },
    });
  });

  it("maps remote weeks_to_items history with default fallbacks", async () => {
    vi.mocked(getSimulationHistory).mockResolvedValue([
      buildRemoteItem({
        mode: "weeks_to_items",
        backlog_size: undefined,
        target_weeks: 6,
        n_sims: undefined,
        samples_count: 0,
        selected_org: null,
        selected_project: null,
        selected_team: null,
        start_date: null,
        end_date: null,
        done_states: undefined,
        types: undefined,
        include_zero_weeks: true,
        percentiles: { P50: 21, P70: 34, P90: 55 },
        distribution: undefined,
      }),
    ]);

    const { result } = renderHook(() => useSimulationHistory());

    await waitFor(() => {
      expect(result.current.simulationHistory).toHaveLength(1);
    });

    expect(result.current.simulationHistory[0]).toMatchObject({
      selectedOrg: "",
      selectedProject: "",
      selectedTeam: "",
      startDate: "",
      endDate: "",
      simulationMode: "weeks_to_items",
      backlogSize: 0,
      targetWeeks: 6,
      nSims: 20000,
      includeZeroWeeks: true,
      types: [],
      doneStates: [],
      sampleStats: { totalWeeks: 0, zeroWeeks: 0, usedWeeks: 0 },
      result: expect.objectContaining({
        result_kind: "items",
        samples_count: 0,
        result_distribution: [],
      }),
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

  it("keeps local fallback when remote fetch fails", async () => {
    const localEntry = {
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
    };
    vi.mocked(storageGetItem).mockReturnValue(JSON.stringify([localEntry]));
    vi.mocked(getSimulationHistory).mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useSimulationHistory());

    await waitFor(() => {
      expect(result.current.simulationHistory).toHaveLength(1);
    });

    expect(result.current.simulationHistory[0].id).toBe("local-1");
  });

  it("ignores late remote data after unmount", async () => {
    let resolveRemote: ((value: SimulationHistoryItem[]) => void) | undefined;
    vi.mocked(getSimulationHistory).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRemote = resolve;
        }),
    );

    const { result, unmount } = renderHook(() => useSimulationHistory());

    unmount();
    resolveRemote?.([buildRemoteItem()]);
    await Promise.resolve();

    expect(result.current.simulationHistory).toEqual([]);
  });

  it("pushes entries with max history size and clears storage", async () => {
    const { result } = renderHook(() => useSimulationHistory());

    for (let index = 0; index < 12; index += 1) {
      await act(async () => {
        result.current.pushSimulationHistory({
          id: `local-${index}`,
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
        });
      });
    }

    expect(result.current.simulationHistory).toHaveLength(10);
    expect(result.current.simulationHistory[0].id).toBe("local-11");
    expect(result.current.simulationHistory.at(-1)?.id).toBe("local-2");

    await act(async () => {
      result.current.clearSimulationHistory();
    });

    expect(result.current.simulationHistory).toEqual([]);
    expect(storageRemoveItem).toHaveBeenCalledWith("mc_simulation_history_v2");
  });
});
