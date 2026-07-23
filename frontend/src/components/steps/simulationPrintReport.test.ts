import { afterEach, describe, expect, it, vi } from "vitest";

const pdfModuleMocks = vi.hoisted(() => ({
  downloadSimulationPdf: vi.fn(async () => undefined),
}));

vi.mock("./simulationPdfDownload", async () => {
  const actual = await vi.importActual<typeof import("./simulationPdfDownload")>("./simulationPdfDownload");
  return {
    ...actual,
    downloadSimulationPdf: pdfModuleMocks.downloadSimulationPdf,
  };
});

import {
  buildSimulationPdfFileName,
  buildSimulationPrintReportHtml,
  exportSimulationPrintReport,
} from "./simulationPrintReport";
import { buildDecisionLanguage } from "../../utils/decisionLanguage";

function buildDecisionDiagnostic(
  level: "supportable" | "caution" | "arbitration_required" | "not_recommended" = "caution",
  withSensitivity = false,
  simulationMode: "backlog_to_weeks" | "weeks_to_items" = "backlog_to_weeks",
) {
  return buildDecisionLanguage({
    dataQuality: {
      level: "watch",
      justification: "Historique à surveiller.",
      factors: [{ code: "usable_history_weeks", description: "Semaines historiques exploitables", value: 7 }],
    },
    forecastUncertainty: {
      level: "high",
      justification: "Dispersion élevée.",
      factors: [{ code: "forecast_percentile_spread", description: "Dispersion des percentiles", value: 0.7 }],
    },
    decisionRecommendation: {
      level,
      justification: "Justification validée par l'interface.",
      advisedAction: "Action validée par l'interface.",
      factors: [{ source: "dataQuality", code: "usable_history_weeks", description: "Historique limité", value: 7 }],
    },
    historicalSensitivity: withSensitivity
      ? {
          level: "high",
          simulationMode,
          comparedSimulations: [],
          p90Minimum: 12,
          p90Maximum: 18,
          absoluteGap: 6,
          relativeGap: 0.5,
          recentChangeRate: simulationMode === "weeks_to_items" ? 0.5 : -0.5,
          recentWindow: { id: "recent", startDate: "2026-02-01", endDate: "2026-03-01", p90: 18, usableWeeks: 7 },
          longWindow: { id: "long", startDate: "2025-09-01", endDate: "2026-03-01", p90: 12, usableWeeks: 24 },
          recentTrend: simulationMode === "weeks_to_items" ? "improved" : "declined",
          justification: "La période historique modifie fortement la prévision.",
          advisedAction: "Retenir le scénario prudent.",
          factors: [],
        }
      : undefined,
  });
}

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
    throughputReliability: { cv: 0.62, iqrRatio: 0.55, slopeNorm: -0.07, label: "incertain" as const, samplesCount: 10 },
    cycleTimePoints: [
      { week: "2025-01-06", cycleTimeDays: 1.4, count: 2 },
      { week: "2025-01-13", cycleTimeDays: 1.9, count: 1 },
      { week: "2025-01-20", cycleTimeDays: 2.2, count: 2 },
    ],
    cycleTimeTrendPoints: [
      { week: "2025-01-06", averageDays: 1.4, lowerBoundDays: 1.4, upperBoundDays: 1.4, itemCount: 2 },
      { week: "2025-01-13", averageDays: 1.57, lowerBoundDays: 1.33, upperBoundDays: 1.8, itemCount: 3 },
      { week: "2025-01-20", averageDays: 1.8, lowerBoundDays: 1.47, upperBoundDays: 2.13, itemCount: 5 },
    ],
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

describe("simulationPrintReport", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    pdfModuleMocks.downloadSimulationPdf.mockReset();
    pdfModuleMocks.downloadSimulationPdf.mockResolvedValue(undefined);
  });

  it("renders report HTML containing chart SVGs and diagnostics", () => {
    const html = buildSimulationPrintReportHtml(buildBaseArgs());

    expect(html).toContain("Cycle Time");
    expect(html).toContain("Throughput hebdomadaire");
    expect(html).toContain("Distribution Monte Carlo");
    expect(html).toContain("Courbe de probabilite");
    expect(html).toContain('class="summary-grid"');
    expect(html).toContain('class="diagnostic-card"');
    expect(html).toContain("Diagnostic");
    expect(html).toContain('<span class="kpi-label">Risk Score</span>');
    expect(html).toContain('<span class="kpi-label">Fiabilite</span>');
    expect(html).toContain('<span class="kpi-value">0,63 (fragile)</span>');
    expect(html).toContain('<span class="kpi-value">0,62 (incertain)</span>');
    expect(html).toContain("Throughput en baisse sur les dernieres semaines.");
    expect((html.match(/<svg/g) || []).length).toBeGreaterThanOrEqual(4);
    expect(html).not.toContain('id="download-pdf"');
  });

  it.each([
    ["caution", "Décision possible avec prudence"],
    ["arbitration_required", "Arbitrage nécessaire"],
    ["not_recommended", "Décision non recommandée"],
  ] as const)("keeps the %s decision wording aligned with the interface", (level, expectedStatus) => {
    const decisionDiagnostic = buildDecisionDiagnostic(level);
    const html = buildSimulationPrintReportHtml({ ...buildBaseArgs(), decisionDiagnostic });
    const reportText = new DOMParser().parseFromString(html, "text/html").body.textContent ?? "";

    expect(html).toContain("Diagnostic décisionnel");
    expect(html).toContain(expectedStatus);
    expect(reportText).toContain(decisionDiagnostic.decisionRecommendation.explanation);
    expect(reportText).toContain(decisionDiagnostic.decisionRecommendation.action);
    expect(html).toContain("Qualité des données — statut");
    expect(html).toContain("Incertitude de prévision — statut");
  });

  it.each(["backlog_to_weeks", "weeks_to_items"] as const)("renders high historical sensitivity for %s", (simulationMode) => {
    const decisionDiagnostic = buildDecisionDiagnostic("caution", true, simulationMode);
    const html = buildSimulationPrintReportHtml({ ...buildBaseArgs(), simulationMode, decisionDiagnostic });
    const sensitivity = decisionDiagnostic.historicalSensitivity!;

    expect(html).toContain(sensitivity.status);
    expect(html).toContain(sensitivity.recentP90);
    expect(html).toContain(sensitivity.longP90);
    expect(html).toContain(sensitivity.gap);
    expect(html).toContain(sensitivity.action);
  });

  it("omits unavailable sensitivity and invalid diagnostic content", () => {
    const missingPercentilesDiagnostic = buildDecisionLanguage({
      dataQuality: { level: "watch", justification: "Données à surveiller.", factors: [] },
      forecastUncertainty: {
        level: "unmeasurable",
        justification: "Les percentiles requis sont absents.",
        factors: [{ code: "missing_required_percentiles", description: "Percentiles requis non calculables", value: undefined }],
      },
      decisionRecommendation: {
        level: "arbitration_required",
        justification: "Arbitrage requis.",
        advisedAction: "Rétablir les percentiles.",
        factors: [{ source: "forecastUncertainty", code: "missing_required_percentiles", description: "Percentiles requis non calculables", value: undefined }],
      },
    });
    const html = buildSimulationPrintReportHtml({ ...buildBaseArgs(), decisionDiagnostic: missingPercentilesDiagnostic });

    expect(html).toContain("Incertitude impossible à mesurer");
    expect(html).not.toContain("Sensibilité à la période historique");
    expect(html).not.toMatch(/undefined|null|NaN/);
  });

  it("renders empty-chart placeholders and escapes unsafe values", () => {
    const html = buildSimulationPrintReportHtml({
      ...buildBaseArgs(),
      selectedTeam: `<script>alert("x")</script>`,
      types: [],
      doneStates: [],
      throughputReliability: undefined,
      cycleTimePoints: [],
      cycleTimeTrendPoints: [],
      throughputPoints: [],
      distributionPoints: [],
      probabilityPoints: [],
    });

    expect((html.match(/Donnees insuffisantes pour afficher ce graphique/g) || []).length).toBe(4);
    expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    expect(html).not.toContain(`<script>alert("x")</script>`);
    expect(html).toContain("Non disponible");
  });

  it("computes fallback reliability wording when API reliability is absent", () => {
    const html = buildSimulationPrintReportHtml({
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

    expect(html).toContain('<span class="kpi-value">0,06 (fiable)</span>');
    expect(html).toContain("Historique globalement stable.");
  });

  it("falls back to zero when throughput inputs and reliability metrics are nullish", () => {
    const html = buildSimulationPrintReportHtml({
      ...buildBaseArgs(),
      throughputReliability: {
        cv: undefined as unknown as number,
        iqrRatio: 0.2,
        slopeNorm: 0,
        label: "incertain",
        samplesCount: 8,
      },
      throughputPoints: [
        { week: "2025-01-06", throughput: undefined as unknown as number, movingAverage: 0 },
        { week: "2025-01-13", throughput: 4, movingAverage: 2 },
      ],
    });

    expect(html).toContain('<span class="kpi-value">0,00 (incertain)</span>');
  });

  it("renders short-history diagnostics and percentile fallbacks", () => {
    const html = buildSimulationPrintReportHtml({
      ...buildBaseArgs(),
      displayPercentiles: undefined as unknown as Record<string, number>,
      throughputReliability: {
        cv: 0.2,
        iqrRatio: 0.2,
        slopeNorm: 0,
        label: "incertain",
        samplesCount: 7,
      },
    });

    expect(html).toContain("Volume historique encore limite.");
    expect(html).not.toContain('<span class="kpi-label">P50</span>');
    expect(html).not.toContain('<span class="kpi-label">Risk Score</span>');
  });

  it("covers diagnostic summary variants and fragile risk legend", () => {
    const variants = [
      {
        throughputReliability: { cv: 0.2, iqrRatio: 0.2, slopeNorm: -0.2, label: "fragile" as const, samplesCount: 10 },
        expected: "Throughput en forte baisse sur les dernieres semaines.",
      },
      {
        throughputReliability: { cv: 0.2, iqrRatio: 0.2, slopeNorm: 0.12, label: "fragile" as const, samplesCount: 10 },
        expected: "Throughput en forte hausse sur les dernieres semaines.",
      },
      {
        throughputReliability: { cv: 0.2, iqrRatio: 0.2, slopeNorm: 0.06, label: "incertain" as const, samplesCount: 10 },
        expected: "Throughput en hausse sur les dernieres semaines.",
      },
      {
        throughputReliability: { cv: 1.2, iqrRatio: 0.2, slopeNorm: 0, label: "fragile" as const, samplesCount: 10 },
        expected: "Dispersion elevee du throughput historique.",
      },
    ];

    for (const variant of variants) {
      const html = buildSimulationPrintReportHtml({
        ...buildBaseArgs(),
        throughputReliability: variant.throughputReliability,
        displayPercentiles: { P50: 10, P70: 12, P90: 16 },
      });
      expect(html).toContain(variant.expected);
      expect(html).toContain("0,60 (fragile)");
    }
  });

  it("renders the short-history warning and the uncertain risk band", () => {
    const html = buildSimulationPrintReportHtml({
      ...buildBaseArgs(),
      displayPercentiles: { P50: 10, P70: 12, P90: 14 },
      throughputReliability: {
        cv: 0.2,
        iqrRatio: 0.2,
        slopeNorm: 0,
        label: "incertain",
        samplesCount: 5,
      },
    });

    expect(html).toContain("Historique trop court pour projeter avec confiance.");
    expect(html).toContain("0,40 (incertain)");
  });

  it("adds an explicit decision notice when volatility is too high", () => {
    const html = buildSimulationPrintReportHtml({
      ...buildBaseArgs(),
      throughputReliability: {
        cv: 1.2,
        iqrRatio: 1.1,
        slopeNorm: 0.01,
        label: "fragile",
        samplesCount: 12,
      },
    });

    expect(html).toContain("<b>Decision:</b> Historique trop volatil pour fonder une projection fiable.");
    expect(html).toContain("pas pour soutenir un engagement.");
  });

  it("renders items mode and zero-week exclusion labels", () => {
    const html = buildSimulationPrintReportHtml({
      ...buildBaseArgs(),
      simulationMode: "weeks_to_items",
      includeZeroWeeks: false,
      resultKind: "items",
      displayPercentiles: { P50: 10, P70: 20, P90: 30 },
    });

    expect(html).toContain("Semaines vers items - cible: 12 semaines");
    expect(html).toContain("Semaines 0 exclues");
    expect(html).toContain(">10 items<");
    expect(html).toContain("0,00 (fiable)");
  });

  it("renders elevated risk for backlog-to-weeks mode", () => {
    const html = buildSimulationPrintReportHtml({
      ...buildBaseArgs(),
      simulationMode: "backlog_to_weeks",
      displayPercentiles: { P50: 10, P70: 20, P90: 30 },
    });

    expect(html).toContain("2,00 (eleve)");
  });

  it("documents horizon and censures when backlog simulations are incomplete", () => {
    const html = buildSimulationPrintReportHtml({
      ...buildBaseArgs(),
      displayPercentiles: { P50: 12 },
      completionSummary: {
        completedCount: 4,
        censoredCount: 6,
        censoredRate: 0.6,
        horizonWeeks: 521,
      },
    });

    expect(html).toContain("Limite d'horizon:");
    expect(html).toContain("521 semaines");
    expect(html).toContain("Censures:");
    expect(html).toContain("6 sur 10 (0,60)");
    expect(html).toContain("Un percentile absent n'est pas identifiable avant l'horizon.");
  });

  it("exports directly to PDF from a detached document", async () => {
    const openSpy = vi.spyOn(window, "open");

    await exportSimulationPrintReport(buildBaseArgs());

    expect(openSpy).not.toHaveBeenCalled();
    expect(pdfModuleMocks.downloadSimulationPdf).toHaveBeenCalledTimes(1);
    expect(pdfModuleMocks.downloadSimulationPdf).toHaveBeenCalledWith(expect.any(Document), "Equipe A");
  });

  it("alerts and rethrows when direct PDF generation fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => undefined);
    pdfModuleMocks.downloadSimulationPdf.mockRejectedValueOnce(new Error("printer offline"));

    await expect(exportSimulationPrintReport(buildBaseArgs())).rejects.toThrow("printer offline");

    expect(errorSpy).toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith("Echec generation PDF: printer offline");
  });

  it("logs and rethrows when direct PDF generation fails without alert support", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const originalAlert = window.alert;
    Object.defineProperty(window, "alert", { value: undefined, configurable: true });
    pdfModuleMocks.downloadSimulationPdf.mockRejectedValueOnce("raw failure");

    await expect(exportSimulationPrintReport(buildBaseArgs())).rejects.toBe("raw failure");

    expect(errorSpy).toHaveBeenCalled();
    Object.defineProperty(window, "alert", { value: originalAlert, configurable: true });
  });

  it("still exposes the shared filename helper", () => {
    const date = new Date("2026-02-25T10:00:00Z");
    expect(buildSimulationPdfFileName("Équipe Alpha / Core", date)).toBe("simulation-Equipe-Alpha-Core-25_02_2026.pdf");
  });
});
