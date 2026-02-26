import { afterEach, describe, expect, it, vi } from "vitest";

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
    capacityPercent: 100,
    reducedCapacityWeeks: 0,
    resultKind: "weeks" as const,
    displayPercentiles: { P50: 8, P70: 10, P90: 13 },
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
      throughputPoints: [],
      distributionPoints: [],
      probabilityPoints: [],
    });

    expect((writtenHtml.match(/Donnees insuffisantes pour afficher ce graphique/g) || []).length).toBe(3);
    expect(writtenHtml).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    expect(writtenHtml).not.toContain(`<script>alert("x")</script>`);
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
    expect(writtenHtml).toContain("items (au moins)");
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
    await clickHandler?.();

    const pdf = pdfMocks.instances[0];
    expect(pdf?.save).toHaveBeenCalled();
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
});
