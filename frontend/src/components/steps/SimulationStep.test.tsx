import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SimulationStep from "./SimulationStep";

const controlPanelMock = vi.fn();

vi.mock("./SimulationControlPanel", () => ({
  default: ({ onExpansionChange }: { onExpansionChange: (expanded: boolean) => void }) => {
    controlPanelMock(onExpansionChange);
    return (
      <div>
        <button type="button" onClick={() => onExpansionChange(true)}>
          Expand controls
        </button>
        <button type="button" onClick={() => onExpansionChange(false)}>
          Collapse controls
        </button>
      </div>
    );
  },
}));

vi.mock("./SimulationResultsPanel", () => ({
  default: () => <div>SimulationResultsPanel</div>,
}));

vi.mock("./SimulationChartTabs", () => ({
  default: () => <div>SimulationChartTabs</div>,
}));

describe("SimulationStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the active team card and visible results by default", () => {
    render(<SimulationStep selectedTeam={"\u00C9quipe D\u00E9mo"} simulation={{ err: "" } as never} />);

    expect(screen.getByText("\u00C9quipe active")).not.toBeNull();
    expect(screen.getByTestId("selected-team-name").textContent).toBe("\u00C9quipe D\u00E9mo");
    expect(screen.queryByText("Erreur:")).toBeNull();
    expect(screen.getByText("SimulationResultsPanel")).not.toBeNull();
    expect(controlPanelMock).toHaveBeenCalled();
  });

  it("renders the error banner when simulation.err is provided", () => {
    render(<SimulationStep selectedTeam="Team A" simulation={{ err: "Erreur simulation temporaire" } as never} />);

    expect(screen.getByText("Erreur:")).not.toBeNull();
    expect(screen.getByText("Erreur simulation temporaire")).not.toBeNull();
  });

  it("hides and shows the results panel when the control panel expands and collapses", () => {
    render(<SimulationStep selectedTeam="Team A" simulation={{ err: "" } as never} />);

    expect(screen.getByText("SimulationResultsPanel")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Expand controls" }));
    expect(screen.queryByText("SimulationResultsPanel")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Collapse controls" }));
    expect(screen.getByText("SimulationResultsPanel")).not.toBeNull();
  });
});
