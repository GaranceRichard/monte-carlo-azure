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
    cycleTimePoints: [
      { week: "2025-01-06", cycleTime: 1.4, count: 2 },
      { week: "2025-01-13", cycleTime: 1.9, count: 1 },
      { week: "2025-01-20", cycleTime: 2.2, count: 2 },
    ],
    cycleTimeTrendPoints: [
      { week: "2025-01-06", average: 1.4, lowerBound: 1.4, upperBound: 1.4, itemCount: 2 },
      { week: "2025-01-13", average: 1.57, lowerBound: 1.33, upperBound: 1.8, itemCount: 3 },
      { week: "2025-01-20", average: 1.8, lowerBound: 1.47, upperBound: 2.13, itemCount: 5 },
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
        iqr_ratio: 0.2,
        slope_norm: 0,
        label: "incertain",
        samples_count: 8,
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
        iqr_ratio: 0.2,
        slope_norm: 0,
        label: "incertain",
        samples_count: 7,
      },
    });

    expect(html).toContain("Volume historique encore limite.");
    expect(html).toContain(">0 semaines (au plus)<");
    expect(html).toContain("0,00 (fiable)");
  });

  it("covers diagnostic summary variants and fragile risk legend", () => {
    const variants = [
      {
        throughputReliability: { cv: 0.2, iqr_ratio: 0.2, slope_norm: -0.2, label: "fragile" as const, samples_count: 10 },
        expected: "Throughput en forte baisse sur les dernieres semaines.",
      },
      {
        throughputReliability: { cv: 0.2, iqr_ratio: 0.2, slope_norm: 0.12, label: "fragile" as const, samples_count: 10 },
        expected: "Throughput en forte hausse sur les dernieres semaines.",
      },
      {
        throughputReliability: { cv: 0.2, iqr_ratio: 0.2, slope_norm: 0.06, label: "incertain" as const, samples_count: 10 },
        expected: "Throughput en hausse sur les dernieres semaines.",
      },
      {
        throughputReliability: { cv: 1.2, iqr_ratio: 0.2, slope_norm: 0, label: "fragile" as const, samples_count: 10 },
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
