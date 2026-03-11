import { afterEach, describe, expect, it, vi } from "vitest";

const pdfMocks = vi.hoisted(() => ({
  instances: [] as Array<{
    internal: { pageSize: { getWidth: () => number; getHeight: () => number } };
    setFont: ReturnType<typeof vi.fn>;
    setFontSize: ReturnType<typeof vi.fn>;
    setDrawColor: ReturnType<typeof vi.fn>;
    setFillColor: ReturnType<typeof vi.fn>;
    splitTextToSize: ReturnType<typeof vi.fn>;
    text: ReturnType<typeof vi.fn>;
    roundedRect: ReturnType<typeof vi.fn>;
    addPage: ReturnType<typeof vi.fn>;
    svg: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  }>,
  nextSvgError: null as Error | null,
}));

vi.mock("jspdf", () => ({
  jsPDF: vi.fn(function MockJsPdfCtor() {
    const svgImpl = pdfMocks.nextSvgError
      ? vi.fn(async () => {
          const error = pdfMocks.nextSvgError;
          pdfMocks.nextSvgError = null;
          throw error;
        })
      : vi.fn(async () => undefined);
    const instance = {
      internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } },
      setFont: vi.fn().mockReturnThis(),
      setFontSize: vi.fn().mockReturnThis(),
      setDrawColor: vi.fn().mockReturnThis(),
      setFillColor: vi.fn().mockReturnThis(),
      splitTextToSize: vi.fn((text: string) => [text]),
      text: vi.fn().mockReturnThis(),
      roundedRect: vi.fn().mockReturnThis(),
      addPage: vi.fn().mockReturnThis(),
      svg: svgImpl,
      save: vi.fn(),
    };
    pdfMocks.instances.push(instance);
    return instance;
  }),
}));

import {
  buildSimulationPdfFileName,
  downloadSimulationPdf,
  exportSimulationPrintReport,
} from "./simulationPrintReport";

function buildBaseArgs() {
  return {
    selectedTeam: "Equipe A",
    startDate: "2025-01-01",
    endDate: "2025-03-01",
    simulationMode: "backlog_to_weeks" as const,
    includeZeroWeeks: true,
    types: ["Bug", "User Story"],
    doneStates: ["Done", "Closed"],
    backlogSize: 120,
    targetWeeks: 12,
    nSims: 20000,
    resultKind: "weeks" as const,
    displayPercentiles: { P50: 8, P70: 10, P90: 13 },
    throughputReliability: { cv: 0.62, iqr_ratio: 0.55, slope_norm: -0.07, label: "incertain" as const, samples_count: 10 },
    throughputPoints: [
      { week: "2025-01-06", throughput: 7, movingAverage: 7 },
      { week: "2025-01-13", throughput: 5, movingAverage: 6 },
      { week: "2025-01-20", throughput: 9, movingAverage: 7 },
    ],
    distributionPoints: [
      { x: 6, count: 14, gauss: 11 },
      { x: 7, count: 21, gauss: 18 },
      { x: 8, count: 17, gauss: 19 },
    ],
    probabilityPoints: [
      { x: 6, probability: 22 },
      { x: 7, probability: 48 },
      { x: 8, probability: 71 },
    ],
  };
}

describe("exportSimulationPrintReport", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    pdfMocks.instances.length = 0;
    pdfMocks.nextSvgError = null;
  });

  it("writes report HTML containing 3 chart SVGs and a download button", () => {
    let writtenHtml = "";
    const openMock = vi.fn();
    const writeMock = vi.fn((html: string) => {
      writtenHtml = html;
    });
    const closeMock = vi.fn();
    const fakeWindow = {
      document: { open: openMock, write: writeMock, close: closeMock, getElementById: vi.fn(() => null) },
      focus: vi.fn(),
      print: vi.fn(),
      onload: null as null | (() => void),
    };

    vi.spyOn(window, "open").mockReturnValue(fakeWindow as unknown as Window);

    exportSimulationPrintReport(buildBaseArgs());

    expect(openMock).toHaveBeenCalledTimes(1);
    expect(writeMock).toHaveBeenCalledTimes(1);
    expect(closeMock).toHaveBeenCalledTimes(1);
    expect(writtenHtml).toContain("Throughput hebdomadaire");
    expect(writtenHtml).toContain("Distribution Monte Carlo");
    expect(writtenHtml).toContain("Courbe de probabilite");
    expect(writtenHtml).toContain('class="summary-grid"');
    expect(writtenHtml).toContain('class="diagnostic-card"');
    expect(writtenHtml).toContain("Diagnostic");
    expect(writtenHtml).toContain('<span class="kpi-label">Risk Score</span>');
    expect(writtenHtml).toContain('<span class="kpi-label">Fiabilite historique</span>');
    expect(writtenHtml).toContain('<span class="kpi-value">0,63 (fragile)</span>');
    expect(writtenHtml).toContain('<span class="kpi-value">0,62 (incertain)</span>');
    expect(writtenHtml).toContain("Throughput en baisse sur les dernieres semaines.");
    expect(writtenHtml).toContain('id="download-pdf"');
    expect((writtenHtml.match(/<svg/g) || []).length).toBeGreaterThanOrEqual(3);
    expect(typeof fakeWindow.onload).toBe("function");
  });

  it("renders empty-chart placeholder and escapes HTML for unsafe values", () => {
    let writtenHtml = "";
    const fakeWindow = {
      document: {
        open: vi.fn(),
        write: vi.fn((html: string) => {
          writtenHtml = html;
        }),
        close: vi.fn(),
        getElementById: vi.fn(() => null),
      },
      onload: null as null | (() => void),
    };
    vi.spyOn(window, "open").mockReturnValue(fakeWindow as unknown as Window);

    exportSimulationPrintReport({
      ...buildBaseArgs(),
      selectedTeam: `<script>alert("x")</script>`,
      types: [],
      doneStates: [],
      throughputReliability: undefined,
      throughputPoints: [],
      distributionPoints: [],
      probabilityPoints: [],
    });

    expect((writtenHtml.match(/Donnees insuffisantes pour afficher ce graphique/g) || []).length).toBe(3);
    expect(writtenHtml).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    expect(writtenHtml).not.toContain(`<script>alert("x")</script>`);
    expect(writtenHtml).toContain("Non disponible");
  });

  it("computes reliability from throughput points when API reliability is absent", () => {
    let writtenHtml = "";
    const fakeWindow = {
      document: {
        open: vi.fn(),
        write: vi.fn((html: string) => {
          writtenHtml = html;
        }),
        close: vi.fn(),
        getElementById: vi.fn(() => null),
      },
      onload: null as null | (() => void),
    };
    vi.spyOn(window, "open").mockReturnValue(fakeWindow as unknown as Window);

    exportSimulationPrintReport({
      ...buildBaseArgs(),
      throughputReliability: undefined,
      throughputPoints: [
        { week: "2025-01-06", throughput: 10, movingAverage: 10 },
        { week: "2025-01-13", throughput: 9, movingAverage: 9.5 },
        { week: "2025-01-20", throughput: 10, movingAverage: 9.67 },
        { week: "2025-01-27", throughput: 11, movingAverage: 10 },
        { week: "2025-02-03", throughput: 10, movingAverage: 10 },
        { week: "2025-02-10", throughput: 9, movingAverage: 10 },
        { week: "2025-02-17", throughput: 10, movingAverage: 10 },
        { week: "2025-02-24", throughput: 10, movingAverage: 10 },
      ],
    });

    expect(writtenHtml).not.toContain("Non disponible");
    expect(writtenHtml).toContain('<span class="kpi-value">0,06 (fiable)</span>');
    expect(writtenHtml).toContain("Historique globalement stable.");
  });

  it("renders the short-history diagnostic message", () => {
    let writtenHtml = "";
    const fakeWindow = {
      document: {
        open: vi.fn(),
        write: vi.fn((html: string) => {
          writtenHtml = html;
        }),
        close: vi.fn(),
        getElementById: vi.fn(() => null),
      },
      onload: null as null | (() => void),
    };
    vi.spyOn(window, "open").mockReturnValue(fakeWindow as unknown as Window);

    exportSimulationPrintReport({
      ...buildBaseArgs(),
      throughputReliability: { cv: 0.1, iqr_ratio: 0.1, slope_norm: 0, label: "non fiable", samples_count: 5 },
    });

    expect(writtenHtml).toContain("Historique trop court pour projeter avec confiance.");
  });

  it("renders strong trend and high-dispersion reliability diagnostics", () => {
    let dropHtml = "";
    const dropWindow = {
      document: {
        open: vi.fn(),
        write: vi.fn((html: string) => {
          dropHtml = html;
        }),
        close: vi.fn(),
        getElementById: vi.fn(() => null),
      },
      onload: null as null | (() => void),
    };
    vi.spyOn(window, "open").mockReturnValueOnce(dropWindow as unknown as Window);
    exportSimulationPrintReport({
      ...buildBaseArgs(),
      throughputReliability: { cv: 0.2, iqr_ratio: 0.2, slope_norm: -0.16, label: "non fiable", samples_count: 10 },
    });

    let riseHtml = "";
    const riseWindow = {
      document: {
        open: vi.fn(),
        write: vi.fn((html: string) => {
          riseHtml = html;
        }),
        close: vi.fn(),
        getElementById: vi.fn(() => null),
      },
      onload: null as null | (() => void),
    };
    vi.spyOn(window, "open").mockReturnValueOnce(riseWindow as unknown as Window);
    exportSimulationPrintReport({
      ...buildBaseArgs(),
      throughputReliability: { cv: 1.1, iqr_ratio: 1.2, slope_norm: 0.12, label: "fragile", samples_count: 10 },
    });

    expect(dropHtml).toContain("Throughput en forte baisse sur les dernieres semaines.");
    expect(riseHtml).toContain("Throughput en forte hausse sur les dernieres semaines.");
  });

  it("renders moderate upward trend, high dispersion and limited-volume diagnostics", () => {
    let riseHtml = "";
    const riseWindow = {
      document: {
        open: vi.fn(),
        write: vi.fn((html: string) => {
          riseHtml = html;
        }),
        close: vi.fn(),
        getElementById: vi.fn(() => null),
      },
      onload: null as null | (() => void),
    };
    vi.spyOn(window, "open").mockReturnValueOnce(riseWindow as unknown as Window);
    exportSimulationPrintReport({
      ...buildBaseArgs(),
      throughputReliability: { cv: 0.2, iqr_ratio: 0.2, slope_norm: 0.06, label: "incertain", samples_count: 10 },
    });

    let dispersionHtml = "";
    const dispersionWindow = {
      document: {
        open: vi.fn(),
        write: vi.fn((html: string) => {
          dispersionHtml = html;
        }),
        close: vi.fn(),
        getElementById: vi.fn(() => null),
      },
      onload: null as null | (() => void),
    };
    vi.spyOn(window, "open").mockReturnValueOnce(dispersionWindow as unknown as Window);
    exportSimulationPrintReport({
      ...buildBaseArgs(),
      throughputReliability: { cv: 1.01, iqr_ratio: 0.4, slope_norm: 0, label: "fragile", samples_count: 10 },
    });

    let volumeHtml = "";
    const volumeWindow = {
      document: {
        open: vi.fn(),
        write: vi.fn((html: string) => {
          volumeHtml = html;
        }),
        close: vi.fn(),
        getElementById: vi.fn(() => null),
      },
      onload: null as null | (() => void),
    };
    vi.spyOn(window, "open").mockReturnValueOnce(volumeWindow as unknown as Window);
    exportSimulationPrintReport({
      ...buildBaseArgs(),
      throughputReliability: { cv: 0.2, iqr_ratio: 0.2, slope_norm: 0, label: "incertain", samples_count: 7 },
    });

    expect(riseHtml).toContain("Throughput en hausse sur les dernieres semaines.");
    expect(dispersionHtml).toContain("Dispersion elevee du throughput historique.");
    expect(volumeHtml).toContain("Volume historique encore limite.");
  });

  it("supports weeks_to_items mode and excluded zero-weeks label", () => {
    let writtenHtml = "";
    const fakeWindow = {
      document: {
        open: vi.fn(),
        write: vi.fn((html: string) => {
          writtenHtml = html;
        }),
        close: vi.fn(),
        getElementById: vi.fn(() => null),
      },
      onload: null as null | (() => void),
    };
    vi.spyOn(window, "open").mockReturnValue(fakeWindow as unknown as Window);

    exportSimulationPrintReport({
      ...buildBaseArgs(),
      simulationMode: "weeks_to_items",
      includeZeroWeeks: false,
      resultKind: "items",
    });

    expect(writtenHtml).toContain("Semaines vers items - cible: 12 semaines");
    expect(writtenHtml).toContain("Semaines 0 exclues");
    expect(writtenHtml).toContain("8 items");
    expect(writtenHtml).not.toContain("items (au moins)");
  });

  it("renders empty type/state summaries and reliable risk legend", () => {
    let writtenHtml = "";
    const fakeWindow = {
      document: {
        open: vi.fn(),
        write: vi.fn((html: string) => {
          writtenHtml = html;
        }),
        close: vi.fn(),
        getElementById: vi.fn(() => null),
      },
      onload: null as null | (() => void),
    };
    vi.spyOn(window, "open").mockReturnValue(fakeWindow as unknown as Window);

    exportSimulationPrintReport({
      ...buildBaseArgs(),
      types: [],
      doneStates: [],
      displayPercentiles: { P50: 10, P70: 11, P90: 12 },
    });

    expect(writtenHtml).toContain("<b>Tickets:</b> Aucun");
    expect(writtenHtml).toContain("<b>Etats:</b> Aucun");
    expect(writtenHtml).toContain("0,20 (fiable)");
  });

  it("uses zero defaults when display percentiles are missing", () => {
    let writtenHtml = "";
    const fakeWindow = {
      document: {
        open: vi.fn(),
        write: vi.fn((html: string) => {
          writtenHtml = html;
        }),
        close: vi.fn(),
        getElementById: vi.fn(() => null),
      },
      onload: null as null | (() => void),
    };
    vi.spyOn(window, "open").mockReturnValue(fakeWindow as unknown as Window);

    exportSimulationPrintReport({
      ...buildBaseArgs(),
      displayPercentiles: {},
    });

    expect(writtenHtml).toMatch(/>P50<\/span><span class="kpi-value">0 semaines \(au plus\)</);
    expect(writtenHtml).toMatch(/>P70<\/span><span class="kpi-value">0 semaines \(au plus\)</);
    expect(writtenHtml).toMatch(/>P90<\/span><span class="kpi-value">0 semaines \(au plus\)</);
  });

  it("renders incertain and eleve risk legends from percentiles", () => {
    let incertainHtml = "";
    const incertainWindow = {
      document: {
        open: vi.fn(),
        write: vi.fn((html: string) => {
          incertainHtml = html;
        }),
        close: vi.fn(),
        getElementById: vi.fn(() => null),
      },
      onload: null as null | (() => void),
    };
    vi.spyOn(window, "open").mockReturnValueOnce(incertainWindow as unknown as Window);
    exportSimulationPrintReport({
      ...buildBaseArgs(),
      displayPercentiles: { P50: 10, P70: 12, P90: 14 },
    });

    let eleveHtml = "";
    const eleveWindow = {
      document: {
        open: vi.fn(),
        write: vi.fn((html: string) => {
          eleveHtml = html;
        }),
        close: vi.fn(),
        getElementById: vi.fn(() => null),
      },
      onload: null as null | (() => void),
    };
    vi.spyOn(window, "open").mockReturnValueOnce(eleveWindow as unknown as Window);
    exportSimulationPrintReport({
      ...buildBaseArgs(),
      displayPercentiles: { P50: 10, P70: 18, P90: 20 },
    });

    expect(incertainHtml).toContain("0,40 (incertain)");
    expect(eleveHtml).toContain("1,00 (eleve)");
  });

  it("returns early when popup opening is blocked", () => {
    vi.spyOn(window, "open").mockReturnValue(null);
    expect(() => exportSimulationPrintReport(buildBaseArgs())).not.toThrow();
  });

  it("wires download button click handler on window load", async () => {
    let clickHandler: null | (() => void) = null;
    const fakeButton = {
      addEventListener: vi.fn((_event: string, handler: () => void) => {
        clickHandler = handler;
      }),
    };

    const reportDoc = document.implementation.createHTMLDocument("report");
    reportDoc.body.innerHTML = `
      <h1>Simulation Monte Carlo - Equipe A</h1>
      <div class="kpi"><span class="kpi-label">P50</span><span class="kpi-value">8 semaines</span></div>
      <div class="chart-wrap"><svg viewBox="0 0 960 300"></svg></div>
    `;

    const fakeWindow = {
      document: {
        open: vi.fn(),
        write: vi.fn(),
        close: vi.fn(),
        getElementById: vi.fn(() => fakeButton),
        querySelector: reportDoc.querySelector.bind(reportDoc),
        querySelectorAll: reportDoc.querySelectorAll.bind(reportDoc),
      },
      onload: null as null | (() => void),
    };

    vi.spyOn(window, "open").mockReturnValue(fakeWindow as unknown as Window);
    exportSimulationPrintReport(buildBaseArgs());
    expect(typeof fakeWindow.onload).toBe("function");

    fakeWindow.onload?.();
    expect(fakeButton.addEventListener).toHaveBeenCalledWith("click", expect.any(Function));
    const wiredClickHandler = clickHandler as null | (() => void | Promise<void>);
    if (wiredClickHandler) {
      await wiredClickHandler();
    }

    const pdf = pdfMocks.instances[0];
    expect(pdf?.save).toHaveBeenCalled();
  });

  it("registers a one-shot load listener when addEventListener is available", () => {
    const addEventListener = vi.fn();
    const fakeButton = {
      addEventListener: vi.fn(),
    };
    const fakeWindow = {
      document: {
        open: vi.fn(),
        write: vi.fn(),
        close: vi.fn(),
        getElementById: vi.fn(() => fakeButton),
      },
      addEventListener,
      onload: null as null | (() => void),
    };

    vi.spyOn(window, "open").mockReturnValue(fakeWindow as unknown as Window);
    exportSimulationPrintReport(buildBaseArgs());

    expect(addEventListener).toHaveBeenCalledWith("load", expect.any(Function), { once: true });
    expect(fakeWindow.onload).toBeNull();
  });

  it("does not bind the download button twice when it is already bound", () => {
    const addEventListener = vi.fn();
    const fakeButton = {
      __downloadBound: true,
      addEventListener: vi.fn(),
    };
    const fakeWindow = {
      document: {
        open: vi.fn(),
        write: vi.fn(),
        close: vi.fn(),
        getElementById: vi.fn(() => fakeButton),
      },
      addEventListener,
      onload: null as null | (() => void),
    };

    vi.spyOn(window, "open").mockReturnValue(fakeWindow as unknown as Window);
    exportSimulationPrintReport(buildBaseArgs());

    const loadHandler = addEventListener.mock.calls[0]?.[1];
    loadHandler?.();
    expect(fakeButton.addEventListener).not.toHaveBeenCalled();
  });

  it("alerts the user when PDF generation fails", async () => {
    let clickHandler: null | (() => void) = null;
    const fakeButton = {
      disabled: false,
      textContent: "Telecharger PDF",
      addEventListener: vi.fn((_event: string, handler: () => void) => {
        clickHandler = handler;
      }),
    };
    const alert = vi.fn();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const reportDoc = document.implementation.createHTMLDocument("report");
    reportDoc.body.innerHTML = `
      <h1>Simulation Monte Carlo - Equipe A</h1>
      <div class="meta-row">Periode: 2025-01-01 au 2025-03-01</div>
      <div class="kpi"><span class="kpi-label">P50</span><span class="kpi-value">8 semaines</span></div>
      <div class="chart-wrap"><svg viewBox="0 0 960 300"></svg></div>
    `;

    const fakeWindow = {
      document: Object.assign(reportDoc, {
        open: vi.fn(),
        write: vi.fn(),
        close: vi.fn(),
        getElementById: vi.fn(() => fakeButton),
      }),
      addEventListener: vi.fn(),
      alert,
      onload: null as null | (() => void),
    };

    vi.spyOn(window, "open").mockReturnValue(fakeWindow as unknown as Window);
    const pdfFailure = new Error("printer offline");
    pdfMocks.nextSvgError = pdfFailure;

    exportSimulationPrintReport(buildBaseArgs());
    const loadHandler = fakeWindow.addEventListener.mock.calls[0]?.[1];
    loadHandler?.();
    const wiredClickHandler = clickHandler as null | (() => void | Promise<void>);
    if (wiredClickHandler) {
      await wiredClickHandler();
    }
    await Promise.resolve();
    await Promise.resolve();

    expect(alert).toHaveBeenCalledWith("Echec generation PDF: printer offline");
    expect(errorSpy).toHaveBeenCalledWith(pdfFailure);
    expect(fakeButton.disabled).toBe(false);
    expect(fakeButton.textContent).toBe("Telecharger PDF");
  });

  it("logs pdf failures without alert when alert is unavailable", async () => {
    let clickHandler: null | (() => void) = null;
    const fakeButton = {
      disabled: false,
      textContent: "Telecharger PDF",
      addEventListener: vi.fn((_event: string, handler: () => void) => {
        clickHandler = handler;
      }),
    };
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const reportDoc = document.implementation.createHTMLDocument("report");
    reportDoc.body.innerHTML = `
      <h1>Simulation Monte Carlo - Equipe A</h1>
      <div class="meta-row">Periode: 2025-01-01 au 2025-03-01</div>
      <div class="kpi"><span class="kpi-label">P50</span><span class="kpi-value">8 semaines</span></div>
      <div class="chart-wrap"><svg viewBox="0 0 960 300"></svg></div>
    `;

    const fakeWindow = {
      document: Object.assign(reportDoc, {
        open: vi.fn(),
        write: vi.fn(),
        close: vi.fn(),
        getElementById: vi.fn(() => fakeButton),
      }),
      addEventListener: vi.fn(),
      onload: null as null | (() => void),
    };

    vi.spyOn(window, "open").mockReturnValue(fakeWindow as unknown as Window);
    pdfMocks.nextSvgError = new Error("silent failure");

    exportSimulationPrintReport(buildBaseArgs());
    const loadHandler = fakeWindow.addEventListener.mock.calls[0]?.[1];
    loadHandler?.();
    const wiredClickHandler = clickHandler as null | (() => void | Promise<void>);
    if (wiredClickHandler) {
      await wiredClickHandler();
    }
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(errorSpy).toHaveBeenCalled();
    expect(fakeButton.disabled).toBe(false);
    expect(fakeButton.textContent).toBe("Telecharger PDF");
  });

  it("handles missing download button and string pdf failures", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const reportDoc = document.implementation.createHTMLDocument("report");
    reportDoc.body.innerHTML = `
      <h1>Simulation Monte Carlo - Equipe A</h1>
      <div class="meta-row">Periode: 2025-01-01 au 2025-03-01</div>
      <div class="kpi"><span class="kpi-label">P50</span><span class="kpi-value">8 semaines</span></div>
      <div class="chart-wrap"><svg viewBox="0 0 960 300"></svg></div>
    `;
    const fakeWindow = {
      document: Object.assign(reportDoc, {
        open: vi.fn(),
        write: vi.fn(),
        close: vi.fn(),
        getElementById: vi.fn(() => null),
      }),
      addEventListener: vi.fn(),
      onload: null as null | (() => void),
    };

    vi.spyOn(window, "open").mockReturnValue(fakeWindow as unknown as Window);
    pdfMocks.nextSvgError = "string failure" as unknown as Error;

    exportSimulationPrintReport(buildBaseArgs());
    const loadHandler = fakeWindow.addEventListener.mock.calls[0]?.[1];
    loadHandler?.();
    const popup = fakeWindow as unknown as Window & { __downloadPdf?: () => void | Promise<void> };
    await popup.__downloadPdf?.();
    await Promise.resolve();
    await Promise.resolve();

    expect(errorSpy).toHaveBeenCalledWith("string failure");
  });

  it("builds expected PDF filename using team name and date", () => {
    const date = new Date("2026-02-25T10:00:00Z");
    expect(buildSimulationPdfFileName("Équipe Alpha / Core", date)).toBe("simulation-Equipe-Alpha-Core-25_02_2026.pdf");
  });
});

describe("downloadSimulationPdf", () => {
  afterEach(() => {
    pdfMocks.instances.length = 0;
  });

  it("renders report DOM to PDF and saves with team-based filename", async () => {
    const reportDoc = document.implementation.createHTMLDocument("report");
    reportDoc.body.innerHTML = `
      <h1>Simulation Monte Carlo - Equipe A</h1>
      <div class="meta-row">Periode: 2025-01-01 au 2025-03-01</div>
      <div class="meta-row">Mode: Backlog vers semaines</div>
      <div class="kpi"><span class="kpi-label">P50</span><span class="kpi-value">8 semaines</span></div>
      <div class="kpi"><span class="kpi-label">P70</span><span class="kpi-value">10 semaines</span></div>
      <div class="kpi"><span class="kpi-label">P90</span><span class="kpi-value">13 semaines</span></div>
    `;

    for (let i = 0; i < 3; i += 1) {
      const wrap = reportDoc.createElement("div");
      wrap.className = "chart-wrap";
      const svg = reportDoc.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 960 900");
      wrap.appendChild(svg);
      reportDoc.body.appendChild(wrap);
    }

    await downloadSimulationPdf(reportDoc, "Equipe A");

    const pdf = pdfMocks.instances[0];
    expect(pdf).toBeDefined();
    expect(pdf.text).toHaveBeenCalled();
    expect(pdf.svg).toHaveBeenCalledTimes(3);
    expect(pdf.addPage).not.toHaveBeenCalled();
    expect(pdf.save).toHaveBeenCalledWith(expect.stringMatching(/^simulation-Equipe-A-\d{2}_\d{2}_\d{4}\.pdf$/));
  });

  it("renders KPI rows on separate PDF lines when report groups them in multiple sections", async () => {
    const reportDoc = document.implementation.createHTMLDocument("report");
    reportDoc.body.innerHTML = `
      <h1>Simulation Monte Carlo - Equipe A</h1>
      <div class="meta-row">Periode: 2025-01-01 au 2025-03-01</div>
      <section class="kpis">
        <div class="kpi"><span class="kpi-label">P50</span><span class="kpi-value">8 items</span></div>
        <div class="kpi"><span class="kpi-label">P70</span><span class="kpi-value">10 items</span></div>
        <div class="kpi"><span class="kpi-label">P90</span><span class="kpi-value">13 items</span></div>
      </section>
      <section class="kpis">
        <div class="kpi"><span class="kpi-label">Risk Score</span><span class="kpi-value">0,20 (fiable)</span></div>
        <div class="kpi"><span class="kpi-label">Fiabilite historique</span><span class="kpi-value">0,62 (incertain)</span></div>
      </section>
      <div class="chart-wrap"><svg viewBox="0 0 960 300"></svg></div>
    `;

    await downloadSimulationPdf(reportDoc, "Equipe A");

    const pdf = pdfMocks.instances[0];
    const textCalls = pdf?.text.mock.calls ?? [];
    const p50Call = textCalls.find((call) => String(call[0]).includes("P50: 8 items"));
    const riskCall = textCalls.find((call) => String(call[0]).includes("Risk Score: 0,20 (fiable)"));

    expect(p50Call).toBeDefined();
    expect(riskCall).toBeDefined();
    expect(Number(riskCall?.[2])).toBeGreaterThan(Number(p50Call?.[2]));
  });

  it("renders diagnostic card in a dedicated right column in PDF export", async () => {
    const reportDoc = document.implementation.createHTMLDocument("report");
    reportDoc.body.innerHTML = `
      <h1>Simulation Monte Carlo - Equipe A</h1>
      <div class="meta">
        <div class="meta-row">Periode: 2025-01-01 au 2025-03-01</div>
        <div class="meta-row">Mode: Semaines vers items - cible: 12 semaines</div>
      </div>
      <aside class="diagnostic-card">
        <h2 class="diagnostic-title">Diagnostic</h2>
        <div class="meta-row">Lecture: Historique globalement stable.</div>
        <div class="meta-row">CV: 0,62</div>
      </aside>
      <div class="chart-wrap"><svg viewBox="0 0 960 300"></svg></div>
    `;

    await downloadSimulationPdf(reportDoc, "Equipe A");

    const pdf = pdfMocks.instances[0];
    expect(pdf?.text).toHaveBeenCalledWith("Diagnostic", expect.any(Number), expect.any(Number));
    expect(pdf?.text).toHaveBeenCalledWith("Periode: 2025-01-01 au 2025-03-01", expect.any(Number), expect.any(Number));
  });
});
