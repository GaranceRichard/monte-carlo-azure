import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SimulationStep from "./SimulationStep";

vi.mock("./SimulationControlPanel", () => ({
  default: () => <div>SimulationControlPanel</div>,
}));

vi.mock("./SimulationResultsPanel", () => ({
  default: () => <div>SimulationResultsPanel</div>,
}));

vi.mock("./SimulationChartTabs", () => ({
  default: () => <div>SimulationChartTabs</div>,
}));

describe("SimulationStep", () => {
  it("renders UTF-8 labels with accents on simulation header", () => {
    render(<SimulationStep selectedTeam="Équipe Démo" simulation={{ err: "" } as never} />);

    expect(screen.getByText("Équipe active")).not.toBeNull();
    expect(screen.getByTestId("selected-team-name")).toHaveTextContent("Équipe Démo");
    expect(screen.queryByText("Ã‰quipe active")).toBeNull();
  });
});
