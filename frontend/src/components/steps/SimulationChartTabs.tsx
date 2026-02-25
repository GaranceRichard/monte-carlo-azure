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
import { exportSimulationPdf } from "./simulationPdfExport";
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from "../ui/tabs";
import {
  useSimulationChartsContext as useChartsContext,
  useSimulationDateRangeContext as useDateRangeContext,
  useSimulationFiltersContext as useFiltersContext,
  useSimulationForecastControlsContext as useForecastControlsContext,
  useSimulationMetaContext as useMetaContext,
  useSimulationResultContext as useResultContext,
} from "./SimulationContext";

export default function SimulationChartTabs() {
  const { selectedTeam } = useMetaContext();
  const { result, displayPercentiles } = useResultContext();
  const {
    activeChartTab,
    setActiveChartTab,
    throughputData,
    mcHistData,
    probabilityCurveData,
    tooltipBaseProps,
    resetForTeamSelection,
    exportThroughputCsv,
  } = useChartsContext();
  const { startDate, endDate } = useDateRangeContext();
  const { simulationMode, includeZeroWeeks, backlogSize, targetWeeks, nSims, capacityPercent, reducedCapacityWeeks } =
    useForecastControlsContext();
  const { types, doneStates } = useFiltersContext();

  const throughputWithMovingAverage = useMemo(() => {
    const windowSize = 4;
    return throughputData.map((point, idx, arr) => {
      const start = Math.max(0, idx - windowSize + 1);
      const slice = arr.slice(start, idx + 1);
      const average = slice.reduce((sum, p) => sum + p.throughput, 0) / slice.length;
      return { ...point, movingAverage: Number(average.toFixed(2)) };
    });
  }, [throughputData]);

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

  function handleExportPdf(): void {
    if (!result) return;
    exportSimulationPdf({
      selectedTeam,
      startDate,
      endDate,
      simulationMode,
      includeZeroWeeks,
      types,
      doneStates,
      backlogSize,
      targetWeeks,
      nSims,
      capacityPercent,
      reducedCapacityWeeks,
      resultKind: result.result_kind,
      displayPercentiles,
      throughputPoints: throughputWithMovingAverage,
      distributionPoints: mcHistData,
      probabilityPoints: probabilityCurveData,
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {result ? (
        <TabsRoot value={activeChartTab} onValueChange={(value) => setActiveChartTab(value as typeof activeChartTab)}>
          <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <TabsList>
              <TabsTrigger value="throughput">Throughput</TabsTrigger>
              <TabsTrigger value="distribution">Distribution</TabsTrigger>
              <TabsTrigger value="probability">Probabilités</TabsTrigger>
            </TabsList>
            <div className="flex flex-nowrap items-center gap-2 overflow-x-auto">
              <button
                type="button"
                onClick={handleExportPdf}
                className="whitespace-nowrap rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm font-semibold text-[var(--text)]"
                title="Ouvrir le document imprimable pour export PDF"
              >
                PDF
              </button>
              <button
                type="button"
                onClick={exportThroughputCsv}
                className="whitespace-nowrap rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm font-semibold text-[var(--text)]"
                title="Exporter le throughput hebdomadaire en CSV"
              >
                CSV
              </button>
              <button
                type="button"
                onClick={resetForTeamSelection}
                className="whitespace-nowrap rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm font-semibold text-[var(--text)]"
                title="Revenir a l'etat initial (simulation non lancee)"
              >
                Réinitialiser
              </button>
            </div>
          </div>

          <TabsContent value="throughput">
            <h4 className="m-0 text-base font-bold">Throughput hebdomadaire</h4>
            <p className="mb-3 mt-1 text-sm text-[var(--muted)]">
              Chaque point represente le nombre d&apos;items termines sur une semaine historique.
            </p>
            <div className="h-[52vh] min-h-[320px] w-full">
              <ResponsiveContainer>
                <ComposedChart data={throughputWithMovingAverage} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
                  <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="4 4" />
                  <XAxis dataKey="week" tick={{ fill: "var(--chart-axis)", fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fill: "var(--chart-axis)", fontSize: 12 }} />
                  <Tooltip {...tooltipBaseProps} content={renderThroughputTooltip} />
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
              Chaque barre represente la frequence d&apos;une duree simulee sur l&apos;ensemble des runs.
            </p>
            <div className="h-[52vh] min-h-[320px] w-full">
              <ResponsiveContainer>
                <ComposedChart data={mcHistData} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
                  <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="4 4" />
                  <XAxis dataKey="x" tick={{ fill: "var(--chart-axis)", fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fill: "var(--chart-axis)", fontSize: 12 }} />
                  <Tooltip
                    {...tooltipBaseProps}
                    formatter={(v, name) => {
                      if (name === "count") return [Number(v).toFixed(0), "Frequence"];
                      if (name === "gauss") return [Number(v).toFixed(1), "Courbe lissee"];
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
              {result?.result_kind === "items"
                ? "Probabilite d'atteindre au moins X items"
                : "Probabilite de terminer en au plus X semaines"}
            </h4>
            <p className="mb-3 mt-1 text-sm text-[var(--muted)]">
              Cette courbe indique la probabilite cumulee pour chaque valeur possible.
            </p>
            <div className="h-[52vh] min-h-[320px] w-full">
              <ResponsiveContainer>
                <LineChart data={probabilityCurveData} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
                  <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="4 4" />
                  <XAxis dataKey="x" tick={{ fill: "var(--chart-axis)", fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fill: "var(--chart-axis)", fontSize: 12 }} />
                  <Tooltip
                    {...tooltipBaseProps}
                    formatter={(v) => [
                      `${Number(v).toFixed(1)}%`,
                      result?.result_kind === "items" ? "P(X >= valeur)" : "P(X <= valeur)",
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
