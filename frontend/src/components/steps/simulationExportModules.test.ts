import { afterEach, describe, expect, it, vi } from "vitest";
import {
  renderCycleTimeChart,
  renderDistributionChart,
  renderOverlayProbabilityChart,
  renderProbabilityChart,
  renderThroughputChart,
  type CycleTimeExportPoint,
  type CycleTimeTrendExportPoint,
  type DistributionExportPoint,
  type ProbabilityExportPoint,
  type ThroughputExportPoint,
} from "./simulationChartsSvg";

const pdfMocks = vi.hoisted(() => ({
  instances: [] as Array<{
    internal: { pageSize: { getWidth: () => number; getHeight: () => number } };
    setFont: ReturnType<typeof vi.fn>;
    setFontSize: ReturnType<typeof vi.fn>;
    setTextColor: ReturnType<typeof vi.fn>;
    setDrawColor: ReturnType<typeof vi.fn>;
    setLineWidth: ReturnType<typeof vi.fn>;
    setFillColor: ReturnType<typeof vi.fn>;
    roundedRect: ReturnType<typeof vi.fn>;
    rect: ReturnType<typeof vi.fn>;
    splitTextToSize: ReturnType<typeof vi.fn>;
    text: ReturnType<typeof vi.fn>;
    addPage: ReturnType<typeof vi.fn>;
    svg: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  }>,
  splitTextToSizeImplementation: undefined as undefined | ((text: string, width: number) => string[]),
}));

vi.mock("jspdf", () => ({
  jsPDF: vi.fn(function MockJsPdfCtor() {
    const instance = {
      internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } },
      setFont: vi.fn().mockReturnThis(),
      setFontSize: vi.fn().mockReturnThis(),
      setTextColor: vi.fn().mockReturnThis(),
      setDrawColor: vi.fn().mockReturnThis(),
      setLineWidth: vi.fn().mockReturnThis(),
      setFillColor: vi.fn().mockReturnThis(),
      roundedRect: vi.fn().mockReturnThis(),
      rect: vi.fn().mockReturnThis(),
      splitTextToSize: vi.fn((text: string, width: number) => pdfMocks.splitTextToSizeImplementation?.(text, width) ?? [text]),
      text: vi.fn().mockReturnThis(),
      addPage: vi.fn().mockReturnThis(),
      svg: vi.fn(async () => undefined),
      save: vi.fn(),
    };
    pdfMocks.instances.push(instance);
    return instance;
  }),
}));

import { buildSimulationPdfFileName, downloadPortfolioPdf, downloadSimulationPdf } from "./simulationPdfDownload";
import { buildPortfolioPrintReportHtml } from "./portfolioPrintReport";
import { presentPortfolioComparisonDiagnostic } from "../../utils/portfolioComparisonPresentation";
import type { PortfolioComparisonDiagnostic } from "../../utils/portfolioComparisonDiagnostic";

function buildThroughputPoints(count: number): ThroughputExportPoint[] {
  return Array.from({ length: count }, (_, i) => ({
    week: `2025-01-${String(i + 1).padStart(2, "0")}`,
    throughput: i % 2 === 0 ? i + 1 : i + 0.5,
    movingAverage: i + 0.25,
  }));
}

function buildCycleTimePoints(count: number): CycleTimeExportPoint[] {
  return Array.from({ length: count }, (_, i) => ({
    week: `2025-01-${String((i % 6) + 1).padStart(2, "0")}`,
    cycleTimeDays: 1.2 + i * 0.35,
    count: (i % 3) + 1,
  }));
}

function buildCycleTimeTrendPoints(count: number): CycleTimeTrendExportPoint[] {
  return Array.from({ length: count }, (_, i) => ({
    week: `2025-01-${String(i + 1).padStart(2, "0")}`,
    averageDays: 1.5 + i * 0.2,
    lowerBoundDays: 1.2 + i * 0.2,
    upperBoundDays: 1.8 + i * 0.2,
    itemCount: i + 2,
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
    expect(renderCycleTimeChart([], [])).toContain("Donnees insuffisantes");
    expect(renderThroughputChart([])).toContain("Donnees insuffisantes");
    expect(renderDistributionChart([])).toContain("Donnees insuffisantes");
    expect(renderProbabilityChart([])).toContain("Donnees insuffisantes");
  });

  it("renders cycle time chart with scatter points and shaded band", () => {
    const svg = renderCycleTimeChart(buildCycleTimePoints(6), buildCycleTimeTrendPoints(4));

    expect(svg).toContain("Cycle Time");
    expect(svg).toContain("<circle");
    expect(svg).toContain("fill-opacity=\"0.35\"");
    expect(svg).toContain("stroke=\"#f97316\"");
    expect(svg).toContain("stroke-dasharray=\"8 4\"");
    expect(svg).toContain("Variabilité");
    expect(svg).toContain("Moyenne glissante");
  });

  it("renders throughput chart with escaped x labels and sparse ticks", () => {
    const points = buildThroughputPoints(12);
    points[0].week = "<unsafe>&";
    const svg = renderThroughputChart(points);

    expect(svg).toContain("Throughput hebdomadaire");
    expect(svg).toContain("&lt;unsafe&gt;&amp;");
    expect(svg).toContain("stroke-dasharray=\"8 4\"");
    expect(svg).toContain("Moyenne mobile");
    expect(svg).toContain("x1=\"44\" y1=\"16\" x2=\"44\" y2=\"296\"");
  });

  it("renders distribution/probability charts with sorted x values and sparse labels", () => {
    const distributionSvg = renderDistributionChart(buildDistributionPoints(12));
    const probabilitySvg = renderProbabilityChart(buildProbabilityPoints(12));

    expect(distributionSvg).toContain("Distribution Monte Carlo");
    expect(distributionSvg).toContain("<path d=\"M");
    expect(distributionSvg).toContain("stroke-dasharray=\"8 4\"");
    expect(distributionSvg).toContain("Fréquence");
    expect(distributionSvg).toContain("Courbe lissée");
    expect(probabilitySvg).toContain("Courbe de probabilit\u00E9");
    expect(probabilitySvg).toContain("<path d=\"M");
    expect(probabilitySvg).toContain("Probabilité");
    expect(probabilitySvg).toMatch(/<path d="M[^"]*" fill="none" stroke="#2563eb" stroke-width="2\.5" \/>/);
  });

  it("renders probability chart with single point (xStep=0 branch)", () => {
    const svg = renderProbabilityChart([{ x: 4, probability: 120 }]);
    expect(svg).toContain("Courbe de probabilit\u00E9");
    expect(svg).toContain(">4</text>");
  });

  it("renders overlay probability chart with legend for multiple series", () => {
    const svg = renderOverlayProbabilityChart([
      { label: "Optimiste", color: "#15803d", points: [{ x: 10, probability: 20 }, { x: 20, probability: 80 }] },
      { label: "Historique corrÃ©lÃ©", color: "#dc2626", points: [{ x: 10, probability: 10 }, { x: 20, probability: 70 }] },
    ]);
    expect(svg).toContain("Courbes de probabilit\u00E9s compar\u00E9es");
    expect(svg).toContain("Optimiste");
    expect(svg).toContain("Historique corrÃ©lÃ©");
    expect(svg).toContain("#15803d");
    expect(svg).toContain("#dc2626");
    expect(svg).toContain("<line x1=");
  });
});

describe("simulationPdfDownload", () => {
  afterEach(() => {
    pdfMocks.instances.length = 0;
    pdfMocks.splitTextToSizeImplementation = undefined;
  });

  it("builds fallback filename when team sanitizes to empty", () => {
    const date = new Date("2026-02-25T10:00:00Z");
    expect(buildSimulationPdfFileName("***", date)).toBe("simulation-equipe-25_02_2026.pdf");
  });

  it("sanitizes accents and repeated separators in filenames", () => {
    const date = new Date("2026-02-25T10:00:00Z");
    expect(buildSimulationPdfFileName("\u00C9quipe   Alpha / Core", date)).toBe("simulation-Equipe-Alpha-Core-25_02_2026.pdf");
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

  it("uses the chart heading preceding the chart wrapper as title", async () => {
    const reportDoc = document.implementation.createHTMLDocument("report");
    reportDoc.body.innerHTML = `
      <h1>Simulation Monte Carlo</h1>
      <h2>Titre personnalise</h2>
      <div class="chart-wrap"><svg viewBox="0 0 960 360"></svg></div>
    `;

    await downloadSimulationPdf(reportDoc, "Equipe A");
    const pdf = pdfMocks.instances.at(-1)!;

    expect(pdf.text).toHaveBeenCalledWith("Titre personnalise", 8, expect.any(Number));
  });

  it("handles missing meta and kpi text nodes", async () => {
    const reportDoc = document.implementation.createHTMLDocument("report");
    reportDoc.body.innerHTML = `
      <h1>Simulation Monte Carlo</h1>
      <div class="meta-row"></div>
      <div class="kpi"><span class="kpi-label"></span><span class="kpi-value"></span></div>
    `;

    await downloadSimulationPdf(reportDoc, "Equipe A");
    const pdf = pdfMocks.instances[0];

    expect(pdf.text).toHaveBeenCalledWith("", 8, expect.any(Number));
    expect(pdf.save).toHaveBeenCalled();
  });

  it("saves a pdf even when there are no charts", async () => {
    const reportDoc = document.implementation.createHTMLDocument("report");
    reportDoc.body.innerHTML = `<h1>Simulation Monte Carlo</h1>`;

    await downloadSimulationPdf(reportDoc, "Equipe A");
    const pdf = pdfMocks.instances[0];

    expect(pdf.svg).not.toHaveBeenCalled();
    expect(pdf.save).toHaveBeenCalled();
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

  it("renders boxed scoped metadata, grouped kpis and diagnostic card", async () => {
    const reportDoc = document.implementation.createHTMLDocument("report");
    reportDoc.body.innerHTML = `
      <h1>Simulation Monte Carlo</h1>
      <div class="summary-grid">
        <div class="meta">
          <div class="meta-row">Periode: 2025-12-12 au 2026-03-11</div>
          <div class="meta-row">Mode: Semaines vers items - cible: 12 semaines</div>
        </div>
        <aside class="diagnostic-card">
          <div class="diagnostic-title">Diagnostic</div>
          <div class="meta-row">Lecture: Historique globalement stable.</div>
          <div class="meta-row">CV: 0,62</div>
        </aside>
      </div>
      <div class="kpis">
        <div class="kpi"><span class="kpi-label">P50</span><span class="kpi-value">82 items</span></div>
        <div class="kpi"><span class="kpi-label">P70</span><span class="kpi-value">75 items</span></div>
        <div class="kpi"><span class="kpi-label">P90</span><span class="kpi-value">65 items</span></div>
      </div>
      <div class="kpis">
        <div class="kpi"><span class="kpi-label">Risk Score</span><span class="kpi-value">0,21 (incertain)</span></div>
        <div class="kpi"><span class="kpi-label">Fiabilite</span><span class="kpi-value">0,62 (incertain)</span></div>
      </div>
    `;

    await downloadSimulationPdf(reportDoc, "Equipe A");
    const pdf = pdfMocks.instances.at(-1)!;

    expect(pdf.roundedRect).toHaveBeenCalledTimes(2);
    expect(pdf.setLineWidth).toHaveBeenCalledWith(0.26);
    expect(pdf.splitTextToSize).toHaveBeenCalledWith("Lecture: Historique globalement stable.", expect.any(Number));
    expect(pdf.text).toHaveBeenCalledWith("Diagnostic", expect.any(Number), expect.any(Number));
    expect(pdf.text).toHaveBeenCalledWith("P50: 82 items", expect.any(Number), expect.any(Number), { align: "center" });
    expect(pdf.text).toHaveBeenCalledWith("Risk Score: 0,21 (incertain)", expect.any(Number), expect.any(Number), { align: "center" });
    expect(pdf.text).toHaveBeenCalledWith("Fiabilite: 0,62 (incertain)", expect.any(Number), expect.any(Number), { align: "center" });
  });

  it("renders the decision diagnostic section in simulation and portfolio PDFs", async () => {
    const simulationDoc = document.implementation.createHTMLDocument("report");
    simulationDoc.body.innerHTML = `
      <h1>Simulation Monte Carlo</h1>
      <section class="decision-diagnostic">
        <h2>Diagnostic décisionnel</h2>
        <div class="decision-dimension">Statut de décision : Arbitrage nécessaire. Action conseillée : Rétablir les percentiles.</div>
      </section>
    `;
    await downloadSimulationPdf(simulationDoc, "Equipe A");
    const simulationPdf = pdfMocks.instances.at(-1)!;

    expect(simulationPdf.text).toHaveBeenCalledWith("Diagnostic décisionnel", expect.any(Number), expect.any(Number));
    expect(simulationPdf.text.mock.calls.some((call) => Array.isArray(call[0]) && call[0][0]?.includes("Arbitrage nécessaire"))).toBe(true);

    const portfolioDoc = document.implementation.createHTMLDocument("report");
    portfolioDoc.body.innerHTML = `
      <section class="page">
        <h1>Simulation Portefeuille</h1>
        <section class="decision-diagnostic">
          <h2>Diagnostic décisionnel</h2>
          <div class="decision-dimension">Statut de décision : Décision non recommandée. Action conseillée : Compléter les données.</div>
        </section>
      </section>
    `;
    await downloadPortfolioPdf(portfolioDoc, "Projet A");
    const portfolioPdf = pdfMocks.instances.at(-1)!;

    expect(portfolioPdf.text).toHaveBeenCalledWith("Diagnostic décisionnel", expect.any(Number), expect.any(Number));
    expect(portfolioPdf.text.mock.calls.some((call) => Array.isArray(call[0]) && call[0][0]?.includes("Décision non recommandée"))).toBe(true);
  });

  it("keeps a gap after the compact decision diagnostic and fits the simulation charts on one page", async () => {
    const reportDoc = document.implementation.createHTMLDocument("report");
    reportDoc.body.innerHTML = `
      <h1>Simulation Monte Carlo</h1>
      <div class="summary-grid">
        <div class="meta">
          <div class="meta-row">Période : 2026-01-01 au 2026-03-01</div>
          <div class="meta-row">Mode : Backlog vers semaines</div>
          <div class="meta-row">Tickets : Bug</div>
          <div class="meta-row">États : Done</div>
          <div class="meta-row">Échantillon : Semaines 0 incluses</div>
          <div class="meta-row">Simulations : 20 000</div>
        </div>
        <aside class="diagnostic-card"><div class="meta-row">Lecture : Historique stable.</div></aside>
      </div>
      <div class="kpis"><div class="kpi"><span class="kpi-label">P50</span><span class="kpi-value">8 semaines</span></div><div class="kpi"><span class="kpi-label">P70</span><span class="kpi-value">10 semaines</span></div><div class="kpi"><span class="kpi-label">P90</span><span class="kpi-value">13 semaines</span></div></div>
      <div class="kpis"><div class="kpi"><span class="kpi-label">Risk Score</span><span class="kpi-value">0,25</span></div><div class="kpi"><span class="kpi-label">Fiabilité</span><span class="kpi-value">0,62</span></div></div>
      <section class="decision-diagnostic">
        <h2>Diagnostic décisionnel</h2>
        <div class="decision-dimension">Statut de décision : Arbitrage nécessaire.</div>
        <div class="decision-dimension">Justification métier : Les percentiles requis sont absents.</div>
        <div class="decision-dimension">Action conseillée : Rétablir les percentiles.</div>
      </section>
      <section><h2>Cycle Time (jours calendaires)</h2><div class="chart-wrap"><svg viewBox="0 0 960 360"></svg></div></section>
      <section><h2>Throughput hebdomadaire</h2><div class="chart-wrap"><svg viewBox="0 0 960 360"></svg></div></section>
      <section><h2>Distribution Monte Carlo</h2><div class="chart-wrap"><svg viewBox="0 0 960 360"></svg></div></section>
      <section><h2>Courbe de probabilité</h2><div class="chart-wrap"><svg viewBox="0 0 960 360"></svg></div></section>
    `;

    await downloadSimulationPdf(reportDoc, "Equipe A");
    const pdf = pdfMocks.instances.at(-1)!;
    const diagnosticBox = pdf.rect.mock.calls.find((call) => call[4] === "S")!;
    const cycleTitle = pdf.text.mock.calls.find((call) => call[0] === "Cycle Time (jours calendaires)")!;

    expect(cycleTitle[2] - (diagnosticBox[1] + diagnosticBox[3])).toBeGreaterThanOrEqual(7);
    expect(pdf.svg).toHaveBeenCalledTimes(4);
    const chartLayouts = pdf.svg.mock.calls.map((call) => call[1] as { width: number; height: number; y: number });
    expect(chartLayouts.every((layout) => layout.width === 95 && layout.height > 36)).toBe(true);
    expect(new Set(chartLayouts.map((layout) => layout.height)).size).toBe(1);
    const lastChart = chartLayouts.at(-1)!;
    expect(lastChart.y + lastChart.height).toBeGreaterThan(275);
    expect(lastChart.y + lastChart.height).toBeLessThanOrEqual(289);
    expect(pdf.addPage).not.toHaveBeenCalled();
  });

  it("renders a boxed scoped metadata block without diagnostic card", async () => {
    const reportDoc = document.implementation.createHTMLDocument("report");
    reportDoc.body.innerHTML = `
      <h1>Simulation Monte Carlo</h1>
      <div class="meta">
        <div class="meta-row">Periode: 2025-12-12 au 2026-03-11</div>
      </div>
    `;

    await downloadSimulationPdf(reportDoc, "Equipe A");
    const pdf = pdfMocks.instances.at(-1)!;

    expect(pdf.roundedRect).toHaveBeenCalledTimes(1);
    expect(pdf.text).toHaveBeenCalledWith("Periode: 2025-12-12 au 2026-03-11", 11, expect.any(Number));
  });

  it("falls back to rect when roundedRect is unavailable", async () => {
    const reportDoc = document.implementation.createHTMLDocument("report");
    reportDoc.body.innerHTML = `
      <h1>Simulation Monte Carlo</h1>
      <div class="meta">
        <div class="meta-row">Periode: 2025-12-12 au 2026-03-11</div>
      </div>
    `;

    pdfMocks.instances.length = 0;
    const { jsPDF } = await import("jspdf");
    (jsPDF as unknown as { mockImplementationOnce: (impl: () => unknown) => void }).mockImplementationOnce(function MockJsPdfCtor() {
      const instance = {
        internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } },
        setFont: vi.fn().mockReturnThis(),
        setFontSize: vi.fn().mockReturnThis(),
        setTextColor: vi.fn().mockReturnThis(),
        setDrawColor: vi.fn().mockReturnThis(),
        setLineWidth: vi.fn().mockReturnThis(),
        setFillColor: vi.fn().mockReturnThis(),
        rect: vi.fn().mockReturnThis(),
        splitTextToSize: vi.fn((text: string) => [text]),
        text: vi.fn().mockReturnThis(),
        addPage: vi.fn().mockReturnThis(),
        svg: vi.fn(async () => undefined),
        save: vi.fn(),
      };
      pdfMocks.instances.push(instance as never);
      return instance as never;
    });

    await downloadSimulationPdf(reportDoc, "Equipe A");
    const pdf = pdfMocks.instances.at(-1)!;

    expect(pdf.rect).toHaveBeenCalledWith(8, expect.any(Number), expect.any(Number), expect.any(Number), "S");
  });

  it("handles missing draw helpers and nullish scoped metadata text", async () => {
    const reportDoc = document.implementation.createHTMLDocument("report");
    reportDoc.body.innerHTML = `
      <h1>Simulation Monte Carlo</h1>
      <div class="meta"><div class="meta-row"></div></div>
      <aside class="diagnostic-card"><div class="meta-row"></div></aside>
    `;
    const scopedMetaRow = reportDoc.querySelector(".meta .meta-row");
    const diagnosticRow = reportDoc.querySelector(".diagnostic-card .meta-row");
    if (scopedMetaRow) {
      Object.defineProperty(scopedMetaRow, "textContent", { value: null, configurable: true });
    }
    if (diagnosticRow) {
      Object.defineProperty(diagnosticRow, "textContent", { value: null, configurable: true });
    }

    pdfMocks.instances.length = 0;
    const { jsPDF } = await import("jspdf");
    (jsPDF as unknown as { mockImplementationOnce: (impl: () => unknown) => void }).mockImplementationOnce(function MockJsPdfCtor() {
      const instance = {
        internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } },
        setFont: vi.fn().mockReturnThis(),
        setFontSize: vi.fn().mockReturnThis(),
        setTextColor: vi.fn().mockReturnThis(),
        setFillColor: vi.fn().mockReturnThis(),
        roundedRect: vi.fn().mockReturnThis(),
        rect: vi.fn().mockReturnThis(),
        splitTextToSize: vi.fn(() => "wrapped"),
        text: vi.fn().mockReturnThis(),
        addPage: vi.fn().mockReturnThis(),
        svg: vi.fn(async () => undefined),
        save: vi.fn(),
      };
      pdfMocks.instances.push(instance as never);
      return instance as never;
    });

    await downloadSimulationPdf(reportDoc, "Equipe A");
    const pdf = pdfMocks.instances.at(-1)!;

    expect(pdf.text).toHaveBeenCalledWith("", 11, expect.any(Number));
    expect(pdf.text).toHaveBeenCalledWith(["wrapped"], expect.any(Number), expect.any(Number));
  });

  it("falls back to default chart dimensions when svg viewBox is missing", async () => {
    const reportDoc = document.implementation.createHTMLDocument("report");
    reportDoc.body.innerHTML = `
      <h1>Simulation Monte Carlo</h1>
      <div class="chart-wrap"><svg></svg></div>
    `;

    await downloadSimulationPdf(reportDoc, "Equipe A");
    const pdf = pdfMocks.instances.at(-1)!;

    expect(pdf.svg).toHaveBeenCalledTimes(1);
  });

  it("adds a page during chart rendering when several charts overflow", async () => {
    const reportDoc = document.implementation.createHTMLDocument("report");
    reportDoc.body.innerHTML = `
      <h1>Simulation Monte Carlo</h1>
      ${Array.from({ length: 12 }, () => '<div class="chart-wrap"><svg viewBox="0 0 960 1200"></svg></div>').join("")}
    `;

    await downloadSimulationPdf(reportDoc, "Equipe A");
    const pdf = pdfMocks.instances.at(-1)!;
    expect(pdf.svg).toHaveBeenCalledTimes(12);
    expect(pdf.save).toHaveBeenCalled();
  });

  it("handles more svg sections than known titles", async () => {
    const reportDoc = document.implementation.createHTMLDocument("report");
    reportDoc.body.innerHTML = `
      <h1>Simulation Monte Carlo</h1>
      ${Array.from({ length: 5 }, () => '<div class="chart-wrap"><svg viewBox="0 0 960 360"></svg></div>').join("")}
    `;

    await downloadSimulationPdf(reportDoc, "Equipe A");
    const pdf = pdfMocks.instances.at(-1)!;
    expect(pdf.text).toHaveBeenCalledWith("", 8, expect.any(Number));
  });

  it("downloads portfolio pdf with synthesis table, hypotheses and risk styles", async () => {
    const reportDoc = document.implementation.createHTMLDocument("portfolio");
    reportDoc.body.innerHTML = `
      <section class="page">
        <h1>Synthese - Simulation Portefeuille</h1>
        <div class="meta-row">Periode: 2026-01-01 au 2026-03-01</div>
        <table class="summary-table">
          <thead>
            <tr>
              <th>Scenario</th>
              <th>P50</th>
              <th>P70</th>
              <th>P90</th>
              <th>Risk Score</th>
              <th>Fiabilite</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Optimiste</td><td>200</td><td>180</td><td>160</td><td>0,12 (fiable)</td><td>0,13 (fiable)</td></tr>
            <tr><td>Arrime</td><td>180</td><td>170</td><td>150</td><td>0,24 (incertain)</td><td>0,24 (incertain)</td></tr>
            <tr><td>Friction</td><td>120</td><td>110</td><td>100</td><td>0,70 (fragile)</td><td>0,70 (fragile)</td></tr>
            <tr><td>Historique corrÃ©lÃ©</td><td>90</td><td>80</td><td>70</td><td>0,95 (non fiable)</td><td>0,95 (non fiable)</td></tr>
          </tbody>
        </table>
        <div class="hypothesis"><strong>Optimiste :</strong> Somme des dÃƒÂ©bits de toutes les ÃƒÂ©quipes.</div>
        <div class="hypothesis"><strong>ArrimÃƒÂ© :</strong> 90% de la capacitÃƒÂ© combinÃƒÂ©e.</div>
        <div class="hypothesis">Friction (81%) : HypothÃƒÂ¨se de friction portefeuille.</div>
        <div class="hypothesis">Historique corrÃ©lÃ© : Somme des throughputs observÃ©s sur les mÃªmes semaines pour toutes les Ã©quipes.</div>
        <div class="hypothesis"><strong>Risk Score :</strong> Plus le score est faible, plus la prÃƒÂ©vision est stable.</div>
        <div class="hypothesis"><strong>FiabilitÃƒÂ© de l'historique :</strong> Historique stable.</div>
        <p class="hypothesis reading-rule"><strong>RÃƒÂ¨gle de lecture :</strong><br />Commencer par la fiabilitÃƒÂ©.</p>
        <div class="kpi"><span class="kpi-label">P50</span><span class="kpi-value">176 items</span></div>
        <h2>Courbes de probabilitÃƒÂ©s comparÃƒÂ©es</h2>
        <div class="chart-wrap"><svg viewBox="0 0 960 360"></svg></div>
      </section>
      <section class="page">
        <h1>Simulation Portefeuille - Team A</h1>
        <div class="summary-grid">
          <div class="meta">
            <div class="meta-row">Periode: 2026-01-01 au 2026-03-01</div>
            <div class="meta-row">Mode: Semaines vers items - cible: 3 semaines</div>
            <div class="meta-row">Tickets: Product Backlog Item</div>
            <div class="meta-row">Etats: Done, Removed</div>
            <div class="meta-row">Echantillon: Semaines 0 exclues</div>
            <div class="meta-row">Simulations: 150000</div>
          </div>
          <aside class="diagnostic-card">
            <h2 class="diagnostic-title">Diagnostic</h2>
            <div class="meta-row">Lecture: Throughput en forte hausse sur les dernieres semaines.</div>
            <div class="meta-row">CV: 0,45</div>
            <div class="meta-row">IQR ratio: 0,75</div>
            <div class="meta-row">Pente normalisee: 0,11</div>
            <div class="meta-row">Semaines utilisees: 8</div>
          </aside>
        </div>
        <div class="kpis">
          <div class="kpi"><span class="kpi-label">P50</span><span class="kpi-value">60 items</span></div>
          <div class="kpi"><span class="kpi-label">P70</span><span class="kpi-value">55 items</span></div>
          <div class="kpi"><span class="kpi-label">P90</span><span class="kpi-value">50 items</span></div>
        </div>
        <div class="kpis">
          <div class="kpi"><span class="kpi-label">Risk Score</span><span class="kpi-value">0,15 (fiable)</span></div>
          <div class="kpi"><span class="kpi-label">Fiabilite</span><span class="kpi-value">0,45 (incertain)</span></div>
        </div>
        <h2>Throughput hebdomadaire</h2>
        <div class="chart-wrap"><svg viewBox="0 0 960 360"></svg></div>
      </section>
    `;

    await downloadPortfolioPdf(reportDoc, "Projet A");
    const pdf = pdfMocks.instances.at(-1)!;

    expect(pdf.setDrawColor).toHaveBeenCalled();
    expect(pdf.setDrawColor).toHaveBeenCalledWith(0, 0, 0);
    expect(pdf.setLineWidth).toHaveBeenCalledWith(0.26);
    expect(pdf.setFillColor).toHaveBeenCalled();
    expect(pdf.setTextColor).toHaveBeenCalledWith(0, 0, 0);
    expect(pdf.setTextColor).toHaveBeenCalledWith(30, 58, 138);
    expect(pdf.rect).toHaveBeenCalled();
    expect(pdf.splitTextToSize).toHaveBeenCalled();
    expect(
      pdf.text.mock.calls.some(
        (call) => typeof call[0] === "string" && call[0].includes("Courbes de probabilit") && call[0].includes("compar"),
      ),
    ).toBe(true);
    expect(pdf.text.mock.calls.some((call) => Array.isArray(call[0]) && call[0][0]?.includes("Optimiste :") && call[1] === 8)).toBe(true);
    expect(pdf.text.mock.calls.some((call) => Array.isArray(call[0]) && call[0][0]?.includes("Arrim") && call[0][0]?.includes(":") && call[1] === 8)).toBe(true);
    expect(pdf.text.mock.calls.some((call) => Array.isArray(call[0]) && call[0][0]?.includes("Friction (81%) :") && call[1] === 8)).toBe(true);
    expect(pdf.text.mock.calls.some((call) => Array.isArray(call[0]) && call[0][0]?.includes("Historique corr") && call[1] === 8)).toBe(true);
    expect(pdf.text.mock.calls.some((call) => Array.isArray(call[0]) && call[0][0]?.includes("Risk Score :") && call[1] === 8)).toBe(true);
    expect(
      pdf.text.mock.calls.some(
        (call) => Array.isArray(call[0]) && call[0][0]?.includes("l'historique :") && call[0][0]?.includes("Fiabilit") && call[1] === 8,
      ),
    ).toBe(true);
    expect(pdf.text.mock.calls.some((call) => Array.isArray(call[0]) && call[0][0]?.includes("lecture :") && call[1] === 8)).toBe(true);
    expect(pdf.text).toHaveBeenCalledWith(expect.arrayContaining(["Fiabilite"]), expect.any(Number), expect.any(Number), { align: "center" });
    expect(pdf.text).toHaveBeenCalledWith("Diagnostic", expect.any(Number), expect.any(Number));
    expect(pdf.text).toHaveBeenCalledWith(expect.arrayContaining(["Lecture: Throughput en forte hausse sur les dernieres semaines."]), expect.any(Number), expect.any(Number));
    expect(pdf.text).toHaveBeenCalledWith(expect.arrayContaining(["CV: 0,45"]), expect.any(Number), expect.any(Number));
    expect(pdf.text).toHaveBeenCalledWith("P50: 60 items", expect.any(Number), expect.any(Number), { align: "center" });
    expect(pdf.text).toHaveBeenCalledWith("Risk Score: 0,15 (fiable)", expect.any(Number), expect.any(Number), { align: "center" });
    expect(pdf.text).toHaveBeenCalledWith("Fiabilite: 0,45 (incertain)", expect.any(Number), expect.any(Number), { align: "center" });
    const textCalls = pdf.text.mock.calls.map((call) => call[0]);
    const summaryIndex = textCalls.findIndex((value) => typeof value === "string" && value.includes("Synth"));
    const comparedCurvesIndex = textCalls.findIndex(
      (value) => typeof value === "string" && value.includes("Courbes de probabilit") && value.includes("compar"),
    );
    const assumptionsIndex = textCalls.findIndex((value) => typeof value === "string" && value.startsWith("Hypoth"));
    expect(summaryIndex).toBeGreaterThanOrEqual(0);
    expect(comparedCurvesIndex).toBeGreaterThan(summaryIndex);
    expect(assumptionsIndex).toBeGreaterThan(comparedCurvesIndex);
    expect(pdf.svg).toHaveBeenCalledTimes(2);
    expect(pdf.addPage).toHaveBeenCalledTimes(1);
    const firstChartCall = pdf.svg.mock.calls[0];
    expect(firstChartCall?.[1]).toMatchObject({ width: expect.any(Number), height: expect.any(Number) });
    expect((firstChartCall?.[1] as { width: number }).width).toBeGreaterThan(150);
    expect((firstChartCall?.[1] as { height: number }).height).toBeGreaterThan(40);
    expect(pdf.save).toHaveBeenCalledWith(expect.stringMatching(/^simulation-Portefeuille-Projet-A-\d{2}_\d{2}_\d{4}\.pdf$/));
  });

  it("renders portfolio decision status and action in an eight-column synthesis", async () => {
    const reportDoc = document.implementation.createHTMLDocument("portfolio");
    reportDoc.body.innerHTML = `
      <section class="page">
        <h1>Synthèse - Simulation Portefeuille</h1>
        <table class="summary-table">
          <thead><tr><th>Scénario</th><th>P50</th><th>P70</th><th>P90</th><th>Risk Score</th><th>Fiabilité</th><th>Statut</th><th>Action</th></tr></thead>
          <tbody><tr><td>Arrimé</td><td>20</td><td>18</td><td>15</td><td>0,25</td><td>fiable</td><td>Arbitrage nécessaire</td><td>Valider les hypothèses.</td></tr></tbody>
        </table>
      </section>
    `;

    await downloadPortfolioPdf(reportDoc, "Projet A");
    const pdf = pdfMocks.instances.at(-1)!;

    expect(pdf.splitTextToSize).toHaveBeenCalledWith("Arbitrage nécessaire", expect.any(Number));
    expect(pdf.splitTextToSize).toHaveBeenCalledWith("Valider les hypothèses.", expect.any(Number));
    expect(pdf.text.mock.calls.some((call) => Array.isArray(call[0]) && call[0][0] === "Arbitrage nécessaire")).toBe(true);
    expect(pdf.text.mock.calls.some((call) => Array.isArray(call[0]) && call[0][0] === "Valider les hypothèses.")).toBe(true);
  });

  it("keeps the correlated-history row within its dynamic table height and renders accented portfolio labels", async () => {
    pdfMocks.splitTextToSizeImplementation = (text) =>
      text.includes("Historique corrélé") || text.includes("Arbitrage nécessaire") || text.includes("Préparer")
        ? ["ligne 1", "ligne 2", "ligne 3", "ligne 4"]
        : [text];
    const reportDoc = document.implementation.createHTMLDocument("portfolio");
    reportDoc.body.innerHTML = `
      <section class="page">
        <h1>Synthèse - Simulation Portefeuille</h1>
        <table class="summary-table">
          <thead><tr><th>Scénario</th><th>P50</th><th>P70</th><th>P90</th><th>Risk Score</th><th>Fiabilité</th><th>Statut</th><th>Action</th></tr></thead>
          <tbody><tr><td>Historique corrélé</td><td>20</td><td>18</td><td>15</td><td>0,25</td><td>fiable</td><td>Arbitrage nécessaire</td><td>Préparer un arbitrage avec les parties prenantes.</td></tr></tbody>
        </table>
      </section>
    `;

    await downloadPortfolioPdf(reportDoc, "Projet A");
    const pdf = pdfMocks.instances.at(-1)!;
    const bodyCellRects = pdf.rect.mock.calls.slice(8, 16);

    expect(pdf.text).toHaveBeenCalledWith("Synthèse décisionnelle", expect.any(Number), expect.any(Number));
    expect(pdf.text.mock.calls.flatMap((call) => (Array.isArray(call[0]) ? call[0] : [call[0]])).join(" ")).not.toMatch(/[ÃÂ�]/);
    expect(bodyCellRects).toHaveLength(8);
    expect(bodyCellRects.every((call) => call[3] === 19)).toBe(true);
    expect(pdf.addPage).not.toHaveBeenCalled();
  });

  it("keeps the detailed decision diagnostic in normal flow before the scenario throughput chart", async () => {
    pdfMocks.splitTextToSizeImplementation = (text) =>
      text.includes("Justification") || text.includes("Action") ? ["ligne 1", "ligne 2", "ligne 3"] : [text];
    const reportDoc = document.implementation.createHTMLDocument("portfolio");
    reportDoc.body.innerHTML = `
      <section class="page">
        <h1>Scénario - Arrimé</h1>
        <section class="section decision-diagnostic">
          <h2>Diagnostic décisionnel</h2>
          <div class="decision-dimension">Décision — statut : Arbitrage nécessaire. Justification : informations à confirmer. Action conseillée : préparer un arbitrage.</div>
          <div class="decision-dimension">Qualité des données — statut : À surveiller. Justification : couverture partielle. Action conseillée : compléter les données.</div>
        </section>
        <section class="section"><h2>Débit simulé du scénario</h2><div class="chart-wrap"><svg viewBox="0 0 960 360"></svg></div></section>
      </section>
    `;

    await downloadPortfolioPdf(reportDoc, "Projet A");
    const pdf = pdfMocks.instances.at(-1)!;
    const diagnosticTitleIndex = pdf.text.mock.calls.findIndex((call) => call[0] === "Diagnostic décisionnel");
    const diagnosticTitleCall = pdf.text.mock.calls[diagnosticTitleIndex];
    const chartTitleIndex = pdf.text.mock.calls.findIndex((call) => call[0] === "Débit simulé du scénario");
    const chartTitleCall = pdf.text.mock.calls[chartTitleIndex];
    const diagnosticFrame = pdf.rect.mock.calls.find((call) => {
      const [x, y, width, height, style] = call as [number, number, number, number, string];
      const titleX = diagnosticTitleCall?.[1] as number | undefined;
      const titleY = diagnosticTitleCall?.[2] as number | undefined;
      return style === "S" && titleX != null && titleY != null && titleX >= x && titleX <= x + width && titleY >= y && titleY <= y + height;
    });
    const diagnosticContentIndexes = pdf.text.mock.calls
      .map((call, index) => ({ call, index }))
      .filter(({ call, index }) => {
        const [, y] = call.slice(1, 3) as [number, number];
        return index > diagnosticTitleIndex && Array.isArray(call[0]) && diagnosticFrame != null && y >= diagnosticFrame[1] && y <= diagnosticFrame[1] + diagnosticFrame[3];
      })
      .map(({ index }) => index);

    expect(diagnosticTitleIndex).toBeGreaterThanOrEqual(0);
    expect(diagnosticFrame).toBeDefined();
    expect(diagnosticContentIndexes.length).toBeGreaterThan(0);
    expect(chartTitleIndex).toBeGreaterThan(diagnosticContentIndexes.at(-1)!);
    expect(chartTitleCall?.[2]).toBeGreaterThanOrEqual(diagnosticFrame![1] + diagnosticFrame![3] + 5);
    expect(pdf.svg).toHaveBeenCalledTimes(1);
    expect(pdf.addPage).not.toHaveBeenCalled();
  });

  it("keeps the portfolio synthesis hypotheses on its first PDF page after the comparison chart", async () => {
    pdfMocks.splitTextToSizeImplementation = (text, width) => {
      const maxChars = Math.max(24, Math.floor(width / 0.55));
      return Array.from({ length: Math.max(1, Math.ceil(text.length / maxChars)) }, (_, index) =>
        text.slice(index * maxChars, (index + 1) * maxChars),
      );
    };
    const reportDoc = document.implementation.createHTMLDocument("portfolio");
    reportDoc.body.innerHTML = `
      <section class="page">
        <h1>Synthèse - Simulation Portefeuille</h1>
        <table class="summary-table">
          <thead><tr><th>Scénario</th><th>P50</th><th>P70</th><th>P90</th><th>Risk Score</th><th>Fiabilité</th><th>Statut</th><th>Action</th></tr></thead>
          <tbody>
            <tr><td>Optimiste</td><td>20</td><td>18</td><td>15</td><td>0,12</td><td>fiable</td><td>Décision possible</td><td>Confirmer les dépendances.</td></tr>
            <tr><td>Arrimé</td><td>18</td><td>16</td><td>14</td><td>0,25</td><td>fiable</td><td>Arbitrage nécessaire</td><td>Valider les hypothèses.</td></tr>
            <tr><td>Friction</td><td>15</td><td>13</td><td>11</td><td>0,45</td><td>incertain</td><td>Décision possible avec prudence</td><td>Suivre la capacité.</td></tr>
            <tr><td>Historique corrélé</td><td>13</td><td>11</td><td>9</td><td>0,60</td><td>fragile</td><td>Décision non recommandée</td><td>Réexaminer les données.</td></tr>
          </tbody>
        </table>
        <section class="section section--summary-chart"><h2>Courbes de probabilités comparées</h2><div class="chart-wrap"><svg viewBox="0 0 960 360"></svg></div></section>
        <section class="section section--hypotheses">
          <h2>Hypothèses</h2>
          <div class="hypothesis-grid">
            <div class="hypothesis-column">
              <p class="hypothesis"><strong>Optimiste :</strong> Hypothèse optimiste pour le portefeuille.</p><p class="hypothesis"><strong>Arrimé :</strong> Hypothèse d'arrimage des équipes.</p><p class="hypothesis"><strong>Friction :</strong> Hypothèse de friction entre équipes.</p><p class="hypothesis"><strong>Historique corrélé :</strong> Hypothèse fondée sur les semaines comparables.</p>
            </div>
            <div class="hypothesis-column">
              <p class="hypothesis"><strong>Risk Score :</strong> Indicateur de dispersion de la prévision.</p><p class="hypothesis"><strong>Fiabilité de l'historique :</strong> Indicateur de qualité des données utilisées.</p><p class="hypothesis reading-rule"><strong>Règle de lecture :</strong> Lire la fiabilité avant les percentiles et les recommandations.</p>
            </div>
          </div>
        </section>
      </section>
      <section class="page page-break"><h1>Scénario - Optimiste</h1></section>
    `;

    await downloadPortfolioPdf(reportDoc, "Projet A");
    const pdf = pdfMocks.instances.at(-1)!;
    const chartCall = pdf.svg.mock.calls[0]?.[1] as { y: number; width: number; height: number };
    const hypothesesTitle = pdf.text.mock.calls.find((call) => call[0] === "Hypothèses");
    const readingRule = pdf.text.mock.calls.find((call) => Array.isArray(call[0]) && call[0][0] === "Règle de lecture :");

    expect(chartCall).toBeDefined();
    expect(chartCall.width).toBeGreaterThanOrEqual(170);
    expect(chartCall.height).toBeGreaterThanOrEqual(55);
    expect(chartCall.height).toBeLessThanOrEqual(65);
    expect(hypothesesTitle?.[2]).toBeGreaterThan(chartCall.y + chartCall.height);
    expect(readingRule?.[2]).toBeLessThanOrEqual(289);
    expect(pdf.addPage).toHaveBeenCalledTimes(1);
  });

  it("renders every comparison block on the PDF page after its title", async () => {
    const reportDoc = document.implementation.createHTMLDocument("portfolio");
    reportDoc.body.innerHTML = `
      <section class="page comparison-page">
        <div class="comparison-intro"><h1>Comparaison des hypothèses</h1><section class="comparison-overview"><h2>Conclusion comparative</h2><p>Preuves insuffisantes pour privilégier une hypothèse.</p><div class="comparison-confidence"><strong>Niveau de confiance comparatif</strong><br />Confiance insuffisante.</div><div class="comparison-label-value"><strong>Recommandation issue des preuves</strong><br />Aucune recommandation de scénario issue des preuves disponibles.</div><div class="comparison-label-value"><strong>Préconisation</strong><br />Ne pas privilégier automatiquement un scénario.</div><div class="comparison-label-value"><strong>Référence de pilotage</strong><br />Non définie</div></section></div>
        <section><h2>Lecture comparative</h2><div class="comparison-hypotheses">
          <article class="comparison-hypothesis"><h3>Indépendant</h3><p class="comparison-evidence-type">Hypothèse non étayée par les données</p><p>Explication indépendante.</p><h4>Limites</h4><ul><li>Limite indépendante.</li></ul></article>
          <article class="comparison-hypothesis"><h3>Arrimé</h3><p class="comparison-evidence-type">Paramètre saisi par l’utilisateur</p><p>Explication arrimée.</p><h4>Limites</h4><ul><li>Limite arrimée.</li></ul></article>
          <article class="comparison-hypothesis"><h3>Friction</h3><p class="comparison-evidence-type">Calculée à partir d’un paramètre</p><p>Explication friction.</p><h4>Limites</h4><ul><li>Limite friction.</li></ul></article>
          <article class="comparison-hypothesis"><h3>Historique corrélé</h3><p class="comparison-evidence-type">Fondée sur des observations historiques</p><p>Explication corrélée.</p><h4>Limites</h4><ul><li>Limite corrélée.</li></ul></article>
        </div></section>
        <section><h2>Faits à vérifier</h2><ul class="comparison-risks"><li>Risque équipe Atlas à vérifier.</li></ul></section>
        <section class="comparison-readings"><h2>Trois lectures distinctes</h2><div><strong>Qualité des données historiques</strong><br />Historique fragile : informations limitées.</div><div><strong>Stabilité des résultats simulés</strong><br />La régularité simulée ne valide pas une hypothèse.</div><div><strong>Crédibilité des hypothèses portefeuille</strong><br />Elle dépend du type de preuve.</div></section>
      </section>
      <section class="page"><h1>Scénario - Optimiste</h1></section>
    `;

    await downloadPortfolioPdf(reportDoc, "Projet A");
    const pdf = pdfMocks.instances.at(-1)!;
    const nextPageOrder = pdf.addPage.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY;
    const firstPageText = pdf.text.mock.calls
      .filter((_call, index) => (pdf.text.mock.invocationCallOrder[index] ?? 0) < nextPageOrder)
      .flatMap((call) => Array.isArray(call[0]) ? call[0] : [call[0]])
      .join(" ");

    expect(firstPageText).toContain("Comparaison des hypothèses");
    expect(firstPageText).toContain("Preuves insuffisantes pour privilégier une hypothèse.");
    expect(firstPageText).toContain("Aucune recommandation de scénario issue des preuves disponibles.");
    expect(firstPageText).toContain("Ne pas privilégier automatiquement un scénario.");
    expect(firstPageText).toContain("Référence de pilotage");
    expect(firstPageText).toContain("Non définie");
    expect(firstPageText).toContain("Fondée sur des observations historiques");
    expect(firstPageText).toContain("Calculée à partir d’un paramètre");
    expect(firstPageText).toContain("Paramètre saisi par l’utilisateur");
    expect(firstPageText).toContain("Hypothèse non étayée par les données");
    expect(firstPageText).toContain("Limite corrélée.");
    expect(firstPageText).toContain("Risque équipe Atlas à vérifier.");
    expect(firstPageText).toContain("Qualité des données historiques");
    expect(firstPageText).toContain("Stabilité des résultats simulés");
    expect(firstPageText).toContain("Crédibilité des hypothèses portefeuille");
    expect(firstPageText).not.toMatch(/^Comparaison des hypothèses$/);
    const comparisonRects = pdf.rect.mock.calls
      .map((call) => ({ x: Number(call[0]), y: Number(call[1]), width: Number(call[2]), height: Number(call[3]) }))
      .filter((rect) => Number.isFinite(rect.x) && Number.isFinite(rect.y) && Number.isFinite(rect.height));
    expect(comparisonRects).toHaveLength(4);
    expect(comparisonRects[0]?.y).toBe(comparisonRects[1]?.y);
    expect(comparisonRects[0]?.x).toBeLessThan(comparisonRects[1]?.x ?? 0);
    expect(comparisonRects[0]?.width).toBe(comparisonRects[1]?.width);
    expect(comparisonRects[2]?.y).toBe(comparisonRects[3]?.y);
    expect(comparisonRects[2]?.x).toBeLessThan(comparisonRects[3]?.x ?? 0);
    expect(comparisonRects[2]?.y).toBeGreaterThanOrEqual(
      (comparisonRects[0]?.y ?? 0) + Math.max(comparisonRects[0]?.height ?? 0, comparisonRects[1]?.height ?? 0),
    );
    const findTextY = (text: string): number => {
      const call = pdf.text.mock.calls.find(([content]) => (Array.isArray(content) ? content.join(" ") : String(content)).includes(text));
      expect(call).toBeDefined();
      return Number(call?.[2]);
    };
    const lastRowBottom = Math.max(
      ...comparisonRects.slice(2).map((rect) => rect.y + rect.height),
    );
    const factsY = findTextY("Faits à vérifier");
    expect(factsY).toBeGreaterThan(lastRowBottom);
    [
      ["Niveau de confiance comparatif", "Confiance insuffisante."],
      ["Recommandation issue des preuves", "Aucune recommandation de scénario issue des preuves disponibles."],
      ["Préconisation", "Ne pas privilégier automatiquement un scénario."],
      ["Référence de pilotage", "Non définie"],
      ["Qualité des données historiques", "Historique fragile : informations limitées."],
      ["Stabilité des résultats simulés", "La régularité simulée ne valide pas une hypothèse."],
      ["Crédibilité des hypothèses portefeuille", "Elle dépend du type de preuve."],
    ].forEach(([label, description]) => {
      expect(findTextY(description)).toBeGreaterThan(findTextY(label));
    });
    expect(firstPageText).not.toContain("Niveau de confiance comparatifConfiance insuffisante.");
    expect(firstPageText).not.toContain("Qualité des données historiquesHistorique fragile");
    expect(pdf.text.mock.calls
      .filter((_call, index) => (pdf.text.mock.invocationCallOrder[index] ?? 0) < nextPageOrder)
      .every((call) => Number(call[2]) >= 8 && Number(call[2]) <= 289)).toBe(true);
    expect(firstPageText).not.toContain("Comparaison des hypothèses — suite");
    expect(pdf.addPage).toHaveBeenCalledTimes(1);
  });

  it("preserves explicit separators between team diagnostic fields in the PDF", async () => {
    pdfMocks.splitTextToSizeImplementation = (text) => text.split("\n");
    const reportDoc = document.implementation.createHTMLDocument("portfolio");
    reportDoc.body.innerHTML = `
      <section class="page">
        <h1>Simulation Portefeuille - Team A</h1>
        <section class="section decision-diagnostic">
          <h2>Diagnostic décisionnel</h2>
          <div class="decision-dimension"><b>Qualité des données — statut :</b> À surveiller<br /><b>Justification :</b> Données à consolider.<ul><li>Période récente : 19 semaines exploitables</li></ul><br /><b>Action conseillée :</b> Calibrer les paramètres.</div>
        </section>
      </section>
    `;

    await downloadPortfolioPdf(reportDoc, "Projet A");
    const pdf = pdfMocks.instances.at(-1)!;
    const diagnosticLines = pdf.text.mock.calls
      .filter((call) => Array.isArray(call[0]))
      .flatMap((call) => call[0] as string[]);

    expect(diagnosticLines).toEqual(expect.arrayContaining([
      "Qualité des données — statut : À surveiller",
      "Justification : Données à consolider.",
      "• Période récente : 19 semaines exploitables",
      "Action conseillée : Calibrer les paramètres.",
    ]));
    expect(diagnosticLines.join(" ")).not.toMatch(/donnéesJustification|19Action conseillée|modérée\.Action/i);
  });

  it("uses the same evidence and pilot-reference formulations in printable HTML and jsPDF", async () => {
    const diagnostic: PortfolioComparisonDiagnostic = {
      historicalData: { quality: "fragile", observedFacts: [], teamFindings: [] },
      simulationStability: [],
      hypothesisCredibility: [
        { hypothesis: "independent", evidenceType: "unsupported", evidence: "Indépendance non observée.", limitations: ["Limite indépendante."] },
        { hypothesis: "aligned", evidenceType: "user_input", evidence: "Paramètre utilisateur.", limitations: ["Limite arrimée."] },
        { hypothesis: "friction", evidenceType: "calculated", evidence: "Paramètre calculé.", limitations: ["Limite friction."] },
        { hypothesis: "correlated", evidenceType: "observed", evidence: "Semaines communes observées.", limitations: ["Limite historique."] },
      ],
      significantRisks: [],
      comparisonConfidence: { level: "insufficient", statement: "Confiance insuffisante." },
      preferredScenario: null,
      conclusion: "Preuves insuffisantes.",
    };
    const presentation = presentPortfolioComparisonDiagnostic(diagnostic, "correlated");
    const html = buildPortfolioPrintReportHtml({
      selectedProject: "Projet A",
      startDate: "2026-01-01",
      endDate: "2026-03-01",
      alignmentRate: 80,
      includedTeams: [],
      sections: [],
      scenarios: [],
      portfolioComparisonDiagnostic: diagnostic,
      pilotReference: "correlated",
    });
    const reportDoc = new DOMParser().parseFromString(html, "text/html");

    await downloadPortfolioPdf(reportDoc, "Projet A");
    const pdf = pdfMocks.instances.at(-1)!;
    const printableText = reportDoc.querySelector<HTMLElement>(".comparison-page")?.textContent ?? "";
    const pdfText = pdf.text.mock.calls.flatMap((call) => Array.isArray(call[0]) ? call[0] : [call[0]]).join(" ");

    [
      presentation.evidenceRecommendation,
      presentation.preconization,
      presentation.pilotReferenceLabel,
      presentation.pilotReferenceGovernanceNote,
    ].filter((formulation): formulation is string => formulation !== null).forEach((formulation) => {
      expect(printableText).toContain(formulation);
      expect(pdfText).toContain(formulation);
    });
    expect(diagnostic.preferredScenario).toBeNull();
    expect(pdfText).not.toContain("Scénario recommandé par les preuves : Historique corrélé.");
  });

  it("renders the documented no-risk fallback and demo footer on a comparison page without hypotheses", async () => {
    const reportDoc = document.implementation.createHTMLDocument("portfolio");
    reportDoc.body.innerHTML = `
      <section class="page comparison-page">
        <h1>Comparaison des hypothèses</h1>
        <section class="section"><h2>Faits à vérifier</h2><p>Aucun risque significatif d’équipe n’est remonté par le diagnostic.</p></section>
      </section>
    `;

    await downloadPortfolioPdf(reportDoc, "Projet A", true);
    const pdf = pdfMocks.instances.at(-1)!;
    const footer = pdf.text.mock.calls.find((call) => call[0] === "Données de démonstration — Monte Carlo Azure");

    const text = pdf.text.mock.calls.flatMap((call) => Array.isArray(call[0]) ? call[0] : [call[0]]).join(" ");
    expect(text).toContain("Faits à vérifier");
    expect(text).toContain("Aucun risque significatif d’équipe n’est remonté par le diagnostic.");
    expect(footer).toMatchObject(["Données de démonstration — Monte Carlo Azure", 8, 292]);
    expect(pdf.setFont).toHaveBeenCalledWith("helvetica", "italic");
    expect(pdf.addPage).not.toHaveBeenCalled();
  });

  it("uses the comparison fallbacks for an ungrouped scenario and ignores an empty risk", async () => {
    const reportDoc = document.implementation.createHTMLDocument("portfolio");
    reportDoc.body.innerHTML = `
      <section class="page comparison-page">
        <h1>Comparaison des hypothèses</h1>
        <article class="comparison-hypothesis"><h3>Indépendant</h3><p class="comparison-evidence-type">Hypothèse non étayée par les données</p><p>Explication.</p><h4>Limites</h4><ul><li>Limite.</li></ul></article>
        <section class="section"><h2>Faits à vérifier</h2><ul class="comparison-risks"><li> </li><li>Risque d’équipe à vérifier.</li></ul></section>
      </section>
    `;

    await downloadPortfolioPdf(reportDoc, "Projet A");
    const pdf = pdfMocks.instances.at(-1)!;
    const text = pdf.text.mock.calls.flatMap((call) => Array.isArray(call[0]) ? call[0] : [call[0]]).join(" ");

    expect(text).toContain("Lecture comparative");
    expect(text).toContain("Risque d’équipe à vérifier.");
    expect(text).not.toContain("•  ");
    expect(pdf.rect).toHaveBeenCalledTimes(1);
    expect(pdf.addPage).not.toHaveBeenCalled();
  });

  it("keeps the facts heading when neither a risk nor a documented no-risk fallback is available", async () => {
    const reportDoc = document.implementation.createHTMLDocument("portfolio");
    reportDoc.body.innerHTML = `
      <section class="page comparison-page">
        <h1>Comparaison des hypothèses</h1>
        <section class="section"><h2>Faits à vérifier</h2></section>
      </section>
    `;

    await downloadPortfolioPdf(reportDoc, "Projet A");
    const pdf = pdfMocks.instances.at(-1)!;

    const text = pdf.text.mock.calls.flatMap((call) => Array.isArray(call[0]) ? call[0] : [call[0]]).join(" ");
    expect(text).toContain("Faits à vérifier");
    expect(text).not.toContain("Aucun risque significatif d’équipe");
    expect(pdf.addPage).not.toHaveBeenCalled();
  });

  it("keeps exporting an incomplete comparison report through its documented label fallbacks", async () => {
    const reportDoc = document.implementation.createHTMLDocument("portfolio");
    reportDoc.body.innerHTML = `
      <section class="page comparison-page">
        <section class="comparison-overview"><p>Conclusion sans titre explicite.</p><div class="comparison-confidence">Confiance sans libellé.</div></section>
        <article class="comparison-hypothesis"></article>
        <section class="comparison-readings"><div>Lecture sans libellé.</div></section>
      </section>
    `;

    await downloadPortfolioPdf(reportDoc, "Projet A");
    const pdf = pdfMocks.instances.at(-1)!;
    const text = pdf.text.mock.calls.flatMap((call) => Array.isArray(call[0]) ? call[0] : [call[0]]).join(" ");

    expect(text).toContain("Comparaison des hypothèses");
    expect(text).toContain("Conclusion comparative");
    expect(text).toContain("Lecture comparative");
    expect(text).toContain("Trois lectures distinctes");
    expect(text).toContain("Confiance sans libellé.");
    expect(text).toContain("Lecture sans libellé.");
    expect(pdf.addPage).not.toHaveBeenCalled();
  });

  it("wraps a scenario limitation across lines without duplicating its bullet", async () => {
    pdfMocks.splitTextToSizeImplementation = (text) => text === "Limite longue." ? ["Limite", "longue."] : [text];
    const reportDoc = document.implementation.createHTMLDocument("portfolio");
    reportDoc.body.innerHTML = `
      <section class="page comparison-page">
        <h1>Comparaison des hypothèses</h1>
        <section><h2>Lecture comparative</h2><div class="comparison-hypotheses"><article class="comparison-hypothesis"><h3>Indépendant</h3><p class="comparison-evidence-type">Hypothèse non étayée par les données</p><p>Explication.</p><h4>Limites</h4><ul><li>Limite longue.</li></ul></article></div></section>
      </section>
    `;

    await downloadPortfolioPdf(reportDoc, "Projet A");
    const pdf = pdfMocks.instances.at(-1)!;
    const bullet = pdf.text.mock.calls.find((call) => Array.isArray(call[0]) && call[0][0] === "• Limite");
    const continuation = pdf.text.mock.calls.find((call) => Array.isArray(call[0]) && call[0][1] === "longue.");

    expect(bullet).toBeDefined();
    expect(continuation).toBeDefined();
    expect(continuation?.[2]).toBe(bullet?.[2]);
    expect(pdf.addPage).not.toHaveBeenCalled();
  });

  it("moves long comparison content to controlled continuation pages without overlapping vertical positions", async () => {
    pdfMocks.splitTextToSizeImplementation = (text) => {
      const width = 60;
      return Array.from({ length: Math.max(1, Math.ceil(text.length / width)) }, (_, index) => text.slice(index * width, (index + 1) * width));
    };
    const longText = "Texte comparatif long à rendre sans chevauchement. ".repeat(55);
    const reportDoc = document.implementation.createHTMLDocument("portfolio");
    reportDoc.body.innerHTML = `
      <section class="page comparison-page">
        <div class="comparison-intro"><h1>Comparaison des hypothèses</h1><section class="comparison-overview"><h2>Conclusion comparative</h2><p>${longText}</p><div class="comparison-confidence">Niveau de confiance comparatif ${longText}</div><p>Aucune hypothèse ne peut être privilégiée avec les éléments disponibles.</p></section></div>
        <section><h2>Lecture comparative</h2><div class="comparison-hypotheses"><article class="comparison-hypothesis"><h3>Indépendant</h3><p class="comparison-evidence-type">Hypothèse non étayée par les données</p><p>${longText}</p><h4>Limites</h4><ul><li>${longText}</li></ul></article></div></section>
        <section><h2>Faits à vérifier</h2><ul class="comparison-risks"><li>${longText}</li></ul></section>
        <section class="comparison-readings"><h2>Trois lectures distinctes</h2><div>${longText}</div><div>${longText}</div><div>${longText}</div></section>
      </section>
    `;

    await downloadPortfolioPdf(reportDoc, "Projet A");
    const pdf = pdfMocks.instances.at(-1)!;
    const yPositions = pdf.text.mock.calls
      .map((call) => Number(call[2]))
      .filter((value) => Number.isFinite(value));
    const pageGroups = yPositions.reduce<number[][]>((groups, y) => {
      const current = groups.at(-1) ?? [];
      if (current.length && y < current.at(-1)!) groups.push([y]);
      else current.push(y);
      if (!groups.length) groups.push(current);
      return groups;
    }, []);

    expect(pdf.addPage).toHaveBeenCalled();
    expect(pageGroups.every((positions) => positions.length > 1)).toBe(true);
    pageGroups.forEach((positions) => {
      positions.slice(1).forEach((position, index) => expect(position).toBeGreaterThan(positions[index]!));
    });
    expect(pdf.text.mock.calls.flatMap((call) => Array.isArray(call[0]) ? call[0] : [call[0]]).join(" "))
      .toContain("Comparaison des hypothèses — suite");
  });

  it("downloads portfolio pdf without table, hypotheses or kpis", async () => {
    const reportDoc = document.implementation.createHTMLDocument("portfolio");
    reportDoc.body.innerHTML = `
      <section class="page">
        <h1>Simulation Portefeuille</h1>
        <div class="meta-row">Periode: 2026-01-01 au 2026-03-01</div>
      </section>
    `;

    await downloadPortfolioPdf(reportDoc, "Projet A");
    const pdf = pdfMocks.instances.at(-1)!;

    expect(pdf.rect).toHaveBeenCalled();
    expect(pdf.svg).not.toHaveBeenCalled();
    expect(pdf.save).toHaveBeenCalled();
  });

  it("handles a summary table header without body rows", async () => {
    const reportDoc = document.implementation.createHTMLDocument("portfolio");
    reportDoc.body.innerHTML = `
      <section class="page">
        <h1>Synthese - Simulation Portefeuille</h1>
        <table class="summary-table">
          <thead>
            <tr><th>Scenario</th><th>P50</th><th>P70</th><th>P90</th><th>Risk Score</th></tr>
          </thead>
          <tbody></tbody>
        </table>
      </section>
    `;

    await downloadPortfolioPdf(reportDoc, "Projet A");
    const pdf = pdfMocks.instances.at(-1)!;

    expect(pdf.rect).toHaveBeenCalled();
    expect(pdf.save).toHaveBeenCalled();
  });

  it("handles summary tables with a non-standard column count", async () => {
    const reportDoc = document.implementation.createHTMLDocument("portfolio");
    reportDoc.body.innerHTML = `
      <section class="page">
        <h1>Synthese - Simulation Portefeuille</h1>
        <table class="summary-table">
          <thead>
            <tr><th>Scenario</th></tr>
          </thead>
          <tbody>
            <tr><td>Optimiste</td></tr>
          </tbody>
        </table>
      </section>
    `;

    await downloadPortfolioPdf(reportDoc, "Projet A");
    const pdf = pdfMocks.instances.at(-1)!;

    expect(pdf.rect).toHaveBeenCalled();
    expect(pdf.text).toHaveBeenCalledWith(["Scenario"], expect.any(Number), expect.any(Number), { align: "left" });
    expect(pdf.text).toHaveBeenCalledWith(["Optimiste"], expect.any(Number), expect.any(Number), { align: "left" });
  });

  it("handles missing summary header and row cell text", async () => {
    const reportDoc = document.implementation.createHTMLDocument("portfolio");
    reportDoc.body.innerHTML = `
      <section class="page">
        <h1>Synthese - Simulation Portefeuille</h1>
        <table class="summary-table">
          <thead>
            <tr><th></th><th>P50</th></tr>
          </thead>
          <tbody>
            <tr><td></td></tr>
          </tbody>
        </table>
        <div class="kpi"><span class="kpi-label"></span><span class="kpi-value"></span></div>
      </section>
    `;

    await downloadPortfolioPdf(reportDoc, "Projet A");
    const pdf = pdfMocks.instances.at(-1)!;

    expect(pdf.text).toHaveBeenCalledWith([""], expect.any(Number), expect.any(Number), { align: "left" });
    expect(pdf.text).toHaveBeenCalledWith([""], expect.any(Number), expect.any(Number), { align: "center" });
  });

  it("uses fallback risk cell style for unrecognized risk labels", async () => {
    const reportDoc = document.implementation.createHTMLDocument("portfolio");
    reportDoc.body.innerHTML = `
      <section class="page">
        <h1>Synthese - Simulation Portefeuille</h1>
        <table class="summary-table">
          <thead>
            <tr><th>Scenario</th><th>P50</th><th>P70</th><th>P90</th><th>Risk Score</th></tr>
          </thead>
          <tbody>
            <tr><td>Autre</td><td>1</td><td>2</td><td>3</td><td>0,33 (moyen)</td></tr>
          </tbody>
        </table>
      </section>
    `;

    await downloadPortfolioPdf(reportDoc, "Projet A");
    const pdf = pdfMocks.instances.at(-1)!;

    expect(pdf.setFillColor).toHaveBeenCalledWith(31, 41, 55);
    expect(pdf.setTextColor).toHaveBeenCalledWith(255, 255, 255);
  });

  it("ignores empty hypotheses and paginates when charts overflow", async () => {
    const reportDoc = document.implementation.createHTMLDocument("portfolio");
    reportDoc.body.innerHTML = `
      <section class="page">
        <h1>Simulation Portefeuille</h1>
        <div class="hypothesis"></div>
        ${Array.from({ length: 10 }, () => '<div class="chart-wrap"><svg viewBox="0 0 960 1200"></svg></div>').join("")}
      </section>
    `;

    await downloadPortfolioPdf(reportDoc, "Projet A");
    const pdf = pdfMocks.instances.at(-1)!;

    expect(pdf.svg).toHaveBeenCalledTimes(10);
    expect(pdf.splitTextToSize).not.toHaveBeenCalled();
  });

  it("downloads portfolio pdf from body fallback when no page wrapper exists", async () => {
    const reportDoc = document.implementation.createHTMLDocument("portfolio");
    reportDoc.body.innerHTML = `
      <h1>Simulation Portefeuille</h1>
      <div class="meta-row">Periode: 2026-01-01 au 2026-03-01</div>
      <div class="hypothesis"><strong>Risk Score :</strong> Hypothese simple</div>
      <div class="chart-wrap"><svg viewBox="0 0 960 360"></svg></div>
    `;

    await downloadPortfolioPdf(reportDoc, "***");
    const pdf = pdfMocks.instances.at(-1)!;

    expect(pdf.text).toHaveBeenCalledWith("Simulation Portefeuille", 8, 8);
    expect(pdf.text).toHaveBeenCalledWith(["Risk Score :"], 8, expect.any(Number));
    expect(pdf.save).toHaveBeenCalledWith(expect.stringMatching(/^simulation-Portefeuille-\d{2}_\d{2}_\d{4}\.pdf$/));
  });

  it("adds a demo footer when exporting a demo portfolio pdf", async () => {
    const reportDoc = document.implementation.createHTMLDocument("portfolio");
    reportDoc.body.innerHTML = `
      <section class="page">
        <h1>Simulation Portefeuille</h1>
      </section>
    `;

    await downloadPortfolioPdf(reportDoc, "Projet A", true);
    const pdf = pdfMocks.instances.at(-1)!;

    expect(
      pdf.text.mock.calls.some(
        (call) => typeof call[0] === "string" && call[0].includes("Monte Carlo Azure") && call[1] === 8 && call[2] === 292,
      ),
    ).toBe(true);
  });

  it("renders hypothesis branches for body-only and lead-only cases outside summary tables", async () => {
    const reportDoc = document.implementation.createHTMLDocument("portfolio");
    reportDoc.body.innerHTML = `
      <section class="page">
        <h1>Simulation Portefeuille</h1>
        <div class="hypothesis"></div>
        <div class="hypothesis">Hypothese simple</div>
        <div class="hypothesis"><strong>Risk Score :</strong></div>
      </section>
    `;

    await downloadPortfolioPdf(reportDoc, "Projet A");
    const pdf = pdfMocks.instances.at(-1)!;

    expect(pdf.text).toHaveBeenCalledWith(["Hypothese simple"], 8, expect.any(Number));
    expect(pdf.text).toHaveBeenCalledWith(["Risk Score :"], 8, expect.any(Number));
  });

  it("renders hypothesis branches for empty and lead-only blocks after a summary table", async () => {
    const reportDoc = document.implementation.createHTMLDocument("portfolio");
    reportDoc.body.innerHTML = `
      <section class="page">
        <h1>Synthese - Simulation Portefeuille</h1>
        <table class="summary-table">
          <thead>
            <tr><th>Scenario</th><th>P50</th><th>P70</th><th>P90</th><th>Risk Score</th><th>Fiabilite</th></tr>
          </thead>
          <tbody>
            <tr><td>Optimiste</td><td>1</td><td>2</td><td>3</td><td>0,10 (fiable)</td><td>0,11 (fiable)</td></tr>
          </tbody>
        </table>
        <div class="hypothesis"></div>
        <div class="hypothesis"><strong>Risk Score :</strong></div>
      </section>
    `;

    await downloadPortfolioPdf(reportDoc, "Projet A");
    const pdf = pdfMocks.instances.at(-1)!;

    expect(
      pdf.text.mock.calls.some((call) => typeof call[0] === "string" && call[0].startsWith("Hypoth") && call[1] === 8),
    ).toBe(true);
    expect(pdf.text).toHaveBeenCalledWith(["Risk Score :"], 8, expect.any(Number));
  });

  it("covers nullish simulation export fallbacks with synthetic nodes", async () => {
    const fakeDoc = {
      querySelector: vi.fn(() => null),
      querySelectorAll: vi.fn((selector: string) => {
        if (selector === ".meta-row") return [{ textContent: null }];
        if (selector === ".kpi") return [{ querySelector: vi.fn(() => null) }];
        if (selector === ".chart-wrap svg") return [{ viewBox: undefined }];
        return [];
      }),
    } as unknown as Document;

    await downloadSimulationPdf(fakeDoc, "Equipe A");
    const pdf = pdfMocks.instances.at(-1)!;

    expect(pdf.text).toHaveBeenCalledWith("Simulation Monte Carlo", 8, 8);
    expect(pdf.text).toHaveBeenCalledWith(": ", expect.any(Number), expect.any(Number), { align: "center" });
    expect(pdf.svg).toHaveBeenCalledTimes(1);
  });

  it("covers portfolio nullish fallbacks with synthetic sparse content", async () => {
    const sparseSection = {
      querySelector: vi.fn((selector: string) => {
        if (selector === "h1") return null;
        if (selector === ".summary-table") {
          return {
            querySelectorAll: (inner: string) => {
              if (inner === "thead th") {
                return [
                  { textContent: null },
                  { textContent: "P50" },
                  { textContent: "P70" },
                  { textContent: "P90" },
                  { textContent: "Risk Score" },
                  { textContent: "Extra" },
                ];
              }
              if (inner === "tbody tr") {
                return [
                  {
                    querySelectorAll: () => [{ textContent: null }],
                  },
                ];
              }
              return [];
            },
          };
        }
        return null;
      }),
      querySelectorAll: vi.fn((selector: string) => {
        if (selector === ".meta-row") return [{ textContent: null }];
        if (selector === ".hypothesis") return [{ textContent: "Hypothese synthetique" }];
        if (selector === ".kpi") return [{ querySelector: vi.fn(() => null) }];
        if (selector === ".chart-wrap svg") return [{ viewBox: undefined }];
        return [];
      }),
    };

    const fakeDoc = {
      body: sparseSection,
      querySelectorAll: vi.fn((selector: string) => (selector === ".page" ? [sparseSection] : [])),
    } as unknown as Document;

    const splitSpy = vi.fn(() => "wrapped text");
    pdfMocks.instances.length = 0;
    const { jsPDF } = await import("jspdf");
    (jsPDF as unknown as { mockImplementationOnce: (impl: () => unknown) => void }).mockImplementationOnce(function MockJsPdfCtor() {
      const instance = {
        internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } },
        setFont: vi.fn().mockReturnThis(),
        setFontSize: vi.fn().mockReturnThis(),
        setTextColor: vi.fn().mockReturnThis(),
        setDrawColor: vi.fn().mockReturnThis(),
        setLineWidth: vi.fn().mockReturnThis(),
        setFillColor: vi.fn().mockReturnThis(),
        roundedRect: vi.fn().mockReturnThis(),
        rect: vi.fn().mockReturnThis(),
        splitTextToSize: splitSpy,
        text: vi.fn().mockReturnThis(),
        addPage: vi.fn().mockReturnThis(),
        svg: vi.fn(async () => undefined),
        save: vi.fn(),
      };
      pdfMocks.instances.push(instance);
      return instance as never;
    });

    await downloadPortfolioPdf(fakeDoc, "Projet A");
    const pdf = pdfMocks.instances.at(-1)!;

    expect(splitSpy).toHaveBeenCalledWith("Hypothese synthetique", expect.any(Number));
    expect(pdf.text).toHaveBeenCalledWith("Simulation Portefeuille", 8, 8);
    expect(pdf.svg).toHaveBeenCalledTimes(1);
  });

  it("covers scoped portfolio meta and hypothesis nullish branches", async () => {
    const fakeSummaryTable = {
      querySelectorAll: (inner: string) => {
        if (inner === "thead th") {
          return [{ textContent: "Scenario" }];
        }
        if (inner === "tbody tr") {
          return [];
        }
        return [];
      },
    };
    const fakeSection = {
      querySelector: vi.fn((selector: string) => {
        if (selector === "h1") return { textContent: "Synthese - Simulation Portefeuille" };
        if (selector === ".summary-table") return fakeSummaryTable;
        return null;
      }),
      querySelectorAll: vi.fn((selector: string) => {
        if (selector === ".meta .meta-row") return [{ textContent: null }];
        if (selector === ".diagnostic-card .meta-row") return [{ textContent: null }];
        if (selector === ".hypothesis") return [{ textContent: null }];
        if (selector === ".kpi") return [];
        if (selector === ".chart-wrap svg") return [];
        return [];
      }),
    };

    const fakeDoc = {
      body: fakeSection,
      querySelectorAll: vi.fn((selector: string) => (selector === ".page" ? [fakeSection] : [])),
    } as unknown as Document;

    await downloadPortfolioPdf(fakeDoc, "Projet A");
    const pdf = pdfMocks.instances.at(-1)!;

    expect(pdf.text).toHaveBeenCalledWith([""], expect.any(Number), expect.any(Number));
  });

  it("renders partial and empty assumptions in the two-column summary grid", async () => {
    const reportDoc = document.implementation.createHTMLDocument("report");
    reportDoc.body.innerHTML = `
      <section class="page">
        <h1>Synthèse - Simulation Portefeuille</h1>
        <table class="summary-table"><thead><tr><th>Scénario</th></tr></thead><tbody></tbody></table>
        <div class="hypothesis-columns">
          <div class="hypothesis-column">
            <p class="hypothesis"></p>
            <p class="hypothesis">Explication sans libellé.</p>
          </div>
          <div class="hypothesis-column">
            <p class="hypothesis"><strong>Risk Score :</strong></p>
          </div>
        </div>
      </section>
    `;

    await downloadPortfolioPdf(reportDoc, "Projet A");
    const pdf = pdfMocks.instances.at(-1)!;

    expect(pdf.text).toHaveBeenCalledWith(["Explication sans libellé."], expect.any(Number), expect.any(Number));
    expect(pdf.text).toHaveBeenCalledWith(["Risk Score :"], expect.any(Number), expect.any(Number));
  });

  it("covers summary table fallbacks for missing headers, rows and widths", async () => {
    const fakeSummaryTable = {
      querySelectorAll: (inner: string) => {
        if (inner === "thead th") return [];
        if (inner === "tbody tr") return [];
        return [];
      },
    };
    const fakeSection = {
      querySelector: vi.fn((selector: string) => {
        if (selector === "h1") return { textContent: "Synthese - Simulation Portefeuille" };
        if (selector === ".summary-table") return fakeSummaryTable;
        return null;
      }),
      querySelectorAll: vi.fn((selector: string) => {
        if (selector === ".meta-row") return [];
        if (selector === ".hypothesis") return [];
        if (selector === ".kpi") return [];
        if (selector === ".chart-wrap svg") return [];
        return [];
      }),
    };

    const fakeDoc = {
      body: fakeSection,
      querySelectorAll: vi.fn((selector: string) => (selector === ".page" ? [fakeSection] : [])),
    } as unknown as Document;

    await downloadPortfolioPdf(fakeDoc, "Projet A");
    const pdf = pdfMocks.instances.at(-1)!;

    expect(pdf.save).toHaveBeenCalled();
  });

  it("covers portfolio title fallback with a sparse synthetic summary table", async () => {
    const fakeSummaryTable = {
      querySelectorAll: (inner: string) => {
        if (inner === "thead th") {
          return [{ textContent: "Scenario" }, { textContent: "P50" }, { textContent: "P70" }];
        }
        if (inner === "tbody tr") {
          return [{ querySelectorAll: () => [] }];
        }
        return [];
      },
    };
    const fakeSection = {
      querySelector: vi.fn((selector: string) => {
        if (selector === "h1") return null;
        if (selector === ".summary-table") return fakeSummaryTable;
        return null;
      }),
      querySelectorAll: vi.fn((selector: string) => {
        if (selector === ".meta-row") return [];
        if (selector === ".hypothesis") return [];
        if (selector === ".kpi") return [];
        if (selector === ".chart-wrap svg") return [];
        return [];
      }),
    };
    const fakeDoc = {
      body: fakeSection,
      querySelectorAll: vi.fn((selector: string) => (selector === ".page" ? [fakeSection] : [])),
    } as unknown as Document;

    await downloadPortfolioPdf(fakeDoc, "Projet A");
    const pdf = pdfMocks.instances.at(-1)!;

    expect(pdf.text).toHaveBeenCalledWith("Simulation Portefeuille", 8, 8);
  });

  it("skips empty kpi rows before rendering populated rows", async () => {
    const reportDoc = document.implementation.createHTMLDocument("report");
    reportDoc.body.innerHTML = `
      <h1>Simulation Monte Carlo</h1>
      <section class="kpis"></section>
      <section class="kpis">
        <div class="kpi"><span class="kpi-label">P50</span><span class="kpi-value">10 semaines</span></div>
      </section>
    `;

    await downloadSimulationPdf(reportDoc, "Equipe A");
    const pdf = pdfMocks.instances.at(-1)!;

    expect(pdf.text).toHaveBeenCalledWith("P50: 10 semaines", expect.any(Number), expect.any(Number), { align: "center" });
  });
});



