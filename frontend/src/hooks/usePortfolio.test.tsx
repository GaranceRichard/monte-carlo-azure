import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePortfolio } from "./usePortfolio";
import { getTeamOptionsDirect } from "../adoClient";
import { runSimulationForecast } from "./simulationForecastService";
import { exportPortfolioPrintReport } from "../components/steps/portfolioPrintReport";
import { buildQuickFiltersScopeKey, readStoredQuickFilters, writeStoredQuickFilters } from "../storage";

vi.mock("../adoClient", () => ({
  getTeamOptionsDirect: vi.fn(),
}));

vi.mock("./simulationForecastService", () => ({
  runSimulationForecast: vi.fn(),
}));

vi.mock("../components/steps/portfolioPrintReport", () => ({
  exportPortfolioPrintReport: vi.fn(),
}));

describe("usePortfolio error handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("formats HTTP-like 403 errors with adoErrors pipeline during report generation", async () => {
    vi.mocked(getTeamOptionsDirect).mockResolvedValue({
      workItemTypes: ["Bug"],
      statesByType: { Bug: ["Done"] },
    });
    vi.mocked(runSimulationForecast).mockRejectedValue({
      status: 403,
      statusText: "Forbidden",
    });

    const { result } = renderHook(() =>
      usePortfolio({
        selectedOrg: "Org A",
        selectedProject: "Project A",
        teams: [{ name: "Team A" }],
        pat: "pat",
      }),
    );

    await act(async () => {
      result.current.openAddModal();
    });
    await waitFor(() => {
      expect(result.current.modalTypeOptions).toEqual(["Bug"]);
    });

    act(() => {
      result.current.toggleModalType("Bug", true);
    });
    act(() => {
      result.current.toggleModalState("Done", true);
    });
    act(() => {
      result.current.validateAddModal();
    });
    await waitFor(() => {
      expect(result.current.teamConfigs).toHaveLength(1);
    });

    await act(async () => {
      await result.current.handleGenerateReport();
    });

    expect(result.current.err).toContain("Aucune equipe n'a pu etre simulee.");
    expect(result.current.reportErrors).toHaveLength(1);
    expect(result.current.reportErrors[0]?.message).toContain("HTTP 403");
    expect(result.current.reportErrors[0]?.message).toContain("permissions requises");
    expect(vi.mocked(exportPortfolioPrintReport)).not.toHaveBeenCalled();
  });

  it("covers invalid modal validations and duplicate team guard", async () => {
    vi.mocked(getTeamOptionsDirect).mockResolvedValue({
      workItemTypes: ["Bug"],
      statesByType: { Bug: ["Done"] },
    });

    const { result } = renderHook(() =>
      usePortfolio({
        selectedOrg: "Org A",
        selectedProject: "Project A",
        teams: [],
        pat: "pat",
      }),
    );

    act(() => {
      result.current.openAddModal();
      result.current.validateAddModal();
    });
    expect(result.current.modalErr).toBe("Selectionnez une equipe.");

    const { result: resultWithTeam } = renderHook(() =>
      usePortfolio({
        selectedOrg: "Org A",
        selectedProject: "Project A",
        teams: [{ name: "Team A" }],
        pat: "pat",
      }),
    );

    await act(async () => {
      resultWithTeam.current.openAddModal();
    });
    await waitFor(() => {
      expect(resultWithTeam.current.modalTypeOptions).toEqual(["Bug"]);
    });

    act(() => {
      resultWithTeam.current.validateAddModal();
    });
    expect(resultWithTeam.current.modalErr).toBe("Selectionnez au moins un type et un etat.");

    act(() => {
      resultWithTeam.current.toggleModalType("Bug", true);
    });
    act(() => {
      resultWithTeam.current.toggleModalState("Done", true);
    });
    act(() => {
      resultWithTeam.current.validateAddModal();
    });
    await waitFor(() => {
      expect(resultWithTeam.current.teamConfigs).toHaveLength(1);
    });

    act(() => {
      resultWithTeam.current.openAddModal();
      resultWithTeam.current.onModalTeamNameChange("Team A");
    });
    await waitFor(() => {
      expect(resultWithTeam.current.modalTypeOptions).toEqual(["Bug"]);
    });
    act(() => {
      resultWithTeam.current.toggleModalType("Bug", true);
    });
    act(() => {
      resultWithTeam.current.toggleModalState("Done", true);
    });
    act(() => {
      resultWithTeam.current.validateAddModal();
    });
    expect(resultWithTeam.current.modalErr).toBe("Cette equipe est deja ajoutee.");
  });

  it("updates available teams when adding then removing a team", async () => {
    vi.mocked(getTeamOptionsDirect).mockResolvedValue({
      workItemTypes: ["Bug"],
      statesByType: { Bug: ["Done", "Closed"] },
    });

    const { result } = renderHook(() =>
      usePortfolio({
        selectedOrg: "Org A",
        selectedProject: "Project A",
        teams: [{ name: "Team A" }, { name: "Team B" }],
        pat: "pat",
      }),
    );

    expect(result.current.availableTeamNames).toEqual(["Team A", "Team B"]);

    await act(async () => {
      result.current.openAddModal();
    });
    await waitFor(() => {
      expect(result.current.modalTypeOptions).toEqual(["Bug"]);
    });

    act(() => {
      result.current.toggleModalType("Bug", true);
    });
    act(() => {
      result.current.toggleModalState("Done", true);
    });
    act(() => {
      result.current.validateAddModal();
    });
    await waitFor(() => {
      expect(result.current.teamConfigs).toHaveLength(1);
    });
    expect(result.current.availableTeamNames).toEqual(["Team B"]);

    act(() => {
      result.current.removeTeam("Team A");
    });
    expect(result.current.availableTeamNames).toEqual(["Team A", "Team B"]);
  });

  it("generates and exports a portfolio report on success", async () => {
    vi.mocked(getTeamOptionsDirect).mockResolvedValue({
      workItemTypes: ["Bug"],
      statesByType: { Bug: ["Done"] },
    });
    vi.mocked(runSimulationForecast).mockResolvedValue({
      weeklyThroughput: [{ week: "2026-01-05", throughput: 3 }],
      sampleStats: { totalWeeks: 10, zeroWeeks: 1, usedWeeks: 9 },
      result: {
        result_kind: "weeks",
        samples_count: 100,
        risk_score: 0.3,
        result_percentiles: { P50: 10, P70: 12, P90: 15 },
        result_distribution: [{ x: 10, count: 25 }],
      },
      historyEntry: {} as never,
    });

    const { result } = renderHook(() =>
      usePortfolio({
        selectedOrg: "Org A",
        selectedProject: "Project A",
        teams: [{ name: "Team A" }],
        pat: "pat",
      }),
    );

    await act(async () => {
      result.current.openAddModal();
    });
    await waitFor(() => {
      expect(result.current.modalTypeOptions).toEqual(["Bug"]);
    });

    act(() => {
      result.current.toggleModalType("Bug", true);
    });
    act(() => {
      result.current.toggleModalState("Done", true);
    });
    act(() => {
      result.current.validateAddModal();
    });
    await waitFor(() => {
      expect(result.current.teamConfigs).toHaveLength(1);
    });

    await act(async () => {
      await result.current.handleGenerateReport();
    });

    expect(vi.mocked(runSimulationForecast)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(exportPortfolioPrintReport)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(exportPortfolioPrintReport).mock.calls[0]?.[0]).toMatchObject({
      selectedProject: "Project A",
      sections: [
        expect.objectContaining({
          selectedTeam: "Team A",
          resultKind: "weeks",
          riskScore: 0.3,
        }),
      ],
    });
  });

  it("handles unknown modal loading failures and closeAddModal resets modal state", async () => {
    vi.mocked(getTeamOptionsDirect).mockRejectedValue("unexpected-failure");

    const { result } = renderHook(() =>
      usePortfolio({
        selectedOrg: "Org A",
        selectedProject: "Project A",
        teams: [{ name: "Team A" }],
        pat: "pat",
      }),
    );

    await act(async () => {
      result.current.openAddModal();
    });
    await waitFor(() => {
      expect(result.current.modalErr).toContain('Erreur inattendue pendant "chargement des types de tickets"');
    });
    expect(result.current.showAddModal).toBe(true);

    act(() => {
      result.current.closeAddModal();
    });
    expect(result.current.showAddModal).toBe(false);
    expect(result.current.modalErr).toBe("");
  });

  it("returns early when generating report with no team config", async () => {
    const { result } = renderHook(() =>
      usePortfolio({
        selectedOrg: "Org A",
        selectedProject: "Project A",
        teams: [{ name: "Team A" }],
        pat: "pat",
      }),
    );

    await act(async () => {
      await result.current.handleGenerateReport();
    });

    expect(vi.mocked(runSimulationForecast)).not.toHaveBeenCalled();
    expect(vi.mocked(exportPortfolioPrintReport)).not.toHaveBeenCalled();
  });

  it("covers modal branch paths for type/state toggles and statesByType fallback", async () => {
    vi.mocked(getTeamOptionsDirect).mockResolvedValue({
      workItemTypes: ["Bug", "Task"],
      statesByType: undefined as unknown as Record<string, string[]>,
    });

    const { result } = renderHook(() =>
      usePortfolio({
        selectedOrg: "Org A",
        selectedProject: "Project A",
        teams: [{ name: "Team A" }],
        pat: "pat",
      }),
    );

    await act(async () => {
      result.current.openAddModal();
    });
    await waitFor(() => {
      expect(result.current.modalTypeOptions).toEqual(["Bug", "Task"]);
    });

    act(() => {
      result.current.toggleModalType("Bug", true);
    });
    act(() => {
      result.current.toggleModalState("Done", true);
    });
    act(() => {
      result.current.toggleModalState("Done", false);
    });
    act(() => {
      result.current.toggleModalType("Task", true);
    });
    act(() => {
      result.current.toggleModalType("Bug", false);
    });

    expect(result.current.modalTypes).toEqual(["Task"]);
    expect(result.current.modalDoneStates).toEqual([]);
  });

  it("falls back to empty work-item list when options do not include workItemTypes", async () => {
    vi.mocked(getTeamOptionsDirect).mockResolvedValue({
      workItemTypes: undefined as unknown as string[],
      statesByType: { Bug: ["Done"] },
    });

    const { result } = renderHook(() =>
      usePortfolio({
        selectedOrg: "Org A",
        selectedProject: "Project A",
        teams: [{ name: "Team A" }],
        pat: "pat",
      }),
    );

    await act(async () => {
      result.current.openAddModal();
    });
    await waitFor(() => {
      expect(result.current.modalTypeOptions).toEqual([]);
    });
  });

  it("caches team options per team within the same org/project session", async () => {
    vi.mocked(getTeamOptionsDirect).mockResolvedValue({
      workItemTypes: ["Bug"],
      statesByType: { Bug: ["Done"] },
    });

    const { result } = renderHook(() =>
      usePortfolio({
        selectedOrg: "Org A",
        selectedProject: "Project A",
        teams: [{ name: "Team A" }, { name: "Team B" }],
        pat: "pat",
      }),
    );

    await act(async () => {
      result.current.openAddModal();
    });
    await waitFor(() => {
      expect(result.current.modalTypeOptions).toEqual(["Bug"]);
    });
    expect(vi.mocked(getTeamOptionsDirect)).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.closeAddModal();
      result.current.openAddModal();
    });
    await waitFor(() => {
      expect(result.current.modalTypeOptions).toEqual(["Bug"]);
    });
    expect(vi.mocked(getTeamOptionsDirect)).toHaveBeenCalledTimes(1);

    await act(async () => {
      result.current.onModalTeamNameChange("Team B");
    });
    await waitFor(() => {
      expect(result.current.modalTypeOptions).toEqual(["Bug"]);
    });
    expect(vi.mocked(getTeamOptionsDirect)).toHaveBeenCalledTimes(2);

    await act(async () => {
      result.current.onModalTeamNameChange("Team A");
    });
    expect(vi.mocked(getTeamOptionsDirect)).toHaveBeenCalledTimes(2);
  });

  it("applies stored quick filters in modal and persists validated selections", async () => {
    const scopeKey = buildQuickFiltersScopeKey("Org A", "Project A", "Team A");
    writeStoredQuickFilters(scopeKey, { types: ["Bug"], doneStates: ["Done"] });
    vi.mocked(getTeamOptionsDirect).mockResolvedValue({
      workItemTypes: ["Bug", "Task"],
      statesByType: { Bug: ["Done", "Closed"], Task: ["Done"] },
    });

    const { result } = renderHook(() =>
      usePortfolio({
        selectedOrg: "Org A",
        selectedProject: "Project A",
        teams: [{ name: "Team A" }],
        pat: "pat",
      }),
    );

    await act(async () => {
      result.current.openAddModal();
    });
    await waitFor(() => {
      expect(result.current.modalHasQuickFilterConfig).toBe(true);
    });

    act(() => {
      result.current.applyModalQuickFilterConfig();
    });
    expect(result.current.modalTypes).toEqual(["Bug"]);
    expect(result.current.modalDoneStates).toEqual(["Done"]);

    act(() => {
      result.current.validateAddModal();
    });

    expect(readStoredQuickFilters(scopeKey)).toEqual({
      types: ["Bug"],
      doneStates: ["Done"],
    });
  });

  it("generates report with successful teams even when one team fails", async () => {
    vi.mocked(getTeamOptionsDirect).mockResolvedValue({
      workItemTypes: ["Bug"],
      statesByType: { Bug: ["Done"] },
    });
    vi.mocked(runSimulationForecast).mockImplementation(async ({ selectedTeam }) => {
      if (selectedTeam === "Team B") {
        throw new Error("team-b-failure");
      }
      return {
        weeklyThroughput: [{ week: "2026-01-05", throughput: 3 }],
        sampleStats: { totalWeeks: 10, zeroWeeks: 1, usedWeeks: 9 },
        result: {
          result_kind: "weeks",
          samples_count: 100,
          risk_score: 0.3,
          result_percentiles: { P50: 10, P70: 12, P90: 15 },
          result_distribution: [{ x: 10, count: 25 }],
        },
        historyEntry: {} as never,
      };
    });

    const { result } = renderHook(() =>
      usePortfolio({
        selectedOrg: "Org A",
        selectedProject: "Project A",
        teams: [{ name: "Team A" }, { name: "Team B" }, { name: "Team C" }],
        pat: "pat",
      }),
    );

    const addTeam = async () => {
      await act(async () => {
        result.current.openAddModal();
      });
      await waitFor(() => {
        expect(result.current.modalTypeOptions).toEqual(["Bug"]);
      });
      act(() => {
        result.current.toggleModalType("Bug", true);
      });
      act(() => {
        result.current.toggleModalState("Done", true);
      });
      act(() => {
        result.current.validateAddModal();
      });
    };

    await addTeam();
    await addTeam();
    await addTeam();
    await waitFor(() => {
      expect(result.current.teamConfigs).toHaveLength(3);
    });

    await act(async () => {
      await result.current.handleGenerateReport();
    });

    expect(vi.mocked(runSimulationForecast)).toHaveBeenCalledTimes(3);
    expect(result.current.reportProgressLabel).toBe("3/3 equipes simulees");
    expect(result.current.reportErrors).toEqual([
      expect.objectContaining({ teamName: "Team B" }),
    ]);
    expect(vi.mocked(exportPortfolioPrintReport)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(exportPortfolioPrintReport).mock.calls[0]?.[0]).toMatchObject({
      sections: [expect.objectContaining({ selectedTeam: "Team A" }), expect.objectContaining({ selectedTeam: "Team C" })],
    });
  });

  it("tracks intermediate portfolio report progress while teams settle", async () => {
    vi.mocked(getTeamOptionsDirect).mockResolvedValue({
      workItemTypes: ["Bug"],
      statesByType: { Bug: ["Done"] },
    });

    type Deferred<T> = {
      promise: Promise<T>;
      resolve: (value: T) => void;
      reject: (reason?: unknown) => void;
    };
    function deferred<T>(): Deferred<T> {
      let resolve!: (value: T) => void;
      let reject!: (reason?: unknown) => void;
      const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    }

    const teamAPromise = deferred<{
      weeklyThroughput: { week: string; throughput: number }[];
      sampleStats: { totalWeeks: number; zeroWeeks: number; usedWeeks: number };
      result: {
        result_kind: "weeks";
        samples_count: number;
        risk_score: number;
        result_percentiles: Record<string, number>;
        result_distribution: { x: number; count: number }[];
      };
      historyEntry: never;
    }>();
    const teamBPromise = deferred<{
      weeklyThroughput: { week: string; throughput: number }[];
      sampleStats: { totalWeeks: number; zeroWeeks: number; usedWeeks: number };
      result: {
        result_kind: "weeks";
        samples_count: number;
        risk_score: number;
        result_percentiles: Record<string, number>;
        result_distribution: { x: number; count: number }[];
      };
      historyEntry: never;
    }>();
    const teamCPromise = deferred<{
      weeklyThroughput: { week: string; throughput: number }[];
      sampleStats: { totalWeeks: number; zeroWeeks: number; usedWeeks: number };
      result: {
        result_kind: "weeks";
        samples_count: number;
        risk_score: number;
        result_percentiles: Record<string, number>;
        result_distribution: { x: number; count: number }[];
      };
      historyEntry: never;
    }>();

    const okForecast = {
      weeklyThroughput: [{ week: "2026-01-05", throughput: 3 }],
      sampleStats: { totalWeeks: 10, zeroWeeks: 1, usedWeeks: 9 },
      result: {
        result_kind: "weeks" as const,
        samples_count: 100,
        risk_score: 0.3,
        result_percentiles: { P50: 10, P70: 12, P90: 15 },
        result_distribution: [{ x: 10, count: 25 }],
      },
      historyEntry: {} as never,
    };

    vi.mocked(runSimulationForecast).mockImplementation(({ selectedTeam }) => {
      if (selectedTeam === "Team A") return teamAPromise.promise;
      if (selectedTeam === "Team B") return teamBPromise.promise;
      return teamCPromise.promise;
    });

    const { result } = renderHook(() =>
      usePortfolio({
        selectedOrg: "Org A",
        selectedProject: "Project A",
        teams: [{ name: "Team A" }, { name: "Team B" }, { name: "Team C" }],
        pat: "pat",
      }),
    );

    const addTeam = async () => {
      await act(async () => {
        result.current.openAddModal();
      });
      await waitFor(() => {
        expect(result.current.modalTypeOptions).toEqual(["Bug"]);
      });
      act(() => {
        result.current.toggleModalType("Bug", true);
      });
      act(() => {
        result.current.toggleModalState("Done", true);
      });
      act(() => {
        result.current.validateAddModal();
      });
    };

    await addTeam();
    await addTeam();
    await addTeam();
    await waitFor(() => {
      expect(result.current.teamConfigs).toHaveLength(3);
    });

    await act(async () => {
      void result.current.handleGenerateReport();
    });
    expect(result.current.reportProgressLabel).toBe("0/3 equipes simulees");

    await act(async () => {
      teamBPromise.reject(new Error("team-b-failure"));
    });
    await waitFor(() => {
      expect(result.current.reportProgressLabel).toBe("1/3 equipes simulees");
    });

    await act(async () => {
      teamAPromise.resolve(okForecast);
    });
    await waitFor(() => {
      expect(result.current.reportProgressLabel).toBe("2/3 equipes simulees");
    });

    await act(async () => {
      teamCPromise.resolve(okForecast);
    });
    await waitFor(() => {
      expect(result.current.reportProgressLabel).toBe("3/3 equipes simulees");
    });
    await waitFor(() => {
      expect(result.current.loadingReport).toBe(false);
    });

    expect(result.current.reportErrors).toEqual([expect.objectContaining({ teamName: "Team B" })]);
    expect(vi.mocked(exportPortfolioPrintReport)).toHaveBeenCalledTimes(1);
  });

  it("handles export failure in global report catch and clears report errors on demand", async () => {
    vi.mocked(getTeamOptionsDirect).mockResolvedValue({
      workItemTypes: ["Bug"],
      statesByType: { Bug: ["Done"] },
    });
    vi.mocked(runSimulationForecast).mockResolvedValue({
      weeklyThroughput: [{ week: "2026-01-05", throughput: 3 }],
      sampleStats: { totalWeeks: 10, zeroWeeks: 1, usedWeeks: 9 },
      result: {
        result_kind: "weeks",
        samples_count: 100,
        risk_score: 0.3,
        result_percentiles: { P50: 10, P70: 12, P90: 15 },
        result_distribution: [{ x: 10, count: 25 }],
      },
      historyEntry: {} as never,
    });
    vi.mocked(exportPortfolioPrintReport).mockImplementation(() => {
      throw new Error("export-failure");
    });

    const { result } = renderHook(() =>
      usePortfolio({
        selectedOrg: "Org A",
        selectedProject: "Project A",
        teams: [{ name: "Team A" }],
        pat: "pat",
      }),
    );

    await act(async () => {
      result.current.openAddModal();
    });
    await waitFor(() => {
      expect(result.current.modalTypeOptions).toEqual(["Bug"]);
    });
    act(() => {
      result.current.toggleModalType("Bug", true);
    });
    act(() => {
      result.current.toggleModalState("Done", true);
    });
    act(() => {
      result.current.validateAddModal();
    });
    await waitFor(() => {
      expect(result.current.teamConfigs).toHaveLength(1);
    });

    await act(async () => {
      await result.current.handleGenerateReport();
    });

    expect(result.current.err).toContain("export-failure");
    expect(result.current.loadingReport).toBe(false);
    act(() => {
      result.current.clearReportErrors();
    });
    expect(result.current.reportErrors).toEqual([]);
  });
});
