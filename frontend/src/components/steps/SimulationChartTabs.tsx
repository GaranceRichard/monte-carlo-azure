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
      capacityPercent: s.capacityPercent,
      reducedCapacityWeeks: s.reducedCapacityWeeks,
      resultKind: s.result.result_kind,
      displayPercentiles: s.displayPercentiles,
      throughputPoints: throughputWithMovingAverage,
      distributionPoints: s.mcHistData,
      probabilityPoints: s.probabilityCurveData,
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {s.result ? (
        <TabsRoot value={s.activeChartTab} onValueChange={(value) => s.setActiveChartTab(value as typeof s.activeChartTab)}>
          <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <TabsList>
              <TabsTrigger value="throughput">Throughput</TabsTrigger>
              <TabsTrigger value="distribution">Distribution</TabsTrigger>
              <TabsTrigger value="probability">Probabilit?s</TabsTrigger>
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
                title="Revenir ? l'?tat initial (simulation non lanc?e)"
              >
                R?initialiser
              </button>
            </div>
          </div>

          <TabsContent value="throughput">
            <h4 className="m-0 text-base font-bold">Throughput hebdomadaire</h4>
            <p className="mb-3 mt-1 text-sm text-[var(--muted)]">
              Chaque point repr?sente le nombre d&apos;items termin?s sur une semaine historique.
            </p>
            <div className="h-[52vh] min-h-[320px] w-full">
              <ResponsiveContainer>
                <ComposedChart data={throughputWithMovingAverage} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
                  <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="4 4" />
                  <XAxis dataKey="week" tick={{ fill: "var(--chart-axis)", fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fill: "var(--chart-axis)", fontSize: 12 }} />
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
              Chaque barre repr?sente la fr?quence d&apos;une dur?e simul?e sur l&apos;ensemble des runs.
            </p>
            <div className="h-[52vh] min-h-[320px] w-full">
              <ResponsiveContainer>
                <ComposedChart data={s.mcHistData} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
                  <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="4 4" />
                  <XAxis dataKey="x" tick={{ fill: "var(--chart-axis)", fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fill: "var(--chart-axis)", fontSize: 12 }} />
                  <Tooltip
                    {...s.tooltipBaseProps}
                    formatter={(v, name) => {
                      if (name === "count") return [Number(v).toFixed(0), "Fr?quence"];
                      if (name === "gauss") return [Number(v).toFixed(1), "Courbe liss?e"];
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
                ? "Probabilit? d'atteindre au moins X items"
                : "Probabilit? de terminer en au plus X semaines"}
            </h4>
            <p className="mb-3 mt-1 text-sm text-[var(--muted)]">
              Cette courbe indique la probabilit? cumul?e pour chaque valeur possible.
            </p>
            <div className="h-[52vh] min-h-[320px] w-full">
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
