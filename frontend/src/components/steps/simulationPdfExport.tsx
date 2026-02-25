import { renderToStaticMarkup } from "react-dom/server";
import { Bar, CartesianGrid, ComposedChart, Line, LineChart, XAxis, YAxis } from "recharts";

type ThroughputExportPoint = {
  week: string;
  throughput: number;
  movingAverage: number;
};

type DistributionExportPoint = {
  x: number;
  count: number;
  gauss: number;
};

type ProbabilityExportPoint = {
  x: number;
  probability: number;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderThroughputChart(points: ThroughputExportPoint[]): string {
  if (!points.length) return "";
  return renderToStaticMarkup(
    <ComposedChart width={960} height={300} data={points} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
      <CartesianGrid stroke="#d1d5db" strokeDasharray="4 4" />
      <XAxis dataKey="week" tick={{ fill: "#6b7280", fontSize: 12 }} />
      <YAxis allowDecimals={false} tick={{ fill: "#6b7280", fontSize: 12 }} />
      <Bar dataKey="throughput" fill="#93c5fd" radius={[5, 5, 0, 0]} />
      <Line type="monotone" dataKey="throughput" dot={false} strokeWidth={2} stroke="#2563eb" />
      <Line type="monotone" dataKey="movingAverage" dot={false} strokeWidth={2.5} stroke="#f97316" strokeDasharray="8 4" />
    </ComposedChart>,
  );
}

function renderDistributionChart(points: DistributionExportPoint[]): string {
  if (!points.length) return "";
  return renderToStaticMarkup(
    <ComposedChart width={960} height={300} data={points} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
      <CartesianGrid stroke="#d1d5db" strokeDasharray="4 4" />
      <XAxis dataKey="x" tick={{ fill: "#6b7280", fontSize: 12 }} />
      <YAxis allowDecimals={false} tick={{ fill: "#6b7280", fontSize: 12 }} />
      <Bar dataKey="count" fill="#93c5fd" radius={[5, 5, 0, 0]} />
      <Line type="monotone" dataKey="gauss" dot={false} strokeWidth={2.5} stroke="#2563eb" />
    </ComposedChart>,
  );
}

function renderProbabilityChart(points: ProbabilityExportPoint[]): string {
  if (!points.length) return "";
  return renderToStaticMarkup(
    <LineChart width={960} height={300} data={points} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
      <CartesianGrid stroke="#d1d5db" strokeDasharray="4 4" />
      <XAxis dataKey="x" tick={{ fill: "#6b7280", fontSize: 12 }} />
      <YAxis domain={[0, 100]} tick={{ fill: "#6b7280", fontSize: 12 }} />
      <Line type="monotone" dataKey="probability" dot={false} strokeWidth={2.5} stroke="#2563eb" />
    </LineChart>,
  );
}

export function exportSimulationPdf({
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
  resultKind,
  displayPercentiles,
  throughputPoints,
  distributionPoints,
  probabilityPoints,
}: {
  selectedTeam: string;
  startDate: string;
  endDate: string;
  simulationMode: "backlog_to_weeks" | "weeks_to_items";
  includeZeroWeeks: boolean;
  types: string[];
  doneStates: string[];
  backlogSize: number | string;
  targetWeeks: number | string;
  nSims: number | string;
  capacityPercent: number | string;
  reducedCapacityWeeks: number | string;
  resultKind: "items" | "weeks";
  displayPercentiles: Record<string, number>;
  throughputPoints: ThroughputExportPoint[];
  distributionPoints: DistributionExportPoint[];
  probabilityPoints: ProbabilityExportPoint[];
}): void {
  const printWindow = window.open("about:blank", "_blank");
  if (!printWindow) return;

  const throughputSvg = renderThroughputChart(throughputPoints);
  const distributionSvg = renderDistributionChart(distributionPoints);
  const probabilitySvg = renderProbabilityChart(probabilityPoints);
  const modeSummary =
    simulationMode === "backlog_to_weeks"
      ? `Backlog vers semaines - backlog: ${String(backlogSize)} items`
      : `Semaines vers items - cible: ${String(targetWeeks)} semaines`;
  const typeSummary = types.length ? types.join(", ") : "Aucun";
  const stateSummary = doneStates.length ? doneStates.join(", ") : "Aucun";
  const modeZeroLabel = includeZeroWeeks ? "Semaines 0 incluses" : "Semaines 0 exclues";
  const resultLabel = resultKind === "items" ? "items (au moins)" : "semaines (au plus)";

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
