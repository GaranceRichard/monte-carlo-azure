import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useState } from "react";
import SimulationFilterControls from "./SimulationFilterControls";
import { SimulationProvider } from "../../hooks/SimulationContext";

function SimulationFilterHarness() {
  const [types, setTypes] = useState<string[]>([]);
  const [doneStates, setDoneStates] = useState<string[]>([]);
  const simulation = {
    hasQuickFilterConfig: true,
    applyQuickFilterConfig: () => {},
    loadingTeamOptions: false,
    workItemTypeOptions: ["Bug"],
    types,
    setTypes,
    filteredDoneStateOptions: ["Done"],
    doneStates,
    setDoneStates,
  };

  return (
    <SimulationProvider value={{ selectedTeam: "Equipe A", simulation: simulation as never }}>
      <SimulationFilterControls />
    </SimulationProvider>
  );
}

describe("SimulationFilterControls updater branches", () => {
  it("covers add/remove branches for types and done states", () => {
    render(<SimulationFilterHarness />);

    const typeCheckbox = screen.getAllByRole("checkbox")[0] as HTMLInputElement;
    const stateCheckbox = screen.getAllByRole("checkbox")[1] as HTMLInputElement;

    expect(typeCheckbox.checked).toBe(false);
    expect(stateCheckbox.disabled).toBe(true);

    fireEvent.click(typeCheckbox);
    expect(typeCheckbox.checked).toBe(true);
    expect(stateCheckbox.disabled).toBe(false);

    fireEvent.click(stateCheckbox);
    expect(stateCheckbox.checked).toBe(true);

    fireEvent.click(stateCheckbox);
    expect(stateCheckbox.checked).toBe(false);

    fireEvent.click(typeCheckbox);
    expect(typeCheckbox.checked).toBe(false);
  });
});
