import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test.use({ viewport: { width: 794, height: 1123 } });

test("portfolio print: synthesis hypotheses remain in the first printable page", async ({ page }) => {
  await page.goto("/");
  await page.emulateMedia({ media: "print" });

  const layout = await page.evaluate(async () => {
    const { buildPortfolioPrintReportHtml } = await import("/src/components/steps/portfolioPrintReport.ts");
    const scenarios = [
      ["Optimiste", 20, "fiable"],
      ["Arrime (80%)", 18, "fiable"],
      ["Friction (80%)", 15, "incertain"],
      ["Historique corrélé", 13, "fragile"],
    ].map(([label, p50, reliability], index) => ({
      label,
      hypothesis: "Hypothèse de portefeuille.",
      seed: index + 1,
      samples: [1, 2, 3],
      weeklyData: [{ week: "2026-01-01", throughput: 3 }],
      percentiles: { P50: p50, P70: p50 - 2, P90: p50 - 4 },
      riskScore: 0.2,
      riskLegend: reliability,
      distribution: [{ x: p50, count: 3 }],
      throughputReliability: { cv: 0.3, iqr_ratio: 0.2, slope_norm: 0, label: reliability, samples_count: 8 },
    }));
    const html = buildPortfolioPrintReportHtml({
      selectedProject: "Projet A",
      startDate: "2026-01-01",
      endDate: "2026-03-01",
      includedTeams: ["Équipe A"],
      alignmentRate: 80,
      simulationMode: "backlog_to_weeks",
      backlogSize: 120,
      targetWeeks: 12,
      scenarios,
      sections: [],
    });
    document.open();
    document.write(html);
    document.close();
    await document.fonts.ready;

    const summary = document.querySelector(".page");
    const chart = summary.querySelector(".section--summary-chart");
    const assumptionsSection = summary.querySelector(".section--hypotheses");
    const nextPage = document.querySelectorAll(".page")[1];
    const getStyle = (element) => {
      const style = getComputedStyle(element);
      return {
        height: style.height,
        minHeight: style.minHeight,
        maxHeight: style.maxHeight,
        display: style.display,
        breakBefore: style.breakBefore,
        breakAfter: style.breakAfter,
        breakInside: style.breakInside,
        pageBreakBefore: style.pageBreakBefore,
        pageBreakAfter: style.pageBreakAfter,
        pageBreakInside: style.pageBreakInside,
      };
    };
    const printableBottom = (297 - 14) * (96 / 25.4);
    const summaryTop = summary.getBoundingClientRect().top;

    return {
      chartBottom: chart.getBoundingClientRect().bottom - summaryTop,
      assumptionsTop: assumptionsSection.getBoundingClientRect().top - summaryTop,
      assumptionsBottom: assumptionsSection.getBoundingClientRect().bottom - summaryTop,
      printableBottom,
      assumptionsStyle: getStyle(assumptionsSection),
      gridStyle: getStyle(assumptionsSection.querySelector(".hypothesis-grid")),
      nextPageStyle: getStyle(nextPage),
    };
  });

  expect(layout.assumptionsTop).toBeGreaterThanOrEqual(layout.chartBottom);
  expect(layout.assumptionsBottom).toBeLessThanOrEqual(layout.printableBottom);
  expect(layout.assumptionsStyle).toMatchObject({
    minHeight: "0px",
    maxHeight: "none",
    breakBefore: "auto",
    breakInside: "auto",
    pageBreakBefore: "auto",
    pageBreakInside: "auto",
  });
  expect(layout.gridStyle.display).toBe("block");
  expect(layout.nextPageStyle.pageBreakAfter).toBe("always");
});

test("portfolio PDF: the synthesis does not add an extra page before scenario details", async ({ page }) => {
  await page.goto("/");

  const downloadPromise = page.waitForEvent("download");
  await page.evaluate(async () => {
    const { buildDecisionLanguage } = await import("/src/utils/decisionLanguage.ts");
    const { buildPortfolioPrintReportHtml } = await import("/src/components/steps/portfolioPrintReport.ts");
    const { downloadPortfolioPdf } = await import("/src/components/steps/simulationPdfDownload.ts");

    const diagnostic = (level) =>
      buildDecisionLanguage({
        dataQuality: { level: level === "not_recommended" ? "insufficient" : "sufficient", justification: "Données utilisées pour la prévision.", factors: [] },
        forecastUncertainty: { level: level === "supportable" ? "low" : "high", justification: "Incertitude issue des percentiles.", factors: [] },
        decisionRecommendation: { level, justification: "Justification décisionnelle du scénario.", advisedAction: "Action recommandée pour le scénario.", factors: [] },
      });
    const scenarios = [
      ["Optimiste", 20, "supportable", "fiable"],
      ["Arrime (80%)", 18, "caution", "fiable"],
      ["Friction (80%)", 15, "arbitration_required", "incertain"],
      ["Historique corrélé", 13, "not_recommended", "fragile"],
    ].map(([label, p50, decisionLevel, reliability], index) => ({
      label,
      hypothesis: "Hypothèse de portefeuille.",
      seed: index + 1,
      samples: [1, 2, 3],
      weeklyData: [{ week: "2026-01-01", throughput: 3 }],
      percentiles: { P50: p50, P70: p50 - 2, P90: p50 - 4 },
      riskScore: 0.2,
      riskLegend: reliability,
      distribution: [{ x: p50, count: 3 }],
      throughputReliability: { cv: 0.3, iqr_ratio: 0.2, slope_norm: 0, label: reliability, samples_count: 8 },
      decisionDiagnostic: diagnostic(decisionLevel),
    }));
    const html = buildPortfolioPrintReportHtml({
      selectedProject: "Projet A",
      startDate: "2026-01-01",
      endDate: "2026-03-01",
      includedTeams: ["Équipe A"],
      alignmentRate: 80,
      simulationMode: "backlog_to_weeks",
      backlogSize: 120,
      targetWeeks: 12,
      scenarios,
      sections: [],
    });
    const reportDocument = document.implementation.createHTMLDocument("portfolio");
    reportDocument.documentElement.innerHTML = html;
    await downloadPortfolioPdf(reportDocument, "Projet A");
  });
  const download = await downloadPromise;
  const pdf = await readFile(await download.path());
  const pdfText = pdf.toString("latin1");
  const pageCount = (pdfText.match(/\/Type\s*\/Page\b/g) ?? []).length;

  expect(pageCount).toBe(5);
});
