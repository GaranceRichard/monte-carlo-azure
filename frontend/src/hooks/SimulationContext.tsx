import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { SimulationViewModel } from "./useSimulation";

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
  const ctx = useContext(SimulationContext);
  if (!ctx) {
    throw new Error("useSimulationContext must be used within a SimulationProvider.");
  }
  return ctx;
}
