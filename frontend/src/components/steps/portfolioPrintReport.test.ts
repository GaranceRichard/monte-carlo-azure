import { afterEach, describe, expect, it, vi } from "vitest";
import { buildAtLeastPercentiles } from "../../hooks/probability";
import { computeRiskScoreFromPercentiles } from "../../utils/simulation";

const pdfModuleMocks = vi.hoisted(() => ({
  downloadPortfolioPdf: vi.fn(async () => undefined),
}));

vi.mock("./simulationPdfDownload", async () => {
  const actual = await vi.importActual<typeof import("./simulationPdfDownload")>("./simulationPdfDownload");
  return {
    ...actual,
    downloadPortfolioPdf: pdfModuleMocks.downloadPortfolioPdf,
  };
});

import { exportPortfolioPrintReport } from "./portfolioPrintReport";

function baseArgs() {
  return {
    selectedProject: "Projet A",
    startDate: "2026-01-01",
    endDate: "2026-03-01",
    arrimageRate: 80,
    includedTeams: ["Team A", "Team B"],
    scenarios: [
      {
        label: "Optimiste" as const,
        hypothese: "hyp optimiste",
        samples: [3, 4, 5],
        weeklyData: [
          { week: "2026-01-01", throughput: 3 },
          { week: "2026-01-08", throughput: 4 },
        ],
        percentiles: { P50: 10, P70: 12, P90: 15 },
        riskScore: 0.2,
        riskLegend: "fiable" as const,
        distribution: [{ x: 10, count: 10 }],
      },
      {
        label: "Arrime (80%)" as const,
        hypothese: "hyp arrime",
        samples: [2, 3, 4],
        weeklyData: [
          { week: "2026-01-01", throughput: 2 },
          { week: "2026-01-08", throughput: 3 },
        ],
        percentiles: { P50: 8, P70: 10, P90: 12 },
        riskScore: 0.25,
        riskLegend: "incertain" as const,
        distribution: [{ x: 8, count: 10 }],
      },
      {
        label: "Friction (64%)" as const,
        hypothese: "hyp friction",
        samples: [1.5, 2, 2.5],
        weeklyData: [
          { week: "2026-01-01", throughput: 1.5 },
          { week: "2026-01-08", throughput: 2 },
        ],
        percentiles: { P50: 7, P70: 8, P90: 10 },
        riskScore: 0.28,
        riskLegend: "incertain" as const,
        distribution: [{ x: 7, count: 10 }],
      },
      {
        label: "Conservateur" as const,
        hypothese: "hyp conservateur",
        samples: [1, 2, 3],
        weeklyData: [
          { week: "2026-01-01", throughput: 1 },
          { week: "2026-01-08", throughput: 2 },
        ],
        percentiles: { P50: 6, P70: 7, P90: 9 },
        riskScore: 0.3,
        riskLegend: "incertain" as const,
        distribution: [{ x: 6, count: 10 }],
      },
    ],
    sections: [
      {
        selectedTeam: "Team A",
        simulationMode: "backlog_to_weeks" as const,
        includeZeroWeeks: true,
        backlogSize: 120,
        targetWeeks: 12,
        nSims: 20000,
        resultKind: "weeks" as const,
        riskScore: 0.3,
        distribution: [{ x: 10, count: 20 }],
        weeklyThroughput: [{ week: "2026-01-01", throughput: 3 }],
        displayPercentiles: { P50: 10, P70: 12, P90: 15 },
      },
    ],
  };
}

describe("exportPortfolioPrintReport", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    pdfModuleMocks.downloadPortfolioPdf.mockReset();
  });

  it("renders synthesis page and scenario pages in expected order with friction in position 4", () => {
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
      addEventListener: vi.fn(),
    };
    vi.spyOn(window, "open").mockReturnValue(fakeWindow as unknown as Window);

    exportPortfolioPrintReport(baseArgs());

    const idxSynth = writtenHtml.indexOf("Synthèse - Simulation Portefeuille");
    const idxOpt = writtenHtml.indexOf("Scénario - Optimiste");
    const idxArr = writtenHtml.search(/Sc.nario - Arrim./);
    const idxFriction = writtenHtml.indexOf("Scénario - Friction (64%)");
    const idxCons = writtenHtml.indexOf("Scénario - Conservateur");
    const idxTeam = writtenHtml.indexOf("Simulation Portefeuille - Team A");

    expect(idxSynth).toBeGreaterThanOrEqual(0);
    expect(idxOpt).toBeGreaterThanOrEqual(0);
    expect(idxArr).toBeGreaterThanOrEqual(0);
    expect(idxFriction).toBeGreaterThanOrEqual(0);
    expect(idxCons).toBeGreaterThanOrEqual(0);
    expect(idxTeam).toBeGreaterThanOrEqual(0);
    expect(idxSynth).toBeLessThan(idxOpt);
    expect(idxOpt).toBeLessThan(idxArr);
    expect(idxArr).toBeLessThan(idxFriction);
    expect(idxFriction).toBeLessThan(idxCons);
    expect(idxCons).toBeLessThan(idxTeam);
  });

  it("includes 4-line summary, overlay probability svg and risk score definition on synthesis page", () => {
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
      addEventListener: vi.fn(),
    };
    vi.spyOn(window, "open").mockReturnValue(fakeWindow as unknown as Window);

    exportPortfolioPrintReport(baseArgs());

    expect(writtenHtml).toContain("<td>Optimiste</td>");
    expect(writtenHtml).toMatch(/<td>Arrim. \(80%\)<\/td>/);
    expect(writtenHtml).toContain("<td>Friction (64%)</td>");
    expect(writtenHtml).toContain("<td>Conservateur</td>");
    expect(writtenHtml).toMatch(/courbes de probabilit.s compar.es/i);
    expect(writtenHtml).toContain('aria-label="Comparaison des probabilites"');
    expect(writtenHtml).toContain("Risk Score : (P90 - P50) / P50");
  });

  it("uses weeks_to_items effective percentiles for summary risk score", () => {
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
      addEventListener: vi.fn(),
    };
    vi.spyOn(window, "open").mockReturnValue(fakeWindow as unknown as Window);

    const args: any = baseArgs();
    args.sections[0].simulationMode = "weeks_to_items";
    args.scenarios = [
      {
        ...args.scenarios[0],
        percentiles: { P50: 100, P70: 110, P90: 120 },
        distribution: [
          { x: 10, count: 10 },
          { x: 20, count: 80 },
          { x: 30, count: 10 },
        ],
      },
      { ...args.scenarios[1] },
      { ...args.scenarios[2] },
      { ...args.scenarios[3] },
    ];

    exportPortfolioPrintReport(args);

    const effectivePercentiles = buildAtLeastPercentiles(args.scenarios[0].distribution, [50, 70, 90]);
    const expectedRisk = computeRiskScoreFromPercentiles("weeks_to_items", effectivePercentiles);
    const expectedP50 = Number(effectivePercentiles.P50 ?? 0).toFixed(0);
    const expectedP70 = Number(effectivePercentiles.P70 ?? 0).toFixed(0);
    const expectedP90 = Number(effectivePercentiles.P90 ?? 0).toFixed(0);

    expect(writtenHtml).toMatch(
      new RegExp(`Optimiste[\\s\\S]*?<td>${expectedP50}</td>\\s*<td>${expectedP70}</td>\\s*<td>${expectedP90}</td>`),
    );
    expect(writtenHtml).not.toMatch(/Optimiste[\s\S]*?<td>100<\/td>\s*<td>110<\/td>\s*<td>120<\/td>/);
    expect(writtenHtml).toContain(expectedRisk.toFixed(2).replace(".", ","));
  });

  it("uses weeks_to_items effective percentiles for scenario and team page risk score", () => {
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
      addEventListener: vi.fn(),
    };
    vi.spyOn(window, "open").mockReturnValue(fakeWindow as unknown as Window);

    const args: any = baseArgs();
    args.sections[0] = {
      ...args.sections[0],
      simulationMode: "weeks_to_items",
      resultKind: "items",
      riskScore: 0,
      displayPercentiles: { P50: 100, P70: 110, P90: 120 },
      distribution: [
        { x: 10, count: 10 },
        { x: 20, count: 80 },
        { x: 30, count: 10 },
      ],
    };
    args.scenarios[0] = {
      ...args.scenarios[0],
      riskScore: 0,
      percentiles: { P50: 100, P70: 110, P90: 120 },
      distribution: [
        { x: 10, count: 10 },
        { x: 20, count: 80 },
        { x: 30, count: 10 },
      ],
    };

    exportPortfolioPrintReport(args);

    const effectivePercentiles = buildAtLeastPercentiles(args.sections[0].distribution, [50, 70, 90]);
    const expectedRisk = computeRiskScoreFromPercentiles("weeks_to_items", effectivePercentiles)
      .toFixed(2)
      .replace(".", ",");

    expect(writtenHtml).toContain("Risk Score : (P50 - P90) / P50");
    expect(writtenHtml).toMatch(new RegExp(`Sc.nario - Optimiste[\\s\\S]*?Risk Score[\\s\\S]*?${expectedRisk}`));
    expect(writtenHtml).toMatch(new RegExp(`Simulation Portefeuille - Team A[\\s\\S]*?Risk Score[\\s\\S]*?${expectedRisk}`));
  });

  it("falls back to computed risk score when weeks-mode riskScore is invalid", () => {
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
      addEventListener: vi.fn(),
    };
    vi.spyOn(window, "open").mockReturnValue(fakeWindow as unknown as Window);

    const args: any = baseArgs();
    args.sections[0] = {
      ...args.sections[0],
      resultKind: "weeks",
      riskScore: Number.NaN,
      displayPercentiles: { P50: 10, P70: 12, P90: 14 },
    };

    exportPortfolioPrintReport(args);

    expect(writtenHtml).toContain("0,40");
  });

  it("renders fallback labels, empty teams and backlog-mode hypothesis when scenarios are reduced", () => {
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
      addEventListener: vi.fn(),
    };
    vi.spyOn(window, "open").mockReturnValue(fakeWindow as unknown as Window);

    const args: any = baseArgs();
    args.includedTeams = [];
    args.scenarios = [
      {
        ...args.scenarios[0],
        label: "Autre",
        distribution: [],
      },
      {
        ...args.scenarios[1],
        label: "Arrime (80%)",
      },
      {
        ...args.scenarios[3],
        label: "Conservateur",
      },
    ];

    exportPortfolioPrintReport(args);

    expect(writtenHtml).toContain("<td>Autre</td>");
    expect(writtenHtml).toMatch(/<td>Arrim. \(80%\)<\/td>/);
    expect(writtenHtml).toContain("<td>Conservateur</td>");
    expect(writtenHtml).toContain("<b>Équipes incluses:</b> Aucune");
    expect(writtenHtml).toContain("3. Friction (100%)");
    expect(writtenHtml).toContain("Risk Score : (P90 - P50) / P50");
  });

  it("renders fragile risk color and unknown risk color fallback", () => {
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
      addEventListener: vi.fn(),
    };
    vi.spyOn(window, "open").mockReturnValue(fakeWindow as unknown as Window);

    const args: any = baseArgs();
    args.sections = [
      {
        ...args.sections[0],
        selectedTeam: "Team A",
        riskScore: 0.7,
      },
      {
        ...args.sections[0],
        selectedTeam: "Team B",
        riskScore: 0.9,
      },
    ];

    exportPortfolioPrintReport(args);

    expect(writtenHtml).toMatch(/Simulation Portefeuille - Team A[\s\S]*?0,70 <span style="color:#dc2626">\(fragile\)<\/span>/);
    expect(writtenHtml).toMatch(/Simulation Portefeuille - Team B[\s\S]*?0,90 <span style="color:#111827">\(non fiable\)<\/span>/);
  });

  it("uses direct riskScore value when weeks-mode riskScore is finite", () => {
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
      addEventListener: vi.fn(),
    };
    vi.spyOn(window, "open").mockReturnValue(fakeWindow as unknown as Window);

    const args: any = baseArgs();
    args.sections[0] = {
      ...args.sections[0],
      resultKind: "weeks",
      riskScore: 0.11,
      distribution: [],
      displayPercentiles: { P50: 10, P70: 12, P90: 14 },
    };

    exportPortfolioPrintReport(args);

    expect(writtenHtml).toMatch(/Simulation Portefeuille - Team A[\s\S]*?0,11[\s\S]*?\(fiable\)/);
  });

  it("uses computed risk score when weeks-mode riskScore is absent", () => {
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
      addEventListener: vi.fn(),
    };
    vi.spyOn(window, "open").mockReturnValue(fakeWindow as unknown as Window);

    const args: any = baseArgs();
    delete args.sections[0].riskScore;
    args.sections[0].distribution = [];
    args.sections[0].displayPercentiles = { P50: 10, P70: 12, P90: 14 };

    exportPortfolioPrintReport(args);

    expect(writtenHtml).toMatch(/Simulation Portefeuille - Team A[\s\S]*?0,40[\s\S]*?\(incertain\)/);
  });

  it("uses section fallbacks when sections are absent", () => {
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
      addEventListener: vi.fn(),
    };
    vi.spyOn(window, "open").mockReturnValue(fakeWindow as unknown as Window);

    const args: any = baseArgs();
    args.sections = [];

    exportPortfolioPrintReport(args);

    expect(writtenHtml).toContain("Backlog vers semaines - backlog: 0 items");
    expect(writtenHtml).not.toContain("Simulation Portefeuille - Team A");
    expect(writtenHtml).toContain("<b>Simulations:</b> 0");
  });

  it("uses default percentile values when percentiles are missing", () => {
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
      addEventListener: vi.fn(),
    };
    vi.spyOn(window, "open").mockReturnValue(fakeWindow as unknown as Window);

    const args: any = baseArgs();
    args.sections[0] = {
      ...args.sections[0],
      includeZeroWeeks: false,
      displayPercentiles: {},
      weeklyThroughput: [
        { week: "2026-01-01", throughput: 0 },
        { week: "2026-01-08", throughput: 3 },
      ],
    };
    args.scenarios[0] = {
      ...args.scenarios[0],
      percentiles: {},
      riskScore: undefined,
    };

    exportPortfolioPrintReport(args);

    expect(writtenHtml).toContain("Semaines 0 exclues");
    expect(writtenHtml).toMatch(/Simulation Portefeuille - Team A[\s\S]*?>0 semaines \(au plus\)</);
    expect(writtenHtml).toMatch(/Sc.nario - Optimiste[\s\S]*?>0 semaines \(au plus\)</);
  });

  it("returns early when popup opening is blocked", () => {
    vi.spyOn(window, "open").mockReturnValue(null);
    expect(() => exportPortfolioPrintReport(baseArgs())).not.toThrow();
  });

  it("wires the download button through addEventListener and triggers PDF export", async () => {
    let clickHandler: null | (() => void) = null;
    const reportDoc = document.implementation.createHTMLDocument("portfolio");
    const fakeButton = {
      disabled: false,
      textContent: "Telecharger PDF",
      addEventListener: vi.fn((_event: string, handler: () => void) => {
        clickHandler = handler;
      }),
    };
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

    exportPortfolioPrintReport(baseArgs());
    const loadHandler = fakeWindow.addEventListener.mock.calls[0]?.[1];
    loadHandler?.();
    const wiredClickHandler = clickHandler as null | (() => void | Promise<void>);
    if (wiredClickHandler) {
      await wiredClickHandler();
    }
    await Promise.resolve();
    await Promise.resolve();

    expect(pdfModuleMocks.downloadPortfolioPdf).toHaveBeenCalledWith(fakeWindow.document, "Projet A");
    expect(fakeButton.addEventListener).toHaveBeenCalledTimes(1);
    expect(fakeButton.disabled).toBe(false);
    expect(fakeButton.textContent).toBe("Telecharger PDF");
  });

  it("does not bind the download button twice when already bound", () => {
    const reportDoc = document.implementation.createHTMLDocument("portfolio");
    const fakeButton = {
      __downloadBound: true,
      addEventListener: vi.fn(),
    };
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

    exportPortfolioPrintReport(baseArgs());
    const loadHandler = fakeWindow.addEventListener.mock.calls[0]?.[1];
    loadHandler?.();

    expect(fakeButton.addEventListener).not.toHaveBeenCalled();
  });

  it("falls back to window.onload and alerts when PDF generation fails", async () => {
    let clickHandler: null | (() => void) = null;
    const reportDoc = document.implementation.createHTMLDocument("portfolio");
    const fakeButton = {
      disabled: false,
      textContent: "Telecharger PDF",
      addEventListener: vi.fn((_event: string, handler: () => void) => {
        clickHandler = handler;
      }),
    };
    const alert = vi.fn();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    pdfModuleMocks.downloadPortfolioPdf.mockRejectedValueOnce(new Error("printer offline"));
    const fakeWindow = {
      document: Object.assign(reportDoc, {
        open: vi.fn(),
        write: vi.fn(),
        close: vi.fn(),
        getElementById: vi.fn(() => fakeButton),
      }),
      onload: null as null | (() => void),
      alert,
    };
    vi.spyOn(window, "open").mockReturnValue(fakeWindow as unknown as Window);

    exportPortfolioPrintReport(baseArgs());
    fakeWindow.onload?.();
    fakeWindow.onload?.();
    const wiredClickHandler = clickHandler as null | (() => void | Promise<void>);
    if (wiredClickHandler) {
      await wiredClickHandler();
    }
    await Promise.resolve();
    await Promise.resolve();

    expect(fakeButton.addEventListener).toHaveBeenCalledTimes(1);
    expect(alert).toHaveBeenCalledWith("Echec generation PDF: printer offline");
    expect(errorSpy).toHaveBeenCalled();
    expect(fakeButton.disabled).toBe(false);
    expect(fakeButton.textContent).toBe("Telecharger PDF");
  });

  it("falls back to window.onload without alert when alert is unavailable", async () => {
    let clickHandler: null | (() => void) = null;
    const reportDoc = document.implementation.createHTMLDocument("portfolio");
    const fakeButton = {
      disabled: false,
      textContent: "Telecharger PDF",
      addEventListener: vi.fn((_event: string, handler: () => void) => {
        clickHandler = handler;
      }),
    };
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    pdfModuleMocks.downloadPortfolioPdf.mockRejectedValueOnce(new Error("silent fail"));
    const fakeWindow = {
      document: Object.assign(reportDoc, {
        open: vi.fn(),
        write: vi.fn(),
        close: vi.fn(),
        getElementById: vi.fn(() => fakeButton),
      }),
      onload: null as null | (() => void),
    };
    vi.spyOn(window, "open").mockReturnValue(fakeWindow as unknown as Window);

    exportPortfolioPrintReport(baseArgs());
    fakeWindow.onload?.();
    const wiredClickHandler = clickHandler as null | (() => void | Promise<void>);
    if (wiredClickHandler) {
      await wiredClickHandler();
    }
    await Promise.resolve();
    await Promise.resolve();

    expect(errorSpy).toHaveBeenCalled();
    expect(fakeButton.disabled).toBe(false);
    expect(fakeButton.textContent).toBe("Telecharger PDF");
  });

  it("stringifies non-Error PDF failures", async () => {
    let clickHandler: null | (() => void) = null;
    const reportDoc = document.implementation.createHTMLDocument("portfolio");
    const fakeButton = {
      disabled: false,
      textContent: "Telecharger PDF",
      addEventListener: vi.fn((_event: string, handler: () => void) => {
        clickHandler = handler;
      }),
    };
    const alert = vi.fn();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    pdfModuleMocks.downloadPortfolioPdf.mockRejectedValueOnce("raw failure");
    const fakeWindow = {
      document: Object.assign(reportDoc, {
        open: vi.fn(),
        write: vi.fn(),
        close: vi.fn(),
        getElementById: vi.fn(() => fakeButton),
      }),
      onload: null as null | (() => void),
      alert,
    };
    vi.spyOn(window, "open").mockReturnValue(fakeWindow as unknown as Window);

    exportPortfolioPrintReport(baseArgs());
    fakeWindow.onload?.();
    const wiredClickHandler = clickHandler as null | (() => void | Promise<void>);
    if (wiredClickHandler) {
      await wiredClickHandler();
    }
    await Promise.resolve();
    await Promise.resolve();

    expect(alert).toHaveBeenCalledWith("Echec generation PDF: raw failure");
    expect(errorSpy).toHaveBeenCalled();
  });
});
