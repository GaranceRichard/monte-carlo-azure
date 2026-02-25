import { useCallback, useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { getTeamOptionsDirect, getWeeklyThroughputDirect } from "../adoClient";
import { postSimulate } from "../api";
import type {
  AppStep,
  ForecastHistogramBucket,
  ForecastMode,
  ForecastRequestPayload,
  ForecastResponse,
  WeeklyThroughputRow,
} from "../types";
import type {
  ChartPoint,
  ProbabilityPoint,
  SampleStats,
  SimulationHistoryEntry,
  ThroughputPoint,
  TooltipBaseProps,
} from "./simulationTypes";
import { clamp, toSafeNumber } from "../utils/math";
import { applyCapacityReductionToResult } from "../utils/simulation";
import { useSimulationAutoRun } from "./useSimulationAutoRun";
import { useSimulationChartData } from "./useSimulationChartData";
import { useSimulationHistory } from "./useSimulationHistory";
import { useSimulationPrefs } from "./useSimulationPrefs";

const DEFAULT_WORK_ITEM_TYPE_OPTIONS = ["User Story", "Product Backlog Item", "Bug"];
const DEFAULT_STATES_BY_TYPE: Record<string, string[]> = {
  "User Story": ["Done", "Closed", "Resolved"],
  "Product Backlog Item": ["Done", "Closed", "Resolved"],
  Bug: ["Done", "Closed", "Resolved"],
};

export type SimulationViewModel = {
  loading: boolean;
  hasLaunchedOnce: boolean;
  loadingTeamOptions: boolean;
  loadingStageMessage: string;
  err: string;
  startDate: string;
  setStartDate: (value: string) => void;
  endDate: string;
  setEndDate: (value: string) => void;
  simulationMode: ForecastMode;
  setSimulationMode: (value: ForecastMode) => void;
  includeZeroWeeks: boolean;
  setIncludeZeroWeeks: (value: boolean) => void;
  capacityPercent: number | string;
  setCapacityPercent: (value: number | string) => void;
  reducedCapacityWeeks: number | string;
  setReducedCapacityWeeks: (value: number | string) => void;
  sampleStats: SampleStats | null;
  backlogSize: number | string;
  setBacklogSize: (value: number | string) => void;
  targetWeeks: number | string;
  setTargetWeeks: (value: number | string) => void;
  nSims: number | string;
  setNSims: (value: number | string) => void;
  workItemTypeOptions: string[];
  types: string[];
  setTypes: Dispatch<SetStateAction<string[]>>;
  filteredDoneStateOptions: string[];
  doneStates: string[];
  setDoneStates: Dispatch<SetStateAction<string[]>>;
  result: ForecastResponse | null;
  displayPercentiles: Record<string, number>;
  activeChartTab: "throughput" | "distribution" | "probability";
  setActiveChartTab: (value: "throughput" | "distribution" | "probability") => void;
  throughputData: ThroughputPoint[];
  mcHistData: ChartPoint[];
  probabilityCurveData: ProbabilityPoint[];
  tooltipBaseProps: TooltipBaseProps;
  simulationHistory: SimulationHistoryEntry[];
  applyHistoryEntry: (entry: SimulationHistoryEntry) => void;
  clearSimulationHistory: () => void;
  exportThroughputCsv: () => void;
  runForecast: () => Promise<void>;
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
  const [loadingTeamOptions, setLoadingTeamOptions] = useState(false);
  const [loadingStageMessage, setLoadingStageMessage] = useState("");
  const [err, setErr] = useState("");
  const [sampleStats, setSampleStats] = useState<SampleStats | null>(null);
  const [workItemTypeOptions, setWorkItemTypeOptions] = useState<string[]>(DEFAULT_WORK_ITEM_TYPE_OPTIONS);
  const [statesByType, setStatesByType] = useState<Record<string, string[]>>({});
  const [doneStates, setDoneStates] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [result, setResult] = useState<ForecastResponse | null>(null);
  const [weeklyThroughput, setWeeklyThroughput] = useState<WeeklyThroughputRow[]>([]);
  const [activeChartTab, setActiveChartTab] = useState<"throughput" | "distribution" | "probability">("throughput");
  const [hasLaunchedOnce, setHasLaunchedOnce] = useState(false);

  const tooltipBaseProps: TooltipBaseProps = {
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

  const { throughputData, mcHistData, probabilityCurveData, displayPercentiles } = useSimulationChartData({
    weeklyThroughput,
    includeZeroWeeks,
    result,
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

  const clearComputedSimulationState = useCallback(() => {
    setResult(null);
    setWeeklyThroughput([]);
    setSampleStats(null);
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
    setLoading(true);
    setLoadingStageMessage("Récupération des données...");
    clearComputedSimulationState();
    const phaseTimer = window.setTimeout(() => {
      setLoadingStageMessage("Simulation en cours...");
    }, 1200);

    try {
      const weekly = await getWeeklyThroughputDirect(
        selectedOrg,
        selectedProject,
        selectedTeam,
        pat,
        startDate,
        endDate,
        doneStates,
        types,
      );

      const throughputSamples = weekly.map((r) => r.throughput).filter((n) => (includeZeroWeeks ? n >= 0 : n > 0));
      const zeroWeeks = weekly.filter((r) => r.throughput === 0).length;
      setSampleStats({
        totalWeeks: weekly.length,
        zeroWeeks,
        usedWeeks: throughputSamples.length,
      });
      if (throughputSamples.length < 6) {
        throw new Error(
          "Historique insuffisant pour une simulation fiable. Élargissez la période sélectionnée, ou vérifiez les types et états de résolution choisis.",
        );
      }

      setWeeklyThroughput(weekly);

      const payload: ForecastRequestPayload = {
        throughput_samples: throughputSamples,
        include_zero_weeks: includeZeroWeeks,
        mode: simulationMode,
        backlog_size: simulationMode === "backlog_to_weeks" ? Number(backlogSize) : undefined,
        target_weeks: simulationMode === "weeks_to_items" ? Number(targetWeeks) : undefined,
        n_sims: Number(nSims),
      };

      const response = await postSimulate(payload);
      const normalized: ForecastResponse = {
        result_kind: response.result_kind,
        samples_count: response.samples_count,
        result_percentiles: response.result_percentiles,
        result_distribution: (response.result_distribution ?? []) as ForecastHistogramBucket[],
      };
      const adjusted = applyCapacityReductionToResult(
        normalized,
        simulationMode,
        toSafeNumber(targetWeeks, 12),
        toSafeNumber(capacityPercent, 100),
        toSafeNumber(reducedCapacityWeeks, 0),
      );
      setResult(adjusted);

      const newHistoryEntry: SimulationHistoryEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: new Date().toISOString(),
        selectedOrg,
        selectedProject,
        selectedTeam,
        startDate,
        endDate,
        simulationMode,
        includeZeroWeeks,
        backlogSize: toSafeNumber(backlogSize, 120),
        targetWeeks: toSafeNumber(targetWeeks, 12),
        nSims: toSafeNumber(nSims, 20_000),
        capacityPercent: clamp(toSafeNumber(capacityPercent, 100), 1, 100),
        reducedCapacityWeeks: clamp(toSafeNumber(reducedCapacityWeeks, 0), 0, 260),
        types: [...types],
        doneStates: [...doneStates],
        sampleStats: {
          totalWeeks: weekly.length,
          zeroWeeks,
          usedWeeks: throughputSamples.length,
        },
        weeklyThroughput: weekly,
        result: adjusted,
      };
      pushSimulationHistory(newHistoryEntry);
    } catch (e: unknown) {
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
    onRun: runForecast,
  });

  useEffect(() => {
    if (step !== "simulation" || !selectedOrg || !selectedProject || !selectedTeam || !pat) return;
    let active = true;

    (async () => {
      try {
        setLoadingTeamOptions(true);
        const options = await getTeamOptionsDirect(selectedOrg, selectedProject, selectedTeam, pat);
        if (!active) return;
        const nextTypes = (options.workItemTypes?.length ? options.workItemTypes : DEFAULT_WORK_ITEM_TYPE_OPTIONS)
          .slice()
          .sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
        setWorkItemTypeOptions(nextTypes);
        setStatesByType(options.statesByType || {});
        setDoneStates([]);
        setTypes([]);
      } catch {
        if (!active) return;
        setWorkItemTypeOptions(DEFAULT_WORK_ITEM_TYPE_OPTIONS);
        setStatesByType(DEFAULT_STATES_BY_TYPE);
        setDoneStates([]);
        setTypes([]);
      } finally {
        if (active) setLoadingTeamOptions(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [step, selectedOrg, selectedProject, selectedTeam, pat]);

  function resetForTeamSelection(): void {
    setErr("");
    clearComputedSimulationState();
    setLoadingTeamOptions(false);
    setHasLaunchedOnce(false);
    resetAutoRunState();
  }

  function resetAll(): void {
    setErr("");
    setLoading(false);
    setLoadingTeamOptions(false);
    setLoadingStageMessage("");
    clearComputedSimulationState();
    setWorkItemTypeOptions(DEFAULT_WORK_ITEM_TYPE_OPTIONS);
    setStatesByType({});
    setDoneStates([]);
    setTypes([]);
    setHasLaunchedOnce(false);
    resetAutoRunState();
  }

  function applyHistoryEntry(entry: SimulationHistoryEntry): void {
    setErr("");
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
    setHasLaunchedOnce(false);
    resetAutoRunState();
  }

  function exportThroughputCsv(): void {
    if (!weeklyThroughput.length) return;
    const header = "week,throughput";
    const rows = weeklyThroughput.map((row) => `${String(row.week).slice(0, 10)},${row.throughput}`);
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const now = new Date().toISOString().replace(/[:.]/g, "-");
    a.download = `throughput-${selectedTeam || "team"}-${now}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
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
    result,
    displayPercentiles,
    activeChartTab,
    setActiveChartTab,
    throughputData,
    mcHistData,
    probabilityCurveData,
    tooltipBaseProps,
    simulationHistory,
    applyHistoryEntry,
    clearSimulationHistory,
    exportThroughputCsv,
    runForecast,
    resetForTeamSelection,
    resetAll,
  };
}
