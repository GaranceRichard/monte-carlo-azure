import { fireEvent, render, screen, within } from "@testing-library/react";
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
      types: ["Bug"],
      doneStates: ["Done"],
      sampleStats: { totalWeeks: 8, zeroWeeks: 1, usedWeeks: 7 },
      weeklyThroughput: [],
      seed: 123456,
      result: {
        result_kind: "items" as const,
        samples_count: 10,
        seed: 123456,
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
        result: { result_kind: "weeks", seed: 1 },
        displayPercentiles: { P50: 5, P70: 8, P90: 12 },
        simulationHistory: [],
        applyHistoryEntry: vi.fn(),
        clearSimulationHistory: vi.fn(),
      },
    } as never);

    render(<SimulationResultsPanel />);
    expect(screen.getByText("Calcul en cours...")).not.toBeNull();
    const loadingStatus = screen.getByRole("status");
    expect(loadingStatus.getAttribute("aria-live")).toBe("polite");
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
        result: { result_kind: "items", seed: 2 },
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
        throughputData: [],
        result: {
          result_kind: "weeks",
          seed: 3,
          risk_score: 0.01,
          throughput_reliability: { cv: 0.42, iqr_ratio: 0.3, slope_norm: -0.02, label: "incertain", samples_count: 10 },
        },
        displayPercentiles: { P50: 50, P70: 60, P90: 71 },
        simulationHistory: [],
        applyHistoryEntry: vi.fn(),
        clearSimulationHistory: vi.fn(),
      },
    } as never);

    render(<SimulationResultsPanel />);
    expect(screen.getByText(/^Risque \/ Fiabilite$/i)).not.toBeNull();
    expect(screen.getByText(/^0,42 \/ 0,42$/i)).not.toBeNull();
    expect(screen.getByText(/^R : incertain$/i)).not.toBeNull();
    expect(screen.getByText(/^F : incertain$/i)).not.toBeNull();
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("hides the risk indicator when display percentiles are incomplete", () => {
    vi.mocked(useSimulationContext).mockReturnValue({
      selectedTeam: "Alpha-Team",
      simulation: {
        loading: false,
        loadingStageMessage: "",
        includeZeroWeeks: true,
        sampleStats: null,
        throughputData: [],
        result: { result_kind: "weeks", seed: 4, risk_score: 0.42 },
        displayPercentiles: { P70: 10 },
        simulationHistory: [],
        applyHistoryEntry: vi.fn(),
        clearSimulationHistory: vi.fn(),
      },
    } as never);

    render(<SimulationResultsPanel />);
    expect(screen.queryByText(/^Risque \/ Fiabilite$/i)).toBeNull();
  });

  it("recomputes a non-zero weeks_to_items risk score from display percentiles when API score is stale", () => {
    vi.mocked(useSimulationContext).mockReturnValue({
      selectedTeam: "Alpha-Team",
      simulation: {
        loading: false,
        loadingStageMessage: "",
        includeZeroWeeks: true,
        sampleStats: null,
        throughputData: [],
        simulationMode: "weeks_to_items",
        result: {
          result_kind: "items",
          seed: 5,
          risk_score: 0,
          throughput_reliability: { cv: 0.42, iqr_ratio: 0.3, slope_norm: -0.02, label: "incertain", samples_count: 10 },
        },
        displayPercentiles: { P50: 24, P70: 22, P90: 18 },
        simulationHistory: [],
        applyHistoryEntry: vi.fn(),
        clearSimulationHistory: vi.fn(),
      },
    } as never);

    render(<SimulationResultsPanel />);
    expect(screen.getByText(/^0,25 \/ 0,42$/i)).not.toBeNull();
  });

  it("falls back to computed risk score when percentiles are incomplete and API score is missing", () => {
    vi.mocked(useSimulationContext).mockReturnValue({
      selectedTeam: "Alpha-Team",
      simulation: {
        loading: false,
        loadingStageMessage: "",
        includeZeroWeeks: true,
        sampleStats: null,
        throughputData: [],
        result: { result_kind: "weeks", seed: 6 },
        displayPercentiles: { P70: 10 },
        simulationHistory: [],
        applyHistoryEntry: vi.fn(),
        clearSimulationHistory: vi.fn(),
      },
    } as never);

    render(<SimulationResultsPanel />);
    expect(screen.queryByText(/^Risque \/ Fiabilite$/i)).toBeNull();
  });

  it("falls back to frontend reliability computation when API reliability is missing", () => {
    vi.mocked(useSimulationContext).mockReturnValue({
      selectedTeam: "Alpha-Team",
      simulation: {
        loading: false,
        loadingStageMessage: "",
        includeZeroWeeks: true,
        sampleStats: null,
        throughputData: [
          { week: "2026-01-01", throughput: 10 },
          { week: "2026-01-08", throughput: 9 },
          { week: "2026-01-15", throughput: 10 },
          { week: "2026-01-22", throughput: 11 },
          { week: "2026-01-29", throughput: 10 },
          { week: "2026-02-05", throughput: 9 },
          { week: "2026-02-12", throughput: 10 },
          { week: "2026-02-19", throughput: 10 },
        ],
        result: { result_kind: "weeks", seed: 7, risk_score: 0.2 },
        displayPercentiles: { P50: 10, P70: 12, P90: 14 },
        simulationHistory: [],
        applyHistoryEntry: vi.fn(),
        clearSimulationHistory: vi.fn(),
      },
    } as never);

    render(<SimulationResultsPanel />);
    expect(screen.getByText(/^Risque \/ Fiabilite$/i)).not.toBeNull();
    expect(screen.getByText(/^0,40 \/ 0,06$/i)).not.toBeNull();
    expect(screen.getByText(/^R : incertain$/i)).not.toBeNull();
    expect(screen.getByText(/^F : fiable$/i)).not.toBeNull();
  });

  it("renders an explicit notice when history is too volatile for a reliable projection", () => {
    vi.mocked(useSimulationContext).mockReturnValue({
      selectedTeam: "Alpha-Team",
      simulation: {
        loading: false,
        loadingStageMessage: "",
        includeZeroWeeks: true,
        sampleStats: null,
        throughputData: [],
        result: {
          result_kind: "weeks",
          seed: 8,
          risk_score: 0.9,
          throughput_reliability: { cv: 1.2, iqr_ratio: 1.1, slope_norm: 0.01, label: "fragile", samples_count: 12 },
        },
        displayPercentiles: { P50: 10, P70: 14, P90: 20 },
        simulationHistory: [],
        applyHistoryEntry: vi.fn(),
        clearSimulationHistory: vi.fn(),
      },
    } as never);

    render(<SimulationResultsPanel />);
    expect(screen.getByText(/Projection a cadrer:/i)).not.toBeNull();
    expect(screen.getByText(/Historique trop volatil pour fonder une projection fiable/i)).not.toBeNull();
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

  it("falls back to 'Equipe' when the team prefix contains no letters", () => {
    const entry = {
      ...baseEntry("h1", "--- 123 ---"),
      simulationMode: "backlog_to_weeks" as const,
      backlogSize: 8,
    };

    vi.mocked(useSimulationContext).mockReturnValue({
      selectedTeam: "--- 123 ---",
      simulation: {
        loading: false,
        loadingStageMessage: "",
        includeZeroWeeks: true,
        sampleStats: null,
        result: null,
        displayPercentiles: {},
        simulationHistory: [entry],
        applyHistoryEntry: vi.fn(),
        clearSimulationHistory: vi.fn(),
      },
    } as never);

    render(<SimulationResultsPanel />);
    expect(screen.getByRole("option", { name: "2026_02_25_Equipe-8 items" })).not.toBeNull();
  });

  it("does not render the risk indicator when there is no simulation result", () => {
    vi.mocked(useSimulationContext).mockReturnValue({
      selectedTeam: "Alpha-Team",
      simulation: {
        loading: false,
        loadingStageMessage: "",
        includeZeroWeeks: true,
        sampleStats: null,
        throughputData: [],
        result: null,
        displayPercentiles: { P50: 10, P90: 12 },
        simulationHistory: [],
        applyHistoryEntry: vi.fn(),
        clearSimulationHistory: vi.fn(),
      },
    } as never);

    render(<SimulationResultsPanel />);
    expect(screen.queryByText(/^Risque \/ Fiabilite$/i)).toBeNull();
    expect(screen.queryByRole("heading", { name: /Diagnostic décisionnel/i })).toBeNull();
  });

  it("shows a compact decision summary and keeps the long diagnostic out of the page", () => {
    vi.mocked(useSimulationContext).mockReturnValue({
      selectedTeam: "Alpha-Team",
      simulation: {
        loading: false,
        loadingStageMessage: "",
        warning: "",
        includeZeroWeeks: true,
        sampleStats: null,
        throughputData: [10, 11, 9, 10, 10, 11, 9, 10].map((throughput, index) => ({ week: `2026-01-${index + 1}`, throughput })),
        result: {
          result_kind: "weeks",
          seed: 10,
          risk_score: 0.1,
          throughput_reliability: { cv: 0.1, iqr_ratio: 0.1, slope_norm: 0.01, label: "fiable", samples_count: 8 },
        },
        displayPercentiles: { P50: 10, P70: 10.5, P90: 11 },
        simulationHistory: [],
        applyHistoryEntry: vi.fn(),
        clearSimulationHistory: vi.fn(),
      },
    } as never);

    render(<SimulationResultsPanel />);

    expect(screen.getByText(/Décision appuyée par les données/i)).not.toBeNull();
    expect(screen.getByRole("button", { name: /Voir le diagnostic décisionnel/i })).not.toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("heading", { name: /Décision recommandée/i })).toBeNull();
    expect(screen.queryByText(/Semaines historiques exploitables : 8/i)).toBeNull();
  });

  it("closes the diagnostic modal as soon as the displayed result is invalidated", () => {
    const contextValue: { selectedTeam: string; simulation: Record<string, unknown> } = {
      selectedTeam: "Alpha-Team",
      simulation: {
        loading: false,
        loadingStageMessage: "",
        notice: "",
        warning: "",
        includeZeroWeeks: true,
        sampleStats: null,
        throughputData: [10, 11, 9, 10, 10, 11, 9, 10].map((throughput, index) => ({
          week: `2026-01-${index + 1}`,
          throughput,
        })),
        result: { result_kind: "weeks", seed: 16 },
        displayPercentiles: { P50: 10, P70: 11, P90: 12 },
        simulationHistory: [],
        applyHistoryEntry: vi.fn(),
        clearSimulationHistory: vi.fn(),
      },
    };
    vi.mocked(useSimulationContext).mockImplementation(() => contextValue as never);
    const { rerender } = render(<SimulationResultsPanel />);
    fireEvent.click(screen.getByRole("button", { name: /Voir le diagnostic décisionnel/i }));
    expect(screen.getByRole("dialog")).not.toBeNull();

    contextValue.simulation = {
      ...contextValue.simulation,
      result: null,
      throughputData: [],
      displayPercentiles: {},
    };
    rerender(<SimulationResultsPanel />);

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("heading", { name: /Diagnostic décisionnel/i })).toBeNull();
  });

  it("announces a locally reloaded simulation without presenting a calculation", () => {
    vi.mocked(useSimulationContext).mockReturnValue({
      selectedTeam: "Alpha-Team",
      simulation: {
        loading: false,
        loadingStageMessage: "",
        notice: "Simulation existante rechargée",
        includeZeroWeeks: true,
        sampleStats: null,
        result: null,
        displayPercentiles: {},
        simulationHistory: [],
        applyHistoryEntry: vi.fn(),
        clearSimulationHistory: vi.fn(),
      },
    } as never);

    render(<SimulationResultsPanel />);
    expect(screen.getByRole("status")).toHaveTextContent("Simulation existante rechargée");
    expect(screen.queryByText(/Calcul/i)).toBeNull();
  });

  it("shows a caution diagnostic with the relevant factors and action", () => {
    vi.mocked(useSimulationContext).mockReturnValue({
      selectedTeam: "Alpha-Team",
      simulation: {
        loading: false,
        loadingStageMessage: "",
        warning: "Collecte Azure DevOps partielle.",
        includeZeroWeeks: true,
        sampleStats: null,
        throughputData: [1, 2, 3, 4, 5, 6].map((throughput, index) => ({ week: `2026-02-${index + 1}`, throughput })),
        result: {
          result_kind: "weeks",
          seed: 11,
          risk_score: 0.1,
          throughput_reliability: { cv: 0.1, iqr_ratio: 0.1, slope_norm: 0.01, label: "fiable", samples_count: 6 },
        },
        displayPercentiles: { P50: 10, P70: 12, P90: 14 },
        simulationHistory: [],
        applyHistoryEntry: vi.fn(),
        clearSimulationHistory: vi.fn(),
      },
    } as never);

    render(<SimulationResultsPanel />);

    expect(screen.getByText(/Décision possible avec prudence/i)).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Voir le diagnostic décisionnel/i }));
    const whySection = screen.getByRole("heading", { name: "Pourquoi ?" }).closest("section");
    expect(whySection).not.toBeNull();
    expect(within(whySection as HTMLElement).getByText(/Collecte Azure DevOps partielle : Collecte Azure DevOps partielle/i)).not.toBeNull();
    expect(within(whySection as HTMLElement).getByText(/Semaines historiques exploitables : 6/i)).not.toBeNull();
    expect(screen.getByText(/Compléter les données Azure DevOps et observer quelques semaines supplémentaires avant un engagement difficilement réversible\./i)).not.toBeNull();
  });

  it("shows blocking diagnostics when data and required percentiles are missing", () => {
    vi.mocked(useSimulationContext).mockReturnValue({
      selectedTeam: "Alpha-Team",
      simulation: {
        loading: false,
        loadingStageMessage: "",
        warning: "",
        includeZeroWeeks: true,
        sampleStats: null,
        throughputData: [1, 2, 3, 4, 5].map((throughput, index) => ({ week: `2026-03-${index + 1}`, throughput })),
        result: { result_kind: "weeks", seed: 12 },
        displayPercentiles: { P50: 10 },
        simulationHistory: [],
        applyHistoryEntry: vi.fn(),
        clearSimulationHistory: vi.fn(),
      },
    } as never);

    render(<SimulationResultsPanel />);

    expect(screen.getByText(/Décision non recommandée/i)).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Voir le diagnostic décisionnel/i }));
    expect(screen.getByText(/Données insuffisantes/i)).not.toBeNull();
    expect(screen.getByText(/Incertitude impossible à mesurer/i)).not.toBeNull();
    expect(screen.getByText(/Percentiles requis non calculables : P70, P90/i)).not.toBeNull();
    expect(screen.getByText(/Compléter l'historique avant tout arbitrage\./i)).not.toBeNull();
  });

  it("shows arbitration when data quality and forecast uncertainty are both degraded", () => {
    vi.mocked(useSimulationContext).mockReturnValue({
      selectedTeam: "Alpha-Team",
      simulation: {
        loading: false,
        loadingStageMessage: "",
        warning: "",
        includeZeroWeeks: true,
        sampleStats: null,
        throughputData: [1, 2, 3, 4, 5, 6].map((throughput, index) => ({ week: `2026-04-${index + 1}`, throughput })),
        result: {
          result_kind: "weeks",
          seed: 13,
          risk_score: 0.8,
          throughput_reliability: { cv: 1, iqr_ratio: 1, slope_norm: 0.1, label: "fragile", samples_count: 6 },
        },
        displayPercentiles: { P50: 10, P70: 14, P90: 20 },
        simulationHistory: [],
        applyHistoryEntry: vi.fn(),
        clearSimulationHistory: vi.fn(),
      },
    } as never);

    render(<SimulationResultsPanel />);

    expect(screen.getByText(/Arbitrage nécessaire/i)).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Voir le diagnostic décisionnel/i }));
    expect(screen.getByText(/La dispersion ou la volatilité historique est élevée\./i)).not.toBeNull();
    expect(screen.getAllByText(/Semaines historiques exploitables : 6/i)).toHaveLength(2);
    expect(screen.getByText(/Planifier sur le P70, conserver le P90 comme marge de sécurité et vérifier la stabilité de la capacité sur quelques semaines supplémentaires\./i)).not.toBeNull();
  });

  it("compares local historical windows and exposes high sensitivity in the summary and dialog", () => {
    const longWindow = {
      ...baseEntry("long-window", "Alpha-Team"),
      startDate: "2025-12-01",
      endDate: "2026-04-30",
      targetWeeks: 3,
      types: ["Bug", "Story"],
      doneStates: ["Closed", "Done"],
      sampleStats: null,
      weeklyThroughput: Array.from({ length: 17 }, (_, index) => ({
        week: `2026-01-${String(index + 1).padStart(2, "0")}`,
        throughput: 8,
      })),
      result: {
        ...baseEntry("source", "Alpha-Team").result,
        result_percentiles: { P50: 10, P70: 11, P90: 12 },
      },
    };
    vi.mocked(useSimulationContext).mockReturnValue({
      selectedTeam: "Alpha-Team",
      simulation: {
        selectedOrg: "org-a",
        selectedProject: "Projet A",
        startDate: "2026-03-01",
        endDate: "2026-04-30",
        simulationMode: "weeks_to_items",
        includeZeroWeeks: true,
        backlogSize: 12,
        targetWeeks: 3,
        types: ["Story", "Bug"],
        doneStates: ["Done", "Closed"],
        loading: false,
        loadingStageMessage: "",
        warning: "",
        sampleStats: { totalWeeks: 9, zeroWeeks: 0, usedWeeks: 9 },
        throughputData: [8, 9, 10, 8, 9, 10, 8, 9, 10].map((throughput, index) => ({
          week: `2026-03-${index + 1}`,
          throughput,
        })),
        result: {
          result_kind: "items",
          seed: 15,
          throughput_reliability: { cv: 0.1, iqr_ratio: 0.1, slope_norm: 0.01, label: "fiable", samples_count: 9 },
        },
        displayPercentiles: { P50: 12, P70: 15, P90: 18 },
        simulationHistory: [longWindow],
        applyHistoryEntry: vi.fn(),
        clearSimulationHistory: vi.fn(),
      },
    } as never);

    render(<SimulationResultsPanel />);

    expect(screen.getByText(/Arbitrage nécessaire/i)).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Voir le diagnostic décisionnel/i }));
    const sensitivityHeading = screen.getByRole("heading", { name: /Sensibilité à la période historique/i });
    const sensitivitySection = sensitivityHeading.closest("section");
    expect(sensitivitySection).not.toBeNull();
    expect(screen.getByText("P90 période récente : 18 items — 9 semaines")).not.toBeNull();
    expect(screen.getByText("P90 période longue : 12 items — 17 semaines")).not.toBeNull();
    expect(screen.getByText("Écart : +50 %")).not.toBeNull();
    expect(within(sensitivitySection as HTMLElement).getByText(/scénario prudent/i)).not.toBeNull();
  });

  it("keeps incomplete legacy histories unchanged by hiding the diagnostic", () => {
    vi.mocked(useSimulationContext).mockReturnValue({
      selectedTeam: "Alpha-Team",
      simulation: {
        loading: false,
        loadingStageMessage: "",
        warning: "",
        includeZeroWeeks: true,
        sampleStats: null,
        throughputData: [],
        result: { result_kind: "weeks", seed: 14 },
        displayPercentiles: { P50: 10 },
        simulationHistory: [],
        applyHistoryEntry: vi.fn(),
        clearSimulationHistory: vi.fn(),
      },
    } as never);

    render(<SimulationResultsPanel />);
    expect(screen.getByText(/10 sem/i)).not.toBeNull();
    expect(screen.queryByRole("heading", { name: /Diagnostic décisionnel/i })).toBeNull();
  });

  it("explains censures and hides missing percentiles", () => {
    vi.mocked(useSimulationContext).mockReturnValue({
      selectedTeam: "Alpha-Team",
      simulation: {
        loading: false,
        loadingStageMessage: "",
        includeZeroWeeks: true,
        sampleStats: null,
        throughputData: [],
        result: {
          result_kind: "weeks",
          seed: 9,
          result_percentiles: { P50: 12 },
          result_distribution: [{ x: 12, count: 4 }],
          completion_summary: {
            completed_count: 4,
            censored_count: 6,
            censored_rate: 0.6,
            horizon_weeks: 521,
          },
        },
        displayPercentiles: { P50: 12 },
        simulationHistory: [],
        applyHistoryEntry: vi.fn(),
        clearSimulationHistory: vi.fn(),
      },
    } as never);

    render(<SimulationResultsPanel />);
    expect(screen.getByText(/Horizon de simulation: 521 semaines/i)).not.toBeNull();
    expect(screen.getByText(/6\/10 simulations n'ont pas termine/i)).not.toBeNull();
    expect(screen.getByText(/^P50$/i)).not.toBeNull();
    expect(screen.queryByText(/^P70$/i)).toBeNull();
    expect(screen.queryByText(/^P90$/i)).toBeNull();
    expect(screen.queryByText(/^Risque \/ Fiabilite$/i)).toBeNull();
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
