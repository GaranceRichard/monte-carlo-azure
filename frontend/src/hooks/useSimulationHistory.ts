import { useEffect, useState } from "react";
import { storageGetItem, storageRemoveItem, storageSetItem } from "../storage";
import type { SimulationHistoryEntry } from "./simulationTypes";

const SIM_HISTORY_KEY = "mc_simulation_history_v2";
const DEMO_SIM_HISTORY_KEY = "mc_demo_simulation_history_v1";
const MAX_SIM_HISTORY = 10;

function readSimulationHistory(storageKey: string): SimulationHistoryEntry[] {
  const raw = storageGetItem(storageKey);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry) => entry && typeof entry === "object");
  } catch {
    return [];
  }
}

export function useSimulationHistory({ demoMode = false }: { demoMode?: boolean } = {}) {
  const storageKey = demoMode ? DEMO_SIM_HISTORY_KEY : SIM_HISTORY_KEY;
  const [simulationHistory, setSimulationHistory] = useState<SimulationHistoryEntry[]>(() => readSimulationHistory(storageKey));

  useEffect(() => {
    storageSetItem(storageKey, JSON.stringify(simulationHistory));
  }, [simulationHistory, storageKey]);

  function pushSimulationHistory(entry: SimulationHistoryEntry): void {
    setSimulationHistory((prev) => [entry, ...prev].slice(0, MAX_SIM_HISTORY));
  }

  function clearSimulationHistory(): void {
    setSimulationHistory([]);
    storageRemoveItem(storageKey);
  }

  return {
    simulationHistory,
    setSimulationHistory,
    pushSimulationHistory,
    clearSimulationHistory,
  };
}
