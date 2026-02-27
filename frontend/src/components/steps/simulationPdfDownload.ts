import { jsPDF } from "jspdf";
import "svg2pdf.js";
import { CHART_HEIGHT, CHART_WIDTH } from "./simulationChartsSvg";

const SECTION_TITLES = ["Throughput hebdomadaire", "Distribution Monte Carlo", "Courbe de probabilité"];

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

  const filename = buildSimulationPdfFileName(selectedTeam);
  pdf.save(filename);
}

export async function downloadPortfolioPdf(reportWindowDocument: Document, selectedProject: string): Promise<void> {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const contentW = pageW - margin * 2;

  const pages = Array.from(reportWindowDocument.querySelectorAll<HTMLElement>(".page"));
  const sections = pages.length ? pages : [reportWindowDocument.body as HTMLElement];

  for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex += 1) {
    if (sectionIndex > 0) {
      pdf.addPage();
    }

    let cursorY = margin;
    const section = sections[sectionIndex];

    const ensureSpace = (neededHeight: number): void => {
      if (cursorY + neededHeight <= pageH - margin) return;
      pdf.addPage();
      cursorY = margin;
    };

    const title = section.querySelector("h1")?.textContent ?? "Simulation Portefeuille";
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.text(title, margin, cursorY);
    cursorY += 6;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    section.querySelectorAll(".meta-row").forEach((row) => {
      ensureSpace(3.6);
      const text = row.textContent ?? "";
      pdf.text(text, margin, cursorY);
      cursorY += 3.6;
    });
    cursorY += 2;

    const summaryTable = section.querySelector<HTMLTableElement>(".summary-table");
    if (summaryTable) {
      const headerCells = Array.from(summaryTable.querySelectorAll("thead th")).map((cell) => (cell.textContent ?? "").trim());
      const bodyRows = Array.from(summaryTable.querySelectorAll("tbody tr")).map((row) =>
        Array.from(row.querySelectorAll("td")).map((cell) => (cell.textContent ?? "").trim()),
      );

      const colRatios = [0.28, 0.12, 0.12, 0.12, 0.36];
      const colWidths = colRatios.map((ratio) => ratio * contentW);
      const headerHeight = 10;
      const rowHeight = 11;
      const tableHeight = headerHeight + bodyRows.length * rowHeight;

      cursorY += 6;
      ensureSpace(6 + tableHeight + 2);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(13);
      pdf.setTextColor(30, 58, 138);
      pdf.text("Synthèse décisionnelle", margin, cursorY);
      cursorY += 5;

      const riskCellStyle = (riskText: string): { fill: [number, number, number]; text: [number, number, number] } => {
        const lower = riskText.toLowerCase();
        if (lower.includes("non fiable")) return { fill: [31, 41, 55], text: [255, 255, 255] };
        if (lower.includes("fragile")) return { fill: [254, 226, 226], text: [153, 27, 27] };
        if (lower.includes("incertain")) return { fill: [254, 243, 199], text: [146, 64, 14] };
        if (lower.includes("fiable")) return { fill: [220, 252, 231], text: [22, 101, 52] };
        return { fill: [31, 41, 55], text: [255, 255, 255] };
      };

      let x = margin;
      pdf.setDrawColor(209, 213, 219);
      for (let i = 0; i < headerCells.length; i += 1) {
        const width = colWidths[i] ?? 0;
        pdf.setFillColor(30, 58, 138);
        pdf.rect(x, cursorY, width, headerHeight, "FD");
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        pdf.setTextColor(255, 255, 255);
        const headerText = headerCells[i] ?? "";
        const align = i === 0 ? "left" : "center";
        const textX = i === 0 ? x + 2 : x + width / 2;
        pdf.text(headerText, textX, cursorY + 6.5, { align });
        x += width;
      }
      cursorY += headerHeight;

      for (let rowIndex = 0; rowIndex < bodyRows.length; rowIndex += 1) {
        const row = bodyRows[rowIndex] ?? [];
        x = margin;
        for (let colIndex = 0; colIndex < colWidths.length; colIndex += 1) {
          const width = colWidths[colIndex] ?? 0;
          const value = row[colIndex] ?? "";
          if (colIndex === 4) {
            const style = riskCellStyle(value);
            pdf.setFillColor(...style.fill);
            pdf.setTextColor(...style.text);
            pdf.rect(x, cursorY, width, rowHeight, "FD");
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(10);
            pdf.text(value, x + width / 2, cursorY + 7, { align: "center" });
          } else {
            const base = rowIndex % 2 === 0 ? 250 : 243;
            pdf.setFillColor(base, base, base);
            pdf.setTextColor(17, 24, 39);
            pdf.rect(x, cursorY, width, rowHeight, "FD");
            pdf.setFont("helvetica", colIndex === 0 ? "bold" : "normal");
            pdf.setFontSize(11);
            if (colIndex === 0) {
              pdf.text(value, x + 2, cursorY + 7, { align: "left" });
            } else {
              pdf.text(value, x + width / 2, cursorY + 7, { align: "center" });
            }
          }
          x += width;
        }
        cursorY += rowHeight;
      }
      cursorY += 2;
    }

    const hypotheses = Array.from(section.querySelectorAll<HTMLElement>(".hypothesis"));
    if (hypotheses.length) {
      cursorY += 10;
      ensureSpace(7);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.text("Hypothèses", margin, cursorY);
      cursorY += 7;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      hypotheses.forEach((hypothesis) => {
        const text = (hypothesis.textContent ?? "").trim();
        if (!text) return;
        const wrapped = pdf.splitTextToSize(text, contentW);
        const wrappedLines = Array.isArray(wrapped) ? wrapped : [String(wrapped)];
        const blockHeight = Math.max(1, wrappedLines.length) * 3.8;
        ensureSpace(blockHeight);
        pdf.text(wrappedLines, margin, cursorY);
        cursorY += blockHeight;
      });
      cursorY += 2;
    }

    ensureSpace(8);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    const kpis = Array.from(section.querySelectorAll(".kpi"));
    const kpiStep = kpis.length > 0 ? contentW / kpis.length : contentW;
    kpis.forEach((kpi, i) => {
      const label = kpi.querySelector(".kpi-label")?.textContent ?? "";
      const value = kpi.querySelector(".kpi-value")?.textContent ?? "";
      pdf.text(`${label}: ${value}`, margin + i * kpiStep, cursorY);
    });
    cursorY += 7;

    const svgElements = section.querySelectorAll<SVGSVGElement>(".chart-wrap svg");
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
  }

  const filename = buildSimulationPdfFileName(`Portefeuille-${selectedProject}`);
  pdf.save(filename);
}
