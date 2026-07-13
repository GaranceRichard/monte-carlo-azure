import { jsPDF } from "jspdf";
import "svg2pdf.js";
import { CHART_HEIGHT, CHART_WIDTH } from "./simulationChartsSvg";

const SECTION_TITLES = ["Cycle Time", "Throughput hebdomadaire", "Distribution Monte Carlo", "Courbe de probabilitÃ©"];
const PORTFOLIO_SECTION_TITLES = ["Cycle Time", "Throughput hebdomadaire", "Distribution Monte Carlo", "Courbe de probabilit\u00E9"];
const PDF_SIMULATION_CHART_COLUMNS = 2;
const PDF_SIMULATION_CHART_GAP = 4;
const PDF_SIMULATION_CHART_TITLE_HEIGHT = 4;
const PDF_SIMULATION_CHART_BOTTOM_GAP = 3;
const PDF_SIMULATION_DIAGNOSTIC_BOTTOM_GAP = 7;
const PDF_PORTFOLIO_SUMMARY_CHART_MAX_HEIGHT = 65;
const PDF_PORTFOLIO_HYPOTHESIS_LINE_HEIGHT = 3.3;
const SUMMARY_TABLE_COLUMN_RATIOS: Record<number, number[]> = {
  5: [0.28, 0.12, 0.12, 0.12, 0.36],
  6: [0.24, 0.12, 0.12, 0.12, 0.2, 0.2],
  8: [0.14, 0.06, 0.06, 0.06, 0.11, 0.12, 0.18, 0.27],
};
const RISK_CELL_STYLES: Array<{ match: string; fill: [number, number, number]; text: [number, number, number] }> = [
  { match: "non fiable", fill: [31, 41, 55], text: [255, 255, 255] },
  { match: "fragile", fill: [254, 226, 226], text: [153, 27, 27] },
  { match: "incertain", fill: [254, 243, 199], text: [146, 64, 14] },
  { match: "fiable", fill: [220, 252, 231], text: [22, 101, 52] },
];

function sanitizeFilePart(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

function resolveChartTitle(chartElement: Element, fallbackTitle: string): string {
  const chartWrap =
    "closest" in chartElement && typeof chartElement.closest === "function"
      ? chartElement.closest(".chart-wrap")
      : null;
  const title = chartWrap?.previousElementSibling?.textContent?.trim();
  return title || fallbackTitle;
}

function splitPdfText(pdf: jsPDF, text: string, width: number): string[] {
  const wrapped = pdf.splitTextToSize(text, width);
  return Array.isArray(wrapped) ? wrapped.map((line) => String(line)) : [String(wrapped)];
}

function getMetaRows(scope: ParentNode): { scoped: string[]; fallback: string[]; rows: string[] } {
  const scoped = Array.from(scope.querySelectorAll(".meta .meta-row")).map((row) => row.textContent ?? "");
  const fallback = scoped.length ? [] : Array.from(scope.querySelectorAll(".meta-row")).map((row) => row.textContent ?? "");
  return {
    scoped,
    fallback,
    rows: scoped.length ? scoped : fallback,
  };
}

function applyThinBlackBorder(pdf: jsPDF): void {
  if ("setDrawColor" in pdf && typeof pdf.setDrawColor === "function") {
    pdf.setDrawColor(0, 0, 0);
  }
  if ("setLineWidth" in pdf && typeof pdf.setLineWidth === "function") {
    pdf.setLineWidth(0.26);
  }
}

function getSummaryTableColumnRatios(columnCount: number): number[] {
  return SUMMARY_TABLE_COLUMN_RATIOS[columnCount] ?? Array.from({ length: Math.max(columnCount, 1) }, () => 1 / Math.max(columnCount, 1));
}

function getRiskCellStyle(riskText: string): { fill: [number, number, number]; text: [number, number, number] } {
  const lower = riskText.toLowerCase();
  return RISK_CELL_STYLES.find((style) => lower.includes(style.match)) ?? { fill: [31, 41, 55], text: [255, 255, 255] };
}

function extractHypothesisParts(hypothesis: HTMLElement): { lead: string; body: string } {
  const fullText = (hypothesis.textContent ?? "").trim();
  if (!fullText) return { lead: "", body: "" };

  const strongText =
    "querySelector" in hypothesis && typeof hypothesis.querySelector === "function"
      ? hypothesis.querySelector("strong")?.textContent?.trim() ?? ""
      : "";
  if (strongText && fullText.startsWith(strongText)) {
    return {
      lead: strongText,
      body: fullText.slice(strongText.length).trim(),
    };
  }

  const prefixedMatch = fullText.match(
    /^((?:Optimiste|Arrim\u00E9|Arrime|Historique corr\u00E9l\u00E9|Friction(?:\s*\([^)]+\))?|Risk Score|Fiabilit\u00E9 de l'historique|R\u00E8gle de lecture)\s*:)\s*(.*)$/u,
  );
  if (prefixedMatch) {
    return {
      lead: prefixedMatch[1]?.trim() ?? "",
      body: prefixedMatch[2]?.trim() ?? "",
    };
  }

  return { lead: "", body: fullText };
}

export function buildSimulationPdfFileName(selectedTeam: string, date = new Date()): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear());
  const teamPart = sanitizeFilePart(selectedTeam) || "equipe";
  return `simulation-${teamPart}-${day}_${month}_${year}.pdf`;
}

function estimateHypothesisSectionHeight(pdf: jsPDF, hypothesisBlocks: HTMLElement[], contentW: number): number {
  let total = 10 + 7 + 2;
  hypothesisBlocks.forEach((hypothesis) => {
    const { lead, body } = extractHypothesisParts(hypothesis);
    if (!lead && !body) return;
    const leadLines = lead ? splitPdfText(pdf, lead, contentW) : [];
    const bodyLines = body ? splitPdfText(pdf, body, contentW) : [];
    total += Math.max(1, leadLines.length + bodyLines.length) * 3.8;
  });
  return total;
}

function estimateHypothesisGridHeight(pdf: jsPDF, hypothesisColumns: HTMLElement[][], contentW: number): number {
  if (hypothesisColumns.length < 2) return estimateHypothesisSectionHeight(pdf, hypothesisColumns[0] ?? [], contentW);

  const columnGap = 6;
  const columnWidth = (contentW - columnGap) / hypothesisColumns.length;
  const tallestColumn = Math.max(
    ...hypothesisColumns.map((column) =>
      column.reduce((total, hypothesis) => {
        const { lead, body } = extractHypothesisParts(hypothesis);
        const leadLines = lead ? splitPdfText(pdf, lead, columnWidth) : [];
        const bodyLines = body ? splitPdfText(pdf, body, columnWidth) : [];
        return total + Math.max(1, leadLines.length + bodyLines.length) * PDF_PORTFOLIO_HYPOTHESIS_LINE_HEIGHT;
      }, 0),
    ),
  );
  return 10 + 5 + 2 + tallestColumn;
}

function renderHypothesisGrid(
  pdf: jsPDF,
  hypothesisColumns: HTMLElement[][],
  margin: number,
  contentW: number,
  cursorY: number,
): number {
  const columnGap = 6;
  const columnWidth = (contentW - columnGap) / hypothesisColumns.length;
  let tallestColumnHeight = 0;

  hypothesisColumns.forEach((column, columnIndex) => {
    let columnY = cursorY;
    const columnX = margin + columnIndex * (columnWidth + columnGap);
    column.forEach((hypothesis) => {
      const { lead, body } = extractHypothesisParts(hypothesis);
      if (!lead && !body) return;

      const leadLines = lead ? splitPdfText(pdf, lead, columnWidth) : [];
      const bodyLines = body ? splitPdfText(pdf, body, columnWidth) : [];
      if (leadLines.length) {
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(30, 58, 138);
        pdf.text(leadLines, columnX, columnY);
        columnY += leadLines.length * PDF_PORTFOLIO_HYPOTHESIS_LINE_HEIGHT;
      }
      if (bodyLines.length) {
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(0, 0, 0);
        pdf.text(bodyLines, columnX, columnY);
        columnY += bodyLines.length * PDF_PORTFOLIO_HYPOTHESIS_LINE_HEIGHT;
      }
    });
    tallestColumnHeight = Math.max(tallestColumnHeight, columnY - cursorY);
  });

  return cursorY + tallestColumnHeight;
}

function getDecisionDiagnostic(scope: ParentNode): { title: string; rows: string[] } | null {
  const diagnostic = scope.querySelector(".decision-diagnostic");
  if (!diagnostic) return null;

  const title = diagnostic.querySelector("h2")?.textContent?.trim() ?? "";
  const rows = Array.from(diagnostic.querySelectorAll(".decision-dimension"))
    .map((row) => row.textContent?.trim() ?? "")
    .filter(Boolean);
  return title && rows.length ? { title, rows } : null;
}

function renderDecisionDiagnostic(
  pdf: jsPDF,
  diagnostic: { title: string; rows: string[] } | null,
  margin: number,
  contentW: number,
  cursorY: number,
  ensureSpace: (neededHeight: number) => number,
  titleColor: [number, number, number] = [17, 24, 39],
  bottomGap = 1,
  compact = false,
  lineHeight = 3.6,
): number {
  if (!diagnostic) return cursorY;

  pdf.setFontSize(8);
  const columnCount = compact ? 2 : 1;
  const columnGap = compact ? 4 : 0;
  const rowWidth = (contentW - 6 - columnGap * (columnCount - 1)) / columnCount;
  const rows = diagnostic.rows.map((row) => splitPdfText(pdf, row, rowWidth));
  const rowHeights = Array.from({ length: Math.ceil(rows.length / columnCount) }, (_, rowIndex) => {
    const rowStart = rowIndex * columnCount;
    return Math.max(...rows.slice(rowStart, rowStart + columnCount).map((lines) => Math.max(lines.length, 1))) * lineHeight + 1;
  });
  const boxHeight = 8 + rowHeights.reduce((total, height) => total + height, 0);
  cursorY = ensureSpace(boxHeight + 3);
  applyThinBlackBorder(pdf);
  pdf.rect(margin, cursorY, contentW, boxHeight, "S");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(...titleColor);
  pdf.text(diagnostic.title, margin + 3, cursorY + 5);
  const contentY = cursorY + 8;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  diagnostic.rows.forEach((row, index) => {
    const lines = rows[index] ?? [row];
    const rowIndex = Math.floor(index / columnCount);
    const columnIndex = index % columnCount;
    const rowY = contentY + rowHeights.slice(0, rowIndex).reduce((total, height) => total + height, 0);
    const rowX = margin + 3 + columnIndex * (rowWidth + columnGap);
    pdf.setTextColor(17, 24, 39);
    pdf.text(lines, rowX, rowY);
  });

  return cursorY + boxHeight + bottomGap;
}

export async function downloadSimulationPdf(reportWindowDocument: Document, selectedTeam: string): Promise<void> {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const contentW = pageW - margin * 2;
  let cursorY = margin;

  const ensureSpace = (neededHeight: number): number => {
    if (cursorY + neededHeight <= pageH - margin) return cursorY;
    pdf.addPage();
    cursorY = margin;
    return cursorY;
  };

  const title = reportWindowDocument.querySelector("h1")?.textContent ?? "Simulation Monte Carlo";
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text(title, margin, cursorY);
  cursorY += 6;

  const drawRoundedBox = (x: number, y: number, width: number, height: number): void => {
    applyThinBlackBorder(pdf);
    if ("roundedRect" in pdf && typeof pdf.roundedRect === "function") {
      pdf.roundedRect(x, y, width, height, 2, 2, "S");
      return;
    }
    pdf.rect(x, y, width, height, "S");
  };

  const { scoped: scopedMetaRows, fallback: fallbackMetaRows, rows: metaRows } = getMetaRows(reportWindowDocument);
  const usesLegacyFlatMeta = scopedMetaRows.length === 0 && fallbackMetaRows.length > 0;
  const diagnosticTitle = reportWindowDocument.querySelector(".diagnostic-title")?.textContent ?? "Diagnostic";
  const diagnosticRows = Array.from(reportWindowDocument.querySelectorAll(".diagnostic-card .meta-row")).map(
    (row) => row.textContent ?? "",
  );
  const hasDiagnosticCard = diagnosticRows.length > 0;

  if (usesLegacyFlatMeta && !hasDiagnosticCard) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    metaRows.forEach((text) => {
      ensureSpace(3.6);
      pdf.text(text, margin, cursorY);
      cursorY += 3.6;
    });
    cursorY += 2;
  } else if (metaRows.length || hasDiagnosticCard) {
    const gap = 4;
    const leftW = hasDiagnosticCard ? contentW * 0.58 : contentW;
    const rightW = hasDiagnosticCard ? contentW - leftW - gap : 0;
    const lineH = 3.6;
    const leftH = Math.max(12, 6 + metaRows.length * lineH);
    const rightH = hasDiagnosticCard ? Math.max(12, 8 + diagnosticRows.length * lineH) : 0;
    const boxH = Math.max(leftH, rightH);

    ensureSpace(boxH + 2);
    drawRoundedBox(margin, cursorY, leftW, boxH);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    let leftY = cursorY + 4.5;
    metaRows.forEach((text) => {
      pdf.text(text, margin + 3, leftY);
      leftY += lineH;
    });

    if (hasDiagnosticCard) {
      const rightX = margin + leftW + gap;
      drawRoundedBox(rightX, cursorY, rightW, boxH);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.text(diagnosticTitle, rightX + 3, cursorY + 4.5);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7);
      let rightY = cursorY + 8.5;
      diagnosticRows.forEach((text) => {
        const lines = splitPdfText(pdf, text, rightW - 6);
        pdf.text(lines, rightX + 3, rightY);
        rightY += Math.max(lines.length, 1) * lineH;
      });
    }

    cursorY += boxH + 3;
  }

  const kpiRows = Array.from(reportWindowDocument.querySelectorAll(".kpis"));
  const rowsToRender = kpiRows.length
    ? kpiRows.map((row) => Array.from(row.querySelectorAll(".kpi")))
    : [Array.from(reportWindowDocument.querySelectorAll(".kpi"))];
  if (rowsToRender.some((row) => row.length > 0)) {
    cursorY += 4;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    rowsToRender.forEach((row) => {
      if (!row.length) return;
      ensureSpace(8);
      const kpiStep = contentW / row.length;
      row.forEach((kpi, i) => {
        const label = kpi.querySelector(".kpi-label")?.textContent ?? "";
        const value = kpi.querySelector(".kpi-value")?.textContent ?? "";
        pdf.text(`${label}: ${value}`, margin + (i + 0.5) * kpiStep, cursorY, { align: "center" });
      });
      cursorY += 7;
    });
  }

  cursorY = renderDecisionDiagnostic(
    pdf,
    getDecisionDiagnostic(reportWindowDocument),
    margin,
    contentW,
    cursorY,
    ensureSpace,
    undefined,
    PDF_SIMULATION_DIAGNOSTIC_BOTTOM_GAP,
    true,
  );

  const svgElements = reportWindowDocument.querySelectorAll<SVGSVGElement>(".chart-wrap svg");
  const chartWidth = (contentW - PDF_SIMULATION_CHART_GAP) / PDF_SIMULATION_CHART_COLUMNS;
  const chartRowCount = Math.max(1, Math.ceil(svgElements.length / PDF_SIMULATION_CHART_COLUMNS));
  const availableChartHeight = pageH - margin - cursorY
    - PDF_SIMULATION_CHART_BOTTOM_GAP * chartRowCount
    - PDF_SIMULATION_CHART_TITLE_HEIGHT * chartRowCount
    - PDF_SIMULATION_CHART_GAP * (chartRowCount - 1);
  const chartHeight = availableChartHeight / chartRowCount;
  const chartRowHeight = PDF_SIMULATION_CHART_TITLE_HEIGHT + chartHeight + PDF_SIMULATION_CHART_BOTTOM_GAP;
  for (let i = 0; i < svgElements.length; i += 1) {
    const svg = svgElements[i];
    const chartRow = Math.floor(i / PDF_SIMULATION_CHART_COLUMNS);
    const chartColumn = i % PDF_SIMULATION_CHART_COLUMNS;
    const chartX = margin + chartColumn * (chartWidth + PDF_SIMULATION_CHART_GAP);
    const chartY = cursorY + chartRow * (chartRowHeight + PDF_SIMULATION_CHART_GAP);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.text(resolveChartTitle(svg, SECTION_TITLES[i] ?? ""), chartX, chartY);

    await pdf.svg(svg, {
      x: chartX,
      y: chartY + PDF_SIMULATION_CHART_TITLE_HEIGHT,
      width: chartWidth,
      height: chartHeight,
    });
  }

  const filename = buildSimulationPdfFileName(selectedTeam);
  pdf.save(filename);
}

export async function downloadPortfolioPdf(
  reportWindowDocument: Document,
  selectedProject: string,
  isDemo = false,
): Promise<void> {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const contentW = pageW - margin * 2;

  const pages = Array.from(reportWindowDocument.querySelectorAll<HTMLElement>(".page"));
  const sections = pages.length ? pages : [reportWindowDocument.body as HTMLElement];
  const BLACK: [number, number, number] = [0, 0, 0];
  const BLUE: [number, number, number] = [30, 58, 138];

  for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex += 1) {
    if (sectionIndex > 0) {
      pdf.addPage();
    }

    let cursorY = margin;
    const section = sections[sectionIndex];

    const ensureSpace = (neededHeight: number): number => {
      if (cursorY + neededHeight <= pageH - margin) return cursorY;
      pdf.addPage();
      cursorY = margin;
      return cursorY;
    };

    const title = section.querySelector("h1")?.textContent ?? "Simulation Portefeuille";
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.setTextColor(...BLACK);
    pdf.text(title, margin, cursorY);
    cursorY += 6;

    const { rows: metaRows } = getMetaRows(section);
    const diagnosticTitle = section.querySelector(".diagnostic-title")?.textContent ?? "Diagnostic";
    const diagnosticRows = Array.from(section.querySelectorAll(".diagnostic-card .meta-row")).map((row) => row.textContent ?? "");
    const hasDiagnosticCard = diagnosticRows.length > 0;

    if (metaRows.length || hasDiagnosticCard) {
      const gap = 4;
      const leftW = hasDiagnosticCard ? contentW * 0.58 : contentW;
      const rightW = hasDiagnosticCard ? contentW - leftW - gap : 0;
      const lineH = 3.6;
      const leftH = Math.max(12, 6 + metaRows.length * lineH);
      const rightH = hasDiagnosticCard ? Math.max(12, 8 + diagnosticRows.length * lineH) : 0;
      const boxH = Math.max(leftH, rightH);

      ensureSpace(boxH + 2);
      applyThinBlackBorder(pdf);
      pdf.rect(margin, cursorY, leftW, boxH, "S");

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7);
      pdf.setTextColor(...BLACK);
      let leftY = cursorY + 4.5;
      metaRows.forEach((text) => {
        pdf.text(text, margin + 3, leftY);
        leftY += lineH;
      });

      if (hasDiagnosticCard) {
        const rightX = margin + leftW + gap;
        pdf.rect(rightX, cursorY, rightW, boxH, "S");
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8);
        pdf.setTextColor(...BLACK);
        pdf.text(diagnosticTitle, rightX + 3, cursorY + 4.5);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7);
        pdf.setTextColor(...BLACK);
        let rightY = cursorY + 8.5;
        diagnosticRows.forEach((text) => {
          const lines = splitPdfText(pdf, text, rightW - 6);
          pdf.text(lines, rightX + 3, rightY);
          rightY += Math.max(lines.length, 1) * lineH;
        });
      }

      cursorY += boxH + 3;
    }

    const summaryTable = section.querySelector<HTMLTableElement>(".summary-table");
    if (summaryTable) {
      const headerCells = Array.from(summaryTable.querySelectorAll("thead th")).map((cell) => (cell.textContent ?? "").trim());
      const bodyRows = Array.from(summaryTable.querySelectorAll("tbody tr")).map((row) =>
        Array.from(row.querySelectorAll("td")).map((cell) => (cell.textContent ?? "").trim()),
      );

      const colRatios = getSummaryTableColumnRatios(headerCells.length);
      const colWidths = colRatios.map((ratio) => ratio * contentW);
      const cellPaddingX = 2;
      const getWrappedLines = (text: string, width: number): string[] => {
        return splitPdfText(pdf, text, Math.max(width - cellPaddingX * 2, 8));
      };
      const headerLines = headerCells.map((cell, index) => getWrappedLines(cell, colWidths[index] ?? contentW));
      const tableLineHeight = 4;
      const cellPaddingY = 3;
      const headerHeight = Math.max(8, Math.max(...headerLines.map((lines) => lines.length), 1) * tableLineHeight + cellPaddingY);
      const rowHeights = bodyRows.map((row) => {
        const maxLines = Math.max(
          ...colWidths.map((width, colIndex) => getWrappedLines(row[colIndex] ?? "", width).length),
          1,
        );
        return Math.max(8, maxLines * tableLineHeight + cellPaddingY);
      });
      const tableHeight = headerHeight + rowHeights.reduce((sum, height) => sum + height, 0);
      cursorY += 4;
      ensureSpace(4 + tableHeight + 2);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      pdf.setTextColor(...BLUE);
      pdf.text("Synth\u00E8se d\u00E9cisionnelle", margin, cursorY);
      cursorY += 4;

      let x = margin;
      pdf.setDrawColor(209, 213, 219);
      for (let i = 0; i < headerCells.length; i += 1) {
        const width = colWidths[i] ?? 0;
        pdf.setFillColor(30, 58, 138);
        pdf.rect(x, cursorY, width, headerHeight, "FD");
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8);
        pdf.setTextColor(255, 255, 255);
        const headerText = headerLines[i] ?? [headerCells[i] ?? ""];
        const align = i === 0 ? "left" : "center";
        const textX = i === 0 ? x + cellPaddingX : x + width / 2;
        pdf.text(headerText, textX, cursorY + 5.5, { align });
        x += width;
      }
      cursorY += headerHeight;

      for (let rowIndex = 0; rowIndex < bodyRows.length; rowIndex += 1) {
        const row = bodyRows[rowIndex] ?? [];
        const rowHeight = rowHeights[rowIndex] ?? 11;
        x = margin;
        for (let colIndex = 0; colIndex < headerCells.length; colIndex += 1) {
          const width = colWidths[colIndex] ?? 0;
          const value = row[colIndex] ?? "";
          const wrappedValue = getWrappedLines(value, width);
          if (colIndex === 4 || colIndex === 5) {
            const style = getRiskCellStyle(value);
            pdf.setFillColor(...style.fill);
            pdf.setTextColor(...style.text);
            pdf.rect(x, cursorY, width, rowHeight, "FD");
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(8);
            pdf.text(wrappedValue, x + width / 2, cursorY + 4.5, { align: "center" });
          } else {
            const base = rowIndex % 2 === 0 ? 250 : 243;
            pdf.setFillColor(base, base, base);
            pdf.setTextColor(17, 24, 39);
            pdf.rect(x, cursorY, width, rowHeight, "FD");
            pdf.setFont("helvetica", colIndex === 0 ? "bold" : "normal");
            pdf.setFontSize(9);
            if (colIndex === 0) {
              pdf.text(wrappedValue, x + cellPaddingX, cursorY + 4.5, { align: "left" });
            } else {
              pdf.text(wrappedValue, x + width / 2, cursorY + 4.5, { align: "center" });
            }
          }
          x += width;
        }
        cursorY += rowHeight;
      }
      cursorY += 2;
    }

    const hypothesisBlocks = Array.from(section.querySelectorAll<HTMLElement>(".hypothesis"));
    const hypothesisColumns = Array.from(section.querySelectorAll<HTMLElement>(".hypothesis-column")).map((column) =>
      Array.from(column.querySelectorAll<HTMLElement>(".hypothesis")),
    );
    const usesHypothesisGrid = Boolean(summaryTable) && hypothesisColumns.length === 2;
    if (hypothesisBlocks.length && !summaryTable) {
      cursorY += 10;
      const hypothesisSectionHeight = estimateHypothesisSectionHeight(pdf, hypothesisBlocks, contentW);
      ensureSpace(hypothesisSectionHeight);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.setTextColor(...BLUE);
      pdf.text("Hypoth\u00E8ses", margin, cursorY);
      cursorY += 7;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      hypothesisBlocks.forEach((hypothesis) => {
        const { lead, body } = extractHypothesisParts(hypothesis);
        if (!lead && !body) return;

        const leadLines = lead ? splitPdfText(pdf, lead, contentW) : [];
        const bodyLines = body ? splitPdfText(pdf, body, contentW) : [];
        const blockHeight = Math.max(1, leadLines.length + bodyLines.length) * 3.8;
        ensureSpace(blockHeight);

        if (leadLines.length) {
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(...BLUE);
          pdf.text(leadLines, margin, cursorY);
          cursorY += leadLines.length * 3.8;
        }

        if (bodyLines.length) {
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(...BLACK);
          pdf.text(bodyLines, margin, cursorY);
          cursorY += bodyLines.length * 3.8;
        }
      });
      cursorY += 2;
    }

    const kpiRows = Array.from(section.querySelectorAll(".kpis"));
    const rowsToRender = kpiRows.length
      ? kpiRows.map((row) => Array.from(row.querySelectorAll(".kpi")))
      : [Array.from(section.querySelectorAll(".kpi"))];
    if (rowsToRender.some((row) => row.length > 0)) {
      cursorY += 4;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      rowsToRender.forEach((row) => {
        if (!row.length) return;
        ensureSpace(8);
        pdf.setTextColor(...BLACK);
        const kpiStep = contentW / row.length;
        row.forEach((kpi, i) => {
          const label = kpi.querySelector(".kpi-label")?.textContent ?? "";
          const value = kpi.querySelector(".kpi-value")?.textContent ?? "";
          pdf.text(`${label}: ${value}`, margin + (i + 0.5) * kpiStep, cursorY, { align: "center" });
        });
        cursorY += 7;
      });
    }

    cursorY = renderDecisionDiagnostic(
      pdf,
      getDecisionDiagnostic(section),
      margin,
      contentW,
      cursorY,
      ensureSpace,
      BLUE,
      5,
      false,
      4,
    );

    const svgElements = section.querySelectorAll<SVGSVGElement>(".chart-wrap svg");
    for (let i = 0; i < svgElements.length; i += 1) {
      const svg = svgElements[i];
      const isSummaryChart = Boolean(summaryTable) && hypothesisBlocks.length > 0;

      const svgW = svg.viewBox?.baseVal?.width || CHART_WIDTH;
      const svgH = svg.viewBox?.baseVal?.height || CHART_HEIGHT;
      const ratio = svgH / svgW;
      const chartsLeft = svgElements.length - i;
      const reservedForTitlesAndSpacing = chartsLeft * (isSummaryChart ? 13 : 4 + 1.5 + 2);
      const reservedForHypothesisSection =
        summaryTable && hypothesisBlocks.length
          ? usesHypothesisGrid
            ? estimateHypothesisGridHeight(pdf, hypothesisColumns, contentW)
            : estimateHypothesisSectionHeight(pdf, hypothesisBlocks, contentW)
          : 0;
      const availableChartH =
        (pageH - margin - cursorY - reservedForTitlesAndSpacing - reservedForHypothesisSection) / chartsLeft;
      const desiredFullWidthH = contentW * ratio;
      const renderH = isSummaryChart
        ? Math.min(desiredFullWidthH, Math.max(0, availableChartH), PDF_PORTFOLIO_SUMMARY_CHART_MAX_HEIGHT)
        : Math.max(20, Math.min(desiredFullWidthH, availableChartH));
      const renderW = Math.min(contentW, renderH / ratio);
      const centeredX = margin + (contentW - renderW) / 2;

      if (isSummaryChart) {
        cursorY += 3;
      }
      ensureSpace(4 + renderH + 2);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(...BLUE);
      pdf.text(resolveChartTitle(svg, PORTFOLIO_SECTION_TITLES[i] ?? ""), margin, cursorY);
      cursorY += 4;

      await pdf.svg(svg, { x: centeredX, y: cursorY, width: renderW, height: renderH });
      cursorY += renderH + 2;
    }

    if (hypothesisBlocks.length && summaryTable) {
      cursorY += 2;
      const hypothesisSectionHeight = usesHypothesisGrid
        ? estimateHypothesisGridHeight(pdf, hypothesisColumns, contentW)
        : estimateHypothesisSectionHeight(pdf, hypothesisBlocks, contentW);
      ensureSpace(hypothesisSectionHeight);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.setTextColor(...BLUE);
      pdf.text("Hypoth\u00E8ses", margin, cursorY);
      cursorY += 5;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      if (usesHypothesisGrid) {
        cursorY = renderHypothesisGrid(pdf, hypothesisColumns, margin, contentW, cursorY);
      } else {
        hypothesisBlocks.forEach((hypothesis) => {
          const { lead, body } = extractHypothesisParts(hypothesis);
          if (!lead && !body) return;

          const leadLines = lead ? splitPdfText(pdf, lead, contentW) : [];
          const bodyLines = body ? splitPdfText(pdf, body, contentW) : [];
          const blockHeight = Math.max(1, leadLines.length + bodyLines.length) * 3.8;
          ensureSpace(blockHeight);

          if (leadLines.length) {
            pdf.setFont("helvetica", "bold");
            pdf.setTextColor(...BLUE);
            pdf.text(leadLines, margin, cursorY);
            cursorY += leadLines.length * 3.8;
          }

          if (bodyLines.length) {
            pdf.setFont("helvetica", "normal");
            pdf.setTextColor(...BLACK);
            pdf.text(bodyLines, margin, cursorY);
            cursorY += bodyLines.length * 3.8;
          }
        });
      }
      cursorY += 2;
    }

    if (isDemo) {
      pdf.setFont("helvetica", "italic");
      pdf.setFontSize(8);
      pdf.setTextColor(107, 114, 128);
      pdf.text("Donn\u00E9es de d\u00E9monstration \u2014 Monte Carlo Azure", margin, pageH - 5);
    }
  }

  const filename = buildSimulationPdfFileName(`Portefeuille-${selectedProject}`);
  pdf.save(filename);
}

