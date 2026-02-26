import {
  renderDistributionChart,
  renderProbabilityChart,
  renderThroughputChart,
  type DistributionExportPoint,
  type ProbabilityExportPoint,
  type ThroughputExportPoint,
} from "./simulationChartsSvg";
import { buildSimulationPdfFileName, downloadSimulationPdf } from "./simulationPdfDownload";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export { buildSimulationPdfFileName, downloadSimulationPdf };

export function exportSimulationPrintReport({
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
          .print-action {
            position: fixed;
            top: 16px;
            right: 16px;
            z-index: 20;
            border: 1px solid #d1d5db;
            background: #111827;
            color: #ffffff;
            border-radius: 8px;
            padding: 8px 12px;
            font-size: 12px;
            font-weight: 700;
            cursor: pointer;
          }
          @media print {
            body { padding: 12mm; }
            .print-action { display: none; }
          }
        </style>
      </head>
      <body>
        <button type="button" id="download-pdf" class="print-action">Télécharger PDF</button>
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
    const button = printWindow.document.getElementById("download-pdf");
    button?.addEventListener("click", () => {
      void downloadSimulationPdf(printWindow.document, selectedTeam);
    });
  };
}
