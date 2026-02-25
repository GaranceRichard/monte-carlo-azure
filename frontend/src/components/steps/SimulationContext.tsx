import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { SimulationViewModel } from "../../hooks/useSimulation";

type SimulationContextValue = {
  selectedTeam: string;
  simulation: SimulationViewModel;
};

const SimulationContext = createContext<SimulationContextValue | null>(null);

type SimulationProviderProps = {
  value: SimulationContextValue;
  children: ReactNode;
};

export function SimulationProvider({ value, children }: SimulationProviderProps) {
  return <SimulationContext.Provider value={value}>{children}</SimulationContext.Provider>;
}

export function useSimulationContext(): SimulationContextValue {
  const context = useContext(SimulationContext);
  if (!context) {
    throw new Error("useSimulationContext must be used within a SimulationProvider.");
  }
  return context;
}
