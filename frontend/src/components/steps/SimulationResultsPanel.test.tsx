import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SimulationResultsPanel from "./SimulationResultsPanel";
import { useSimulationContext } from "../../hooks/SimulationContext";

vi.mock("../../hooks/SimulationContext", () => ({
  useSimulationContext: vi.fn(),
}));

describe("SimulationResultsPanel history list", () => {
  function baseEntry(id: string, selectedTeam: string) {
    return {
      id,
      createdAt: "2026-02-25T10:00:00.000Z",
      selectedOrg: "org-a",
      selectedProject: "Projet A",
      selectedTeam,
      startDate: "2026-01-01",
      endDate: "2026-02-01",
      simulationMode: "weeks_to_items" as const,
      includeZeroWeeks: true,
      backlogSize: 12,
      targetWeeks: 3,
      nSims: 20000,
      capacityPercent: 100,
      reducedCapacityWeeks: 0,
      types: ["Bug"],
      doneStates: ["Done"],
      sampleStats: { totalWeeks: 8, zeroWeeks: 1, usedWeeks: 7 },
      weeklyThroughput: [],
      result: {
        result_kind: "items" as const,
        samples_count: 10,
        result_percentiles: { P50: 1, P70: 2, P90: 3 },
        result_distribution: [],
      },
    };
  }

  it("shows 'pas de simulation pour l'équipe' when team has no history", () => {
    vi.mocked(useSimulationContext).mockReturnValue({
      selectedTeam: "Alpha-Team",
      simulation: {
        loading: false,
        loadingStageMessage: "",
        includeZeroWeeks: true,
        sampleStats: null,
        result: null,
        displayPercentiles: {},
        simulationHistory: [baseEntry("h2", "Beta-Team")],
        applyHistoryEntry: vi.fn(),
        clearSimulationHistory: vi.fn(),
      },
    } as never);

    render(<SimulationResultsPanel />);
    expect(screen.getByText("pas de simulation pour l'équipe")).not.toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("shows only current team history and loads on selection", () => {
    const applyHistoryEntry = vi.fn();
    const entry = baseEntry("h1", "Alpha-Team");
    const otherTeamEntry = baseEntry("h2", "Beta-Team");

    vi.mocked(useSimulationContext).mockReturnValue({
      selectedTeam: "Alpha-Team",
      simulation: {
        loading: false,
        loadingStageMessage: "",
        includeZeroWeeks: true,
        sampleStats: null,
        result: null,
        displayPercentiles: {},
        simulationHistory: [entry, otherTeamEntry],
        applyHistoryEntry,
        clearSimulationHistory: vi.fn(),
      },
    } as never);

    render(<SimulationResultsPanel />);

    const combo = screen.getByRole("combobox");
    expect(combo).not.toBeNull();
    expect(screen.getByRole("option", { name: "simulation enregistrée" })).not.toBeNull();
    expect(screen.getByRole("option", { name: "2026_02_25_Alpha-3 semaines" })).not.toBeNull();
    expect(screen.queryByRole("option", { name: /Beta/i })).toBeNull();
    fireEvent.change(combo, { target: { value: "h1" } });
    expect(applyHistoryEntry).toHaveBeenCalledWith(entry);
  });

  it("shows plural label for two simulations", () => {
    const alpha1 = baseEntry("h1", "Alpha-Team");
    const alpha2 = { ...baseEntry("h3", "Alpha-Team"), createdAt: "2026-02-26T10:00:00.000Z" };

    vi.mocked(useSimulationContext).mockReturnValue({
      selectedTeam: "Alpha-Team",
      simulation: {
        loading: false,
        loadingStageMessage: "",
        includeZeroWeeks: true,
        sampleStats: null,
        result: null,
        displayPercentiles: {},
        simulationHistory: [alpha1, alpha2],
        applyHistoryEntry: vi.fn(),
        clearSimulationHistory: vi.fn(),
      },
    } as never);

    render(<SimulationResultsPanel />);
    expect(screen.getByRole("option", { name: "simulations enregistrées" })).not.toBeNull();
  });

  it("hides history frame when hideHistory is true", () => {
    vi.mocked(useSimulationContext).mockReturnValue({
      selectedTeam: "Alpha-Team",
      simulation: {
        loading: false,
        loadingStageMessage: "",
        includeZeroWeeks: true,
        sampleStats: null,
        result: null,
        displayPercentiles: {},
        simulationHistory: [baseEntry("h1", "Alpha-Team")],
        applyHistoryEntry: vi.fn(),
        clearSimulationHistory: vi.fn(),
      },
    } as never);

    render(<SimulationResultsPanel hideHistory />);
    expect(screen.queryByText("Historique local")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("renders loading, sample stats and weeks result label", () => {
    vi.mocked(useSimulationContext).mockReturnValue({
      selectedTeam: "Alpha-Team",
      simulation: {
        loading: true,
        loadingStageMessage: "Calcul en cours...",
        warning: "",
        includeZeroWeeks: false,
        sampleStats: { totalWeeks: 40, zeroWeeks: 14, usedWeeks: 26 },
        result: { result_kind: "weeks" },
        displayPercentiles: { P50: 5, P70: 8, P90: 12 },
        simulationHistory: [],
        applyHistoryEntry: vi.fn(),
        clearSimulationHistory: vi.fn(),
      },
    } as never);

    render(<SimulationResultsPanel />);
    expect(screen.getByText("Calcul en cours...")).not.toBeNull();
    expect(screen.getByText(/Semaines utilisees: 26\/40/i)).not.toBeNull();
    expect(screen.getByText(/5 sem/i)).not.toBeNull();
  });

  it("renders ADO partial data warning when present", () => {
    vi.mocked(useSimulationContext).mockReturnValue({
      selectedTeam: "Alpha-Team",
      simulation: {
        loading: false,
        loadingStageMessage: "",
        warning: "1/3 lot(s) de work items n'ont pas pu etre charges.",
        includeZeroWeeks: false,
        sampleStats: null,
        result: null,
        displayPercentiles: {},
        simulationHistory: [],
        applyHistoryEntry: vi.fn(),
        clearSimulationHistory: vi.fn(),
      },
    } as never);

    render(<SimulationResultsPanel />);
    expect(screen.getByText(/Avertissement:/i)).not.toBeNull();
    expect(screen.getByText(/1\/3 lot\(s\)/i)).not.toBeNull();
  });

  it("clears selection when selecting placeholder option and can clear history", () => {
    const clearSimulationHistory = vi.fn();
    const applyHistoryEntry = vi.fn();
    const entry = baseEntry("h1", "Alpha-Team");

    vi.mocked(useSimulationContext).mockReturnValue({
      selectedTeam: "Alpha-Team",
      simulation: {
        loading: false,
        loadingStageMessage: "",
        includeZeroWeeks: true,
        sampleStats: null,
        result: null,
        displayPercentiles: {},
        simulationHistory: [entry],
        applyHistoryEntry,
        clearSimulationHistory,
      },
    } as never);

    render(<SimulationResultsPanel />);
    const combo = screen.getByRole("combobox");
    fireEvent.change(combo, { target: { value: "h1" } });
    fireEvent.change(combo, { target: { value: "" } });

    expect(applyHistoryEntry).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: /vider/i }));
    expect(clearSimulationHistory).toHaveBeenCalledTimes(1);
  });

  it("renders items unit when result kind is items", () => {
    vi.mocked(useSimulationContext).mockReturnValue({
      selectedTeam: "Alpha-Team",
      simulation: {
        loading: false,
        loadingStageMessage: "",
        includeZeroWeeks: true,
        sampleStats: null,
        result: { result_kind: "items" },
        displayPercentiles: { P50: 38, P70: 44, P90: 52 },
        simulationHistory: [],
        applyHistoryEntry: vi.fn(),
        clearSimulationHistory: vi.fn(),
      },
    } as never);

    render(<SimulationResultsPanel />);
    expect(screen.getByText(/38 items/i)).not.toBeNull();
  });

  it("renders risk score indicator", () => {
    vi.mocked(useSimulationContext).mockReturnValue({
      selectedTeam: "Alpha-Team",
      simulation: {
        loading: false,
        loadingStageMessage: "",
        includeZeroWeeks: true,
        sampleStats: null,
        result: { result_kind: "weeks", risk_score: 0.01 },
        displayPercentiles: { P50: 50, P70: 60, P90: 71 },
        simulationHistory: [],
        applyHistoryEntry: vi.fn(),
        clearSimulationHistory: vi.fn(),
      },
    } as never);

    render(<SimulationResultsPanel />);
    expect(screen.getByText(/^Risk$/i)).not.toBeNull();
    expect(screen.getByText(/^0.42$/i)).not.toBeNull();
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("uses API risk_score when display percentiles are incomplete", () => {
    vi.mocked(useSimulationContext).mockReturnValue({
      selectedTeam: "Alpha-Team",
      simulation: {
        loading: false,
        loadingStageMessage: "",
        includeZeroWeeks: true,
        sampleStats: null,
        result: { result_kind: "weeks", risk_score: 0.42 },
        displayPercentiles: { P70: 10 },
        simulationHistory: [],
        applyHistoryEntry: vi.fn(),
        clearSimulationHistory: vi.fn(),
      },
    } as never);

    render(<SimulationResultsPanel />);
    expect(screen.getByText(/^0.42$/i)).not.toBeNull();
  });

  it("falls back to computed risk score when percentiles are incomplete and API score is missing", () => {
    vi.mocked(useSimulationContext).mockReturnValue({
      selectedTeam: "Alpha-Team",
      simulation: {
        loading: false,
        loadingStageMessage: "",
        includeZeroWeeks: true,
        sampleStats: null,
        result: { result_kind: "weeks" },
        displayPercentiles: { P70: 10 },
        simulationHistory: [],
        applyHistoryEntry: vi.fn(),
        clearSimulationHistory: vi.fn(),
      },
    } as never);

    render(<SimulationResultsPanel />);
    expect(screen.getByText(/^0.00$/i)).not.toBeNull();
  });

  it("formats history option labels for both simulation modes", () => {
    const backlogEntry = {
      ...baseEntry("h1", "Alpha-Team"),
      simulationMode: "backlog_to_weeks" as const,
      backlogSize: 12,
      createdAt: "2026-02-26T10:00:00.000Z",
    };
    const weeksEntry = {
      ...baseEntry("h2", "Alpha-Team"),
      simulationMode: "weeks_to_items" as const,
      targetWeeks: 1,
      createdAt: "2026-02-27T10:00:00.000Z",
    };

    vi.mocked(useSimulationContext).mockReturnValue({
      selectedTeam: "Alpha-Team",
      simulation: {
        loading: false,
        loadingStageMessage: "",
        includeZeroWeeks: true,
        sampleStats: null,
        result: null,
        displayPercentiles: {},
        simulationHistory: [backlogEntry, weeksEntry],
        applyHistoryEntry: vi.fn(),
        clearSimulationHistory: vi.fn(),
      },
    } as never);

    render(<SimulationResultsPanel />);
    expect(screen.getByRole("option", { name: "2026_02_26_Alpha-12 items" })).not.toBeNull();
    expect(screen.getByRole("option", { name: "2026_02_27_Alpha-1 semaine" })).not.toBeNull();
  });

  it("ignores unknown history ids", () => {
    const applyHistoryEntry = vi.fn();
    vi.mocked(useSimulationContext).mockReturnValue({
      selectedTeam: "Alpha-Team",
      simulation: {
        loading: false,
        loadingStageMessage: "",
        includeZeroWeeks: true,
        sampleStats: null,
        result: null,
        displayPercentiles: {},
        simulationHistory: [baseEntry("h1", "Alpha-Team")],
        applyHistoryEntry,
        clearSimulationHistory: vi.fn(),
      },
    } as never);

    render(<SimulationResultsPanel />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "unknown-id" } });
    expect(applyHistoryEntry).not.toHaveBeenCalled();
  });
});
