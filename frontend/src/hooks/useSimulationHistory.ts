import { useEffect, useState } from "react";
import { storageGetItem, storageRemoveItem, storageSetItem } from "../storage";
import type { SimulationHistoryEntry } from "./simulationTypes";

const SIM_HISTORY_KEY = "mc_simulation_history_v2";
const DEMO_SIM_HISTORY_KEY = "mc_demo_simulation_history_v1";
const MAX_SIM_HISTORY = 10;
const CURRENT_SIM_HISTORY_SCHEMA_VERSION = 2;

type LegacyCycleTimePoint = {
  week?: unknown;
  cycleTime?: unknown;
  cycleTimeDays?: unknown;
  count?: unknown;
};

type LegacySimulationHistoryEntry = Omit<Partial<SimulationHistoryEntry>, "schemaVersion" | "cycleTimeDaysData"> & {
  schemaVersion?: unknown;
  cycleTimeData?: unknown;
  cycleTimeDaysData?: unknown;
};

function toFiniteNumber(value: unknown, fallback = 0): number {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function normalizeCycleTimeDaysData(value: unknown, schemaVersion?: unknown): SimulationHistoryEntry["cycleTimeDaysData"] {
  if (!Array.isArray(value)) return [];
  const shouldMigrateWeeksToDays = schemaVersion == null;

  return value
    .filter((point): point is LegacyCycleTimePoint => Boolean(point && typeof point === "object"))
    .map((point) => {
      const week = String(point.week ?? "").slice(0, 10);
      const legacyCycleTimeDays = toFiniteNumber(point.cycleTimeDays, Number.NaN);
      const legacyCycleTimeWeeks = toFiniteNumber(point.cycleTime, Number.NaN);
      const baseCycleTimeDays = Number.isFinite(legacyCycleTimeDays)
        ? legacyCycleTimeDays
        : Number.isFinite(legacyCycleTimeWeeks)
          ? legacyCycleTimeWeeks
          : 0;

      return {
        week,
        cycleTimeDays: Number((shouldMigrateWeeksToDays ? baseCycleTimeDays * 7 : baseCycleTimeDays).toFixed(2)),
        count: Math.max(0, Math.floor(toFiniteNumber(point.count))),
      };
    })
    .filter((point) => point.week);
}

function migrateSimulationHistoryEntry(entry: LegacySimulationHistoryEntry): SimulationHistoryEntry | null {
  if (!entry || typeof entry !== "object") return null;
  return {
    schemaVersion: CURRENT_SIM_HISTORY_SCHEMA_VERSION,
    id: String(entry.id ?? ""),
    createdAt: String(entry.createdAt ?? ""),
    selectedOrg: String(entry.selectedOrg ?? ""),
    selectedProject: String(entry.selectedProject ?? ""),
    selectedTeam: String(entry.selectedTeam ?? ""),
    startDate: String(entry.startDate ?? ""),
    endDate: String(entry.endDate ?? ""),
    simulationMode: entry.simulationMode === "weeks_to_items" ? "weeks_to_items" : "backlog_to_weeks",
    includeZeroWeeks: Boolean(entry.includeZeroWeeks),
    backlogSize: toFiniteNumber(entry.backlogSize),
    targetWeeks: toFiniteNumber(entry.targetWeeks),
    nSims: Math.max(1, Math.floor(toFiniteNumber(entry.nSims, 1))),
    types: Array.isArray(entry.types) ? entry.types.filter((value): value is string => typeof value === "string") : [],
    doneStates: Array.isArray(entry.doneStates) ? entry.doneStates.filter((value): value is string => typeof value === "string") : [],
    sampleStats: entry.sampleStats ?? null,
    weeklyThroughput: Array.isArray(entry.weeklyThroughput) ? entry.weeklyThroughput.filter((value) => value && typeof value === "object") : [],
    cycleTimeDaysData: normalizeCycleTimeDaysData(entry.cycleTimeDaysData ?? entry.cycleTimeData, entry.schemaVersion),
    result: (entry.result ?? {
      result_kind: "weeks",
      samples_count: 0,
      result_percentiles: {},
      result_distribution: [],
    }) as SimulationHistoryEntry["result"],
    warning: typeof entry.warning === "string" ? entry.warning : undefined,
  };
}

function readSimulationHistory(storageKey: string): SimulationHistoryEntry[] {
  const raw = storageGetItem(storageKey);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => migrateSimulationHistoryEntry(entry as LegacySimulationHistoryEntry))
      .filter((entry): entry is SimulationHistoryEntry => entry !== null);
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
