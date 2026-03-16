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
    alignmentRate: 80,
    includedTeams: ["Team A", "Team B"],
    scenarios: [
      {
        label: "Optimiste" as const,
        hypothesis: "hyp optimistic",
        samples: [3, 4, 5],
        weeklyData: [
          { week: "2026-01-01", throughput: 3 },
          { week: "2026-01-08", throughput: 4 },
        ],
        percentiles: { P50: 10, P70: 12, P90: 15 },
        riskScore: 0.2,
        riskLegend: "fiable" as const,
        distribution: [{ x: 10, count: 10 }],
        throughputReliability: { cv: 0.22, iqr_ratio: 0.3, slope_norm: -0.02, label: "fiable" as const, samples_count: 8 },
      },
      {
        label: "Arrime (80%)" as const,
        hypothesis: "hyp aligned",
        samples: [2, 3, 4],
        weeklyData: [
          { week: "2026-01-01", throughput: 2 },
          { week: "2026-01-08", throughput: 3 },
        ],
        percentiles: { P50: 8, P70: 10, P90: 12 },
        riskScore: 0.25,
        riskLegend: "incertain" as const,
        distribution: [{ x: 8, count: 10 }],
        throughputReliability: { cv: 0.51, iqr_ratio: 0.55, slope_norm: -0.03, label: "incertain" as const, samples_count: 8 },
      },
      {
        label: "Friction (64%)" as const,
        hypothesis: "hyp friction",
        samples: [1.5, 2, 2.5],
        weeklyData: [
          { week: "2026-01-01", throughput: 1.5 },
          { week: "2026-01-08", throughput: 2 },
        ],
        percentiles: { P50: 7, P70: 8, P90: 10 },
        riskScore: 0.28,
        riskLegend: "incertain" as const,
        distribution: [{ x: 7, count: 10 }],
        throughputReliability: { cv: 1.01, iqr_ratio: 0.7, slope_norm: -0.11, label: "fragile" as const, samples_count: 8 },
      },
      {
        label: "Conservateur" as const,
        hypothesis: "hyp conservative",
        samples: [1, 2, 3],
        weeklyData: [
          { week: "2026-01-01", throughput: 1 },
          { week: "2026-01-08", throughput: 2 },
        ],
        percentiles: { P50: 6, P70: 7, P90: 9 },
        riskScore: 0.3,
        riskLegend: "incertain" as const,
        distribution: [{ x: 6, count: 10 }],
        throughputReliability: { cv: 1.6, iqr_ratio: 1.2, slope_norm: -0.2, label: "non fiable" as const, samples_count: 5 },
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
        types: ["Bug"],
        doneStates: ["Done"],
        resultKind: "weeks" as const,
        riskScore: 0.3,
        throughputReliability: { cv: 0.62, iqr_ratio: 0.55, slope_norm: -0.07, label: "incertain" as const, samples_count: 10 },
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
    expect(writtenHtml).toMatch(/Simulation Portefeuille - Team A[\s\S]*?<b>Tickets:<\/b> Bug/);
    expect(writtenHtml).toMatch(/Simulation Portefeuille - Team A[\s\S]*?<b>Etats:<\/b> Done/);
    expect(writtenHtml).toMatch(/Simulation Portefeuille - Team A[\s\S]*?<h2 class="diagnostic-title">Diagnostic<\/h2>/);
    expect(writtenHtml).toMatch(/Simulation Portefeuille - Team A[\s\S]*?<b>Lecture:<\/b> Throughput en baisse sur les dernieres semaines\./);
    expect(writtenHtml).toMatch(/Simulation Portefeuille - Team A[\s\S]*?<section class="kpis">[\s\S]*?P50[\s\S]*?P70[\s\S]*?P90/);
    expect(writtenHtml).toMatch(/Simulation Portefeuille - Team A[\s\S]*?<section class="kpis">[\s\S]*?Risk Score[\s\S]*?Fiabilite/);
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
    expect(writtenHtml).toContain("0,22 (fiable)");
    expect(writtenHtml).toContain("1,60 (non fiable)");
    expect(writtenHtml).toContain("<th>Fiabilité</th>");
    expect(writtenHtml).not.toContain("Fiabilité historique");
    expect(writtenHtml).toContain('<col class="summary-col summary-col--reliability" />');
    expect(writtenHtml).toContain(".summary-table { width: 100%; border-collapse: collapse; font-size: 10px; table-layout: fixed; }");
    expect(writtenHtml).toContain(".summary-table--compact .summary-col--reliability { width: 26%; }");
    expect(writtenHtml).toContain("Courbes de probabilités comparées");
    expect(writtenHtml).toContain('aria-label="Comparaison des probabilites"');
    expect(writtenHtml).toContain("<strong>Optimiste :</strong>");
    expect(writtenHtml).toContain("<strong>Arrimé :</strong>");
    expect(writtenHtml).toContain("<strong>Friction (64%) :</strong>");
    expect(writtenHtml).toContain("<strong>Risk Score :</strong>");
    expect(writtenHtml).toContain("<strong>Fiabilité de l&#39;historique :</strong>");
    expect(writtenHtml).toContain('<p class="hypothesis reading-rule"><strong>Règle de lecture :</strong><br />');
    expect(writtenHtml).toContain("Commencer par la fiabilité de l&#39;historique");
    expect(writtenHtml).toContain("<strong>Risk Score :</strong>");
    expect(writtenHtml).toContain("(P90 - P50) / P50");
    expect(writtenHtml).not.toContain("Throughput hebdomadaire");
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
    expect(writtenHtml).toContain("Friction (100%) :</strong>");
    expect(writtenHtml).toContain("(100%) de la capacité combinée");
    expect(writtenHtml).toContain("<strong>Risk Score :</strong>");
    expect(writtenHtml).toContain("(P90 - P50) / P50");
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

  it("renders reliability summary branches and team metadata fallbacks", () => {
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
        selectedTeam: "Team Short",
        types: undefined,
        doneStates: undefined,
        throughputReliability: { cv: 0.21, iqr_ratio: 0.31, slope_norm: 0, label: "fiable", samples_count: 5 },
      },
      {
        ...args.sections[0],
        selectedTeam: "Team Down",
        throughputReliability: { cv: 0.3, iqr_ratio: 0.25, slope_norm: -0.16, label: "fiable", samples_count: 9 },
      },
      {
        ...args.sections[0],
        selectedTeam: "Team Up",
        throughputReliability: { cv: 0.33, iqr_ratio: 0.28, slope_norm: 0.12, label: "fiable", samples_count: 9 },
      },
      {
        ...args.sections[0],
        selectedTeam: "Team Slight Up",
        throughputReliability: { cv: 0.34, iqr_ratio: 0.29, slope_norm: 0.06, label: "fiable", samples_count: 9 },
      },
      {
        ...args.sections[0],
        selectedTeam: "Team Spread",
        throughputReliability: { cv: 1.2, iqr_ratio: 0.4, slope_norm: 0, label: "non fiable", samples_count: 9 },
      },
      {
        ...args.sections[0],
        selectedTeam: "Team Limited",
        throughputReliability: { cv: 0.41, iqr_ratio: 0.39, slope_norm: 0, label: "incertain", samples_count: 7 },
      },
      {
        ...args.sections[0],
        selectedTeam: "Team Missing",
        throughputReliability: undefined,
      },
    ];
    args.scenarios[0] = {
      ...args.scenarios[0],
      throughputReliability: undefined,
    };

    exportPortfolioPrintReport(args);

    expect(writtenHtml).toContain("<td>Non disponible</td>");
    expect(writtenHtml).toMatch(/Simulation Portefeuille - Team Short[\s\S]*?<b>Tickets:<\/b> Agr.g. portefeuille/);
    expect(writtenHtml).toMatch(/Simulation Portefeuille - Team Short[\s\S]*?<b>Etats:<\/b> Agr.g. portefeuille/);
    expect(writtenHtml).toMatch(/Simulation Portefeuille - Team Short[\s\S]*?<b>Lecture:<\/b> Historique trop court pour projeter avec confiance\./);
    expect(writtenHtml).toMatch(/Simulation Portefeuille - Team Down[\s\S]*?<b>Lecture:<\/b> Throughput en forte baisse sur les dernieres semaines\./);
    expect(writtenHtml).toMatch(/Simulation Portefeuille - Team Up[\s\S]*?<b>Lecture:<\/b> Throughput en forte hausse sur les dernieres semaines\./);
    expect(writtenHtml).toMatch(/Simulation Portefeuille - Team Slight Up[\s\S]*?<b>Lecture:<\/b> Throughput en hausse sur les dernieres semaines\./);
    expect(writtenHtml).toMatch(/Simulation Portefeuille - Team Spread[\s\S]*?<b>Lecture:<\/b> Dispersion elevee du throughput historique\./);
    expect(writtenHtml).toMatch(/Simulation Portefeuille - Team Limited[\s\S]*?<b>Lecture:<\/b> Volume historique encore limite\./);
    expect(writtenHtml).toMatch(/Simulation Portefeuille - Team Missing[\s\S]*?<b>Lecture:<\/b> Non disponible/);
    expect(writtenHtml).toMatch(/Simulation Portefeuille - Team Missing[\s\S]*?<span class="kpi-value">Non disponible<\/span>/);
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

    expect(pdfModuleMocks.downloadPortfolioPdf).toHaveBeenCalledWith(fakeWindow.document, "Projet A", false);
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

  it("handles successful PDF export when download button is absent", async () => {
    const reportDoc = document.implementation.createHTMLDocument("portfolio");
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

    exportPortfolioPrintReport(baseArgs());
    const loadHandler = fakeWindow.addEventListener.mock.calls[0]?.[1];
    loadHandler?.();
    const popup = fakeWindow as unknown as Window & { __downloadPdf?: () => void | Promise<void> };
    await popup.__downloadPdf?.();
    await Promise.resolve();
    await Promise.resolve();

    expect(pdfModuleMocks.downloadPortfolioPdf).toHaveBeenCalledWith(fakeWindow.document, "Projet A", false);
  });

  it("passes the demo flag to the PDF export when requested", async () => {
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

    exportPortfolioPrintReport({ ...baseArgs(), isDemo: true });
    const loadHandler = fakeWindow.addEventListener.mock.calls[0]?.[1];
    loadHandler?.();
    await (clickHandler as (() => void | Promise<void>) | null)?.();
    await Promise.resolve();
    await Promise.resolve();

    expect(pdfModuleMocks.downloadPortfolioPdf).toHaveBeenCalledWith(fakeWindow.document, "Projet A", true);
  });

  it("escapes html-sensitive values in generated pages", () => {
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
    args.selectedProject = `Projet <A> & "B"`;
    args.scenarios[0] = {
      ...args.scenarios[0],
      hypothesis: `hyp <unsafe> & "quoted"`,
      label: "Optimiste",
    };
    args.sections[0] = {
      ...args.sections[0],
      selectedTeam: "Team <One>",
      types: [`Bug & Story`, `Feature "A"`],
      doneStates: [`Done <ok>`],
    };

    exportPortfolioPrintReport(args);

    expect(writtenHtml).toContain("Projet &lt;A&gt; &amp; &quot;B&quot;");
    expect(writtenHtml).toContain("hyp &lt;unsafe&gt; &amp; &quot;quoted&quot;");
    expect(writtenHtml).toContain("Team &lt;One&gt;");
    expect(writtenHtml).toContain("Bug &amp; Story, Feature &quot;A&quot;");
    expect(writtenHtml).toContain("Done &lt;ok&gt;");
  });

  it("normalizes invalid scenario risk scores in summary rows", () => {
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
    args.scenarios = [
      { ...args.scenarios[0], label: "Optimiste", riskScore: Number.POSITIVE_INFINITY },
      { ...args.scenarios[1], label: "Arrime (80%)", riskScore: -0.4 },
      { ...args.scenarios[2], label: "Friction (64%)", riskScore: 0.7 },
      { ...args.scenarios[3], label: "Conservateur", riskScore: 0.95 },
    ];

    exportPortfolioPrintReport(args);

    expect(writtenHtml).toMatch(/Optimiste[\s\S]*?0,00 \(fiable\)/);
    expect(writtenHtml).toMatch(/Arrim. \(80%\)[\s\S]*?0,00 \(fiable\)/);
  });
});
