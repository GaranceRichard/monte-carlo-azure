import { useEffect, useMemo, useRef, useState } from "react";
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
import { buildAtLeastPercentiles, buildProbabilityCurve } from "./probability";

const DEFAULT_WORK_ITEM_TYPE_OPTIONS = ["User Story", "Product Backlog Item", "Bug"];
const DEFAULT_STATES_BY_TYPE: Record<string, string[]> = {
  "User Story": ["Done", "Closed", "Resolved"],
  "Product Backlog Item": ["Done", "Closed", "Resolved"],
  Bug: ["Done", "Closed", "Resolved"],
};
const SIM_PREFS_KEY = "mc_simulation_prefs_v1";
const SIM_HISTORY_KEY = "mc_simulation_history_v1";
const MAX_SIM_HISTORY = 10;

type ChartPoint = { x: number; count: number; gauss: number };
type ProbabilityPoint = { x: number; probability: number };
type ThroughputPoint = { week: string; throughput: number };

type TooltipBaseProps = {
  cursor: boolean;
  contentStyle: Record<string, string | number>;
  labelStyle: Record<string, string | number>;
  itemStyle: Record<string, string | number>;
};

type SampleStats = {
  totalWeeks: number;
  zeroWeeks: number;
  usedWeeks: number;
};

type StoredSimulationPrefs = {
  startDate?: string;
  endDate?: string;
  simulationMode?: ForecastMode;
  includeZeroWeeks?: boolean;
  backlogSize?: number;
  targetWeeks?: number;
  nSims?: number;
  capacityPercent?: number;
  reducedCapacityWeeks?: number;
};

type SimulationHistoryEntry = {
  id: string;
  createdAt: string;
  selectedOrg: string;
  selectedProject: string;
  selectedTeam: string;
  startDate: string;
  endDate: string;
  simulationMode: ForecastMode;
  includeZeroWeeks: boolean;
  backlogSize: number;
  targetWeeks: number;
  nSims: number;
  capacityPercent: number;
  reducedCapacityWeeks: number;
  types: string[];
  doneStates: string[];
  sampleStats: SampleStats | null;
  weeklyThroughput: WeeklyThroughputRow[];
  result: ForecastResponse;
};

export type SimulationViewModel = {
  loading: boolean;
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

function formatDateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function today(): string {
  return formatDateLocal(new Date());
}

function nWeeksAgo(weeks: number): string {
  const date = new Date();
  date.setDate(date.getDate() - weeks * 7);
  return formatDateLocal(date);
}

function smoothHistogramCounts(points: Array<{ x: number; count: number }>): number[] {
  if (!points.length) return [];
  const weights = [1, 2, 3, 2, 1];
  const radius = 2;
  return points.map((_, i) => {
    let weightedSum = 0;
    let weightTotal = 0;
    for (let offset = -radius; offset <= radius; offset += 1) {
      const idx = i + offset;
      if (idx < 0 || idx >= points.length) continue;
      const w = weights[offset + radius];
      weightedSum += points[idx].count * w;
      weightTotal += w;
    }
    return weightTotal > 0 ? weightedSum / weightTotal : points[i].count;
  });
}

function readStoredSimulationPrefs(): StoredSimulationPrefs {
  try {
    const raw = localStorage.getItem(SIM_PREFS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoredSimulationPrefs;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
}

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

function toSafeNumber(value: number | string, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function applyCapacityReductionToResult(
  response: ForecastResponse,
  mode: ForecastMode,
  targetWeeksValue: number,
  capacityPercentValue: number,
  reducedWeeksValue: number,
): ForecastResponse {
  const capacity = clamp(capacityPercentValue, 1, 100) / 100;
  const reducedWeeks = clamp(reducedWeeksValue, 0, 260);
  if (capacity >= 1 || reducedWeeks <= 0) return response;

  const lostWeeks = reducedWeeks * (1 - capacity);

  if (response.result_kind === "weeks") {
    return {
      ...response,
      result_percentiles: Object.fromEntries(
        Object.entries(response.result_percentiles).map(([key, value]) => [key, Number(value) + lostWeeks]),
      ),
      result_distribution: response.result_distribution.map((bucket) => ({
        ...bucket,
        x: Number(bucket.x) + lostWeeks,
      })),
    };
  }

  const horizon = Math.max(1, targetWeeksValue);
  const itemFactor = clamp((horizon - lostWeeks) / horizon, 0, 1);
  return {
    ...response,
    result_percentiles: Object.fromEntries(
      Object.entries(response.result_percentiles).map(([key, value]) => [key, Number(value) * itemFactor]),
    ),
    result_distribution: response.result_distribution.map((bucket) => ({
      ...bucket,
      x: Number(bucket.x) * itemFactor,
    })),
  };
}

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
  const prefs = readStoredSimulationPrefs();
  const [loading, setLoading] = useState(false);
  const [loadingTeamOptions, setLoadingTeamOptions] = useState(false);
  const [loadingStageMessage, setLoadingStageMessage] = useState("");
  const [err, setErr] = useState("");
  const [startDate, setStartDate] = useState(() => prefs.startDate || nWeeksAgo(52));
  const [endDate, setEndDate] = useState(() => prefs.endDate || today());
  const [simulationMode, setSimulationMode] = useState<ForecastMode>(
    () => prefs.simulationMode || "backlog_to_weeks",
  );
  const [includeZeroWeeks, setIncludeZeroWeeks] = useState(() => Boolean(prefs.includeZeroWeeks));
  const [capacityPercent, setCapacityPercent] = useState<number | string>(prefs.capacityPercent ?? 100);
  const [reducedCapacityWeeks, setReducedCapacityWeeks] = useState<number | string>(prefs.reducedCapacityWeeks ?? 0);
  const [sampleStats, setSampleStats] = useState<SampleStats | null>(null);
  const [backlogSize, setBacklogSize] = useState<number | string>(prefs.backlogSize ?? 120);
  const [targetWeeks, setTargetWeeks] = useState<number | string>(prefs.targetWeeks ?? 12);
  const [nSims, setNSims] = useState<number | string>(prefs.nSims ?? 20000);
  const [workItemTypeOptions, setWorkItemTypeOptions] = useState<string[]>(DEFAULT_WORK_ITEM_TYPE_OPTIONS);
  const [statesByType, setStatesByType] = useState<Record<string, string[]>>({});
  const [doneStates, setDoneStates] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [result, setResult] = useState<ForecastResponse | null>(null);
  const [weeklyThroughput, setWeeklyThroughput] = useState<WeeklyThroughputRow[]>([]);
  const [simulationHistory, setSimulationHistory] = useState<SimulationHistoryEntry[]>(() => readSimulationHistory());
  const [activeChartTab, setActiveChartTab] = useState<"throughput" | "distribution" | "probability">("throughput");
  const [hasLaunchedOnce, setHasLaunchedOnce] = useState(false);
  const autoRunKeyRef = useRef("");
  const pendingAutoRunRef = useRef(false);

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

  const throughputData = useMemo((): ThroughputPoint[] => {
    const rows = includeZeroWeeks ? weeklyThroughput : weeklyThroughput.filter((row) => row.throughput > 0);
    return rows.map((row) => ({
      week: String(row.week).slice(0, 10),
      throughput: row.throughput,
    }));
  }, [weeklyThroughput, includeZeroWeeks]);

  const mcHistData = useMemo((): ChartPoint[] => {
    const buckets = result?.result_distribution;
    if (!buckets?.length) return [];

    const points = buckets
      .map((b) => ({ x: Number(b.x), count: Number(b.count) }))
      .filter((b) => Number.isFinite(b.x) && Number.isFinite(b.count) && b.count > 0)
      .sort((a, b) => a.x - b.x);
    if (!points.length) return [];

    const smoothed = smoothHistogramCounts(points);

    return points.map((p, idx) => ({
      x: p.x,
      count: p.count,
      gauss: smoothed[idx],
    }));
  }, [result]);

  const probabilityCurveData = useMemo((): ProbabilityPoint[] => {
    if (!result?.result_distribution?.length) return [];

    const points = result.result_distribution
      .map((b) => ({ x: Number(b.x), count: Number(b.count) }))
      .filter((b) => Number.isFinite(b.x) && Number.isFinite(b.count) && b.count > 0)
      .sort((a, b) => a.x - b.x);
    if (!points.length) return [];

    return buildProbabilityCurve(points, result.result_kind);
  }, [result]);

  const displayPercentiles = useMemo((): Record<string, number> => {
    if (!result) return {};
    if (result.result_kind !== "items") return result.result_percentiles;

    const points = result.result_distribution
      .map((b) => ({ x: Number(b.x), count: Number(b.count) }))
      .filter((b) => Number.isFinite(b.x) && Number.isFinite(b.count) && b.count > 0)
      .sort((a, b) => a.x - b.x);
    if (!points.length) return result.result_percentiles;

    return buildAtLeastPercentiles(points, [50, 70, 90]);
  }, [result]);

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
    const autoRunKey = [
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

    if (!autoRunKeyRef.current) {
      autoRunKeyRef.current = autoRunKey;
      return;
    }
    if (autoRunKeyRef.current === autoRunKey) return;
    autoRunKeyRef.current = autoRunKey;

    if (!hasLaunchedOnce || step !== "simulation") return;

    if (!types.length || !doneStates.length) {
      setErr("Ticket et État obligatoires.");
      setResult(null);
      setWeeklyThroughput([]);
      setSampleStats(null);
      setActiveChartTab("throughput");
      return;
    }

    if (loading) {
      pendingAutoRunRef.current = true;
      return;
    }

    const timer = window.setTimeout(() => {
      void runForecast();
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
  ]);

  useEffect(() => {
    if (loading || !pendingAutoRunRef.current) return;
    pendingAutoRunRef.current = false;
    if (!types.length || !doneStates.length) return;
    void runForecast();
  }, [loading, types, doneStates]);

  useEffect(() => {
    try {
      localStorage.setItem(
        SIM_PREFS_KEY,
        JSON.stringify({
          startDate,
          endDate,
          simulationMode,
          includeZeroWeeks,
          capacityPercent: Number(capacityPercent) || 100,
          reducedCapacityWeeks: Number(reducedCapacityWeeks) || 0,
          backlogSize: Number(backlogSize) || 0,
          targetWeeks: Number(targetWeeks) || 0,
          nSims: Number(nSims) || 0,
        } satisfies StoredSimulationPrefs),
      );
    } catch {
      // Local storage can be unavailable in private contexts.
    }
  }, [
    startDate,
    endDate,
    simulationMode,
    includeZeroWeeks,
    capacityPercent,
    reducedCapacityWeeks,
    backlogSize,
    targetWeeks,
    nSims,
  ]);

  useEffect(() => {
    try {
      localStorage.setItem(SIM_HISTORY_KEY, JSON.stringify(simulationHistory));
    } catch {
      // Best effort only.
    }
  }, [simulationHistory]);

  useEffect(() => {
    if (step !== "simulation" || !selectedOrg || !selectedProject || !selectedTeam || !pat) return;
    let active = true;

    (async () => {
      try {
        setLoadingTeamOptions(true);
        const options = await getTeamOptionsDirect(selectedOrg, selectedProject, selectedTeam, pat);
        if (!active) return;
        const nextTypes = (
          options.workItemTypes?.length ? options.workItemTypes : DEFAULT_WORK_ITEM_TYPE_OPTIONS
        )
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
    setResult(null);
    setWeeklyThroughput([]);
    setSampleStats(null);
    setActiveChartTab("throughput");
    setLoadingTeamOptions(false);
    setHasLaunchedOnce(false);
    autoRunKeyRef.current = "";
    pendingAutoRunRef.current = false;
  }

  function resetAll(): void {
    setErr("");
    setLoading(false);
    setLoadingTeamOptions(false);
    setLoadingStageMessage("");
    setResult(null);
    setWeeklyThroughput([]);
    setSampleStats(null);
    setActiveChartTab("throughput");
    setWorkItemTypeOptions(DEFAULT_WORK_ITEM_TYPE_OPTIONS);
    setStatesByType({});
    setDoneStates([]);
    setTypes([]);
    setHasLaunchedOnce(false);
    autoRunKeyRef.current = "";
    pendingAutoRunRef.current = false;
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
    autoRunKeyRef.current = "";
    pendingAutoRunRef.current = false;
  }

  function clearSimulationHistory(): void {
    setSimulationHistory([]);
    try {
      localStorage.removeItem(SIM_HISTORY_KEY);
    } catch {
      // Ignore storage errors.
    }
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

  async function runForecast(): Promise<void> {
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
      setErr("Ticket et État obligatoires.");
      setResult(null);
      setWeeklyThroughput([]);
      setSampleStats(null);
      setActiveChartTab("throughput");
      return;
    }

    setHasLaunchedOnce(true);

    setErr("");
    setLoading(true);
    setLoadingStageMessage("Récupération des données...");
    setResult(null);
    setWeeklyThroughput([]);
    setSampleStats(null);
    setActiveChartTab("throughput");
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

      const throughputSamples = weekly
        .map((r) => r.throughput)
        .filter((n) => (includeZeroWeeks ? n >= 0 : n > 0));
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
      setSimulationHistory((prev) => [newHistoryEntry, ...prev].slice(0, MAX_SIM_HISTORY));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      window.clearTimeout(phaseTimer);
      setLoading(false);
      setLoadingStageMessage("");
    }
  }

  return {
    loading,
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

