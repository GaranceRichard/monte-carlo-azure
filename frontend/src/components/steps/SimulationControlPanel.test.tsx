import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SimulationControlPanel from "./SimulationControlPanel";
import { useSimulationContext } from "../../hooks/SimulationContext";

vi.mock("../../hooks/SimulationContext", () => ({
  useSimulationContext: vi.fn(),
}));

vi.mock("./SimulationFilterControls", () => ({ default: () => <div>Filters Content</div> }));
vi.mock("./SimulationHistoryRangeControls", () => ({ default: () => <div>Period Content</div> }));
vi.mock("./SimulationModeAndParametersControls", () => ({ default: () => <div>Mode Content</div> }));

function setContext({
  hasLaunchedOnce,
  types = ["Bug"],
  doneStates = ["Done"],
  loading = false,
  selectedTeam = "Equipe A",
  runForecast = vi.fn(async () => {}),
  resetForTeamSelection = vi.fn(),
  resetSimulationResults = vi.fn(),
}: {
  hasLaunchedOnce: boolean;
  types?: string[];
  doneStates?: string[];
  loading?: boolean;
  selectedTeam?: string;
  runForecast?: ReturnType<typeof vi.fn>;
  resetForTeamSelection?: ReturnType<typeof vi.fn>;
  resetSimulationResults?: ReturnType<typeof vi.fn>;
}): ReturnType<typeof vi.fn> {
  vi.mocked(useSimulationContext).mockReturnValue({
    selectedTeam,
    simulation: {
      loading,
      hasLaunchedOnce,
      runForecast,
      resetForTeamSelection,
      resetSimulationResults,
      types,
      doneStates,
      startDate: "2026-01-01",
      endDate: "2026-02-01",
      simulationMode: "backlog_to_weeks",
      backlogSize: 100,
      targetWeeks: 12,
      includeZeroWeeks: true,
      nSims: 20000,
    },
  } as never);
  return runForecast;
}

describe("SimulationControlPanel launch button visibility", () => {
  it("shows launch button before first run", () => {
    setContext({ hasLaunchedOnce: false });
    render(<SimulationControlPanel />);
    expect(screen.getByRole("button", { name: /lancer la simulation/i })).not.toBeNull();
  });

  it("hides launch button after a simulation has been launched or loaded", () => {
    setContext({ hasLaunchedOnce: true });
    render(<SimulationControlPanel />);
    expect(screen.queryByRole("button", { name: /lancer la simulation/i })).toBeNull();
  });

  it("shows validation error and does not run when required filters are missing", () => {
    const runForecast = setContext({ hasLaunchedOnce: false, types: [], doneStates: [] });
    render(<SimulationControlPanel />);

    fireEvent.click(screen.getByRole("button", { name: /lancer la simulation/i }));

    expect(screen.getByText("Ticket et Etat obligatoires.")).not.toBeNull();
    expect(runForecast).not.toHaveBeenCalled();
  });

  it("runs forecast when filters are valid", async () => {
    const runForecast = setContext({ hasLaunchedOnce: false });
    render(<SimulationControlPanel />);

    fireEvent.click(screen.getByRole("button", { name: /lancer la simulation/i }));

    expect(runForecast).toHaveBeenCalledTimes(1);
  });

  it("toggles sections and hides summary when expanded", () => {
    setContext({ hasLaunchedOnce: false });
    const onExpansionChange = vi.fn();

    render(<SimulationControlPanel onExpansionChange={onExpansionChange} />);

    const filtersSection = screen.getByRole("heading", { name: /filtres de tickets/i }).closest("section");
    expect(filtersSection).not.toBeNull();
    if (!filtersSection) return;

    expect(within(filtersSection).getByText(/type bug ; etats done/i)).not.toBeNull();
    fireEvent.click(within(filtersSection).getByRole("button", { name: /developper/i }));

    expect(within(filtersSection).queryByText(/type bug ; etats done/i)).toBeNull();
    expect(within(filtersSection).getByText("Filters Content")).not.toBeNull();
    expect(onExpansionChange).toHaveBeenLastCalledWith(true);

    fireEvent.click(within(filtersSection).getByRole("button", { name: /reduire/i }));
    expect(onExpansionChange).toHaveBeenLastCalledWith(false);
  });

  it("opens period then mode section with exclusive content", () => {
    setContext({ hasLaunchedOnce: false });
    render(<SimulationControlPanel />);

    const periodSection = screen.getByRole("heading", { name: /periode historique/i }).closest("section");
    const modeSection = screen.getByRole("heading", { name: /mode de simulation/i }).closest("section");
    expect(periodSection).not.toBeNull();
    expect(modeSection).not.toBeNull();
    if (!periodSection || !modeSection) return;

    fireEvent.click(within(periodSection).getByRole("button", { name: /developper/i }));
    expect(within(periodSection).getByText("Period Content")).not.toBeNull();

    fireEvent.click(within(modeSection).getByRole("button", { name: /developper/i }));
    expect(within(modeSection).getByText("Mode Content")).not.toBeNull();
    expect(within(periodSection).queryByText("Period Content")).toBeNull();
  });

  it("resets simulation when opening ticket filters after a launched simulation", () => {
    const resetSimulationResults = vi.fn();
    vi.mocked(useSimulationContext).mockReturnValue({
      selectedTeam: "Equipe A",
      simulation: {
        loading: false,
        hasLaunchedOnce: true,
        runForecast: vi.fn(async () => {}),
        resetForTeamSelection: vi.fn(),
        resetSimulationResults,
        types: ["Bug"],
        doneStates: ["Done"],
        startDate: "2026-01-01",
        endDate: "2026-02-01",
        simulationMode: "backlog_to_weeks",
        backlogSize: 100,
        targetWeeks: 12,
        includeZeroWeeks: true,
        nSims: 20000,
      },
    } as never);

    render(<SimulationControlPanel />);
    const filtersSection = screen.getByRole("heading", { name: /filtres de tickets/i }).closest("section");
    expect(filtersSection).not.toBeNull();
    if (!filtersSection) return;

    fireEvent.click(within(filtersSection).getByRole("button", { name: /developper/i }));
    expect(resetSimulationResults).toHaveBeenCalledTimes(1);
  });

  it("clears validation message when filters become valid after an error", () => {
    const runForecast = vi.fn(async () => {});
    const contextValue = {
      selectedTeam: "Equipe A",
      simulation: {
        loading: false,
        hasLaunchedOnce: false,
        runForecast,
        types: [],
        doneStates: [],
        startDate: "2026-01-01",
        endDate: "2026-02-01",
        simulationMode: "backlog_to_weeks",
        backlogSize: 100,
        targetWeeks: 12,
        includeZeroWeeks: true,
        nSims: 20000,
      },
    };
    vi.mocked(useSimulationContext).mockImplementation(() => contextValue as never);

    const { rerender } = render(<SimulationControlPanel />);
    fireEvent.click(screen.getByRole("button", { name: /lancer la simulation/i }));
    expect(screen.getByText("Ticket et Etat obligatoires.")).not.toBeNull();

    contextValue.simulation.types = ["Bug"];
    contextValue.simulation.doneStates = ["Done"];
    rerender(<SimulationControlPanel />);

    expect(screen.queryByText("Ticket et Etat obligatoires.")).toBeNull();
    expect(runForecast).not.toHaveBeenCalled();
  });
});
