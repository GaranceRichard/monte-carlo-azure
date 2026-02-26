import { jsPDF } from "jspdf";
import "svg2pdf.js";
import { CHART_HEIGHT, CHART_WIDTH } from "./simulationChartsSvg";

const SECTION_TITLES = ["Throughput hebdomadaire", "Distribution Monte Carlo", "Courbe de probabilite"];

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

export async function downloadSimulationPdf(reportWindowDocument: Document, selectedTeam: string): Promise<void> {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const contentW = pageW - margin * 2;
  let cursorY = margin;

  const ensureSpace = (neededHeight: number): void => {
    if (cursorY + neededHeight <= pageH - margin) return;
    pdf.addPage();
    cursorY = margin;
  };

  const title = reportWindowDocument.querySelector("h1")?.textContent ?? "Simulation Monte Carlo";
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text(title, margin, cursorY);
  cursorY += 6;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  reportWindowDocument.querySelectorAll(".meta-row").forEach((row) => {
    ensureSpace(3.6);
    const text = row.textContent ?? "";
    pdf.text(text, margin, cursorY);
    cursorY += 3.6;
  });
  cursorY += 2;

  ensureSpace(8);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  const kpis = Array.from(reportWindowDocument.querySelectorAll(".kpi"));
  const kpiStep = kpis.length > 0 ? contentW / kpis.length : contentW;
  kpis.forEach((kpi, i) => {
    const label = kpi.querySelector(".kpi-label")?.textContent ?? "";
    const value = kpi.querySelector(".kpi-value")?.textContent ?? "";
    pdf.text(`${label}: ${value}`, margin + i * kpiStep, cursorY);
  });
  cursorY += 7;

  const svgElements = reportWindowDocument.querySelectorAll<SVGSVGElement>(".chart-wrap svg");
  for (let i = 0; i < svgElements.length; i += 1) {
    const svg = svgElements[i];

    const svgW = svg.viewBox?.baseVal?.width || CHART_WIDTH;
    const svgH = svg.viewBox?.baseVal?.height || CHART_HEIGHT;
    const ratio = svgH / svgW;
    const chartsLeft = svgElements.length - i;
    const reservedForTitlesAndSpacing = chartsLeft * (4 + 1.5 + 2);
    const maxChartH = Math.max(24, (pageH - margin - cursorY - reservedForTitlesAndSpacing) / chartsLeft);
    const renderW = Math.min(contentW, maxChartH / ratio);
    const renderH = renderW * ratio;
    const centeredX = margin + (contentW - renderW) / 2;

    ensureSpace(4 + renderH + 2);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.text(SECTION_TITLES[i] ?? "", margin, cursorY);
    cursorY += 4;

    await pdf.svg(svg, { x: centeredX, y: cursorY, width: renderW, height: renderH });
    cursorY += renderH + 2;
  }

  pdf.save(buildSimulationPdfFileName(selectedTeam));
}
