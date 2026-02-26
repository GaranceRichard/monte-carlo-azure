import { jsPDF } from "jspdf";
import "svg2pdf.js";

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

const CHART_WIDTH = 960;
const CHART_HEIGHT = 300;
const MARGIN = { top: 16, right: 16, bottom: 36, left: 44 };

function sanitizeFilePart(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

export function buildSimulationPdfFileName(selectedTeam: string, date = new Date()): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear());
  const teamPart = sanitizeFilePart(selectedTeam) || "equipe";
  return `simulation-${teamPart}-${day}_${month}_${year}.pdf`;
}

function formatNum(value: number): string {
  if (!Number.isFinite(value)) return "0";
  if (Math.abs(value) >= 100) return value.toFixed(0);
  if (Math.abs(value) >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

function niceMax(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const exponent = Math.floor(Math.log10(value));
  const fraction = value / 10 ** exponent;
  let niceFraction = 1;
  if (fraction <= 1) niceFraction = 1;
  else if (fraction <= 2) niceFraction = 2;
  else if (fraction <= 5) niceFraction = 5;
  else niceFraction = 10;
  return niceFraction * 10 ** exponent;
}

function linePath(values: number[], yScale: (value: number) => number, xScale: (index: number) => number): string {
  if (!values.length) return "";
  return values
    .map((value, index) => `${index === 0 ? "M" : "L"} ${xScale(index).toFixed(2)} ${yScale(value).toFixed(2)}`)
    .join(" ");
}

function renderEmptyChart(title: string): string {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CHART_WIDTH} ${CHART_HEIGHT}" role="img" aria-label="${escapeHtml(title)}">
      <rect x="0" y="0" width="${CHART_WIDTH}" height="${CHART_HEIGHT}" fill="#ffffff" />
      <text x="${CHART_WIDTH / 2}" y="${CHART_HEIGHT / 2}" text-anchor="middle" fill="#6b7280" font-size="14">
        Donnees insuffisantes pour afficher ce graphique
      </text>
    </svg>
  `;
}

function renderGridAndYAxis(yTicks: number[], yScale: (value: number) => number): string {
  return yTicks
    .map((tick) => {
      const y = yScale(tick);
      return `
        <line x1="${MARGIN.left}" y1="${y}" x2="${CHART_WIDTH - MARGIN.right}" y2="${y}" stroke="#e5e7eb" stroke-dasharray="4 4" />
        <text x="${MARGIN.left - 8}" y="${y + 4}" text-anchor="end" fill="#6b7280" font-size="11">${formatNum(tick)}</text>
      `;
    })
    .join("");
}

function renderThroughputChart(points: ThroughputExportPoint[]): string {
  if (!points.length) return renderEmptyChart("Throughput hebdomadaire");
  const plotWidth = CHART_WIDTH - MARGIN.left - MARGIN.right;
  const plotHeight = CHART_HEIGHT - MARGIN.top - MARGIN.bottom;
  const maxY = niceMax(Math.max(...points.map((p) => Math.max(p.throughput, p.movingAverage))));
  const yScale = (value: number) => MARGIN.top + plotHeight - (Math.max(0, value) / maxY) * plotHeight;
  const xStep = points.length > 1 ? plotWidth / (points.length - 1) : 0;
  const xScale = (index: number) => MARGIN.left + index * xStep;
  const tickStep = Math.max(1, Math.ceil(points.length / 8));
  const barWidth = Math.max(5, Math.min(20, plotWidth / Math.max(1, points.length) * 0.65));
  const yTicks = Array.from({ length: 5 }, (_, i) => (maxY * i) / 4);

  const bars = points
    .map((point, index) => {
      const x = xScale(index) - barWidth / 2;
      const y = yScale(point.throughput);
      const h = MARGIN.top + plotHeight - y;
      return `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${barWidth.toFixed(2)}" height="${Math.max(0, h).toFixed(2)}" fill="#93c5fd" />`;
    })
    .join("");
  const throughputPath = linePath(
    points.map((p) => p.throughput),
    yScale,
    xScale,
  );
  const averagePath = linePath(
    points.map((p) => p.movingAverage),
    yScale,
    xScale,
  );
  const xLabels = points
    .map((point, index) =>
      index % tickStep === 0 || index === points.length - 1
        ? `<text x="${xScale(index)}" y="${CHART_HEIGHT - 12}" text-anchor="middle" fill="#6b7280" font-size="10">${escapeHtml(point.week)}</text>`
        : "",
    )
    .join("");

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CHART_WIDTH} ${CHART_HEIGHT}" role="img" aria-label="Throughput hebdomadaire">
      <rect x="0" y="0" width="${CHART_WIDTH}" height="${CHART_HEIGHT}" fill="#ffffff" />
      ${renderGridAndYAxis(yTicks, yScale)}
      <line x1="${MARGIN.left}" y1="${MARGIN.top + plotHeight}" x2="${CHART_WIDTH - MARGIN.right}" y2="${MARGIN.top + plotHeight}" stroke="#9ca3af" />
      ${bars}
      <path d="${throughputPath}" fill="none" stroke="#2563eb" stroke-width="2" />
      <path d="${averagePath}" fill="none" stroke="#f97316" stroke-width="2.5" stroke-dasharray="8 4" />
      ${xLabels}
    </svg>
  `;
}

function renderDistributionChart(points: DistributionExportPoint[]): string {
  if (!points.length) return renderEmptyChart("Distribution Monte Carlo");
  const sorted = [...points].sort((a, b) => a.x - b.x);
  const plotWidth = CHART_WIDTH - MARGIN.left - MARGIN.right;
  const plotHeight = CHART_HEIGHT - MARGIN.top - MARGIN.bottom;
  const maxY = niceMax(Math.max(...sorted.map((p) => Math.max(p.count, p.gauss))));
  const yScale = (value: number) => MARGIN.top + plotHeight - (Math.max(0, value) / maxY) * plotHeight;
  const xStep = sorted.length > 1 ? plotWidth / (sorted.length - 1) : 0;
  const xScale = (index: number) => MARGIN.left + index * xStep;
  const yTicks = Array.from({ length: 5 }, (_, i) => (maxY * i) / 4);
  const tickStep = Math.max(1, Math.ceil(sorted.length / 10));
  const barWidth = Math.max(4, Math.min(14, plotWidth / Math.max(1, sorted.length) * 0.55));

  const bars = sorted
    .map((point, index) => {
      const x = xScale(index) - barWidth / 2;
      const y = yScale(point.count);
      const h = MARGIN.top + plotHeight - y;
      return `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${barWidth.toFixed(2)}" height="${Math.max(0, h).toFixed(2)}" fill="#93c5fd" />`;
    })
    .join("");
  const gaussPath = linePath(
    sorted.map((p) => p.gauss),
    yScale,
    xScale,
  );
  const xLabels = sorted
    .map((point, index) =>
      index % tickStep === 0 || index === sorted.length - 1
        ? `<text x="${xScale(index)}" y="${CHART_HEIGHT - 12}" text-anchor="middle" fill="#6b7280" font-size="10">${escapeHtml(String(point.x))}</text>`
        : "",
    )
    .join("");

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CHART_WIDTH} ${CHART_HEIGHT}" role="img" aria-label="Distribution Monte Carlo">
      <rect x="0" y="0" width="${CHART_WIDTH}" height="${CHART_HEIGHT}" fill="#ffffff" />
      ${renderGridAndYAxis(yTicks, yScale)}
      <line x1="${MARGIN.left}" y1="${MARGIN.top + plotHeight}" x2="${CHART_WIDTH - MARGIN.right}" y2="${MARGIN.top + plotHeight}" stroke="#9ca3af" />
      ${bars}
      <path d="${gaussPath}" fill="none" stroke="#2563eb" stroke-width="2.5" />
      ${xLabels}
    </svg>
  `;
}

function renderProbabilityChart(points: ProbabilityExportPoint[]): string {
  if (!points.length) return renderEmptyChart("Courbe de probabilite");
  const sorted = [...points].sort((a, b) => a.x - b.x);
  const plotWidth = CHART_WIDTH - MARGIN.left - MARGIN.right;
  const plotHeight = CHART_HEIGHT - MARGIN.top - MARGIN.bottom;
  const yScale = (value: number) => MARGIN.top + plotHeight - (Math.max(0, Math.min(100, value)) / 100) * plotHeight;
  const xStep = sorted.length > 1 ? plotWidth / (sorted.length - 1) : 0;
  const xScale = (index: number) => MARGIN.left + index * xStep;
  const yTicks = [0, 25, 50, 75, 100];
  const tickStep = Math.max(1, Math.ceil(sorted.length / 10));
  const probabilityPath = linePath(
    sorted.map((p) => p.probability),
    yScale,
    xScale,
  );
  const xLabels = sorted
    .map((point, index) =>
      index % tickStep === 0 || index === sorted.length - 1
        ? `<text x="${xScale(index)}" y="${CHART_HEIGHT - 12}" text-anchor="middle" fill="#6b7280" font-size="10">${escapeHtml(String(point.x))}</text>`
        : "",
    )
    .join("");

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CHART_WIDTH} ${CHART_HEIGHT}" role="img" aria-label="Courbe de probabilite">
      <rect x="0" y="0" width="${CHART_WIDTH}" height="${CHART_HEIGHT}" fill="#ffffff" />
      ${renderGridAndYAxis(yTicks, yScale)}
      <line x1="${MARGIN.left}" y1="${MARGIN.top + plotHeight}" x2="${CHART_WIDTH - MARGIN.right}" y2="${MARGIN.top + plotHeight}" stroke="#9ca3af" />
      <path d="${probabilityPath}" fill="none" stroke="#2563eb" stroke-width="2.5" />
      ${xLabels}
    </svg>
  `;
}

export async function downloadSimulationPdf(reportWindowDocument: Document, selectedTeam: string): Promise<void> {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 12;
  const contentW = pageW - margin * 2;
  let cursorY = margin;

  const ensureSpace = (neededHeight: number): void => {
    if (cursorY + neededHeight <= pageH - margin) return;
    pdf.addPage();
    cursorY = margin;
  };

  const title = reportWindowDocument.querySelector("h1")?.textContent ?? "Simulation Monte Carlo";
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text(title, margin, cursorY);
  cursorY += 10;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  reportWindowDocument.querySelectorAll(".meta-row").forEach((row) => {
    ensureSpace(5);
    const text = row.textContent ?? "";
    pdf.text(text, margin, cursorY);
    cursorY += 5;
  });
  cursorY += 4;

  ensureSpace(12);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  reportWindowDocument.querySelectorAll(".kpi").forEach((kpi, i) => {
    const label = kpi.querySelector(".kpi-label")?.textContent ?? "";
    const value = kpi.querySelector(".kpi-value")?.textContent ?? "";
    pdf.text(`${label}: ${value}`, margin + i * 60, cursorY);
  });
  cursorY += 12;

  const svgElements = reportWindowDocument.querySelectorAll<SVGSVGElement>(".chart-wrap svg");
  const sectionTitles = ["Throughput hebdomadaire", "Distribution Monte Carlo", "Courbe de probabilite"];

  for (let i = 0; i < svgElements.length; i += 1) {
    const svg = svgElements[i];
    if (!svg) continue;

    const svgW = svg.viewBox?.baseVal?.width || CHART_WIDTH;
    const svgH = svg.viewBox?.baseVal?.height || CHART_HEIGHT;
    const ratio = svgH / svgW;
    const renderW = contentW;
    const renderH = renderW * ratio;

    ensureSpace(6 + renderH + 8);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.text(sectionTitles[i] ?? "", margin, cursorY);
    cursorY += 6;

    await pdf.svg(svg, { x: margin, y: cursorY, width: renderW, height: renderH });
    cursorY += renderH + 8;
  }

  pdf.save(buildSimulationPdfFileName(selectedTeam));
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

