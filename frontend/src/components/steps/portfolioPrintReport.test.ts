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
import { buildDecisionLanguage } from "../../utils/decisionLanguage";
import type { PortfolioComparisonDiagnostic } from "../../utils/portfolioComparisonDiagnostic";
import { presentPortfolioComparisonDiagnostic } from "../../utils/portfolioComparisonPresentation";

type PortfolioPrintReportArgs = Parameters<typeof buildPortfolioPrintReportHtml>[0];

function scenarioDiagnostic(level: "supportable" | "caution" | "arbitration_required" | "not_recommended") {
  const dataQualityLevel = level === "not_recommended" ? "insufficient" : level === "arbitration_required" ? "watch" : "sufficient";
  const uncertaintyLevel = level === "supportable" ? "low" : level === "not_recommended" ? "unmeasurable" : "high";
  const factors = level === "arbitration_required"
    ? [
        { source: "dataQuality" as const, code: "partial_ado_data", description: "Données partielles" },
        { source: "forecastUncertainty" as const, code: "forecast_percentile_spread", description: "Dispersion élevée" },
      ]
    : level === "caution"
      ? [{ source: "forecastUncertainty" as const, code: "forecast_percentile_spread", description: "Dispersion élevée" }]
      : [];

  return buildDecisionLanguage({
    dataQuality: { level: dataQualityLevel, justification: "Qualité issue des données du scénario.", factors: [] },
    forecastUncertainty: { level: uncertaintyLevel, justification: "Incertitude issue des percentiles du scénario.", factors: [] },
    decisionRecommendation: {
      level,
      justification: `Justification ${level}.`,
      advisedAction: `Action ${level}.`,
      factors,
    },
  });
}

function formatScenarioLabelForTest(label: string): string {
  if (label === "Optimiste") return "Indépendant";
  return label.startsWith("Arrime") ? label.replace("Arrime", "Arrimé") : label;
}

function htmlTextForScenario(report: Document, label: string): string {
  return Array.from(report.querySelectorAll<HTMLElement>(".page")).find(
    (page) => page.querySelector("h1")?.textContent === `Scénario - ${label}`,
  )?.textContent ?? "";
}

function comparisonDiagnosticFixture(overrides: Partial<PortfolioComparisonDiagnostic> = {}): PortfolioComparisonDiagnostic {
  return {
    historicalData: { quality: "fragile", observedFacts: [], teamFindings: [] },
    simulationStability: [],
    hypothesisCredibility: [
      { hypothesis: "independent", evidenceType: "unsupported", evidence: "Tirages synthétiques : l’indépendance est modélisée, pas observée.", limitations: ["Une simulation stable ne valide pas cette hypothèse."] },
      { hypothesis: "aligned", evidenceType: "user_input", evidence: "Le coefficient d’alignement est saisi par l’utilisateur.", limitations: ["Le paramètre n’est pas un fait démontré."] },
      { hypothesis: "friction", evidenceType: "calculated", evidence: "Le coefficient de friction est calculé à partir du paramètre saisi.", limitations: ["Le calcul n’est pas une observation historique."] },
      { hypothesis: "correlated", evidenceType: "observed", evidence: "Des semaines historiques communes ont été observées.", limitations: ["Ce caractère observé ne suffit pas à recommander automatiquement ce scénario."] },
    ],
    significantRisks: [{ kind: "team_history", teamNames: ["Atlas"], statement: "L’équipe Atlas présente un historique fragile : fait à vérifier au niveau portefeuille." }],
    comparisonConfidence: { level: "insufficient", statement: "Les éléments disponibles ne suffisent pas à départager la crédibilité future des hypothèses." },
    preferredScenario: null,
    conclusion: "Preuves insuffisantes pour privilégier une hypothèse.",
    ...overrides,
  };
}

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
        decisionDiagnostic: scenarioDiagnostic("caution"),
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
        decisionDiagnostic: scenarioDiagnostic("arbitration_required"),
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
        decisionDiagnostic: scenarioDiagnostic("not_recommended"),
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
        decisionDiagnostic: scenarioDiagnostic("supportable"),
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
    portfolioComparisonDiagnostic: comparisonDiagnosticFixture(),
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

    const idxSynth = html.indexOf("Synth\u00E8se - Simulation Portefeuille");
    const idxOpt = html.search(/Sc.nario - Ind.pendant/);
    const idxArr = html.search(/Sc.nario - Arrim./);
    const idxFriction = html.search(/Sc.nario - Friction \(80%\)/);
    const idxCons = html.search(/Sc.nario - Historique corr.l./);
    const idxTeam = html.indexOf("Simulation Portefeuille - Team A");

    expect(idxSynth).toBeLessThan(idxOpt);
    expect(html.indexOf("Comparaison des hypothèses")).toBeGreaterThan(idxSynth);
    expect(html.indexOf("Comparaison des hypothèses")).toBeLessThan(idxOpt);
    expect(idxOpt).toBeLessThan(idxArr);
    expect(idxArr).toBeLessThan(idxFriction);
    expect(idxFriction).toBeLessThan(idxCons);
    expect(idxCons).toBeLessThan(idxTeam);
    expect(html).toMatch(/Simulation Portefeuille - Team A[\s\S]*?<b>Tickets:<\/b> Bug/);
    expect(html).toMatch(/Simulation Portefeuille - Team A[\s\S]*?<b>États:<\/b> Done/);
    expect(html).toMatch(/Simulation Portefeuille - Team A[\s\S]*?<b>Lecture:<\/b> Throughput en baisse sur les dernières semaines\./);
    expect(html).not.toContain('id="download-pdf"');
  });

  it("includes synthesis content, overlay SVG and reading rule", () => {
    const html = buildPortfolioPrintReportHtml(baseArgs());

    expect(html).toContain("<td>Indépendant</td>");
    expect(html).toMatch(/<td>Arrim. \(80%\)<\/td>/);
    expect(html).toContain("<td>Friction (80%)</td>");
    expect(html).toMatch(/<td>Historique corr.l.<\/td>/);
    expect(html).toMatch(/Courbes de probabilit.s compar.es/);
    expect(html).toMatch(/aria-label="Courbes de probabilit.s compar.es"/);
    expect(html).toContain("<strong>Indépendant :</strong>");
    expect(html).toMatch(/<strong>Arrim. :<\/strong>/);
    expect(html).toContain("<strong>Risk Score :</strong>");
    expect(html).toMatch(/<strong>Fiabilit. de l&#39;historique :<\/strong>/);
    expect(html).toMatch(/<p class="hypothesis reading-rule"><strong>R.gle de lecture :<\/strong><br \/>/);
  });

  it("uses the unified Independent label and the exposed P90 percentile everywhere", () => {
    const report = new DOMParser().parseFromString(buildPortfolioPrintReportHtml(baseArgs()), "text/html");
    const text = report.body.textContent ?? "";

    expect(text).toContain("Indépendant");
    expect(text).not.toContain("Optimiste");
    expect(text).toContain("P90");
    expect(text).not.toContain("P85");
  });

  it("renders the complete comparative diagnosis in the PDF and no preferred scenario", () => {
    const args = baseArgs();
    const diagnostic = args.portfolioComparisonDiagnostic!;
    const presentation = presentPortfolioComparisonDiagnostic(diagnostic);
    const report = new DOMParser().parseFromString(buildPortfolioPrintReportHtml(args), "text/html");
    const comparison = Array.from(report.querySelectorAll<HTMLElement>(".comparison-page")).at(0);
    const text = comparison?.textContent ?? "";

    expect(text).toContain(presentation.conclusion);
    expect(text).toContain(presentation.comparisonConfidence);
    expect(text).toContain("Aucune recommandation de scénario issue des preuves disponibles.");
    expect(text).toContain("Ne pas privilégier automatiquement un scénario.");
    expect(text).toContain("Référence de pilotageNon définie");
    expect(text).not.toMatch(/scénario recommandé par les preuves/i);
    presentation.scenarioCredibilities.forEach((hypothesis) => {
      expect(text).toContain(hypothesis.label);
      expect(text).toContain(hypothesis.evidenceTypeLabel);
      expect(text).toContain(hypothesis.evidence);
    });
    expect(text).toContain("Tirages synthétiques");
    expect(text).toContain("pas observée");
    expect(text).toContain("ne suffit pas à recommander automatiquement");
    expect(text).toContain("L’équipe Atlas présente un historique fragile");
    expect(text).toContain("La régularité des résultats simulés ne valide pas une hypothèse de portefeuille.");
    expect(text).not.toMatch(/se compensent|sont substituables|provoque|cause/i);
    expect(htmlTextForScenario(report, "Historique corrélé")).toContain("ne valide ni la crédibilité future du scénario");
  });

  it("renders a domain-provided preference as the evidence recommendation", () => {
    const args = baseArgs();
    args.portfolioComparisonDiagnostic = comparisonDiagnosticFixture({ preferredScenario: "correlated" });

    const comparisonText = new DOMParser()
      .parseFromString(buildPortfolioPrintReportHtml(args), "text/html")
      .querySelector<HTMLElement>(".comparison-page")?.textContent ?? "";

    expect(comparisonText).toContain("Scénario recommandé par les preuves : Historique corrélé.");
    expect(comparisonText).not.toContain("Ne pas privilégier automatiquement un scénario.");
  });

  it.each([
    ["independent", "Indépendant"],
    ["aligned", "Arrimé"],
    ["friction", "Friction"],
    ["correlated", "Historique corrélé"],
  ] as const)("keeps the user pilot reference %s separate from evidence", (pilotReference, expectedLabel) => {
    const args = baseArgs();
    args.pilotReference = pilotReference;
    const comparisonText = new DOMParser()
      .parseFromString(buildPortfolioPrintReportHtml(args), "text/html")
      .querySelector<HTMLElement>(".comparison-page")?.textContent ?? "";

    expect(args.portfolioComparisonDiagnostic?.preferredScenario).toBeNull();
    expect(comparisonText).toContain(`Référence de pilotage${expectedLabel}`);
    expect(comparisonText).toContain("Choix de gouvernance utilisé comme convention de pilotage");
    expect(comparisonText).toContain("Aucune recommandation de scénario issue des preuves disponibles.");
    if (pilotReference === "correlated") {
      expect(comparisonText).not.toMatch(/Historique corrélé[^.]{0,80}(?:recommandé|validé|fiable)/i);
    }
  });

  it("keeps scenario pages free of simulated-source diagnostics while preserving real-team diagnostics", () => {
    const report = new DOMParser().parseFromString(buildPortfolioPrintReportHtml(baseArgs()), "text/html");

    ["Indépendant", "Arrimé (80%)", "Friction (80%)"].forEach((label) => {
      const text = htmlTextForScenario(report, label);
      expect(text).not.toMatch(/Décision appuyée par les données|Données suffisantes|Historique globalement stable|Semaines utilisées|semaines historiques exploitables/i);
      expect(text).not.toContain("Diagnostic décisionnel");
      expect(text).not.toContain("Fiabilité");
    });
    const teamPage = Array.from(report.querySelectorAll<HTMLElement>(".page")).find(
      (page) => page.querySelector("h1")?.textContent === "Simulation Portefeuille - Team A",
    );
    expect(teamPage?.textContent).toContain("Diagnostic");
    expect(teamPage?.textContent).toContain("Fiabilité");
  });

  it("keeps the comparison title with its first block and never creates an empty report page", () => {
    const report = new DOMParser().parseFromString(buildPortfolioPrintReportHtml(baseArgs()), "text/html");
    const comparison = report.querySelector<HTMLElement>(".comparison-page");

    expect(comparison?.querySelector(".comparison-intro h1")?.textContent).toBe("Comparaison des hypothèses");
    expect(comparison?.querySelector(".comparison-intro .comparison-overview")?.textContent).toContain("Conclusion comparative");
    expect(Array.from(report.querySelectorAll<HTMLElement>(".page")).every((page) => (page.textContent ?? "").trim().length > 0)).toBe(true);
    expect(buildPortfolioPrintReportHtml(baseArgs())).toContain(".comparison-intro { break-inside: avoid; page-break-inside: avoid; }");
  });

  it("renders long comparison text and the explicit no-risk state without invalid content", () => {
    const longText = "Limite détaillée ".repeat(80);
    const args = baseArgs();
    args.portfolioComparisonDiagnostic = comparisonDiagnosticFixture({
      significantRisks: [],
      hypothesisCredibility: comparisonDiagnosticFixture().hypothesisCredibility.map((hypothesis) => ({
        ...hypothesis,
        evidence: longText,
        limitations: [longText],
      })),
    });

    const html = buildPortfolioPrintReportHtml(args);

    expect(html).toContain("Aucun risque significatif d’équipe n’est remonté par le diagnostic.");
    expect(html).toContain(longText);
    expect(html).toContain("overflow-wrap: anywhere");
    expect(html).toContain("break-inside: avoid");
    expect(html).not.toMatch(/undefined|null|NaN/);
  });

  it("keeps every synthesis hypothesis below the chart in a compact two-column section", () => {
    const html = buildPortfolioPrintReportHtml(baseArgs());
    const report = new DOMParser().parseFromString(html, "text/html");
    const summaryPage = report.querySelector<HTMLElement>(".page");
    const hypothesisSection = summaryPage?.querySelector<HTMLElement>(".section--hypotheses");
    const columns = Array.from(hypothesisSection?.querySelectorAll<HTMLElement>(".hypothesis-column") ?? []);
    const hypothesisLabels = Array.from(hypothesisSection?.querySelectorAll<HTMLElement>(".hypothesis strong") ?? []).map(
      (element) => element.textContent?.trim() ?? "",
    );
    const hypothesisCss = html.match(/\.section--hypotheses \{[^}]+\}/)?.[0] ?? "";

    expect(summaryPage?.querySelectorAll(".page")).toHaveLength(0);
    expect(summaryPage?.querySelector("h2")?.textContent).toBe("Synthèse décisionnelle");
    expect(summaryPage?.textContent).toContain("Courbes de probabilités comparées");
    expect(columns).toHaveLength(2);
    expect(columns.map((column) => column.querySelectorAll(".hypothesis").length)).toEqual([4, 3]);
    expect(hypothesisLabels).toEqual([
      "Indépendant :",
      "Arrimé :",
      expect.stringMatching(/^Friction/),
      "Historique corrélé :",
      "Risk Score :",
      "Fiabilité de l'historique :",
      "Règle de lecture :",
    ]);
    expect(hypothesisCss).toContain("break-before: auto");
    expect(hypothesisCss).toContain("page-break-before: auto");
    expect(hypothesisCss).toContain("break-inside: auto");
    expect(hypothesisCss).toContain("page-break-inside: auto");
    expect(hypothesisCss).not.toContain("page-break-after");
    expect(html).toContain("@media print");
    expect(html).toContain(".hypothesis-grid { display: block; column-count: 2;");
    expect(html).toMatch(/\.page-break \{ page-break-after: always; \}/);
    expect(html).not.toMatch(/[\u00C3\u00C2\uFFFD]/);
  });

  it("keeps accented portfolio text and lets the synthesis table and decision diagnostic grow naturally", () => {
    const html = buildPortfolioPrintReportHtml(baseArgs());
    const summaryTableCss = html.match(/\.summary-table \{[^}]+\}/)?.[0] ?? "";
    const summaryCellsCss = html.match(/\.summary-table th, \.summary-table td \{[^}]+\}/)?.[0] ?? "";
    const decisionDiagnosticCss = html.match(/\.decision-diagnostic \{[^}]+\}/)?.[0] ?? "";

    expect(html).toContain("Synth\u00E8se d\u00E9cisionnelle");
    expect(html).toContain("Hypoth\u00E8ses");
    expect(html).toContain("Fiabilit\u00E9");
    expect(html).toContain("Historique corr\u00E9l\u00E9");
    expect(html).not.toMatch(/[\u00C3\u00C2\uFFFD]/);
    expect(summaryTableCss).not.toMatch(/(?:^|;)\s*height\s*:/);
    expect(summaryCellsCss).toContain("vertical-align: top");
    expect(summaryCellsCss).toContain("overflow-wrap: anywhere");
    expect(summaryCellsCss).toContain("word-break: break-word");
    expect(decisionDiagnosticCss).not.toMatch(/(?:^|;)\s*height\s*:/);
    expect(decisionDiagnosticCss).not.toMatch(/position\s*:/);
  });

  it("renders a team decision diagnostic only when the available diagnostic is supplied", () => {
    const args = baseArgs();
    const diagnostic = buildDecisionLanguage({
      dataQuality: { level: "sufficient", justification: "Données suffisantes.", factors: [] },
      forecastUncertainty: { level: "moderate", justification: "Incertitude modérée.", factors: [] },
      decisionRecommendation: {
        level: "supportable",
        justification: "Décision étayée.",
        advisedAction: "Confirmer la décision.",
        factors: [],
      },
    });
    args.sections[0] = { ...args.sections[0], decisionDiagnostic: diagnostic };

    const html = buildPortfolioPrintReportHtml(args);

    expect(html).toContain("Diagnostic décisionnel");
    expect(html).toContain(diagnostic.decisionRecommendation.status);
    expect(html).toContain(diagnostic.decisionRecommendation.explanation);
    expect(html).toContain(diagnostic.decisionRecommendation.action);
    expect(html).not.toMatch(/undefined|null|NaN/);
  });

  it("separates team diagnostic justification, usable weeks and action in the printable markup", () => {
    const args = baseArgs();
    args.sections[0] = {
      ...args.sections[0],
      decisionDiagnostic: buildDecisionLanguage({
        dataQuality: {
          level: "watch",
          justification: "Données à consolider.",
          factors: [{ code: "limited_recent_history", description: "Période récente", value: "19 semaines exploitables" }],
        },
        forecastUncertainty: { level: "moderate", justification: "Incertitude modérée.", factors: [] },
        decisionRecommendation: {
          level: "caution",
          justification: "Décision à documenter.",
          advisedAction: "Calibrer les paramètres.",
          factors: [],
        },
      }),
    };

    const report = new DOMParser().parseFromString(buildPortfolioPrintReportHtml(args), "text/html");
    const diagnostic = Array.from(report.querySelectorAll<HTMLElement>(".page")).find(
      (page) => page.querySelector("h1")?.textContent === "Simulation Portefeuille - Team A",
    )?.querySelector<HTMLElement>(".decision-diagnostic");
    const markup = diagnostic?.innerHTML ?? "";

    expect(markup).toContain("Justification métier :");
    expect(markup).toContain("19 semaines exploitables");
    expect(markup).toContain("<br><b>Action conseillée :</b>");
    expect(markup).not.toMatch(/donnéesJustification|19Action conseillée|modérée\.Action/i);
  });

  it("keeps only numerical and risk indicators in the scenario synthesis", () => {
    const args = baseArgs();
    const report = new DOMParser().parseFromString(buildPortfolioPrintReportHtml(args), "text/html");
    const rows = Array.from(report.querySelectorAll<HTMLTableRowElement>(".summary-table tbody tr"));

    expect(rows).toHaveLength(args.scenarios.length);
    rows.forEach((row, index) => {
      const cells = Array.from(row.querySelectorAll("td")).map((cell) => cell.textContent?.trim() ?? "");
      expect(cells).toHaveLength(5);
      expect(cells[0]).toBe(formatScenarioLabelForTest(args.scenarios[index].label));
    });
    expect(report.querySelector("thead")?.textContent).not.toMatch(/Statut|Action|Fiabilité/);
  });

  it("shows historical sensitivity on a team page only when complete comparable data is supplied", () => {
    const args = baseArgs();
    const diagnostic = buildDecisionLanguage({
      dataQuality: { level: "sufficient", justification: "Données suffisantes.", factors: [] },
      forecastUncertainty: { level: "low", justification: "Incertitude faible.", factors: [] },
      decisionRecommendation: {
        level: "caution",
        justification: "Sensibilité historique.",
        advisedAction: "Comparer les périodes.",
        factors: [{ source: "historicalSensitivity", code: "historical_window_sensitivity", description: "Sensibilité historique" }],
      },
      historicalSensitivity: {
        level: "high",
        simulationMode: "backlog_to_weeks",
        comparedSimulations: [],
        p90Minimum: 10,
        p90Maximum: 15,
        absoluteGap: 5,
        relativeGap: 0.5,
        recentChangeRate: -0.2,
        recentWindow: { id: "recent", startDate: "2026-02-01", endDate: "2026-03-01", p90: 12, usableWeeks: 8 },
        longWindow: { id: "long", startDate: "2025-10-01", endDate: "2026-03-01", p90: 15, usableWeeks: 20 },
        recentTrend: "improved",
        justification: "La période récente diffère de la période longue.",
        advisedAction: "Conserver la période longue comme scénario prudent.",
        factors: [],
      },
    });
    args.sections[0] = { ...args.sections[0], decisionDiagnostic: diagnostic };

    const html = buildPortfolioPrintReportHtml(args);

    expect(html).toContain(diagnostic.historicalSensitivity!.recentP90);
    expect(html).toContain(diagnostic.historicalSensitivity!.longP90);
    expect(html).toContain(diagnostic.historicalSensitivity!.gap);
  });

  it("hides invalid percentiles and never emits invalid values", () => {
    const args = baseArgs();
    args.scenarios[0] = {
      ...args.scenarios[0],
      percentiles: { P50: 10, P70: Number.NaN },
      riskScore: Number.NaN,
      throughputReliability: null,
      decisionDiagnostic: buildDecisionLanguage({
        dataQuality: { level: "watch", justification: "Données à surveiller.", factors: [] },
        forecastUncertainty: { level: "unmeasurable", justification: "Percentiles manquants.", factors: [] },
        decisionRecommendation: {
          level: "not_recommended",
          justification: "La prévision est incomplète.",
          advisedAction: "Rétablir les percentiles requis.",
          factors: [],
        },
      }),
    };

    const html = buildPortfolioPrintReportHtml(args);

    expect(html).not.toContain("Décision non recommandée");
    expect(html).not.toMatch(/undefined|null|NaN/);
  });

  it("keeps every portfolio chart title aligned with its rendered data", () => {
    const html = buildPortfolioPrintReportHtml(baseArgs());

    expect(html).toMatch(/Sc.nario - Ind.pendant[\s\S]*?<h2>D.bit simul. du sc.nario<\/h2>[\s\S]*?aria-label="D.bit simul. du sc.nario"/);
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

  it("does not render scenario hypothesis subtitles outside the comparative section", () => {
    const args = baseArgs();
    args.scenarios[0] = {
      ...args.scenarios[0],
      hypothesis: "Observed common slowdowns remained visible in the shared history.",
    };

    const html = buildPortfolioPrintReportHtml(args);

    expect(html).not.toContain("Observed common slowdowns remained visible in the shared history.");
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
        `Indépendant[\\s\\S]*?<td>${Number(args.scenarios[0].percentiles.P50 ?? 0).toFixed(0)}</td>\\s*<td>${Number(args.scenarios[0].percentiles.P70 ?? 0).toFixed(0)}</td>\\s*<td>${Number(args.scenarios[0].percentiles.P90 ?? 0).toFixed(0)}</td>`,
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
    expect(html).toMatch(/Simulation Portefeuille - Team A[\s\S]*?<b>États:<\/b> Agr/);
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
    const report = new DOMParser().parseFromString(html, "text/html");
    const teamPage = Array.from(report.querySelectorAll<HTMLElement>(".page")).find(
      (page) => page.querySelector("h1")?.textContent === "Simulation Portefeuille - Team A",
    );

    expect(html).toContain("Semaines 0 exclues");
    expect(html).toContain("Non disponible");
    expect(teamPage?.querySelector(".diagnostic-card")).toBeNull();
    expect(html).toMatch(/Simulation Portefeuille - Team A[\s\S]*?<section class="kpis">\s*<\/section>/);
  });

  it("omits non-finite reliability measurements from a team page", () => {
    const args = baseArgs();
    args.scenarios[0] = {
      ...args.scenarios[0],
      completionSummary: {
        completed_count: 9,
        censored_count: 1,
        censored_rate: 0.1,
        horizon_weeks: 52,
      },
    };
    args.sections[0] = {
      ...args.sections[0],
      throughputReliability: {
        cv: Number.NaN,
        iqr_ratio: Number.NaN,
        slope_norm: Number.NaN,
        label: "incertain",
        samples_count: Number.NaN,
      },
    };

    const html = buildPortfolioPrintReportHtml(args);
    const report = new DOMParser().parseFromString(html, "text/html");
    const teamPage = Array.from(report.querySelectorAll<HTMLElement>(".page")).find(
      (page) => page.querySelector("h1")?.textContent === "Simulation Portefeuille - Team A",
    );
    const teamText = teamPage?.textContent ?? "";

    expect(teamText).toContain("Non disponible");
    expect(teamText).not.toContain("CV:");
    expect(teamText).not.toContain("IQR ratio:");
    expect(teamText).not.toContain("Pente normalisée:");
    expect(teamText).not.toContain("Semaines utilisées:");
    expect(teamText).not.toMatch(/NaN|undefined|null/);
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
    expect(html).toMatch(/<td>\s*<\/td>/);
    expect(html).not.toContain("<td>0</td>");
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



