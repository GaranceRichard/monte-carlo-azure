import { useEffect, useMemo, useState } from "react";
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

export type SimulationViewModel = {
  loading: boolean;
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
  const [loading, setLoading] = useState(false);
  const [loadingStageMessage, setLoadingStageMessage] = useState("");
  const [err, setErr] = useState("");
  const [startDate, setStartDate] = useState(() => nWeeksAgo(52));
  const [endDate, setEndDate] = useState(() => today());
  const [simulationMode, setSimulationMode] = useState<ForecastMode>("backlog_to_weeks");
  const [includeZeroWeeks, setIncludeZeroWeeks] = useState(false);
  const [sampleStats, setSampleStats] = useState<SampleStats | null>(null);
  const [backlogSize, setBacklogSize] = useState<number | string>(120);
  const [targetWeeks, setTargetWeeks] = useState<number | string>(12);
  const [nSims, setNSims] = useState<number | string>(20000);
  const [workItemTypeOptions, setWorkItemTypeOptions] = useState<string[]>(DEFAULT_WORK_ITEM_TYPE_OPTIONS);
  const [statesByType, setStatesByType] = useState<Record<string, string[]>>({});
  const [doneStates, setDoneStates] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [result, setResult] = useState<ForecastResponse | null>(null);
  const [weeklyThroughput, setWeeklyThroughput] = useState<WeeklyThroughputRow[]>([]);
  const [activeChartTab, setActiveChartTab] = useState<"throughput" | "distribution" | "probability">("throughput");

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
    if (step !== "simulation" || !selectedOrg || !selectedProject || !selectedTeam || !pat) return;
    let active = true;

    (async () => {
      try {
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
        setStatesByType({});
        setDoneStates([]);
        setTypes([]);
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
  }

  function resetAll(): void {
    setErr("");
    setLoading(false);
    setLoadingStageMessage("");
    setResult(null);
    setWeeklyThroughput([]);
    setSampleStats(null);
    setActiveChartTab("throughput");
    setWorkItemTypeOptions(DEFAULT_WORK_ITEM_TYPE_OPTIONS);
    setStatesByType({});
    setDoneStates([]);
    setTypes([]);
  }

  async function runForecast(): Promise<void> {
    if (!selectedTeam) {
      setErr("Selectionnez une equipe.");
      return;
    }
    if (!pat) {
      setErr("PAT manquant. Reconnectez-vous.");
      return;
    }

    setErr("");
    setLoading(true);
    setLoadingStageMessage("Recuperation des donnees...");
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
          includeZeroWeeks
            ? "Historique insuffisant (moins de 6 semaines)."
            : "Historique insuffisant (moins de 6 semaines non nulles).",
        );
      }

      setWeeklyThroughput(weekly);

      const payload: ForecastRequestPayload = {
        throughput_samples: throughputSamples,
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
      setResult(normalized);
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
    runForecast,
    resetForTeamSelection,
    resetAll,
  };
}
