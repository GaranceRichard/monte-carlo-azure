import { useCallback, useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type {
  AppStep,
  ForecastResponse,
  WeeklyThroughputRow,
} from "../types";
import type {
  ChartTab,
  SampleStats,
  SimulationDateRange,
  SimulationForecastControls,
  SimulationHistoryEntry,
  SimulationResult,
  TooltipBaseProps,
} from "./simulationTypes";
import { exportThroughputCsv as exportCsv } from "../utils/export";
import { useSimulationAutoRun } from "./useSimulationAutoRun";
import { useSimulationChartData } from "./useSimulationChartData";
import { runSimulationForecast } from "./simulationForecastService";
import { useSimulationHistory } from "./useSimulationHistory";
import { useSimulationPrefs } from "./useSimulationPrefs";
import { useTeamOptions } from "./useTeamOptions";
import { buildQuickFiltersScopeKey, writeStoredQuickFilters } from "../storage";

const TOOLTIP_BASE_PROPS: TooltipBaseProps = {
  cursor: false,
  contentStyle: {
    background: "var(--panel)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    boxShadow: "0 6px 20px rgba(0,0,0,0.22)",
  },
  labelStyle: { color: "var(--muted)", fontWeight: 700 },
  itemStyle: { color: "var(--text)", fontWeight: 700 },
};

export type SimulationViewModel = SimulationForecastControls &
  SimulationDateRange &
  SimulationResult & {
  loading: boolean;
  hasLaunchedOnce: boolean;
  loadingTeamOptions: boolean;
  loadingStageMessage: string;
  err: string;
  workItemTypeOptions: string[];
  types: string[];
  setTypes: Dispatch<SetStateAction<string[]>>;
  filteredDoneStateOptions: string[];
  doneStates: string[];
  setDoneStates: Dispatch<SetStateAction<string[]>>;
  hasQuickFilterConfig: boolean;
  applyQuickFilterConfig: () => void;
  activeChartTab: ChartTab;
  setActiveChartTab: (value: ChartTab) => void;
  tooltipBaseProps: TooltipBaseProps;
  simulationHistory: SimulationHistoryEntry[];
  applyHistoryEntry: (entry: SimulationHistoryEntry) => void;
  clearSimulationHistory: () => void;
  exportThroughputCsv: () => void;
  runForecast: () => Promise<void>;
  resetSimulationResults: () => void;
  resetForTeamSelection: () => void;
  resetAll: () => void;
};

export function useSimulation({
  step,
  selectedOrg,
  selectedProject,
  selectedTeam,
  pat,
}: {
  step: AppStep;
  selectedOrg: string;
  selectedProject: string;
  selectedTeam: string;
  pat: string;
}): SimulationViewModel {
  const {
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
    capacityPercent,
    setCapacityPercent,
    reducedCapacityWeeks,
    setReducedCapacityWeeks,
  } = useSimulationPrefs();
  const { simulationHistory, pushSimulationHistory, clearSimulationHistory } = useSimulationHistory();

  const [loading, setLoading] = useState(false);
  const [loadingStageMessage, setLoadingStageMessage] = useState("");
  const [err, setErr] = useState("");
  const [sampleStats, setSampleStats] = useState<SampleStats | null>(null);
  const [warning, setWarning] = useState("");
  const [doneStates, setDoneStates] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [result, setResult] = useState<ForecastResponse | null>(null);
  const [weeklyThroughput, setWeeklyThroughput] = useState<WeeklyThroughputRow[]>([]);
  const [activeChartTab, setActiveChartTab] = useState<ChartTab>("throughput");
  const [hasLaunchedOnce, setHasLaunchedOnce] = useState(false);

  const { throughputData, mcHistData, probabilityCurveData, displayPercentiles } = useSimulationChartData({
    weeklyThroughput,
    includeZeroWeeks,
    result,
  });

  const onTeamOptionsReset = useCallback((): void => {
    setDoneStates([]);
    setTypes([]);
  }, []);

  const quickFiltersScopeKey = useMemo(() => {
    if (!selectedOrg || !selectedProject || !selectedTeam) return "";
    return buildQuickFiltersScopeKey(selectedOrg, selectedProject, selectedTeam);
  }, [selectedOrg, selectedProject, selectedTeam]);

  const {
    loadingTeamOptions,
    workItemTypeOptions,
    statesByType,
    hasQuickFilterConfig,
    applyQuickFilterConfig,
    resetTeamOptions,
  } = useTeamOptions({
    step,
    selectedOrg,
    selectedProject,
    selectedTeam,
    pat,
    quickFiltersScopeKey,
    setTypes,
    setDoneStates,
    onTeamOptionsReset,
  });

  const filteredDoneStateOptions = useMemo((): string[] => {
    if (!types.length) return [];
    const out = new Set<string>();
    for (const type of types) {
      const states = statesByType?.[type] || [];
      for (const state of states) out.add(state);
    }
    return Array.from(out).sort();
  }, [types, statesByType]);

  useEffect(() => {
    setDoneStates((prev) => prev.filter((state) => filteredDoneStateOptions.includes(state)));
  }, [filteredDoneStateOptions]);

  useEffect(() => {
    if (step !== "simulation" || !quickFiltersScopeKey) return;

    const allowedTypes = new Set(workItemTypeOptions);
    const persistedTypes = types.filter((type, idx, arr) => allowedTypes.has(type) && arr.indexOf(type) === idx);
    if (!persistedTypes.length) return;

    const allowedStates = new Set(persistedTypes.flatMap((type) => statesByType[type] || []));
    const persistedDoneStates = doneStates.filter(
      (state, idx, arr) => allowedStates.has(state) && arr.indexOf(state) === idx,
    );
    if (!persistedDoneStates.length) return;

    writeStoredQuickFilters(quickFiltersScopeKey, {
      types: persistedTypes,
      doneStates: persistedDoneStates,
    });
  }, [doneStates, quickFiltersScopeKey, statesByType, step, types, workItemTypeOptions]);

  const clearComputedSimulationState = useCallback(() => {
    setResult(null);
    setWeeklyThroughput([]);
    setSampleStats(null);
    setWarning("");
    setActiveChartTab("throughput");
  }, []);

  const onInvalidFilters = useCallback(() => {
    setErr("Ticket et État obligatoires.");
    clearComputedSimulationState();
  }, [clearComputedSimulationState]);

  const runForecast = useCallback(async (): Promise<void> => {
    if (loading) return;
    if (!selectedTeam) {
      setErr("Sélectionnez une équipe.");
      return;
    }
    if (!pat) {
      setErr("PAT manquant. Reconnectez-vous.");
      return;
    }
    if (!types.length || !doneStates.length) {
      onInvalidFilters();
      return;
    }

    setHasLaunchedOnce(true);
    setErr("");
    setWarning("");
    setLoading(true);
    setLoadingStageMessage("Récupération des données...");
    clearComputedSimulationState();
    const phaseTimer = window.setTimeout(() => {
      setLoadingStageMessage("Simulation en cours...");
    }, 1200);

    try {
      const forecast = await runSimulationForecast({
        selectedOrg,
        selectedProject,
        selectedTeam,
        pat,
        startDate,
        endDate,
        doneStates,
        types,
        includeZeroWeeks,
        simulationMode,
        backlogSize,
        targetWeeks,
        nSims,
        capacityPercent,
        reducedCapacityWeeks,
      });
      setSampleStats(forecast.sampleStats);
      setWeeklyThroughput(forecast.weeklyThroughput);
      setResult(forecast.result);
      setWarning(forecast.warning ?? "");
      pushSimulationHistory(forecast.historyEntry);
    } catch (e: unknown) {
      setWarning("");
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      window.clearTimeout(phaseTimer);
      setLoading(false);
      setLoadingStageMessage("");
    }
  }, [
    backlogSize,
    capacityPercent,
    clearComputedSimulationState,
    doneStates,
    endDate,
    includeZeroWeeks,
    loading,
    nSims,
    onInvalidFilters,
    pat,
    pushSimulationHistory,
    reducedCapacityWeeks,
    selectedOrg,
    selectedProject,
    selectedTeam,
    simulationMode,
    startDate,
    targetWeeks,
    types,
  ]);

  const { resetAutoRunState } = useSimulationAutoRun({
    params: {
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
    },
    hasLaunchedOnce,
    loading,
    onInvalidFilters,
    onRun: runForecast,
  });

  function resetForTeamSelection(): void {
    setErr("");
    setWarning("");
    clearComputedSimulationState();
    setHasLaunchedOnce(false);
    resetAutoRunState();
  }

  function resetAll(): void {
    setErr("");
    setWarning("");
    setLoading(false);
    setLoadingStageMessage("");
    clearComputedSimulationState();
    resetTeamOptions();
    setHasLaunchedOnce(false);
    resetAutoRunState();
  }

  function applyHistoryEntry(entry: SimulationHistoryEntry): void {
    setErr("");
    setWarning(entry.warning ?? "");
    setStartDate(entry.startDate);
    setEndDate(entry.endDate);
    setSimulationMode(entry.simulationMode);
    setIncludeZeroWeeks(entry.includeZeroWeeks);
    setCapacityPercent(entry.capacityPercent);
    setReducedCapacityWeeks(entry.reducedCapacityWeeks);
    setBacklogSize(entry.backlogSize);
    setTargetWeeks(entry.targetWeeks);
    setNSims(entry.nSims);
    setTypes(entry.types);
    setDoneStates(entry.doneStates);
    setSampleStats(entry.sampleStats);
    setWeeklyThroughput(entry.weeklyThroughput);
    setResult(entry.result);
    setActiveChartTab("throughput");
    setHasLaunchedOnce(true);
    resetAutoRunState();
  }

  function resetSimulationResults(): void {
    setErr("");
    setWarning("");
    clearComputedSimulationState();
    setHasLaunchedOnce(false);
    resetAutoRunState();
  }

  return {
    loading,
    hasLaunchedOnce,
    loadingTeamOptions,
    loadingStageMessage,
    err,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    simulationMode,
    setSimulationMode,
    includeZeroWeeks,
    setIncludeZeroWeeks,
    capacityPercent,
    setCapacityPercent,
    reducedCapacityWeeks,
    setReducedCapacityWeeks,
    sampleStats,
    warning,
    backlogSize,
    setBacklogSize,
    targetWeeks,
    setTargetWeeks,
    nSims,
    setNSims,
    workItemTypeOptions,
    types,
    setTypes,
    filteredDoneStateOptions,
    doneStates,
    setDoneStates,
    hasQuickFilterConfig,
    applyQuickFilterConfig,
    result,
    displayPercentiles,
    activeChartTab,
    setActiveChartTab,
    throughputData,
    mcHistData,
    probabilityCurveData,
    tooltipBaseProps: TOOLTIP_BASE_PROPS,
    simulationHistory,
    applyHistoryEntry,
    clearSimulationHistory,
    exportThroughputCsv: () => exportCsv(weeklyThroughput, selectedTeam),
    runForecast,
    resetSimulationResults,
    resetForTeamSelection,
    resetAll,
  };
}
