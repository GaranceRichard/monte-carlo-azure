import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SimulationHistoryRangeControls from "./SimulationHistoryRangeControls";
import { useSimulationContext } from "../../hooks/SimulationContext";

vi.mock("../../hooks/SimulationContext", () => ({
  useSimulationContext: vi.fn(),
}));

describe("SimulationHistoryRangeControls", () => {
  it("renders UTF-8 labels for date fields", () => {
    vi.mocked(useSimulationContext).mockReturnValue({
      simulation: {
        startDate: "2026-01-01",
        endDate: "2026-02-01",
        setStartDate: vi.fn(),
        setEndDate: vi.fn(),
      },
    } as never);

    render(<SimulationHistoryRangeControls />);

    expect(screen.getByText("Début historique")).not.toBeNull();
    expect(screen.getByText("Fin historique")).not.toBeNull();
    expect(screen.queryByText("D?but historique")).toBeNull();
    expect(screen.queryByText("F?n historique")).toBeNull();
  });
});
