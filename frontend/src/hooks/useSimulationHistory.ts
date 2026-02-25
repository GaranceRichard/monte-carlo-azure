import { useEffect, useState } from "react";
import type { SimulationHistoryEntry } from "./simulationTypes";

const SIM_HISTORY_KEY = "mc_simulation_history_v1";
const MAX_SIM_HISTORY = 10;

function readSimulationHistory(): SimulationHistoryEntry[] {
  try {
    const raw = localStorage.getItem(SIM_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry) => entry && typeof entry === "object");
  } catch {
    return [];
  }
}

export function useSimulationHistory() {
  const [simulationHistory, setSimulationHistory] = useState<SimulationHistoryEntry[]>(() => readSimulationHistory());

  useEffect(() => {
    try {
      localStorage.setItem(SIM_HISTORY_KEY, JSON.stringify(simulationHistory));
    } catch {
      // Best effort only.
    }
  }, [simulationHistory]);

  function pushSimulationHistory(entry: SimulationHistoryEntry): void {
    setSimulationHistory((prev) => [entry, ...prev].slice(0, MAX_SIM_HISTORY));
  }

  function clearSimulationHistory(): void {
    setSimulationHistory([]);
    try {
      localStorage.removeItem(SIM_HISTORY_KEY);
    } catch {
      // Ignore storage errors.
    }
  }

  return {
    simulationHistory,
    setSimulationHistory,
    pushSimulationHistory,
    clearSimulationHistory,
  };
}
