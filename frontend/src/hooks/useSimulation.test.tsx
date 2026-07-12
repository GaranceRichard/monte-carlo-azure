import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runSimulationForecast } from "./simulationForecastService";
import { useSimulation } from "./useSimulation";

const pushSimulationHistory = vi.fn();
const clearSimulationHistory = vi.fn();
const resetTeamOptions = vi.fn();
const resetAutoRunState = vi.fn();
const exportThroughputCsv = vi.fn();
const capturedOnTeamOptionsReset = vi.hoisted(() => ({ current: undefined as undefined | (() => void) }));
const teamOptions = vi.hoisted(() => ({
  loadingTeamOptions: false,
  workItemTypeOptions: ["Bug"],
  statesByType: { Bug: ["Done", "Closed"] },
  hasQuickFilterConfig: false,
  applyQuickFilterConfig: vi.fn(),
  resetTeamOptions: vi.fn(),
}));

vi.mock("./simulationForecastService", () => ({ runSimulationForecast: vi.fn() }));
vi.mock("../utils/export", () => ({ exportThroughputCsv: (...args: unknown[]) => exportThroughputCsv(...args) }));
vi.mock("./useSimulationHistory", () => ({ useSimulationHistory: () => ({ simulationHistory: [], pushSimulationHistory, clearSimulationHistory }) }));
vi.mock("./useTeamOptions", () => ({ useTeamOptions: (params: { onTeamOptionsReset: () => void }) => {
  capturedOnTeamOptionsReset.current = params.onTeamOptionsReset;
  return { ...teamOptions, resetTeamOptions };
} }));
vi.mock("./useSimulationQuickFilters", () => ({ useSimulationQuickFilters: () => undefined }));
vi.mock("./useSimulationAutoRun", () => ({ useSimulationAutoRun: () => ({ resetAutoRunState }) }));
vi.mock("./useSimulationChartData", () => ({ useSimulationChartData: () => ({ throughputData: [], cycleTimeDaysData: [], cycleTimeTrendData: [], cycleTimeSummary: { itemCount: 0, averageDays: null, hasSufficientData: false }, mcHistData: [], probabilityCurveData: [], displayPercentiles: {} }) }));

function setup(overrides: Partial<Parameters<typeof useSimulation>[0]> = {}) {
  return renderHook(() => useSimulation({ step: "simulation", selectedOrg: "Org", selectedProject: "Projet", selectedTeam: "Equipe", pat: "pat", serverUrl: "", ...overrides }));
}

const forecast = {
  sampleStats: { totalWeeks: 8, zeroWeeks: 1, usedWeeks: 7 },
  weeklyThroughput: [{ week: "2026-01-05", throughput: 3 }],
  cycleTimeDaysData: [],
  result: { result_kind: "weeks" as const, samples_count: 8, seed: 42, result_percentiles: { P50: 3 }, result_distribution: [] },
  warning: "partiel",
  historyEntry: { id: "history" },
};

describe("useSimulation", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.useRealTimers();
    teamOptions.workItemTypeOptions = ["Bug"];
    teamOptions.statesByType = { Bug: ["Done", "Closed"] };
  });

  it("starts idle and exposes required team option state", () => {
    const { result } = setup();
    expect(result.current).toMatchObject({ loading: false, err: "", types: [], doneStates: [], filteredDoneStateOptions: [] });
    expect(result.current.workItemTypeOptions).toEqual(["Bug"]);
  });

  it("validates missing team, PAT and filters before calling the forecast service", async () => {
    const noTeam = setup({ selectedTeam: "" });
    await act(() => noTeam.result.current.runForecast());
    expect(noTeam.result.current.err).toContain("équipe");
    noTeam.unmount();
    const noPat = setup({ pat: "" });
    await act(() => noPat.result.current.runForecast());
    expect(noPat.result.current.err).toContain("PAT");
    noPat.unmount();
    const missingFilters = setup();
    await act(() => missingFilters.result.current.runForecast());
    expect(missingFilters.result.current.err).toContain("Ticket");
    expect(runSimulationForecast).not.toHaveBeenCalled();
  });

  it("runs successfully with filters and records history", async () => {
    vi.mocked(runSimulationForecast).mockResolvedValue(forecast as never);
    const { result } = setup();
    act(() => { result.current.setTypes(["Bug"]); result.current.setDoneStates(["Done"]); });
    await act(() => result.current.runForecast());
    await waitFor(() => expect(result.current.result).toEqual(forecast.result));
    expect(result.current.warning).toBe("partiel");
    expect(result.current.hasLaunchedOnce).toBe(true);
    expect(pushSimulationHistory).toHaveBeenCalledWith(forecast.historyEntry);
  });

  it("surfaces forecast errors and resets computed results", async () => {
    vi.mocked(runSimulationForecast).mockRejectedValue(new Error("Azure indisponible"));
    const { result } = setup();
    act(() => { result.current.setTypes(["Bug"]); result.current.setDoneStates(["Done"]); });
    await act(() => result.current.runForecast());
    expect(result.current.err).toBe("Azure indisponible");
    expect(result.current.loading).toBe(false);
    expect(result.current.result).toBeNull();
  });

  it("resets all state and delegates the team option cleanup", () => {
    const { result } = setup();
    act(() => { result.current.setTypes(["Bug"]); result.current.setDoneStates(["Done"]); result.current.resetAll(); });
    expect(resetTeamOptions).toHaveBeenCalledOnce();
    expect(result.current).toMatchObject({ err: "", warning: "", hasLaunchedOnce: false });
  });

  it("filters obsolete states and clears filters when team options are reset", async () => {
    const { result, rerender } = setup();
    act(() => {
      result.current.setTypes(["Bug", "Unknown"]);
      result.current.setDoneStates(["Done", "Obsolete"]);
    });
    await waitFor(() => expect(result.current.doneStates).toEqual(["Done"]));

    teamOptions.statesByType = { Bug: [] };
    rerender();
    await waitFor(() => expect(result.current.doneStates).toEqual([]));

    act(() => capturedOnTeamOptionsReset.current?.());
    expect(result.current.types).toEqual([]);
    expect(result.current.doneStates).toEqual([]);
  });

  it("shows the simulation phase while a request is pending and ignores a duplicate launch", async () => {
    vi.useFakeTimers();
    let resolveForecast: (value: typeof forecast) => void = () => undefined;
    vi.mocked(runSimulationForecast).mockReturnValue(new Promise((resolve) => { resolveForecast = resolve; }) as never);
    const { result } = setup();
    act(() => { result.current.setTypes(["Bug"]); result.current.setDoneStates(["Done"]); });

    let pendingRun: Promise<void> | undefined;
    await act(async () => {
      pendingRun = result.current.runForecast();
      await Promise.resolve();
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(1200); });
    expect(result.current).toMatchObject({ loading: true, loadingStageMessage: "Simulation en cours..." });
    await act(() => result.current.runForecast());
    expect(runSimulationForecast).toHaveBeenCalledOnce();

    await act(async () => { resolveForecast(forecast); await pendingRun; });
    expect(result.current.loading).toBe(false);
    vi.useRealTimers();
  });

  it("auto-runs the demo only once after valid filters are selected", async () => {
    vi.mocked(runSimulationForecast).mockResolvedValue(forecast as never);
    const { result } = setup({ demoMode: true });
    act(() => { result.current.setTypes(["Bug"]); result.current.setDoneStates(["Done"]); });
    await waitFor(() => expect(runSimulationForecast).toHaveBeenCalledOnce());
    expect(vi.mocked(runSimulationForecast).mock.calls[0]?.[0]).toMatchObject({ demoMode: true });
  });

  it("restores a saved run, replays its seed while unchanged, and clears it after a parameter change", async () => {
    vi.mocked(runSimulationForecast).mockResolvedValue(forecast as never);
    const { result } = setup();
    const entry = {
      schemaVersion: 2 as const,
      id: "saved",
      seed: 77,
      createdAt: "2026-01-10T00:00:00Z",
      selectedOrg: "Org",
      selectedProject: "Projet",
      selectedTeam: "Equipe",
      startDate: "2026-01-01",
      endDate: "2026-02-01",
      simulationMode: "backlog_to_weeks" as const,
      includeZeroWeeks: true,
      backlogSize: 120,
      targetWeeks: 12,
      nSims: 20000,
      types: ["Bug"],
      doneStates: ["Done"],
      sampleStats: forecast.sampleStats,
      weeklyThroughput: forecast.weeklyThroughput,
      result: forecast.result,
      warning: "restauré",
    };

    act(() => result.current.applyHistoryEntry(entry));
    expect(result.current).toMatchObject({ warning: "restauré", hasLaunchedOnce: true, types: ["Bug"] });
    await act(() => result.current.runForecast());
    expect(vi.mocked(runSimulationForecast).mock.calls[0]?.[0]).toMatchObject({ seed: 77 });

    act(() => result.current.setTargetWeeks(13));
    await act(() => result.current.runForecast());
    expect(vi.mocked(runSimulationForecast).mock.calls[1]?.[0]).toMatchObject({ seed: undefined });
    expect(resetAutoRunState).toHaveBeenCalled();
  });

  it("handles a legacy history entry and exposes CSV export and result reset actions", () => {
    const { result } = setup();
    const entry = {
      schemaVersion: 2 as const,
      id: "legacy",
      seed: null,
      createdAt: "2026-01-10T00:00:00Z",
      selectedOrg: "Org",
      selectedProject: "Projet",
      selectedTeam: "Equipe",
      startDate: "2026-01-01",
      endDate: "2026-02-01",
      simulationMode: "weeks_to_items" as const,
      includeZeroWeeks: false,
      backlogSize: 20,
      targetWeeks: 4,
      nSims: 100,
      types: ["Bug"],
      doneStates: ["Done"],
      sampleStats: null,
      weeklyThroughput: [{ week: "2026-01-05", throughput: 3 }],
      result: forecast.result,
    };
    act(() => result.current.applyHistoryEntry(entry));
    act(() => result.current.exportThroughputCsv());
    expect(exportThroughputCsv).toHaveBeenCalledWith(entry.weeklyThroughput, "Equipe");
    act(() => result.current.resetForTeamSelection());
    expect(result.current).toMatchObject({ result: null, hasLaunchedOnce: false, warning: "" });
    act(() => result.current.resetSimulationResults());
    expect(resetAutoRunState).toHaveBeenCalledTimes(3);
  });
});
