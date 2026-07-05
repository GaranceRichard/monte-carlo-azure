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
      splitTextToSize: vi.fn((text: string) => [text]),
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
      { label: "Historique corrÃ©lÃ©", color: "#dc2626", points: [{ x: 10, probability: 10 }, { x: 20, probability: 70 }] },
    ]);
    expect(svg).toContain("Comparaison des probabilites");
    expect(svg).toContain("Optimiste");
    expect(svg).toContain("Historique corrÃ©lÃ©");
    expect(svg).toContain("#15803d");
    expect(svg).toContain("#dc2626");
  });
});

describe("simulationPdfDownload", () => {
  afterEach(() => {
    pdfMocks.instances.length = 0;
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



