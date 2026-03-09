import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SimulationProvider } from "../../hooks/SimulationContext";
import SimulationHistoryRangeControls from "./SimulationHistoryRangeControls";

function TestHarness({
  spies,
}: {
  spies: {
    setStartDate: ReturnType<typeof vi.fn>;
    setEndDate: ReturnType<typeof vi.fn>;
  };
}) {
  const [startDate, rawSetStartDate] = useState("2026-01-01");
  const [endDate, rawSetEndDate] = useState("2026-02-01");

  const simulation = {
    startDate,
    endDate,
    setStartDate: (value: string) => {
      spies.setStartDate(value);
      rawSetStartDate(value);
    },
    setEndDate: (value: string) => {
      spies.setEndDate(value);
      rawSetEndDate(value);
    },
  };

  return (
    <SimulationProvider value={{ selectedTeam: "Team A", simulation: simulation as never }}>
      <SimulationHistoryRangeControls />
    </SimulationProvider>
  );
}

describe("SimulationHistoryRangeControls", () => {
  it("renders labels and updates both date inputs", () => {
    const spies = {
      setStartDate: vi.fn(),
      setEndDate: vi.fn(),
    };

    const { container } = render(<TestHarness spies={spies} />);
    const dateInputs = container.querySelectorAll('input[type="date"]');

    if (dateInputs.length !== 2) {
      throw new Error("Expected date inputs were not rendered");
    }

    expect(screen.getByText("Début historique")).not.toBeNull();
    expect(screen.getByText("Fin historique")).not.toBeNull();

    fireEvent.change(dateInputs[0], { target: { value: "2026-01-15" } });
    fireEvent.change(dateInputs[1], { target: { value: "2026-02-15" } });

    expect(spies.setStartDate).toHaveBeenCalledWith("2026-01-15");
    expect(spies.setEndDate).toHaveBeenCalledWith("2026-02-15");
  });
});
