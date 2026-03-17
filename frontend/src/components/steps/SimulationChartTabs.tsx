import { useMemo } from "react";
import {
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
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from "../ui/tabs";
import { useSimulationContext } from "../../hooks/SimulationContext";
import { computeThroughputReliability } from "../../utils/simulation";

function formatReliabilityMetric(value: number): string {
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

export default function SimulationChartTabs() {
  const { selectedTeam, simulation } = useSimulationContext();
  const s = simulation;

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
    if (s.result?.throughput_reliability) {
      return s.result.throughput_reliability;
    }
    return computeThroughputReliability((s.throughputData ?? []).map((point) => point.throughput)) ?? undefined;
  }, [s.result?.throughput_reliability, s.throughputData]);

  const reliabilityTone = useMemo(() => getReliabilityTone(reliability?.label), [reliability?.label]);

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

  async function handleExportReport(): Promise<void> {
    if (!s.result) return;
    const { exportSimulationPrintReport } = await import("./simulationPrintReport");
    exportSimulationPrintReport({
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
      resultKind: s.result.result_kind,
      displayPercentiles: s.displayPercentiles,
      throughputReliability: reliability,
      throughputPoints: throughputWithMovingAverage,
      distributionPoints: s.mcHistData,
      probabilityPoints: s.probabilityCurveData,
    });
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      {s.result ? (
        <TabsRoot value={s.activeChartTab} onValueChange={(value) => s.setActiveChartTab(value as typeof s.activeChartTab)}>
          <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <TabsList>
              <TabsTrigger value="throughput">Throughput</TabsTrigger>
              <TabsTrigger value="distribution">Distribution</TabsTrigger>
              <TabsTrigger value="probability">Probabilités</TabsTrigger>
            </TabsList>
            <div className="flex flex-nowrap items-center gap-2 overflow-x-auto">
              <button
                type="button"
                onClick={() => void handleExportReport()}
                className="whitespace-nowrap rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm font-semibold text-[var(--text)]"
                title="Ouvrir le rapport imprimable"
              >
                Rapport
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

          <TabsContent value="throughput">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h4 className="m-0 text-base font-bold">Throughput hebdomadaire</h4>
              {reliability && (
                <span
                  className={`inline-flex items-center self-start rounded-full border px-3 py-1 text-xs font-semibold ${reliabilityTone}`}
                  title={`CV ${formatReliabilityMetric(reliability.cv)} · IQR ${formatReliabilityMetric(reliability.iqr_ratio)} · pente ${formatReliabilityMetric(reliability.slope_norm)} · ${reliability.samples_count} semaines`}
                >
                  Fiabilite {reliability.label} · CV {formatReliabilityMetric(reliability.cv)}
                </span>
              )}
            </div>
            <p className="mb-3 mt-1 text-sm text-[var(--muted)]">
              Chaque point représente le nombre d&apos;items terminés sur une semaine historique.
            </p>
            <div className="h-[52vh] min-h-[320px] w-full min-w-0 overflow-hidden">
              <ResponsiveContainer>
                <ComposedChart data={throughputWithMovingAverage} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
                  <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="4 4" />
                  <XAxis dataKey="week" tick={{ fill: "var(--chart-axis)", fontSize: 12 }} />
                  <YAxis
                    domain={[0, getThroughputYAxisMax]}
                    allowDecimals={false}
                    tick={{ fill: "var(--chart-axis)", fontSize: 12 }}
                  />
                  <Tooltip {...s.tooltipBaseProps} content={renderThroughputTooltip} />
                  <Legend />
                  <Bar dataKey="throughput" name="Throughput" fill="var(--p90)" radius={[5, 5, 0, 0]} />
                  <Line type="monotone" dataKey="throughput" dot={false} strokeWidth={2} stroke="var(--brand)" name="Courbe" />
                  <Line
                    type="monotone"
                    dataKey="movingAverage"
                    dot={false}
                    strokeWidth={2.5}
                    stroke="var(--p70)"
                    strokeDasharray="8 4"
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
            <div className="h-[52vh] min-h-[320px] w-full min-w-0 overflow-hidden">
              <ResponsiveContainer>
                <ComposedChart data={s.mcHistData} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
                  <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="4 4" />
                  <XAxis dataKey="x" tick={{ fill: "var(--chart-axis)", fontSize: 12 }} />
                  <YAxis domain={[0, "auto"]} allowDecimals={false} tick={{ fill: "var(--chart-axis)", fontSize: 12 }} />
                  <Tooltip
                    {...s.tooltipBaseProps}
                    formatter={(v, name) => {
                      if (name === "count") return [Number(v).toFixed(0), "Fréquence"];
                      if (name === "gauss") return [Number(v).toFixed(1), "Courbe lissée"];
                      return [Number(v).toFixed(1), name];
                    }}
                  />
                  <Legend />
                  <Bar dataKey="count" fill="var(--p90)" radius={[5, 5, 0, 0]} />
                  <Line type="monotone" dataKey="gauss" dot={false} strokeWidth={2.5} stroke="var(--brand)" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value="probability">
            <h4 className="m-0 text-base font-bold">
              {s.result?.result_kind === "items"
                ? "Probabilité d'atteindre au moins X items"
                : "Probabilité de terminer en au plus X semaines"}
            </h4>
            <p className="mb-3 mt-1 text-sm text-[var(--muted)]">
              Cette courbe indique la probabilité cumulée pour chaque valeur possible.
            </p>
            <div className="h-[52vh] min-h-[320px] w-full min-w-0 overflow-hidden">
              <ResponsiveContainer>
                <LineChart data={s.probabilityCurveData} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
                  <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="4 4" />
                  <XAxis dataKey="x" tick={{ fill: "var(--chart-axis)", fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fill: "var(--chart-axis)", fontSize: 12 }} />
                  <Tooltip
                    {...s.tooltipBaseProps}
                    formatter={(v) => [
                      `${Number(v).toFixed(1)}%`,
                      s.result?.result_kind === "items" ? "P(X >= valeur)" : "P(X <= valeur)",
                    ]}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="probability" dot={false} strokeWidth={2.5} stroke="var(--brand)" />
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

