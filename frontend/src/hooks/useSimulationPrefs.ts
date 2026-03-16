import { useEffect, useState } from "react";
import type { ForecastMode } from "../types";
import { nWeeksAgo, today } from "../date";
import { storageGetItem, storageSetItem } from "../storage";
import type { StoredSimulationPrefs } from "./simulationTypes";

const SIM_PREFS_KEY = "mc_simulation_prefs_v2";

function readStoredSimulationPrefs(): StoredSimulationPrefs {
  const raw = storageGetItem(SIM_PREFS_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as StoredSimulationPrefs;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
}

export type SimulationPrefsState = {
  startDate: string;
  setStartDate: (value: string) => void;
  endDate: string;
  setEndDate: (value: string) => void;
  simulationMode: ForecastMode;
  setSimulationMode: (value: ForecastMode) => void;
  includeZeroWeeks: boolean;
  setIncludeZeroWeeks: (value: boolean) => void;
  backlogSize: number | string;
  setBacklogSize: (value: number | string) => void;
  targetWeeks: number | string;
  setTargetWeeks: (value: number | string) => void;
  nSims: number | string;
  setNSims: (value: number | string) => void;
};

export function useSimulationPrefs(
  defaults: { startDate?: string; endDate?: string; forceDefaults?: boolean } = {},
): SimulationPrefsState {
  const prefs = readStoredSimulationPrefs();
  const [startDate, setStartDate] = useState(() =>
    defaults.forceDefaults ? defaults.startDate || nWeeksAgo(52) : prefs.startDate || defaults.startDate || nWeeksAgo(52),
  );
  const [endDate, setEndDate] = useState(() =>
    defaults.forceDefaults ? defaults.endDate || today() : prefs.endDate || defaults.endDate || today(),
  );
  const [simulationMode, setSimulationMode] = useState<ForecastMode>(() => prefs.simulationMode || "backlog_to_weeks");
  const [includeZeroWeeks, setIncludeZeroWeeks] = useState(() => prefs.includeZeroWeeks ?? true);
  const [backlogSize, setBacklogSize] = useState<number | string>(prefs.backlogSize ?? 120);
  const [targetWeeks, setTargetWeeks] = useState<number | string>(prefs.targetWeeks ?? 12);
  const [nSims, setNSims] = useState<number | string>(prefs.nSims ?? 20000);

  useEffect(() => {
    storageSetItem(
      SIM_PREFS_KEY,
      JSON.stringify({
        startDate,
        endDate,
        simulationMode,
        includeZeroWeeks,
        backlogSize: Number(backlogSize) || 0,
        targetWeeks: Number(targetWeeks) || 0,
        nSims: Number(nSims) || 0,
      } satisfies StoredSimulationPrefs),
    );
  }, [
    startDate,
    endDate,
    simulationMode,
    includeZeroWeeks,
    backlogSize,
    targetWeeks,
    nSims,
  ]);

  return {
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    simulationMode,
    setSimulationMode,
    includeZeroWeeks,
    setIncludeZeroWeeks,
    backlogSize,
    setBacklogSize,
    targetWeeks,
    setTargetWeeks,
    nSims,
    setNSims,
  };
}
