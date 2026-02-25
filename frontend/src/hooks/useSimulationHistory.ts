import { useEffect, useState } from "react";
import { storageGetItem, storageRemoveItem, storageSetItem } from "../storage";
import type { SimulationHistoryEntry } from "./simulationTypes";

const SIM_HISTORY_KEY = "mc_simulation_history_v1";
const MAX_SIM_HISTORY = 10;

function readSimulationHistory(): SimulationHistoryEntry[] {
  const raw = storageGetItem(SIM_HISTORY_KEY);
  if (!raw) return [];
  try {
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
    storageSetItem(SIM_HISTORY_KEY, JSON.stringify(simulationHistory));
  }, [simulationHistory]);

  function pushSimulationHistory(entry: SimulationHistoryEntry): void {
    setSimulationHistory((prev) => [entry, ...prev].slice(0, MAX_SIM_HISTORY));
  }

  function clearSimulationHistory(): void {
    setSimulationHistory([]);
    storageRemoveItem(SIM_HISTORY_KEY);
  }

  return {
    simulationHistory,
    setSimulationHistory,
    pushSimulationHistory,
    clearSimulationHistory,
  };
}
