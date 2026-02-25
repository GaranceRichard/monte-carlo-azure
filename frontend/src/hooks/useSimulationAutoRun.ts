import { useEffect, useRef } from "react";
import type { AppStep, ForecastMode } from "../types";

function buildAutoRunKey({
  step,
  selectedTeam,
  startDate,
  endDate,
  simulationMode,
  includeZeroWeeks,
  capacityPercent,
  reducedCapacityWeeks,
  backlogSize,
  targetWeeks,
  nSims,
  types,
  doneStates,
}: {
  step: AppStep;
  selectedTeam: string;
  startDate: string;
  endDate: string;
  simulationMode: ForecastMode;
  includeZeroWeeks: boolean;
  capacityPercent: number | string;
  reducedCapacityWeeks: number | string;
  backlogSize: number | string;
  targetWeeks: number | string;
  nSims: number | string;
  types: string[];
  doneStates: string[];
}): string {
  return [
    step,
    selectedTeam,
    startDate,
    endDate,
    simulationMode,
    includeZeroWeeks ? "1" : "0",
    String(capacityPercent),
    String(reducedCapacityWeeks),
    String(backlogSize),
    String(targetWeeks),
    String(nSims),
    types.join("|"),
    doneStates.join("|"),
  ].join("::");
}

export function useSimulationAutoRun({
  step,
  selectedTeam,
  startDate,
  endDate,
  simulationMode,
  includeZeroWeeks,
  capacityPercent,
  reducedCapacityWeeks,
  backlogSize,
  targetWeeks,
  nSims,
  types,
  doneStates,
  hasLaunchedOnce,
  loading,
  onInvalidFilters,
  onRun,
}: {
  step: AppStep;
  selectedTeam: string;
  startDate: string;
  endDate: string;
  simulationMode: ForecastMode;
  includeZeroWeeks: boolean;
  capacityPercent: number | string;
  reducedCapacityWeeks: number | string;
  backlogSize: number | string;
  targetWeeks: number | string;
  nSims: number | string;
  types: string[];
  doneStates: string[];
  hasLaunchedOnce: boolean;
  loading: boolean;
  onInvalidFilters: () => void;
  onRun: () => Promise<void>;
}) {
  const autoRunKeyRef = useRef("");
  const pendingAutoRunRef = useRef(false);

  useEffect(() => {
    const autoRunKey = buildAutoRunKey({
      step,
      selectedTeam,
      startDate,
      endDate,
      simulationMode,
      includeZeroWeeks,
      capacityPercent,
      reducedCapacityWeeks,
      backlogSize,
      targetWeeks,
      nSims,
      types,
      doneStates,
    });

    if (!autoRunKeyRef.current) {
      autoRunKeyRef.current = autoRunKey;
      return;
    }
    if (autoRunKeyRef.current === autoRunKey) return;
    autoRunKeyRef.current = autoRunKey;

    if (!hasLaunchedOnce || step !== "simulation") return;

    if (!types.length || !doneStates.length) {
      onInvalidFilters();
      return;
    }

    if (loading) {
      pendingAutoRunRef.current = true;
      return;
    }

    const timer = window.setTimeout(() => {
      void onRun();
    }, 300);
    return () => {
      window.clearTimeout(timer);
    };
  }, [
    step,
    selectedTeam,
    startDate,
    endDate,
    simulationMode,
    includeZeroWeeks,
    capacityPercent,
    reducedCapacityWeeks,
    backlogSize,
    targetWeeks,
    nSims,
    types,
    doneStates,
    hasLaunchedOnce,
    loading,
    onInvalidFilters,
    onRun,
  ]);

  useEffect(() => {
    if (loading || !pendingAutoRunRef.current) return;
    pendingAutoRunRef.current = false;
    if (!types.length || !doneStates.length) return;
    void onRun();
  }, [loading, types, doneStates, onRun]);

  function resetAutoRunState(): void {
    autoRunKeyRef.current = "";
    pendingAutoRunRef.current = false;
  }

  return { resetAutoRunState };
}
