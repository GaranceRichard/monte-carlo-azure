import { describe, expect, it, vi } from "vitest";
import {
  renderDistributionChart,
  renderOverlayProbabilityChart,
  renderProbabilityChart,
  renderThroughputChart,
  type DistributionExportPoint,
  type ProbabilityExportPoint,
  type ThroughputExportPoint,
} from "./simulationChartsSvg";

const pdfMocks = vi.hoisted(() => ({
  instances: [] as Array<{
    internal: { pageSize: { getWidth: () => number; getHeight: () => number } };
    setFont: ReturnType<typeof vi.fn>;
    setFontSize: ReturnType<typeof vi.fn>;
    text: ReturnType<typeof vi.fn>;
    addPage: ReturnType<typeof vi.fn>;
    svg: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  }>,
}));

vi.mock("jspdf", () => ({
  jsPDF: vi.fn(function MockJsPdfCtor() {
    const instance = {
      internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } },
      setFont: vi.fn().mockReturnThis(),
      setFontSize: vi.fn().mockReturnThis(),
      text: vi.fn().mockReturnThis(),
      addPage: vi.fn().mockReturnThis(),
      svg: vi.fn(async () => undefined),
      save: vi.fn(),
    };
    pdfMocks.instances.push(instance);
    return instance;
  }),
}));

import { buildSimulationPdfFileName, downloadSimulationPdf } from "./simulationPdfDownload";

function buildThroughputPoints(count: number): ThroughputExportPoint[] {
  return Array.from({ length: count }, (_, i) => ({
    week: `2025-01-${String(i + 1).padStart(2, "0")}`,
    throughput: i % 2 === 0 ? i + 1 : i + 0.5,
    movingAverage: i + 0.25,
  }));
}

function buildDistributionPoints(count: number): DistributionExportPoint[] {
  return Array.from({ length: count }, (_, i) => ({
    x: count - i,
    count: i + 1,
    gauss: i + 0.4,
  }));
}

function buildProbabilityPoints(count: number): ProbabilityExportPoint[] {
  return Array.from({ length: count }, (_, i) => ({
    x: count - i,
    probability: (i * 11) % 120,
  }));
}

describe("simulationChartsSvg", () => {
  it("renders empty state for all charts when no points", () => {
    expect(renderThroughputChart([])).toContain("Donnees insuffisantes");
    expect(renderDistributionChart([])).toContain("Donnees insuffisantes");
    expect(renderProbabilityChart([])).toContain("Donnees insuffisantes");
  });

  it("renders throughput chart with escaped x labels and sparse ticks", () => {
    const points = buildThroughputPoints(12);
    points[0].week = "<unsafe>&";
    const svg = renderThroughputChart(points);

    expect(svg).toContain("Throughput hebdomadaire");
    expect(svg).toContain("&lt;unsafe&gt;&amp;");
    expect(svg).toContain("stroke-dasharray=\"8 4\"");
    expect(svg).toContain("x1=\"44\" y1=\"16\" x2=\"44\" y2=\"324\"");
  });

  it("renders distribution/probability charts with sorted x values and sparse labels", () => {
    const distributionSvg = renderDistributionChart(buildDistributionPoints(12));
    const probabilitySvg = renderProbabilityChart(buildProbabilityPoints(12));

    expect(distributionSvg).toContain("Distribution Monte Carlo");
    expect(distributionSvg).toContain("<path d=\"M");
    expect(probabilitySvg).toContain("Courbe de probabilite");
    expect(probabilitySvg).toContain("<path d=\"M");
  });

  it("renders probability chart with single point (xStep=0 branch)", () => {
    const svg = renderProbabilityChart([{ x: 4, probability: 120 }]);
    expect(svg).toContain("Courbe de probabilite");
    expect(svg).toContain(">4</text>");
  });

  it("renders overlay probability chart with legend for multiple series", () => {
    const svg = renderOverlayProbabilityChart([
      { label: "Optimiste", color: "#15803d", points: [{ x: 10, probability: 20 }, { x: 20, probability: 80 }] },
      { label: "Conservateur", color: "#dc2626", points: [{ x: 10, probability: 10 }, { x: 20, probability: 70 }] },
    ]);
    expect(svg).toContain("Comparaison des probabilites");
    expect(svg).toContain("Optimiste");
    expect(svg).toContain("Conservateur");
    expect(svg).toContain("#15803d");
    expect(svg).toContain("#dc2626");
  });
});

describe("simulationPdfDownload", () => {
  it("builds fallback filename when team sanitizes to empty", () => {
    const date = new Date("2026-02-25T10:00:00Z");
    expect(buildSimulationPdfFileName("***", date)).toBe("simulation-equipe-25_02_2026.pdf");
  });

  it("downloads pdf with fallbacks when title/meta/kpi are missing", async () => {
    const reportDoc = document.implementation.createHTMLDocument("report");
    reportDoc.body.innerHTML = `
      <div class="chart-wrap"><svg></svg></div>
      <div class="chart-wrap"><svg viewBox="0 0 960 300"></svg></div>
      <div class="chart-wrap"><svg viewBox="0 0 960 300"></svg></div>
      <div class="chart-wrap"><svg viewBox="0 0 960 300"></svg></div>
    `;

    await downloadSimulationPdf(reportDoc, "***");
    const pdf = pdfMocks.instances[0];

    expect(pdf.text).toHaveBeenCalledWith("Simulation Monte Carlo", 8, 8);
    expect(pdf.svg).toHaveBeenCalledTimes(4);
    expect(pdf.save).toHaveBeenCalledWith(expect.stringMatching(/^simulation-equipe-\d{2}_\d{2}_\d{4}\.pdf$/));
  });

  it("keeps charts on the same page by shrinking render size", async () => {
    const reportDoc = document.implementation.createHTMLDocument("report");
    reportDoc.body.innerHTML = `
      <h1>Simulation Monte Carlo</h1>
      <div class="chart-wrap"><svg viewBox="0 0 960 1200"></svg></div>
      <div class="chart-wrap"><svg viewBox="0 0 960 1200"></svg></div>
    `;

    await downloadSimulationPdf(reportDoc, "Equipe A");
    const pdf = pdfMocks.instances[0];
    expect(pdf.addPage).not.toHaveBeenCalled();
  });

  it("adds a page when metadata overflows available height", async () => {
    const reportDoc = document.implementation.createHTMLDocument("report");
    const metaRows = Array.from({ length: 90 }, (_, i) => `<div class="meta-row">Meta ${i + 1}</div>`).join("");
    reportDoc.body.innerHTML = `
      <h1>Simulation Monte Carlo</h1>
      ${metaRows}
      <div class="chart-wrap"><svg viewBox="0 0 960 360"></svg></div>
    `;

    await downloadSimulationPdf(reportDoc, "Equipe A");
    const pdf = pdfMocks.instances.at(-1)!;
    expect(pdf.addPage).toHaveBeenCalled();
  });
});
