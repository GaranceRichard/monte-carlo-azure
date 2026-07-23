import { useMemo } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useState, type ReactNode } from "react";
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from "../ui/tabs";
import { useSimulationContext } from "../../hooks/SimulationContext";
import { computeRiskScoreFromPercentiles, computeThroughputReliability } from "../../utils/simulation";
import { buildSimulationDecisionLanguage } from "../../utils/simulationDecisionDiagnostic";
import {
  chartLegendVisualByDataKey,
  SMOOTHED_SERIES_STROKE_DASHARRAY,
  type ChartLegendVisual,
} from "./chartVisualSemantics";

const chartMargin = { top: 8, right: 12, left: 4, bottom: 22 };
const xAxisTick = { fill: "var(--chart-axis)", fontSize: 12 };
const yAxisTick = { fill: "var(--chart-axis)", fontSize: 12 };
const sharedLegendProps = { verticalAlign: "bottom" as const, align: "center" as const, height: 44 };

function formatReliabilityMetric(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

function formatCycleTimeMetric(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "-";
  return value.toFixed(2).replace(".", ",");
}

function getReliabilityTone(label?: string): string {
  if (label === "fiable") return "border-emerald-600 bg-emerald-50 text-emerald-700";
  if (label === "incertain") return "border-amber-500 bg-amber-50 text-amber-700";
  if (label === "fragile") return "border-red-600 bg-red-50 text-red-700";
  if (label === "non fiable") return "border-black bg-neutral-200 text-black";
  return "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)]";
}

export function getThroughputYAxisMax(dataMax: number): number {
  if (!Number.isFinite(dataMax) || dataMax <= 0) return 1;
  return Math.max(1, Math.ceil(dataMax * 1.1), dataMax + 1);
}

export function getCycleTimeYAxisMax(dataMax: number): number {
  if (!Number.isFinite(dataMax) || dataMax <= 0) return 1;
  return Math.max(1, Number((dataMax * 1.1).toFixed(1)));
}

export default function SimulationChartTabs() {
  const { selectedTeam, simulation } = useSimulationContext();
  const s = simulation;
  const [loadingReport, setLoadingReport] = useState(false);

  const throughputWithMovingAverage = useMemo(() => {
    const windowSize = 4;
    return s.throughputData.map((point, idx, arr) => {
      const start = Math.max(0, idx - windowSize + 1);
      const slice = arr.slice(start, idx + 1);
      const average = slice.reduce((sum, p) => sum + p.throughput, 0) / slice.length;
      return { ...point, movingAverage: Number(average.toFixed(2)) };
    });
  }, [s.throughputData]);

  const reliability = useMemo(() => {
    if (s.result?.throughputReliability) {
      return s.result.throughputReliability;
    }
    return computeThroughputReliability((s.throughputData ?? []).map((point) => point.throughput)) ?? undefined;
  }, [s.result?.throughputReliability, s.throughputData]);

  const reliabilityTone = useMemo(() => getReliabilityTone(reliability?.label), [reliability?.label]);
  const decisionDiagnostic = useMemo(() => buildSimulationDecisionLanguage({
    hasResult: Boolean(s.result),
    throughputSamples: (s.throughputData ?? []).map((point) => point.throughput),
    includeZeroWeeks: s.includeZeroWeeks,
    adoDataWarning: s.warning,
    percentiles: s.displayPercentiles,
    completionSummary: s.result?.completionSummary,
    riskScore: computeRiskScoreFromPercentiles(s.simulationMode, s.displayPercentiles),
    throughputReliability: reliability,
    selectedOrg: s.selectedOrg,
    selectedProject: s.selectedProject,
    selectedTeam,
    startDate: s.startDate,
    endDate: s.endDate,
    simulationMode: s.simulationMode,
    backlogSize: s.backlogSize,
    targetWeeks: s.targetWeeks,
    types: s.types,
    doneStates: s.doneStates,
    usableWeeks: s.sampleStats?.usedWeeks,
    history: s.simulationHistory,
  }), [reliability, s, selectedTeam]);
  const cycleTimeChartData = useMemo(() => {
    const observedByWeek = new Map<string, { weightedSum: number; count: number }>();
    s.cycleTimeDaysData.forEach((point) => {
      const current = observedByWeek.get(point.week) ?? { weightedSum: 0, count: 0 };
      current.weightedSum += point.cycleTimeDays * point.count;
      current.count += point.count;
      observedByWeek.set(point.week, current);
    });

    return s.cycleTimeTrendData.map((point) => {
      const observed = observedByWeek.get(point.week);
      const observedAverage =
        observed && observed.count > 0 ? Number((observed.weightedSum / observed.count).toFixed(2)) : null;
      return {
        week: point.week,
        averageDays: point.averageDays,
        lowerBoundDays: point.lowerBoundDays,
        upperBoundDays: point.upperBoundDays,
        bandBaseDays: point.lowerBoundDays,
        bandRangeDays: Math.max(0, Number((point.upperBoundDays - point.lowerBoundDays).toFixed(2))),
        observedAverage,
        itemCount: point.itemCount,
      };
    });
  }, [s.cycleTimeDaysData, s.cycleTimeTrendData]);

  const renderThroughputTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: ReadonlyArray<{ dataKey?: string; value?: number }>;
    label?: string | number;
  }) => {
    if (!active || !payload?.length) return null;
    const throughputPoint = payload.find((p) => p.dataKey === "throughput");
    const movingAvgPoint = payload.find((p) => p.dataKey === "movingAverage");
    return (
      <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 10px" }}>
        <div style={{ color: "var(--muted)", fontWeight: 700, marginBottom: 4 }}>{label}</div>
        <div style={{ color: "var(--text)", fontWeight: 700 }}>throughput: {Number(throughputPoint?.value ?? 0).toFixed(0)}</div>
        <div style={{ color: "var(--text)", fontWeight: 700 }}>moyenne mobile: {Number(movingAvgPoint?.value ?? 0).toFixed(2)}</div>
      </div>
    );
  };

  const renderCycleTimeTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: ReadonlyArray<{ dataKey?: string; value?: number | null; payload?: { itemCount?: number } }>;
    label?: string | number;
  }) => {
    if (!active || !payload?.length) return null;
    const averagePoint = payload.find((p) => p.dataKey === "averageDays");
    const observedPoint = payload.find((p) => p.dataKey === "observedAverage");
    const itemCount = averagePoint?.payload?.itemCount ?? 0;

    return (
      <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 10px" }}>
        <div style={{ color: "var(--muted)", fontWeight: 700, marginBottom: 4 }}>{label}</div>
        <div style={{ color: "var(--text)", fontWeight: 700 }}>
          moyenne glissante: {formatCycleTimeMetric(Number(averagePoint?.value ?? 0))} j
        </div>
        <div style={{ color: "var(--text)", fontWeight: 700 }}>
          cycle time observé: {formatCycleTimeMetric(observedPoint?.value == null ? null : Number(observedPoint.value))} j
        </div>
        <div style={{ color: "var(--muted)", fontWeight: 700, marginTop: 4 }}>{itemCount} items</div>
      </div>
    );
  };

  const renderChartLegend =
    (allowedKeys?: ReadonlyArray<string>) =>
    ({
      payload,
    }: {
      payload?: ReadonlyArray<{ value?: string | number; color?: string; dataKey?: unknown }>;
    } = {}): ReactNode => {
      const items = (payload ?? []).filter((entry) => {
        if (!entry.value) return false;
        if (!allowedKeys?.length) return true;
        return typeof entry.dataKey === "string" && allowedKeys.includes(entry.dataKey);
      });
      if (!items.length) return null;

      return (
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 px-2 text-sm font-medium text-[var(--text)]">
          {items.map((item) => (
            <div key={String(item.dataKey ?? item.value)} className="flex items-center gap-2 whitespace-nowrap">
              {(() => {
                const visual: ChartLegendVisual =
                  typeof item.dataKey === "string" ? chartLegendVisualByDataKey[item.dataKey] ?? "solid-line" : "solid-line";
                const markerStyle = { backgroundColor: item.color, borderColor: item.color };

                if (visual === "bar") {
                  return <span aria-hidden="true" data-visual-style={visual} className="inline-block h-3 w-4 shrink-0 rounded-sm" style={markerStyle} />;
                }
                if (visual === "band") {
                  return <span aria-hidden="true" data-visual-style={visual} className="inline-block h-3 w-5 shrink-0 rounded-sm opacity-20" style={markerStyle} />;
                }
                if (visual === "point") {
                  return <span aria-hidden="true" data-visual-style={visual} className="inline-block h-3 w-3 shrink-0 rounded-full" style={markerStyle} />;
                }

                return (
                  <span
                    aria-hidden="true"
                    data-visual-style={visual}
                    className="inline-block w-5 shrink-0 border-t-2"
                    style={{
                      borderColor: item.color,
                      borderTopStyle: visual === "dashed-line" ? "dashed" : "solid",
                    }}
                  />
                );
              })()}
              <span>{item.value}</span>
            </div>
          ))}
        </div>
      );
    };

  async function handleExportReport(): Promise<void> {
    if (!s.result || loadingReport) return;
    setLoadingReport(true);
    const { exportSimulationPrintReport } = await import("./simulationPrintReport");
    try {
      await exportSimulationPrintReport({
        selectedTeam,
        startDate: s.startDate,
        endDate: s.endDate,
        simulationMode: s.simulationMode,
        includeZeroWeeks: s.includeZeroWeeks,
        types: s.types,
        doneStates: s.doneStates,
        backlogSize: s.backlogSize,
        targetWeeks: s.targetWeeks,
        nSims: s.nSims,
        resultKind: s.result.resultKind,
        displayPercentiles: s.displayPercentiles,
        completionSummary: s.result.completionSummary,
        throughputReliability: reliability,
        cycleTimePoints: s.cycleTimeDaysData,
        cycleTimeTrendPoints: s.cycleTimeTrendData,
        throughputPoints: throughputWithMovingAverage,
        distributionPoints: s.mcHistData,
        probabilityPoints: s.probabilityCurveData,
        decisionDiagnostic,
      });
    } finally {
      setLoadingReport(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-visible pb-2">
      {s.result ? (
        <TabsRoot value={s.activeChartTab} onValueChange={(value) => s.setActiveChartTab(value as typeof s.activeChartTab)}>
          <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <TabsList>
              <TabsTrigger value="cycle_time">Cycle Time</TabsTrigger>
              <TabsTrigger value="throughput">Throughput</TabsTrigger>
              <TabsTrigger value="distribution">Distribution</TabsTrigger>
              <TabsTrigger value="probability">Probabilités</TabsTrigger>
            </TabsList>
            <div className="flex flex-nowrap items-center gap-2 overflow-x-auto">
              <button
                type="button"
                onClick={() => void handleExportReport()}
                disabled={loadingReport}
                className="whitespace-nowrap rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm font-semibold text-[var(--text)]"
                title="Telecharger le rapport PDF"
              >
                {loadingReport ? "Generation..." : "Rapport"}
              </button>
              <button
                type="button"
                onClick={s.exportThroughputCsv}
                className="whitespace-nowrap rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm font-semibold text-[var(--text)]"
                title="Exporter le throughput hebdomadaire en CSV"
              >
                CSV
              </button>
              <button
                type="button"
                onClick={s.resetForTeamSelection}
                className="whitespace-nowrap rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm font-semibold text-[var(--text)]"
                title="Revenir à l'état initial (simulation non lancée)"
              >
                Réinitialiser
              </button>
            </div>
          </div>

          <TabsContent value="cycle_time">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3 text-center">
                <div className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Items</div>
                <div className="mt-1 text-lg font-extrabold text-[var(--text)]">{s.cycleTimeSummary.itemCount}</div>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3 text-center">
                <div className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Cycle Time moyen</div>
                <div className="mt-1 text-lg font-extrabold text-[var(--text)]">
                  {formatCycleTimeMetric(s.cycleTimeSummary.averageDays)} j
                </div>
              </div>
            </div>
            {s.cycleTimeSummary.hasSufficientData ? (
              <div className="sim-chart-wrap h-[52vh] min-h-[320px] pb-6">
                <ResponsiveContainer>
                  <ComposedChart data={cycleTimeChartData} margin={chartMargin}>
                    <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="4 4" />
                    <XAxis dataKey="week" tick={xAxisTick} tickMargin={10} minTickGap={24} />
                    <YAxis domain={[0, getCycleTimeYAxisMax]} tick={yAxisTick} />
                    <Tooltip {...s.tooltipBaseProps} content={renderCycleTimeTooltip} />
                    <Legend {...sharedLegendProps} content={renderChartLegend(["bandRangeDays", "averageDays", "observedAverage"])} />
                    <Area
                      type="monotone"
                      dataKey="bandBaseDays"
                      stackId="cycle-band"
                      stroke="transparent"
                      fill="transparent"
                      legendType="none"
                      isAnimationActive={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="bandRangeDays"
                      stackId="cycle-band"
                      name="Variabilité"
                      stroke="transparent"
                      fill="var(--p90)"
                      fillOpacity={0.2}
                      legendType="rect"
                    />
                    <Line
                      type="monotone"
                      dataKey="averageDays"
                      dot={false}
                      strokeWidth={2.5}
                      stroke="var(--brand)"
                      strokeDasharray={SMOOTHED_SERIES_STROKE_DASHARRAY}
                      name="Moyenne glissante"
                    />
                    <Line
                      type="monotone"
                      dataKey="observedAverage"
                      dot={{ r: 4, fill: "var(--p70)", stroke: "var(--p70)" }}
                      strokeWidth={0}
                      stroke="var(--p70)"
                      name="Cycle time observé"
                      connectNulls
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="grid h-[52vh] min-h-[320px] place-items-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] p-6 text-center text-[var(--muted)]">
                Donnees insuffisantes pour afficher le cycle time. Au moins 2 semaines avec items termines sont requises.
              </div>
            )}
          </TabsContent>

          <TabsContent value="throughput">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h4 className="m-0 text-base font-bold">Throughput hebdomadaire</h4>
              {reliability && (
                <span
                  className={`inline-flex items-center self-start rounded-full border px-3 py-1 text-xs font-semibold ${reliabilityTone}`}
                  title={`CV ${formatReliabilityMetric(reliability.cv)} · IQR ${formatReliabilityMetric(reliability.iqrRatio)} · pente ${formatReliabilityMetric(reliability.slopeNorm)} · ${reliability.samplesCount} semaines`}
                >
                  Fiabilite {reliability.label} · CV {formatReliabilityMetric(reliability.cv)}
                </span>
              )}
            </div>
            <p className="mb-3 mt-1 text-sm text-[var(--muted)]">
              Chaque point représente le nombre d&apos;items terminés sur une semaine historique.
            </p>
            <div className="sim-chart-wrap h-[52vh] min-h-[320px] pb-6">
              <ResponsiveContainer>
                <ComposedChart data={throughputWithMovingAverage} margin={chartMargin}>
                  <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="4 4" />
                  <XAxis dataKey="week" tick={xAxisTick} tickMargin={10} minTickGap={24} />
                  <YAxis
                    domain={[0, getThroughputYAxisMax]}
                    allowDecimals={false}
                    tick={yAxisTick}
                  />
                  <Tooltip {...s.tooltipBaseProps} content={renderThroughputTooltip} />
                  <Legend {...sharedLegendProps} content={renderChartLegend(["throughput", "movingAverage"])} />
                  <Bar dataKey="throughput" name="Throughput" fill="var(--p90)" radius={[5, 5, 0, 0]} />
                  <Line
                    type="monotone"
                    dataKey="movingAverage"
                    dot={false}
                    strokeWidth={2.5}
                    stroke="var(--p70)"
                    strokeDasharray={SMOOTHED_SERIES_STROKE_DASHARRAY}
                    name="Moyenne mobile"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value="distribution">
            <h4 className="m-0 text-base font-bold">Distribution Monte Carlo</h4>
            <p className="mb-3 mt-1 text-sm text-[var(--muted)]">
              Chaque barre représente la fréquence d&apos;une durée simulée sur l&apos;ensemble des runs.
            </p>
            <div className="sim-chart-wrap h-[52vh] min-h-[320px] pb-6">
              <ResponsiveContainer>
                <ComposedChart data={s.mcHistData} margin={chartMargin}>
                  <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="4 4" />
                  <XAxis dataKey="x" tick={xAxisTick} tickMargin={10} minTickGap={24} />
                  <YAxis domain={[0, "auto"]} allowDecimals={false} tick={yAxisTick} />
                  <Tooltip
                    {...s.tooltipBaseProps}
                    formatter={(v, name) => {
                      if (name === "count") return [Number(v).toFixed(0), "Fréquence"];
                      if (name === "gauss") return [Number(v).toFixed(1), "Courbe lissée"];
                      return [Number(v).toFixed(1), name];
                    }}
                  />
                  <Legend {...sharedLegendProps} content={renderChartLegend(["count", "gauss"])} />
                  <Bar dataKey="count" name="Fréquence" fill="var(--p90)" radius={[5, 5, 0, 0]} />
                  <Line
                    type="monotone"
                    dataKey="gauss"
                    dot={false}
                    strokeWidth={2.5}
                    stroke="var(--brand)"
                    strokeDasharray={SMOOTHED_SERIES_STROKE_DASHARRAY}
                    name="Courbe lissée"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value="probability">
            <h4 className="m-0 text-base font-bold">
              {s.result?.resultKind === "items"
                ? "Probabilité d'atteindre au moins X items"
                : "Probabilité de terminer en au plus X semaines"}
            </h4>
            <p className="mb-3 mt-1 text-sm text-[var(--muted)]">
              Cette courbe indique la probabilité cumulée pour chaque valeur possible.
            </p>
            <div className="sim-chart-wrap h-[52vh] min-h-[320px] pb-6">
              <ResponsiveContainer>
                <LineChart data={s.probabilityCurveData} margin={chartMargin}>
                  <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="4 4" />
                  <XAxis dataKey="x" tick={xAxisTick} tickMargin={10} minTickGap={24} />
                  <YAxis domain={[0, 100]} tick={yAxisTick} />
                  <Tooltip
                    {...s.tooltipBaseProps}
                    formatter={(v) => [
                      `${Number(v).toFixed(1)}%`,
                      s.result?.resultKind === "items" ? "P(X >= valeur)" : "P(X <= valeur)",
                    ]}
                  />
                  <Legend {...sharedLegendProps} content={renderChartLegend(["probability"])} />
                  <Line type="monotone" dataKey="probability" dot={false} strokeWidth={2.5} stroke="var(--brand)" name="Probabilité" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>
        </TabsRoot>
      ) : (
        <div className="grid h-full place-items-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] p-6 text-[var(--muted)]">
          Lancez une simulation pour afficher les graphiques.
        </div>
      )}
    </div>
  );
}
