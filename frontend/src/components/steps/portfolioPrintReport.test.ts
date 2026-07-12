import { afterEach, describe, expect, it, vi } from "vitest";
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

import { buildPortfolioPrintReportHtml, exportPortfolioPrintReport } from "./portfolioPrintReport";

type PortfolioPrintReportArgs = Parameters<typeof buildPortfolioPrintReportHtml>[0];

function baseArgs(): PortfolioPrintReportArgs {
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
        seed: 101,
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
        seed: 102,
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
        label: "Friction (80%)" as const,
        hypothesis: "hyp friction",
        seed: 103,
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
        label: "Historique corr\u00E9l\u00E9" as const,
        hypothesis: "hyp correlated",
        seed: 104,
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
        seed: 201,
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

describe("portfolioPrintReport", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    pdfModuleMocks.downloadPortfolioPdf.mockReset();
    pdfModuleMocks.downloadPortfolioPdf.mockResolvedValue(undefined);
  });

  it("renders synthesis, scenarios and team pages in expected order", () => {
    const html = buildPortfolioPrintReportHtml(baseArgs());

    const idxSynth = html.indexOf("SynthÃƒÂ¨se - Simulation Portefeuille");
    const idxOpt = html.search(/Sc.nario - Optimiste/);
    const idxArr = html.search(/Sc.nario - Arrim./);
    const idxFriction = html.search(/Sc.nario - Friction \(80%\)/);
    const idxCons = html.search(/Sc.nario - Historique corr.l./);
    const idxTeam = html.indexOf("Simulation Portefeuille - Team A");

    expect(idxSynth).toBeLessThan(idxOpt);
    expect(idxOpt).toBeLessThan(idxArr);
    expect(idxArr).toBeLessThan(idxFriction);
    expect(idxFriction).toBeLessThan(idxCons);
    expect(idxCons).toBeLessThan(idxTeam);
    expect(html).toMatch(/Simulation Portefeuille - Team A[\s\S]*?<b>Tickets:<\/b> Bug/);
    expect(html).toMatch(/Simulation Portefeuille - Team A[\s\S]*?<b>Etats:<\/b> Done/);
    expect(html).toMatch(/Simulation Portefeuille - Team A[\s\S]*?<b>Lecture:<\/b> Throughput en baisse sur les dernieres semaines\./);
    expect(html).not.toContain('id="download-pdf"');
  });

  it("includes synthesis content, overlay SVG and reading rule", () => {
    const html = buildPortfolioPrintReportHtml(baseArgs());

    expect(html).toContain("<td>Optimiste</td>");
    expect(html).toMatch(/<td>Arrim. \(80%\)<\/td>/);
    expect(html).toContain("<td>Friction (80%)</td>");
    expect(html).toMatch(/<td>Historique corr.l.<\/td>/);
    expect(html).toContain("0,22 (fiable)");
    expect(html).toContain("1,60 (non fiable)");
    expect(html).toMatch(/Courbes de probabilit.s compar.es/);
    expect(html).toMatch(/aria-label="Courbes de probabilit.s compar.es"/);
    expect(html).toContain("<strong>Optimiste :</strong>");
    expect(html).toMatch(/<strong>Arrim. :<\/strong>/);
    expect(html).toContain("<strong>Risk Score :</strong>");
    expect(html).toMatch(/<strong>Fiabilit. de l&#39;historique :<\/strong>/);
    expect(html).toMatch(/<p class="hypothesis reading-rule"><strong>R.gle de lecture :<\/strong><br \/>/);
  });

  it("keeps every portfolio chart title aligned with its rendered data", () => {
    const html = buildPortfolioPrintReportHtml(baseArgs());

    expect(html).toMatch(/Sc.nario - Optimiste[\s\S]*?<h2>D.bit simul. du sc.nario<\/h2>[\s\S]*?aria-label="D.bit simul. du sc.nario"/);
    expect(html).toMatch(/Sc.nario - Historique corr.l.[\s\S]*?<h2>Throughput historique corr.l.<\/h2>[\s\S]*?aria-label="Throughput historique corr.l."/);
    expect(html).toMatch(/Simulation Portefeuille - Team A[\s\S]*?<h2>Throughput hebdomadaire<\/h2>[\s\S]*?aria-label="Throughput hebdomadaire"/);
    expect(html.match(/<h2>Courbes de probabilit.s compar.es<\/h2>/g)).toHaveLength(1);
    expect(html.match(/aria-label="Courbes de probabilit.s compar.es"/g)).toHaveLength(1);
    expect(html).toMatch(/D.bit synth.tique reconstruit par bootstrap, non issu de l&#39;historique r.el\./);
    expect(html).toContain('<h2>Distribution Monte Carlo</h2>');
    expect(html).toContain('aria-label="Distribution Monte Carlo"');
    expect(html).toMatch(/<h2>Courbe de probabilit.<\/h2>/);
    expect(html).toMatch(/aria-label="Courbe de probabilit."/);
  });

  it("renders a plain scenario subtitle when no lead prefix is detected", () => {
    const args = baseArgs();
    args.scenarios[0] = {
      ...args.scenarios[0],
      hypothesis: "Observed common slowdowns remained visible in the shared history.",
    };

    const html = buildPortfolioPrintReportHtml(args);

    expect(html).toContain("<div class=\"subtitle\"><i>Observed common slowdowns remained visible in the shared history.</i></div>");
  });

  it("uses business percentiles in weeks_to_items mode for scenario risk score", () => {
    const args: ReturnType<typeof baseArgs> = baseArgs();
    args.sections[0].simulationMode = "weeks_to_items";
    args.scenarios[0] = {
      ...args.scenarios[0],
      percentiles: { P50: 24, P70: 22, P90: 18 },
      distribution: [
        { x: 10, count: 10 },
        { x: 20, count: 80 },
        { x: 30, count: 10 },
      ],
    };

    const html = buildPortfolioPrintReportHtml(args);
    const expectedRisk = computeRiskScoreFromPercentiles("weeks_to_items", args.scenarios[0].percentiles);

    expect(html).toMatch(
      new RegExp(
        `Optimiste[\\s\\S]*?<td>${Number(args.scenarios[0].percentiles.P50 ?? 0).toFixed(0)}</td>\\s*<td>${Number(args.scenarios[0].percentiles.P70 ?? 0).toFixed(0)}</td>\\s*<td>${Number(args.scenarios[0].percentiles.P90 ?? 0).toFixed(0)}</td>`,
      ),
    );
    expect(html).toContain(expectedRisk?.toFixed(2).replace(".", ",") ?? "");
  });

  it("documents the weeks_to_items risk formula in the synthesis", () => {
    const args = baseArgs();
    args.sections[0].simulationMode = "weeks_to_items";

    const html = buildPortfolioPrintReportHtml(args);

    expect(html).toContain("(P50 - P90) / P50.");
  });

  it("falls back to computed risk score when a team page has no finite risk score", () => {
    const args = baseArgs();
    args.sections[0] = {
      ...args.sections[0],
      riskScore: Number.NaN,
      displayPercentiles: { P50: 10, P70: 14, P90: 19 },
    };

    const html = buildPortfolioPrintReportHtml(args);
    const expectedRisk = computeRiskScoreFromPercentiles("backlog_to_weeks", args.sections[0].displayPercentiles);

    expect(html).toContain(expectedRisk?.toFixed(2).replace(".", ",") ?? "");
  });

  it("builds a minimal report when sections and scenarios are empty", () => {
    const html = buildPortfolioPrintReportHtml({
      ...baseArgs(),
      includedTeams: [],
      sections: [],
      scenarios: [],
    });

    expect(html).toMatch(/Synth.se - Simulation Portefeuille/);
    expect(html).toMatch(/<b>.quipes incluses:<\/b> Aucune/);
    expect(html).not.toMatch(/Sc.nario - /);
    expect(html).not.toContain("Simulation Portefeuille - Team A");
  });

  it("falls back to the real friction label computed from the team count", () => {
    const args = baseArgs();
    args.includedTeams = ["Team A", "Team B", "Team C"];
    args.scenarios = [args.scenarios[0], args.scenarios[1], args.scenarios[3]];

    const html = buildPortfolioPrintReportHtml(args);

    expect(html).toContain("<strong>Friction (64%) :</strong>");
    expect(html).toContain("64%) de la capacit");
  });

  it("uses fallback section arrays when types and states are absent", () => {
    const args = baseArgs();
    args.sections[0] = {
      ...args.sections[0],
      types: undefined as unknown as string[],
      doneStates: undefined as unknown as string[],
    };

    const html = buildPortfolioPrintReportHtml(args);

    expect(html).toMatch(/Simulation Portefeuille - Team A[\s\S]*?<b>Tickets:<\/b> Agr/);
    expect(html).toMatch(/Simulation Portefeuille - Team A[\s\S]*?<b>Etats:<\/b> Agr/);
  });

  it("renders team-page fallbacks when zero weeks are excluded and metrics are missing", () => {
    const args = baseArgs();
    args.sections[0] = {
      ...args.sections[0],
      includeZeroWeeks: false,
      throughputReliability: null,
      displayPercentiles: undefined as unknown as Record<string, number>,
      weeklyThroughput: [
        { week: "2026-01-01", throughput: 3 },
        { week: "2026-01-08", throughput: 0 },
      ],
    };

    const html = buildPortfolioPrintReportHtml(args);

    expect(html).toContain("Semaines 0 exclues");
    expect(html).toContain("Non disponible");
    expect(html).toContain("<b>CV:</b> 0,00");
    expect(html).toMatch(/Simulation Portefeuille - Team A[\s\S]*?<section class="kpis">\s*<\/section>/);
  });

  it("renders summary-page fallbacks when scenario risk scores and section defaults are missing", () => {
    const html = buildPortfolioPrintReportHtml({
      ...baseArgs(),
      sections: [],
      scenarios: [
        {
          label: "Optimiste",
          hypothesis: "hyp optimistic",
          seed: 301,
          samples: [3, 4, 5],
          weeklyData: [{ week: "2026-01-01", throughput: 3 }],
          percentiles: {} as Record<string, number>,
          riskScore: undefined,
          riskLegend: "fiable",
          distribution: [],
          throughputReliability: null,
        },
        {
          label: "Historique corr\u00E9l\u00E9",
          hypothesis: "hyp correlated",
          seed: 302,
          samples: [1, 2, 3],
          weeklyData: [{ week: "2026-01-01", throughput: 1 }],
          percentiles: {} as Record<string, number>,
          riskScore: Number.NaN,
          riskLegend: "incertain",
          distribution: [],
          throughputReliability: null,
        },
      ],
    });

    expect(html).toContain("backlog: 0 items");
    expect(html).toContain("<td>0</td>");
    expect(html).not.toContain("0,00 (fiable)");
  });

  it("explains censures on team-like backlog pages", () => {
    const args = baseArgs();
    args.sections[0] = {
      ...args.sections[0],
      displayPercentiles: { P50: 12 },
      completionSummary: {
        completed_count: 4,
        censored_count: 6,
        censored_rate: 0.6,
        horizon_weeks: 521,
      },
    };

    const html = buildPortfolioPrintReportHtml(args);

    expect(html).toContain("Limite d'horizon:");
    expect(html).toContain("6 sur 10 (0,60)");
    expect(html).toContain("Un percentile absent n'est pas identifiable avant l'horizon.");
  });

  it("exports directly to PDF from a detached document", async () => {
    const openSpy = vi.spyOn(window, "open");

    await exportPortfolioPrintReport(baseArgs());

    expect(openSpy).not.toHaveBeenCalled();
    expect(pdfModuleMocks.downloadPortfolioPdf).toHaveBeenCalledTimes(1);
    expect(pdfModuleMocks.downloadPortfolioPdf).toHaveBeenCalledWith(expect.any(Document), "Projet A", undefined);
  });

  it("passes the demo flag through the direct export path", async () => {
    await exportPortfolioPrintReport({ ...baseArgs(), isDemo: true });
    expect(pdfModuleMocks.downloadPortfolioPdf).toHaveBeenCalledWith(expect.any(Document), "Projet A", true);
  });

  it("alerts and rethrows when direct PDF generation fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => undefined);
    pdfModuleMocks.downloadPortfolioPdf.mockRejectedValueOnce(new Error("printer offline"));

    await expect(exportPortfolioPrintReport(baseArgs())).rejects.toThrow("printer offline");

    expect(errorSpy).toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith("Echec generation PDF: printer offline");
  });

  it("rethrows raw failures without alert support", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const originalAlert = window.alert;
    Object.defineProperty(window, "alert", { value: undefined, configurable: true });
    pdfModuleMocks.downloadPortfolioPdf.mockRejectedValueOnce("raw failure");

    await expect(exportPortfolioPrintReport(baseArgs())).rejects.toBe("raw failure");

    expect(errorSpy).toHaveBeenCalled();
    Object.defineProperty(window, "alert", { value: originalAlert, configurable: true });
  });
});



