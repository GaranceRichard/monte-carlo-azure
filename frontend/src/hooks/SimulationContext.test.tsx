import { render, renderHook, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { SimulationProvider, useSimulationContext } from "./SimulationContext";

describe("SimulationContext", () => {
  it("throws when hook is used outside provider", () => {
    expect(() => renderHook(() => useSimulationContext())).toThrow(
      "useSimulationContext must be used within a SimulationProvider.",
    );
  });

  it("returns provider value when used inside SimulationProvider", () => {
    const simulation = { id: "sim-1" } as never;
    const wrapper = ({ children }: { children: ReactNode }) => (
      <SimulationProvider
        value={{
          selectedTeam: "Equipe A",
          simulation,
        }}
      >
        {children}
      </SimulationProvider>
    );

    const { result } = renderHook(() => useSimulationContext(), { wrapper });
    expect(result.current.selectedTeam).toBe("Equipe A");
    expect(result.current.simulation).toBe(simulation);
  });

  it("renders children inside SimulationProvider", () => {
    render(
      <SimulationProvider
        value={{
          selectedTeam: "Equipe B",
          simulation: { id: "sim-2" } as never,
        }}
      >
        <div>Contenu du provider</div>
      </SimulationProvider>,
    );

    expect(screen.getByText("Contenu du provider")).toBeTruthy();
  });
});
