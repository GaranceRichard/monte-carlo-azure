import { afterEach, describe, expect, it, vi } from "vitest";
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
    setTextColor: ReturnType<typeof vi.fn>;
    setDrawColor: ReturnType<typeof vi.fn>;
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
  afterEach(() => {
    pdfMocks.instances.length = 0;
  });

  it("builds fallback filename when team sanitizes to empty", () => {
    const date = new Date("2026-02-25T10:00:00Z");
    expect(buildSimulationPdfFileName("***", date)).toBe("simulation-equipe-25_02_2026.pdf");
  });

  it("sanitizes accents and repeated separators in filenames", () => {
    const date = new Date("2026-02-25T10:00:00Z");
    expect(buildSimulationPdfFileName("Équipe   Alpha / Core", date)).toBe("simulation-Equipe-Alpha-Core-25_02_2026.pdf");
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
        <div class="kpi"><span class="kpi-label">Fiabilite historique</span><span class="kpi-value">0,62 (incertain)</span></div>
      </div>
    `;

    await downloadSimulationPdf(reportDoc, "Equipe A");
    const pdf = pdfMocks.instances.at(-1)!;

    expect(pdf.roundedRect).toHaveBeenCalledTimes(2);
    expect(pdf.splitTextToSize).toHaveBeenCalledWith("Lecture: Historique globalement stable.", expect.any(Number));
    expect(pdf.text).toHaveBeenCalledWith("Diagnostic", expect.any(Number), expect.any(Number));
    expect(pdf.text).toHaveBeenCalledWith("P50: 82 items", 8, expect.any(Number));
    expect(pdf.text).toHaveBeenCalledWith("Risk Score: 0,21 (incertain)", 8, expect.any(Number));
    expect(pdf.text).toHaveBeenCalledWith("Fiabilite historique: 0,62 (incertain)", expect.any(Number), expect.any(Number));
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
            </tr>
          </thead>
          <tbody>
            <tr><td>Optimiste</td><td>200</td><td>180</td><td>160</td><td>0,12 (fiable)</td></tr>
            <tr><td>Arrime</td><td>180</td><td>170</td><td>150</td><td>0,24 (incertain)</td></tr>
            <tr><td>Friction</td><td>120</td><td>110</td><td>100</td><td>0,70 (fragile)</td></tr>
            <tr><td>Conservateur</td><td>90</td><td>80</td><td>70</td><td>0,95 (non fiable)</td></tr>
          </tbody>
        </table>
        <div class="hypothesis">Hypothese longue a renvoyer sur plusieurs lignes si necessaire.</div>
        <div class="kpi"><span class="kpi-label">P50</span><span class="kpi-value">176 items</span></div>
        <div class="chart-wrap"><svg viewBox="0 0 960 360"></svg></div>
      </section>
      <section class="page">
        <h1>Simulation Portefeuille - Team A</h1>
        <div class="meta-row">Equipe: Team A</div>
        <div class="kpi"><span class="kpi-label">P50</span><span class="kpi-value">60 items</span></div>
        <div class="chart-wrap"><svg viewBox="0 0 960 360"></svg></div>
      </section>
    `;

    await downloadPortfolioPdf(reportDoc, "Projet A");
    const pdf = pdfMocks.instances.at(-1)!;

    expect(pdf.setDrawColor).toHaveBeenCalled();
    expect(pdf.setFillColor).toHaveBeenCalled();
    expect(pdf.rect).toHaveBeenCalled();
    expect(pdf.splitTextToSize).toHaveBeenCalled();
    expect(pdf.svg).toHaveBeenCalledTimes(2);
    expect(pdf.addPage).toHaveBeenCalled();
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

    expect(pdf.rect).not.toHaveBeenCalled();
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

    expect(pdf.text).toHaveBeenCalledWith("", expect.any(Number), expect.any(Number), { align: "left" });
    expect(pdf.text).toHaveBeenCalledWith("", expect.any(Number), expect.any(Number), { align: "center" });
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
      <div class="hypothesis">Hypothese simple</div>
      <div class="chart-wrap"><svg viewBox="0 0 960 360"></svg></div>
    `;

    await downloadPortfolioPdf(reportDoc, "***");
    const pdf = pdfMocks.instances.at(-1)!;

    expect(pdf.text).toHaveBeenCalledWith("Simulation Portefeuille", 8, 8);
    expect(pdf.save).toHaveBeenCalledWith(expect.stringMatching(/^simulation-Portefeuille-\d{2}_\d{2}_\d{4}\.pdf$/));
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
    expect(pdf.text).toHaveBeenCalledWith(": ", 8, expect.any(Number));
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
});
