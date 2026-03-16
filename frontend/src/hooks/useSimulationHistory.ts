import { useEffect, useState } from "react";
import { getSimulationHistory, type SimulationHistoryItem } from "../api";
import { storageGetItem, storageRemoveItem, storageSetItem } from "../storage";
import type { SimulationHistoryEntry } from "./simulationTypes";
import { computeRiskScoreFromPercentiles } from "../utils/simulation";

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

function mapRemoteHistoryItem(item: SimulationHistoryItem, index: number): SimulationHistoryEntry {
  return {
    id: `remote-${item.created_at}-${index}`,
    createdAt: item.created_at,
    selectedOrg: item.selected_org ?? "",
    selectedProject: item.selected_project ?? "",
    selectedTeam: item.selected_team ?? "",
    startDate: item.start_date ?? "",
    endDate: item.end_date ?? "",
    simulationMode: item.mode,
    includeZeroWeeks: Boolean(item.include_zero_weeks),
    backlogSize: Number(item.backlog_size ?? 0),
    targetWeeks: Number(item.target_weeks ?? 0),
    nSims: Number(item.n_sims ?? 20000),
    types: item.types ?? [],
    doneStates: item.done_states ?? [],
    sampleStats: {
      totalWeeks: Number(item.samples_count ?? 0),
      zeroWeeks: 0,
      usedWeeks: Number(item.samples_count ?? 0),
    },
    weeklyThroughput: [],
    result: {
      result_kind: item.mode === "backlog_to_weeks" ? "weeks" : "items",
      samples_count: Number(item.samples_count ?? 0),
      result_percentiles: item.percentiles ?? {},
      risk_score: computeRiskScoreFromPercentiles(item.mode, item.percentiles ?? {}),
      result_distribution: item.distribution ?? [],
      throughput_reliability: item.throughput_reliability,
    },
  };
}

export function useSimulationHistory({ demoMode = false }: { demoMode?: boolean } = {}) {
  const storageKey = demoMode ? DEMO_SIM_HISTORY_KEY : SIM_HISTORY_KEY;
  const [simulationHistory, setSimulationHistory] = useState<SimulationHistoryEntry[]>(() => readSimulationHistory(storageKey));

  useEffect(() => {
    if (demoMode) return;
    let active = true;
    (async () => {
      try {
        const remote = await getSimulationHistory();
        if (!active || !remote.length) return;
        setSimulationHistory((prev) => {
          if (prev.length > 0) return prev;
          return remote.slice(0, MAX_SIM_HISTORY).map(mapRemoteHistoryItem);
        });
      } catch {
        // local history remains the fallback when backend history is unavailable.
      }
    })();
    return () => {
      active = false;
    };
  }, [demoMode]);

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
