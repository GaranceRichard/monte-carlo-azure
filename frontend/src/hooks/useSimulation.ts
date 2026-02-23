import { useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { getTeamOptions, postForecast } from "../api";
import type {
  AppStep,
  ForecastMode,
  ForecastRequestPayload,
  ForecastResponse,
  WeeklyThroughputRow,
} from "../types";

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

export type SimulationViewModel = {
  loading: boolean;
  err: string;
  startDate: string;
  setStartDate: (value: string) => void;
  endDate: string;
  setEndDate: (value: string) => void;
  simulationMode: ForecastMode;
  setSimulationMode: (value: ForecastMode) => void;
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

function normalPdf(x: number, mean: number, std: number): number {
  if (!std || std <= 0) return 0;
  const z = (x - mean) / std;
  return (1 / (std * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * z * z);
}

export function useSimulation({
  step,
  selectedOrg,
  selectedProject,
  selectedTeam,
}: {
  step: AppStep;
  selectedOrg: string;
  selectedProject: string;
  selectedTeam: string;
}): SimulationViewModel {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [startDate, setStartDate] = useState(() => nWeeksAgo(52));
  const [endDate, setEndDate] = useState(() => today());
  const [simulationMode, setSimulationMode] = useState<ForecastMode>("backlog_to_weeks");
  const [backlogSize, setBacklogSize] = useState<number | string>(120);
  const [targetWeeks, setTargetWeeks] = useState<number | string>(12);
  const [nSims, setNSims] = useState<number | string>(20000);
  const [workItemTypeOptions, setWorkItemTypeOptions] = useState<string[]>(DEFAULT_WORK_ITEM_TYPE_OPTIONS);
  const [statesByType, setStatesByType] = useState<Record<string, string[]>>({});
  const [doneStates, setDoneStates] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [result, setResult] = useState<ForecastResponse | null>(null);
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
    if (!result?.weekly_throughput) return [];
    return result.weekly_throughput.map((row: WeeklyThroughputRow) => ({
      week: String(row.week).slice(0, 10),
      throughput: row.throughput,
    }));
  }, [result]);

  const mcHistData = useMemo((): ChartPoint[] => {
    const buckets = result?.result_histogram;
    if (!buckets?.length) return [];

    const points = buckets
      .map((b) => ({ x: Number(b.x), count: Number(b.count) }))
      .filter((b) => Number.isFinite(b.x) && Number.isFinite(b.count) && b.count > 0)
      .sort((a, b) => a.x - b.x);
    if (!points.length) return [];

    const n = points.reduce((acc, p) => acc + p.count, 0);
    const mean = points.reduce((acc, p) => acc + p.x * p.count, 0) / n;
    const variance = points.reduce((acc, p) => acc + ((p.x - mean) ** 2) * p.count, 0) / n;
    const std = Math.sqrt(variance);

    return points.map((p) => ({
      x: p.x,
      count: p.count,
      gauss: normalPdf(p.x, mean, std) * n,
    }));
  }, [result]);

  const probabilityCurveData = useMemo((): ProbabilityPoint[] => {
    const buckets = result?.result_histogram;
    if (!buckets?.length) return [];

    const points = buckets
      .map((b) => ({ x: Number(b.x), count: Number(b.count) }))
      .filter((b) => Number.isFinite(b.x) && Number.isFinite(b.count) && b.count > 0)
      .sort((a, b) => a.x - b.x);
    if (!points.length) return [];

    const n = points.reduce((acc, p) => acc + p.count, 0);
    let cumulative = 0;

    return points.map((p) => {
      cumulative += p.count;
      return { x: p.x, probability: (cumulative / n) * 100 };
    });
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
    if (step !== "simulation" || !selectedOrg || !selectedProject || !selectedTeam) return;
    let active = true;

    (async () => {
      try {
        const options = await getTeamOptions(selectedOrg, selectedProject, selectedTeam);
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
  }, [step, selectedOrg, selectedProject, selectedTeam]);

  function resetForTeamSelection(): void {
    setErr("");
    setResult(null);
    setActiveChartTab("throughput");
  }

  function resetAll(): void {
    setErr("");
    setLoading(false);
    setResult(null);
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
    setErr("");
    setLoading(true);
    setResult(null);
    setActiveChartTab("throughput");
    try {
      const payload: ForecastRequestPayload = {
        org: selectedOrg,
        project: selectedProject,
        mode: simulationMode,
        team_name: selectedTeam,
        area_path: null,
        start_date: startDate,
        end_date: endDate,
        backlog_size: simulationMode === "backlog_to_weeks" ? Number(backlogSize) : undefined,
        target_weeks: simulationMode === "weeks_to_items" ? Number(targetWeeks) : undefined,
        done_states: doneStates,
        work_item_types: types,
        n_sims: Number(nSims),
      };
      const response = await postForecast(payload);
      setResult(response);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return {
    loading,
    err,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    simulationMode,
    setSimulationMode,
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
