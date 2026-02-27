import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SimulationFilterControls from "./SimulationFilterControls";
import { useSimulationContext } from "../../hooks/SimulationContext";

vi.mock("../../hooks/SimulationContext", () => ({
  useSimulationContext: vi.fn(),
}));

function setContext({
  hasQuickFilterConfig = true,
  loadingTeamOptions = false,
  applyQuickFilterConfig = vi.fn(),
  types = [],
  doneStates = [],
  setTypes = vi.fn(),
  setDoneStates = vi.fn(),
}: {
  hasQuickFilterConfig?: boolean;
  loadingTeamOptions?: boolean;
  applyQuickFilterConfig?: ReturnType<typeof vi.fn>;
  types?: string[];
  doneStates?: string[];
  setTypes?: ReturnType<typeof vi.fn>;
  setDoneStates?: ReturnType<typeof vi.fn>;
}) {
  vi.mocked(useSimulationContext).mockReturnValue({
    selectedTeam: "Equipe A",
    simulation: {
      hasQuickFilterConfig,
      applyQuickFilterConfig,
      loadingTeamOptions,
      workItemTypeOptions: ["Bug"],
      types,
      setTypes,
      filteredDoneStateOptions: ["Done"],
      doneStates,
      setDoneStates,
    },
  } as never);
  return { applyQuickFilterConfig, setTypes, setDoneStates };
}

describe("SimulationFilterControls quick configuration", () => {
  it("triggers the quick configuration action when available", () => {
    const { applyQuickFilterConfig } = setContext({});
    render(<SimulationFilterControls />);

    fireEvent.click(screen.getByRole("button", { name: /configuration rapide/i }));
    expect(applyQuickFilterConfig).toHaveBeenCalledTimes(1);
  });

  it("disables quick configuration button when no stored preset exists", () => {
    setContext({ hasQuickFilterConfig: false });
    render(<SimulationFilterControls />);

    expect((screen.getByRole("button", { name: /configuration rapide/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows loading and empty-state hints when team options are still loading", () => {
    setContext({ loadingTeamOptions: true, types: [] });
    render(<SimulationFilterControls />);

    expect(screen.getByText(/Chargement des types de tickets/i)).not.toBeNull();
    expect(screen.getByText("Chargement des états de résolution...")).not.toBeNull();
    expect(screen.getByText("Sélectionnez d'abord un ou plusieurs tickets.")).not.toBeNull();
  });
});
