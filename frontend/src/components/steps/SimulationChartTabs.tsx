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
import type { SimulationViewModel } from "../../hooks/useSimulation";
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from "../ui/tabs";

type SimulationChartTabsProps = {
  selectedTeam: string;
  simulation: Pick<
    SimulationViewModel,
    | "result"
    | "activeChartTab"
    | "setActiveChartTab"
    | "throughputData"
    | "mcHistData"
    | "probabilityCurveData"
    | "tooltipBaseProps"
    | "resetForTeamSelection"
    | "exportThroughputCsv"
    | "displayPercentiles"
    | "startDate"
    | "endDate"
    | "simulationMode"
    | "includeZeroWeeks"
    | "types"
    | "doneStates"
    | "backlogSize"
    | "targetWeeks"
    | "nSims"
    | "capacityPercent"
    | "reducedCapacityWeeks"
  >;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildLinearTicks(minValue: number, maxValue: number, tickCount: number): number[] {
  if (!Number.isFinite(minValue) || !Number.isFinite(maxValue) || tickCount <= 1) return [0];
  if (minValue === maxValue) return [minValue];
  const ticks: number[] = [];
  const step = (maxValue - minValue) / (tickCount - 1);
  for (let i = 0; i < tickCount; i += 1) ticks.push(minValue + step * i);
  return ticks;
}

export default function SimulationChartTabs({ selectedTeam, simulation }: SimulationChartTabsProps) {
  const {
    result,
    activeChartTab,
    setActiveChartTab,
    throughputData,
    mcHistData,
    probabilityCurveData,
    tooltipBaseProps,
    resetForTeamSelection,
    exportThroughputCsv,
    displayPercentiles,
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
  } = simulation;

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

  const throughputSvg = useMemo(() => {
    if (!throughputWithMovingAverage.length) return "";
    const width = 960;
    const height = 300;
    const margin = { top: 18, right: 20, bottom: 40, left: 54 };
    const plotW = width - margin.left - margin.right;
    const plotH = height - margin.top - margin.bottom;
    const maxY = Math.max(1, ...throughputWithMovingAverage.map((p) => Math.max(p.throughput, p.movingAverage)));
    const yMax = Math.ceil(maxY);
    const yScale = (value: number) => margin.top + plotH - (value / yMax) * plotH;
    const pointX = (idx: number) => margin.left + (throughputWithMovingAverage.length === 1 ? plotW / 2 : (idx / (throughputWithMovingAverage.length - 1)) * plotW);
    const barW = Math.max(3, Math.min(20, plotW / Math.max(throughputWithMovingAverage.length * 1.6, 1)));
    const yTicks = buildLinearTicks(0, yMax, 6);
    const xLabelStep = Math.max(1, Math.ceil(throughputWithMovingAverage.length / 10));
    const throughputLine = throughputWithMovingAverage.map((point, idx) => `${pointX(idx).toFixed(1)},${yScale(point.throughput).toFixed(1)}`).join(" ");
    const movingAverageLine = throughputWithMovingAverage.map((point, idx) => `${pointX(idx).toFixed(1)},${yScale(point.movingAverage).toFixed(1)}`).join(" ");

    const gridLines = yTicks
      .map((tick) => {
        const y = yScale(tick);
        return `<line x1="${margin.left}" y1="${y.toFixed(1)}" x2="${(width - margin.right).toFixed(1)}" y2="${y.toFixed(1)}" stroke="#d1d5db" stroke-width="1" />`;
      })
      .join("");

    const yLabels = yTicks
      .map((tick) => {
        const y = yScale(tick);
        return `<text x="${margin.left - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="#6b7280">${tick.toFixed(0)}</text>`;
      })
      .join("");

    const bars = throughputWithMovingAverage
      .map((point, idx) => {
        const x = pointX(idx) - barW / 2;
        const y = yScale(point.throughput);
        const h = margin.top + plotH - y;
        return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" fill="#93c5fd" />`;
      })
      .join("");

    const xLabels = throughputWithMovingAverage
      .map((point, idx) => {
        if (idx % xLabelStep !== 0 && idx !== throughputWithMovingAverage.length - 1) return "";
        return `<text x="${pointX(idx).toFixed(1)}" y="${height - 12}" text-anchor="middle" font-size="10" fill="#6b7280">${escapeHtml(point.week)}</text>`;
      })
      .join("");

    return `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Graphique throughput">
        <rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff" />
        ${gridLines}
        <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${height - margin.bottom}" stroke="#9ca3af" stroke-width="1" />
        <line x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}" stroke="#9ca3af" stroke-width="1" />
        ${bars}
        <polyline points="${throughputLine}" fill="none" stroke="#2563eb" stroke-width="2" />
        <polyline points="${movingAverageLine}" fill="none" stroke="#f97316" stroke-width="2.4" stroke-dasharray="8 4" />
        ${yLabels}
        ${xLabels}
      </svg>
    `;
  }, [throughputWithMovingAverage]);

  const distributionSvg = useMemo(() => {
    if (!mcHistData.length) return "";
    const width = 960;
    const height = 300;
    const margin = { top: 18, right: 20, bottom: 40, left: 54 };
    const plotW = width - margin.left - margin.right;
    const plotH = height - margin.top - margin.bottom;
    const maxY = Math.max(1, ...mcHistData.map((point) => Math.max(point.count, point.gauss)));
    const yMax = Math.ceil(maxY);
    const yScale = (value: number) => margin.top + plotH - (value / yMax) * plotH;
    const pointX = (idx: number) => margin.left + (mcHistData.length === 1 ? plotW / 2 : (idx / (mcHistData.length - 1)) * plotW);
    const barW = Math.max(3, Math.min(24, plotW / Math.max(mcHistData.length * 1.6, 1)));
    const yTicks = buildLinearTicks(0, yMax, 6);
    const xLabelStep = Math.max(1, Math.ceil(mcHistData.length / 10));
    const smoothLine = mcHistData.map((point, idx) => `${pointX(idx).toFixed(1)},${yScale(point.gauss).toFixed(1)}`).join(" ");
    const gridLines = yTicks
      .map((tick) => {
        const y = yScale(tick);
        return `<line x1="${margin.left}" y1="${y.toFixed(1)}" x2="${(width - margin.right).toFixed(1)}" y2="${y.toFixed(1)}" stroke="#d1d5db" stroke-width="1" />`;
      })
      .join("");
    const yLabels = yTicks
      .map((tick) => {
        const y = yScale(tick);
        return `<text x="${margin.left - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="#6b7280">${tick.toFixed(0)}</text>`;
      })
      .join("");
    const bars = mcHistData
      .map((point, idx) => {
        const x = pointX(idx) - barW / 2;
        const y = yScale(point.count);
        const h = margin.top + plotH - y;
        return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" fill="#93c5fd" />`;
      })
      .join("");
    const xLabels = mcHistData
      .map((point, idx) => {
        if (idx % xLabelStep !== 0 && idx !== mcHistData.length - 1) return "";
        return `<text x="${pointX(idx).toFixed(1)}" y="${height - 12}" text-anchor="middle" font-size="10" fill="#6b7280">${point.x.toFixed(0)}</text>`;
      })
      .join("");

    return `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Graphique distribution">
        <rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff" />
        ${gridLines}
        <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${height - margin.bottom}" stroke="#9ca3af" stroke-width="1" />
        <line x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}" stroke="#9ca3af" stroke-width="1" />
        ${bars}
        <polyline points="${smoothLine}" fill="none" stroke="#2563eb" stroke-width="2.2" />
        ${yLabels}
        ${xLabels}
      </svg>
    `;
  }, [mcHistData]);

  const probabilitySvg = useMemo(() => {
    if (!probabilityCurveData.length) return "";
    const width = 960;
    const height = 300;
    const margin = { top: 18, right: 20, bottom: 40, left: 54 };
    const plotW = width - margin.left - margin.right;
    const plotH = height - margin.top - margin.bottom;
    const yScale = (value: number) => margin.top + plotH - (value / 100) * plotH;
    const pointX = (idx: number) => margin.left + (probabilityCurveData.length === 1 ? plotW / 2 : (idx / (probabilityCurveData.length - 1)) * plotW);
    const yTicks = buildLinearTicks(0, 100, 6);
    const xLabelStep = Math.max(1, Math.ceil(probabilityCurveData.length / 10));
    const line = probabilityCurveData.map((point, idx) => `${pointX(idx).toFixed(1)},${yScale(point.probability).toFixed(1)}`).join(" ");
    const gridLines = yTicks
      .map((tick) => {
        const y = yScale(tick);
        return `<line x1="${margin.left}" y1="${y.toFixed(1)}" x2="${(width - margin.right).toFixed(1)}" y2="${y.toFixed(1)}" stroke="#d1d5db" stroke-width="1" />`;
      })
      .join("");
    const yLabels = yTicks
      .map((tick) => {
        const y = yScale(tick);
        return `<text x="${margin.left - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="#6b7280">${tick.toFixed(0)}%</text>`;
      })
      .join("");
    const xLabels = probabilityCurveData
      .map((point, idx) => {
        if (idx % xLabelStep !== 0 && idx !== probabilityCurveData.length - 1) return "";
        return `<text x="${pointX(idx).toFixed(1)}" y="${height - 12}" text-anchor="middle" font-size="10" fill="#6b7280">${point.x.toFixed(0)}</text>`;
      })
      .join("");

    return `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Graphique probabilite">
        <rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff" />
        ${gridLines}
        <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${height - margin.bottom}" stroke="#9ca3af" stroke-width="1" />
        <line x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}" stroke="#9ca3af" stroke-width="1" />
        <polyline points="${line}" fill="none" stroke="#2563eb" stroke-width="2.2" />
        ${yLabels}
        ${xLabels}
      </svg>
    `;
  }, [probabilityCurveData]);

  function handleExportPdf(): void {
    if (!result) return;
    const printWindow = window.open("about:blank", "_blank");
    if (!printWindow) return;

    const modeSummary =
      simulationMode === "backlog_to_weeks"
        ? `Backlog vers semaines - backlog: ${String(backlogSize)} items`
        : `Semaines vers items - cible: ${String(targetWeeks)} semaines`;
    const typeSummary = types.length ? types.join(", ") : "Aucun";
    const stateSummary = doneStates.length ? doneStates.join(", ") : "Aucun";
    const modeZeroLabel = includeZeroWeeks ? "Semaines 0 incluses" : "Semaines 0 exclues";
    const resultLabel = result.result_kind === "items" ? "items (au moins)" : "semaines (au plus)";

    const html = `
      <!doctype html>
      <html lang="fr">
      <head>
        <meta charset="utf-8" />
        <title>Export Simulation Monte Carlo</title>
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; padding: 24px; font-family: Arial, sans-serif; color: #111827; }
          .header { margin-bottom: 14px; }
          .title { margin: 0; font-size: 24px; }
          .meta { margin-top: 10px; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 8px; background: #f9fafb; font-size: 12px; line-height: 1.5; }
          .meta-row { margin-bottom: 2px; }
          .kpis { display: flex; gap: 8px; margin-top: 12px; margin-bottom: 14px; }
          .kpi { border: 1px solid #d1d5db; border-radius: 8px; padding: 8px 10px; min-width: 160px; background: #f9fafb; }
          .kpi-label { display: block; font-size: 11px; color: #374151; font-weight: 700; }
          .kpi-value { display: block; margin-top: 4px; font-size: 18px; font-weight: 800; }
          .section { margin-top: 16px; page-break-inside: avoid; }
          .section h2 { margin: 0 0 6px 0; font-size: 17px; }
          .chart-wrap { width: 100%; overflow: hidden; border: 1px solid #d1d5db; border-radius: 8px; padding: 8px; background: #fff; }
          .chart-wrap svg { width: 100%; height: auto; display: block; }
          @media print {
            body { padding: 12mm; }
          }
        </style>
      </head>
      <body>
        <header class="header">
          <h1 class="title">Simulation Monte Carlo - ${escapeHtml(selectedTeam)}</h1>
          <div class="meta">
            <div class="meta-row"><b>Periode:</b> ${escapeHtml(startDate)} au ${escapeHtml(endDate)}</div>
            <div class="meta-row"><b>Mode:</b> ${escapeHtml(modeSummary)}</div>
            <div class="meta-row"><b>Tickets:</b> ${escapeHtml(typeSummary)}</div>
            <div class="meta-row"><b>Etats:</b> ${escapeHtml(stateSummary)}</div>
            <div class="meta-row"><b>Echantillon:</b> ${escapeHtml(modeZeroLabel)}</div>
            <div class="meta-row"><b>Capacite reduite:</b> ${escapeHtml(`${String(capacityPercent)}% pendant ${String(reducedCapacityWeeks)} semaines`)}</div>
            <div class="meta-row"><b>Simulations:</b> ${escapeHtml(String(nSims))}</div>
          </div>
        </header>

        <section class="kpis">
          <div class="kpi"><span class="kpi-label">P50</span><span class="kpi-value">${Number(displayPercentiles?.P50 ?? 0).toFixed(0)} ${escapeHtml(resultLabel)}</span></div>
          <div class="kpi"><span class="kpi-label">P70</span><span class="kpi-value">${Number(displayPercentiles?.P70 ?? 0).toFixed(0)} ${escapeHtml(resultLabel)}</span></div>
          <div class="kpi"><span class="kpi-label">P90</span><span class="kpi-value">${Number(displayPercentiles?.P90 ?? 0).toFixed(0)} ${escapeHtml(resultLabel)}</span></div>
        </section>

        <section class="section">
          <h2>Throughput hebdomadaire</h2>
          <div class="chart-wrap">${throughputSvg}</div>
        </section>

        <section class="section">
          <h2>Distribution Monte Carlo</h2>
          <div class="chart-wrap">${distributionSvg}</div>
        </section>

        <section class="section">
          <h2>Courbe de probabilite</h2>
          <div class="chart-wrap">${probabilitySvg}</div>
        </section>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
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
