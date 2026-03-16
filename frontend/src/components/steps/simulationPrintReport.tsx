import {
  renderDistributionChart,
  renderProbabilityChart,
  renderThroughputChart,
  type DistributionExportPoint,
  type ProbabilityExportPoint,
  type ThroughputExportPoint,
} from "./simulationChartsSvg";
import { buildSimulationPdfFileName, downloadSimulationPdf } from "./simulationPdfDownload";
import { computeRiskScoreFromPercentiles, computeThroughputReliability } from "../../utils/simulation";
import type { ThroughputReliability } from "../../types";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export { buildSimulationPdfFileName, downloadSimulationPdf };

function formatMetric(value: number): string {
  return Number(value ?? 0).toFixed(2).replace(".", ",");
}

function buildReliabilitySummary(reliability?: ThroughputReliability): string {
  if (!reliability) return "Non disponible";
  if (reliability.samples_count < 6) return "Historique trop court pour projeter avec confiance.";
  if (reliability.slope_norm <= -0.15) return "Throughput en forte baisse sur les dernieres semaines.";
  if (reliability.slope_norm <= -0.05) return "Throughput en baisse sur les dernieres semaines.";
  if (reliability.slope_norm >= 0.10) return "Throughput en forte hausse sur les dernieres semaines.";
  if (reliability.slope_norm >= 0.05) return "Throughput en hausse sur les dernieres semaines.";
  if (reliability.cv >= 1 || reliability.iqr_ratio >= 1) return "Dispersion elevee du throughput historique.";
  if (reliability.samples_count < 8) return "Volume historique encore limite.";
  return "Historique globalement stable.";
}

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
  resultKind,
  displayPercentiles,
  throughputReliability,
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
  resultKind: "items" | "weeks";
  displayPercentiles: Record<string, number>;
  throughputReliability?: ThroughputReliability;
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
  const resultLabel = resultKind === "items" ? "items" : "semaines (au plus)";
  const effectiveRiskScore = computeRiskScoreFromPercentiles(simulationMode, displayPercentiles);
  const effectiveReliability =
    throughputReliability ??
    computeThroughputReliability(throughputPoints.map((point) => Number(point.throughput ?? 0))) ??
    undefined;
  const riskLegend =
    effectiveRiskScore <= 0.2 ? "fiable" : effectiveRiskScore <= 0.5 ? "incertain" : effectiveRiskScore <= 0.8 ? "fragile" : "eleve";
  const riskScoreLabel = formatMetric(effectiveRiskScore);
  const reliabilityLegend = effectiveReliability?.label ?? "Non disponible";
  const reliabilityScoreLabel = effectiveReliability ? `${formatMetric(effectiveReliability.cv)} (${reliabilityLegend})` : "Non disponible";
  const reliabilitySummary = buildReliabilitySummary(effectiveReliability);

  const html = `
      <!doctype html>
      <html lang="fr">
      <head>
        <meta charset="utf-8" />
        <title>Export Simulation Monte Carlo</title>
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; padding: 12px; font-family: Arial, sans-serif; color: #111827; }
          .header { margin-bottom: 8px; }
          .title { margin: 0; font-size: 20px; }
          .summary-grid { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(260px, 0.9fr); gap: 8px; margin-top: 6px; }
          .meta { padding: 6px 8px; border: 1px solid #d1d5db; border-radius: 8px; background: #f9fafb; font-size: 11px; line-height: 1.35; }
          .diagnostic-card { padding: 6px 8px; border: 1px solid #d1d5db; border-radius: 8px; background: #f9fafb; font-size: 11px; line-height: 1.35; }
          .diagnostic-title { margin: 0 0 4px 0; font-size: 12px; font-weight: 700; color: #374151; }
          .meta-row { margin-bottom: 2px; }
          .kpis { display: flex; gap: 6px; margin-top: 8px; margin-bottom: 8px; }
          .kpis + .kpis { margin-top: 0; }
          .kpi { border: 1px solid #d1d5db; border-radius: 8px; padding: 6px 8px; min-width: 140px; background: #f9fafb; }
          .kpi-label { display: block; font-size: 11px; color: #374151; font-weight: 700; }
          .kpi-value { display: block; margin-top: 2px; font-size: 16px; font-weight: 800; }
          .section { margin-top: 8px; page-break-inside: avoid; }
          .section h2 { margin: 0 0 4px 0; font-size: 14px; }
          .chart-wrap { width: 100%; overflow: hidden; border: 1px solid #d1d5db; border-radius: 8px; padding: 4px; background: #fff; }
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
            body { padding: 7mm; }
            .print-action { display: none; }
          }
          @media (max-width: 720px) {
            .summary-grid { grid-template-columns: 1fr; }
          }
        </style>
      </head>
      <body>
        <button type="button" id="download-pdf" class="print-action">Telecharger PDF</button>
        <header class="header">
          <h1 class="title">Simulation Monte Carlo - ${escapeHtml(selectedTeam)}</h1>
          <div class="summary-grid">
            <div class="meta">
              <div class="meta-row"><b>Periode:</b> ${escapeHtml(startDate)} au ${escapeHtml(endDate)}</div>
              <div class="meta-row"><b>Mode:</b> ${escapeHtml(modeSummary)}</div>
              <div class="meta-row"><b>Tickets:</b> ${escapeHtml(typeSummary)}</div>
              <div class="meta-row"><b>Etats:</b> ${escapeHtml(stateSummary)}</div>
              <div class="meta-row"><b>Echantillon:</b> ${escapeHtml(modeZeroLabel)}</div>
              <div class="meta-row"><b>Simulations:</b> ${escapeHtml(String(nSims))}</div>
            </div>
            <aside class="diagnostic-card">
              <h2 class="diagnostic-title">Diagnostic</h2>
              <div class="meta-row"><b>Lecture:</b> ${escapeHtml(reliabilitySummary)}</div>
              <div class="meta-row"><b>CV:</b> ${escapeHtml(formatMetric(effectiveReliability?.cv ?? 0))}</div>
              <div class="meta-row"><b>IQR ratio:</b> ${escapeHtml(formatMetric(effectiveReliability?.iqr_ratio ?? 0))}</div>
              <div class="meta-row"><b>Pente normalisee:</b> ${escapeHtml(formatMetric(effectiveReliability?.slope_norm ?? 0))}</div>
              <div class="meta-row"><b>Semaines utilisees:</b> ${escapeHtml(String(effectiveReliability?.samples_count ?? 0))}</div>
            </aside>
          </div>
        </header>

        <section class="kpis">
          <div class="kpi"><span class="kpi-label">P50</span><span class="kpi-value">${Number(displayPercentiles?.P50 ?? 0).toFixed(0)} ${escapeHtml(resultLabel)}</span></div>
          <div class="kpi"><span class="kpi-label">P70</span><span class="kpi-value">${Number(displayPercentiles?.P70 ?? 0).toFixed(0)} ${escapeHtml(resultLabel)}</span></div>
          <div class="kpi"><span class="kpi-label">P90</span><span class="kpi-value">${Number(displayPercentiles?.P90 ?? 0).toFixed(0)} ${escapeHtml(resultLabel)}</span></div>
        </section>
        <section class="kpis">
          <div class="kpi"><span class="kpi-label">Risk Score</span><span class="kpi-value">${escapeHtml(riskScoreLabel)} (${escapeHtml(riskLegend)})</span></div>
          <div class="kpi"><span class="kpi-label">Fiabilite</span><span class="kpi-value">${escapeHtml(reliabilityScoreLabel)}</span></div>
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

  const popup = printWindow as Window & { __downloadPdf?: () => void };
  popup.__downloadPdf = () => {
    const button = printWindow.document.getElementById("download-pdf") as HTMLButtonElement | null;
    if (button) {
      button.disabled = true;
      button.textContent = "Generation...";
    }
    void downloadSimulationPdf(printWindow.document, selectedTeam)
      .catch((err) => {
        console.error(err);
        const message = err instanceof Error ? err.message : String(err);
        if (typeof printWindow.alert === "function") {
          printWindow.alert(`Echec generation PDF: ${message}`);
        }
      })
      .finally(() => {
        if (button) {
          button.disabled = false;
          button.textContent = "Telecharger PDF";
        }
      });
  };

  const wireDownloadButton = () => {
    const button = printWindow.document.getElementById("download-pdf");
    const bindableButton = button as (HTMLElement & { __downloadBound?: boolean }) | null;
    if (!bindableButton || bindableButton.__downloadBound) return;
    bindableButton.__downloadBound = true;
    bindableButton.addEventListener("click", () => {
      popup.__downloadPdf?.();
    });
  };
  wireDownloadButton();
  if (typeof printWindow.addEventListener === "function") {
    printWindow.addEventListener("load", wireDownloadButton, { once: true });
  } else {
    printWindow.onload = wireDownloadButton;
  }
}

