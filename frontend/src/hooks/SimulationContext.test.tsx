import { renderHook } from "@testing-library/react";
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
    const wrapper = ({ children }: { children: ReactNode }) => (
      <SimulationProvider
        value={{
          selectedTeam: "Equipe A",
          simulation: {} as never,
        }}
      >
        {children}
      </SimulationProvider>
    );

    const { result } = renderHook(() => useSimulationContext(), { wrapper });
    expect(result.current.selectedTeam).toBe("Equipe A");
  });
});
