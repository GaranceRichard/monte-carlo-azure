import { useEffect, useState } from "react";
import { storageGetItem, storageRemoveItem, storageSetItem } from "../storage";
import {
  parseSimulationHistory,
  simulationHistoryModelToDto,
} from "../storage/simulationHistoryMappers";
import type { SimulationHistoryEntry } from "../domain/simulationHistory";

const SIM_HISTORY_KEY = "mc_simulation_history_v2";
const DEMO_SIM_HISTORY_KEY = "mc_demo_simulation_history_v1";
const MAX_SIM_HISTORY = 10;
export function useSimulationHistory({ demoMode = false }: { demoMode?: boolean } = {}) {
  const storageKey = demoMode ? DEMO_SIM_HISTORY_KEY : SIM_HISTORY_KEY;
  const [simulationHistory, setSimulationHistory] = useState<SimulationHistoryEntry[]>(
    () => parseSimulationHistory(storageGetItem(storageKey)),
  );

  useEffect(() => {
    storageSetItem(
      storageKey,
      JSON.stringify(simulationHistory.map(simulationHistoryModelToDto)),
    );
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
