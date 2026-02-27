import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePortfolio } from "./usePortfolio";
import { getTeamOptionsDirect } from "../adoClient";
import { runSimulationForecast } from "./simulationForecastService";
import { exportPortfolioPrintReport } from "../components/steps/portfolioPrintReport";

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

    expect(result.current.err).toContain("HTTP 403");
    expect(result.current.err).toContain("permissions requises");
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
});
