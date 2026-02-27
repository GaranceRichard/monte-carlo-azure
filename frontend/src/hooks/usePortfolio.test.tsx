import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePortfolio } from "./usePortfolio";
import { getTeamOptionsDirect } from "../adoClient";
import { fetchTeamThroughput, simulateForecastFromSamples } from "./simulationForecastService";
import { exportPortfolioPrintReport } from "../components/steps/portfolioPrintReport";
import { buildQuickFiltersScopeKey, readStoredPortfolioPrefs, writeStoredQuickFilters } from "../storage";

vi.mock("../adoClient", () => ({
  getTeamOptionsDirect: vi.fn(),
}));

vi.mock("./simulationForecastService", () => ({
  fetchTeamThroughput: vi.fn(),
  simulateForecastFromSamples: vi.fn(),
}));

vi.mock("../components/steps/portfolioPrintReport", () => ({
  exportPortfolioPrintReport: vi.fn(),
}));

const throughputData = {
  weeklyThroughput: [{ week: "2026-01-05", throughput: 3 }],
  throughputSamples: [2, 3, 5, 8, 13, 21],
  sampleStats: { totalWeeks: 10, zeroWeeks: 1, usedWeeks: 9 },
};

const simulationResult = {
  result_kind: "weeks" as const,
  samples_count: 100,
  risk_score: 0.3,
  result_percentiles: { P50: 10, P70: 12, P90: 15 },
  result_distribution: [{ x: 10, count: 25 }],
};

function setup(teams = [{ name: "Team A" }, { name: "Team B" }]) {
  return renderHook(() =>
    usePortfolio({
      selectedOrg: "Org A",
      selectedProject: "Project A",
      teams,
      pat: "pat",
    }),
  );
}

async function addTeam(result: ReturnType<typeof setup>["result"]) {
  await act(async () => {
    result.current.openAddModal();
  });
  await waitFor(() => {
    expect(result.current.modalTypeOptions).toEqual(["Bug"]);
  });
  act(() => {
    result.current.toggleModalType("Bug", true);
  });
  await waitFor(() => {
    expect(result.current.modalAvailableStates).toEqual(["Done"]);
  });
  act(() => {
    result.current.toggleModalState("Done", true);
  });
  act(() => {
    result.current.validateAddModal();
  });
  await waitFor(() => {
    expect(result.current.showAddModal).toBe(false);
  });
}

describe("usePortfolio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(getTeamOptionsDirect).mockResolvedValue({
      workItemTypes: ["Bug"],
      statesByType: { Bug: ["Done"] },
    });
  });

  it("generates report with scenario + team simulations", async () => {
    vi.mocked(fetchTeamThroughput).mockResolvedValue(throughputData);
    vi.mocked(simulateForecastFromSamples).mockResolvedValue(simulationResult);

    const { result } = setup([{ name: "Team A" }]);
    await addTeam(result);

    await act(async () => {
      await result.current.handleGenerateReport();
    });

    expect(vi.mocked(fetchTeamThroughput)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(simulateForecastFromSamples)).toHaveBeenCalledTimes(5);
    expect(vi.mocked(exportPortfolioPrintReport)).toHaveBeenCalledTimes(1);
    expect(result.current.err).toBe("");
  });

  it("keeps partial output when one team fails throughput collection", async () => {
    vi.mocked(fetchTeamThroughput).mockImplementation(async ({ selectedTeam }) => {
      if (selectedTeam === "Team B") throw new Error("team-b-failure");
      return throughputData;
    });
    vi.mocked(simulateForecastFromSamples).mockResolvedValue(simulationResult);

    const { result } = setup();
    await addTeam(result);
    await addTeam(result);

    await act(async () => {
      await result.current.handleGenerateReport();
    });

    expect(result.current.reportErrors).toEqual([expect.objectContaining({ teamName: "Team B" })]);
    expect(vi.mocked(exportPortfolioPrintReport)).toHaveBeenCalledTimes(1);
  });

  it("reports blocking error when all teams fail throughput collection", async () => {
    vi.mocked(fetchTeamThroughput).mockRejectedValue(new Error("collect-failure"));

    const { result } = setup([{ name: "Team A" }]);
    await addTeam(result);

    await act(async () => {
      await result.current.handleGenerateReport();
    });

    expect(result.current.err).toBe("Aucune equipe n'a pu etre simulee.");
    expect(vi.mocked(exportPortfolioPrintReport)).not.toHaveBeenCalled();
  });

  it("keeps arrimageRate when returning to a single team", async () => {
    const { result } = setup();
    await addTeam(result);
    await addTeam(result);

    act(() => {
      result.current.setArrimageRate(75);
    });
    expect(result.current.arrimageRate).toBe(75);

    act(() => {
      result.current.removeTeam("Team B");
    });
    await waitFor(() => {
      expect(result.current.arrimageRate).toBe(75);
    });
    expect(readStoredPortfolioPrefs().arrimageRate).toBe(75);
  });

  it("shows error when validating modal without team selection", async () => {
    const { result } = setup([]);

    await act(async () => {
      result.current.openAddModal();
    });
    act(() => {
      result.current.validateAddModal();
    });

    expect(result.current.modalErr).toBe("Selectionnez une equipe.");
  });

  it("shows error when validating modal without type/state", async () => {
    const { result } = setup([{ name: "Team A" }]);

    await act(async () => {
      result.current.openAddModal();
    });
    await waitFor(() => {
      expect(result.current.modalTypeOptions).toEqual(["Bug"]);
    });

    act(() => {
      result.current.validateAddModal();
    });

    expect(result.current.modalErr).toBe("Selectionnez au moins un type et un etat.");
  });

  it("shows duplicate team error when same team is added twice", async () => {
    const { result } = setup([{ name: "Team A" }, { name: "Team B" }]);
    await addTeam(result);

    await act(async () => {
      result.current.openAddModal();
    });
    act(() => {
      result.current.onModalTeamNameChange("Team A");
    });
    await waitFor(() => {
      expect(result.current.modalTeamName).toBe("Team A");
    });
    await waitFor(() => {
      expect(result.current.modalTypeOptions).toEqual(["Bug"]);
    });
    act(() => {
      result.current.toggleModalType("Bug", true);
    });
    await waitFor(() => {
      expect(result.current.modalAvailableStates).toEqual(["Done"]);
    });
    act(() => {
      result.current.toggleModalState("Done", true);
    });
    await waitFor(() => {
      expect(result.current.modalTypes).toEqual(["Bug"]);
      expect(result.current.modalDoneStates).toEqual(["Done"]);
    });
    act(() => {
      result.current.validateAddModal();
    });

    expect(result.current.modalErr).toBe("Cette equipe est deja ajoutee.");
  });

  it("applies only valid stored quick filters", async () => {
    const { result } = setup([{ name: "Team A" }]);
    const scopeKey = buildQuickFiltersScopeKey("Org A", "Project A", "Team A");
    writeStoredQuickFilters(scopeKey, {
      types: ["Bug", "Bug", "Unknown"],
      doneStates: ["Done", "Done", "Invalid"],
    });

    await act(async () => {
      result.current.openAddModal();
    });
    await waitFor(() => {
      expect(result.current.modalTypeOptions).toEqual(["Bug"]);
    });

    act(() => {
      result.current.applyModalQuickFilterConfig();
    });

    expect(result.current.modalTypes).toEqual(["Bug"]);
    expect(result.current.modalDoneStates).toEqual(["Done"]);
  });

  it("ignores stored quick filters when no valid selection remains", async () => {
    const { result } = setup([{ name: "Team A" }]);
    const scopeKey = buildQuickFiltersScopeKey("Org A", "Project A", "Team A");
    writeStoredQuickFilters(scopeKey, {
      types: ["Unknown"],
      doneStates: ["Invalid"],
    });

    await act(async () => {
      result.current.openAddModal();
    });
    await waitFor(() => {
      expect(result.current.modalTypeOptions).toEqual(["Bug"]);
    });

    act(() => {
      result.current.applyModalQuickFilterConfig();
    });

    expect(result.current.modalTypes).toEqual([]);
    expect(result.current.modalDoneStates).toEqual([]);
  });

  it("sets modalErr when team options loading fails", async () => {
    vi.mocked(getTeamOptionsDirect).mockRejectedValueOnce(new Error("load-options-failure"));
    const { result } = setup([{ name: "Team A" }]);

    await act(async () => {
      result.current.openAddModal();
    });

    await waitFor(() => {
      expect(result.current.modalErr).toBe("load-options-failure");
    });
  });

  it("closeAddModal resets modal visibility, error and quick-filter flag", async () => {
    const { result } = setup([{ name: "Team A" }]);
    const scopeKey = buildQuickFiltersScopeKey("Org A", "Project A", "Team A");
    writeStoredQuickFilters(scopeKey, { types: ["Bug"], doneStates: ["Done"] });

    await act(async () => {
      result.current.openAddModal();
    });
    await waitFor(() => {
      expect(result.current.modalHasQuickFilterConfig).toBe(true);
    });

    act(() => {
      result.current.toggleModalType("Bug", true);
      result.current.validateAddModal();
      result.current.closeAddModal();
    });

    expect(result.current.showAddModal).toBe(false);
    expect(result.current.modalErr).toBe("");
    expect(result.current.modalHasQuickFilterConfig).toBe(false);
  });

  it("keeps modal quick-filter flag false when no stored quick filter exists", async () => {
    const { result } = setup([{ name: "Team A" }]);

    await act(async () => {
      result.current.openAddModal();
    });
    await waitFor(() => {
      expect(result.current.modalTypeOptions).toEqual(["Bug"]);
    });

    act(() => {
      result.current.applyModalQuickFilterConfig();
    });

    expect(result.current.modalHasQuickFilterConfig).toBe(false);
    expect(result.current.modalTypes).toEqual([]);
    expect(result.current.modalDoneStates).toEqual([]);
  });

  it("removes selected state when ticket type is unchecked", async () => {
    const { result } = setup([{ name: "Team A" }]);

    await act(async () => {
      result.current.openAddModal();
    });
    await waitFor(() => {
      expect(result.current.modalTypeOptions).toEqual(["Bug"]);
    });

    act(() => {
      result.current.toggleModalType("Bug", true);
    });
    await waitFor(() => {
      expect(result.current.modalAvailableStates).toEqual(["Done"]);
    });

    act(() => {
      result.current.toggleModalState("Done", true);
    });
    await waitFor(() => {
      expect(result.current.modalDoneStates).toEqual(["Done"]);
    });

    act(() => {
      result.current.toggleModalType("Bug", false);
    });

    expect(result.current.modalTypes).toEqual([]);
    expect(result.current.modalDoneStates).toEqual([]);
  });

  it("removes state when unchecked", async () => {
    const { result } = setup([{ name: "Team A" }]);

    await act(async () => {
      result.current.openAddModal();
    });
    await waitFor(() => {
      expect(result.current.modalTypeOptions).toEqual(["Bug"]);
    });

    act(() => {
      result.current.toggleModalType("Bug", true);
    });
    await waitFor(() => {
      expect(result.current.modalAvailableStates).toEqual(["Done"]);
    });

    act(() => {
      result.current.toggleModalState("Done", true);
    });
    await waitFor(() => {
      expect(result.current.modalDoneStates).toEqual(["Done"]);
    });

    act(() => {
      result.current.toggleModalState("Done", false);
    });

    expect(result.current.modalDoneStates).toEqual([]);
  });
});
