import type { ForecastKind } from "../../types";
import { buildAtLeastPercentiles, buildProbabilityCurve } from "../../hooks/probability";
import { computeRiskScoreFromPercentiles } from "../../utils/simulation";
import {
  renderDistributionChart,
  renderProbabilityChart,
  renderThroughputChart,
  type DistributionExportPoint,
  type ThroughputExportPoint,
} from "./simulationChartsSvg";
import { downloadPortfolioPdf } from "./simulationPdfDownload";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

type PortfolioSectionInput = {
  selectedTeam: string;
  simulationMode: "backlog_to_weeks" | "weeks_to_items";
  includeZeroWeeks: boolean;
  backlogSize: number;
  targetWeeks: number;
  nSims: number;
  resultKind: ForecastKind;
  riskScore?: number;
  distribution: Array<{ x: number; count: number }>;
  weeklyThroughput: Array<{ week: string; throughput: number }>;
  displayPercentiles: Record<string, number>;
};

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

function computeRiskLegend(score: number): string {
  if (score <= 0.2) return "fiable";
  if (score <= 0.5) return "incertain";
  if (score <= 0.8) return "fragile";
  return "non fiable";
}

function formatRiskScore(
  mode: "backlog_to_weeks" | "weeks_to_items",
  percentiles: Record<string, number>,
): string {
  const risk = computeRiskScoreFromPercentiles(mode, percentiles);
  const label = risk.toFixed(2).replace(".", ",");
  return `${label} (${computeRiskLegend(risk)})`;
}

export function exportPortfolioPrintReport({
  selectedProject,
  startDate,
  endDate,
  sections,
}: {
  selectedProject: string;
  startDate: string;
  endDate: string;
  sections: PortfolioSectionInput[];
}): void {
  const printWindow = window.open("about:blank", "_blank");
  if (!printWindow) return;

  const pagesHtml = sections
    .map((section, idx) => {
      const throughputRows = section.includeZeroWeeks
        ? section.weeklyThroughput
        : section.weeklyThroughput.filter((row) => row.throughput > 0);
      const throughputPoints: ThroughputExportPoint[] = throughputRows.map((point, index, arr) => {
        const windowSize = 4;
        const start = Math.max(0, index - windowSize + 1);
        const slice = arr.slice(start, index + 1);
        const average = slice.reduce((sum, p) => sum + p.throughput, 0) / slice.length;
        return { week: String(point.week).slice(0, 10), throughput: point.throughput, movingAverage: Number(average.toFixed(2)) };
      });

      const sortedDistribution = [...section.distribution]
        .map((p) => ({ x: Number(p.x), count: Number(p.count) }))
        .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.count) && p.count > 0)
        .sort((a, b) => a.x - b.x);
      const smoothed = smoothHistogramCounts(sortedDistribution);
      const distributionPoints: DistributionExportPoint[] = sortedDistribution.map((p, i) => ({
        x: p.x,
        count: p.count,
        gauss: smoothed[i],
      }));
      const probabilityPoints = buildProbabilityCurve(sortedDistribution, section.resultKind);
      const displayPercentiles =
        section.resultKind === "items"
          ? buildAtLeastPercentiles(sortedDistribution, [50, 70, 90])
          : section.displayPercentiles;

      const throughputSvg = renderThroughputChart(throughputPoints);
      const distributionSvg = renderDistributionChart(distributionPoints);
      const probabilitySvg = renderProbabilityChart(probabilityPoints);
      const modeSummary =
        section.simulationMode === "backlog_to_weeks"
          ? `Backlog vers semaines - backlog: ${String(section.backlogSize)} items`
          : `Semaines vers items - cible: ${String(section.targetWeeks)} semaines`;
      const resultLabel = section.resultKind === "items" ? "items (au moins)" : "semaines (au plus)";
      const modeZeroLabel = section.includeZeroWeeks ? "Semaines 0 incluses" : "Semaines 0 exclues";

      return `
        <section class="page ${idx < sections.length - 1 ? "page-break" : ""}">
          <header class="header">
            <h1 class="title">Simulation Portefeuille - ${escapeHtml(section.selectedTeam)}</h1>
            <div class="meta">
              <div class="meta-row"><b>Projet:</b> ${escapeHtml(selectedProject)}</div>
              <div class="meta-row"><b>Periode:</b> ${escapeHtml(startDate)} au ${escapeHtml(endDate)}</div>
              <div class="meta-row"><b>Mode:</b> ${escapeHtml(modeSummary)}</div>
              <div class="meta-row"><b>Echantillon:</b> ${escapeHtml(modeZeroLabel)}</div>
              <div class="meta-row"><b>Simulations:</b> ${escapeHtml(String(section.nSims))}</div>
            </div>
          </header>

          <section class="kpis">
            <div class="kpi"><span class="kpi-label">P50</span><span class="kpi-value">${Number(displayPercentiles?.P50 ?? 0).toFixed(0)} ${escapeHtml(resultLabel)}</span></div>
            <div class="kpi"><span class="kpi-label">P70</span><span class="kpi-value">${Number(displayPercentiles?.P70 ?? 0).toFixed(0)} ${escapeHtml(resultLabel)}</span></div>
            <div class="kpi"><span class="kpi-label">P90</span><span class="kpi-value">${Number(displayPercentiles?.P90 ?? 0).toFixed(0)} ${escapeHtml(resultLabel)}</span></div>
            <div class="kpi"><span class="kpi-label">Risk Score</span><span class="kpi-value">${escapeHtml(formatRiskScore(section.simulationMode, displayPercentiles))}</span></div>
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
        </section>
      `;
    })
    .join("");

  const html = `
    <!doctype html>
    <html lang="fr">
    <head>
      <meta charset="utf-8" />
      <title>Export Portefeuille Monte Carlo</title>
      <style>
        * { box-sizing: border-box; }
        body { margin: 0; padding: 12px; font-family: Arial, sans-serif; color: #111827; }
        .header { margin-bottom: 8px; }
        .title { margin: 0; font-size: 20px; }
        .meta { margin-top: 6px; padding: 6px 8px; border: 1px solid #d1d5db; border-radius: 8px; background: #f9fafb; font-size: 11px; line-height: 1.35; }
        .meta-row { margin-bottom: 2px; }
        .kpis { display: flex; gap: 6px; margin-top: 8px; margin-bottom: 8px; }
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
        .page-break { page-break-after: always; }
        @media print {
          body { padding: 7mm; }
          .print-action { display: none; }
        }
      </style>
    </head>
    <body>
      <button type="button" id="download-pdf" class="print-action" onclick="window.__downloadPdf && window.__downloadPdf()">Telecharger PDF</button>
      ${pagesHtml}
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
    void downloadPortfolioPdf(printWindow.document, selectedProject)
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
    if (!button) return;
    button.addEventListener("click", () => {
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


