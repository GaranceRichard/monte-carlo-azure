import type { ForecastKind } from "../../types";
import type { PortfolioScenarioResult } from "../../hooks/simulationTypes";
import { buildAtLeastPercentiles, buildProbabilityCurve } from "../../hooks/probability";
import { computeRiskLegend, computeRiskScoreFromPercentiles } from "../../utils/simulation";
import {
  renderDistributionChart,
  renderOverlayProbabilityChart,
  renderProbabilityChart,
  renderThroughputChart,
  type DistributionExportPoint,
  type OverlayProbabilitySeries,
  type ThroughputExportPoint,
} from "./simulationChartsSvg";
import { downloadPortfolioPdf } from "./simulationPdfDownload";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getScenarioDisplayLabel(label: string): string {
  return label.startsWith("Arrime") ? label.replace("Arrime", "Arrimé") : label;
}

function getScenarioOrder(label: PortfolioScenarioResult["label"]): number {
  if (label === "Optimiste") return 0;
  if (label.startsWith("Arrime")) return 1;
  if (label.startsWith("Friction")) return 2;
  return 3;
}

type PortfolioSectionInput = {
  selectedTeam: string;
  simulationMode: "backlog_to_weeks" | "weeks_to_items";
  includeZeroWeeks: boolean;
  backlogSize: number;
  targetWeeks: number;
  nSims: number;
  resultKind: ForecastKind;
  riskScore?: number;
  distribution: Array<{ x: number; count: number }>;
  weeklyThroughput: Array<{ week: string; throughput: number }>;
  displayPercentiles: Record<string, number>;
};

function smoothHistogramCounts(points: Array<{ x: number; count: number }>): number[] {
  if (!points.length) return [];
  const weights = [1, 2, 3, 2, 1];
  const radius = 2;
  return points.map((_, i) => {
    let weightedSum = 0;
    let weightTotal = 0;
    for (let offset = -radius; offset <= radius; offset += 1) {
      const idx = i + offset;
      if (idx < 0 || idx >= points.length) continue;
      const w = weights[offset + radius];
      weightedSum += points[idx].count * w;
      weightTotal += w;
    }
    return weightTotal > 0 ? weightedSum / weightTotal : points[i].count;
  });
}

function riskColor(label: string): string {
  if (label === "fiable") return "#15803d";
  if (label === "incertain") return "#d97706";
  if (label === "fragile") return "#dc2626";
  return "#111827";
}

function formatRiskScore(
  mode: "backlog_to_weeks" | "weeks_to_items",
  percentiles: Record<string, number>,
): { score: number; label: string; valueLabel: string } {
  const score = computeRiskScoreFromPercentiles(mode, percentiles);
  const label = computeRiskLegend(score);
  return {
    score,
    label,
    valueLabel: score.toFixed(2).replace(".", ","),
  };
}

function formatRiskScoreFromValue(score: number): { score: number; label: string; valueLabel: string } {
  const safe = Number.isFinite(score) ? Math.max(0, score) : 0;
  const label = computeRiskLegend(safe);
  return {
    score: safe,
    label,
    valueLabel: safe.toFixed(2).replace(".", ","),
  };
}

function buildTeamLikePageHtml({
  title,
  subtitle,
  selectedProject,
  startDate,
  endDate,
  simulationMode,
  includeZeroWeeks,
  backlogSize,
  targetWeeks,
  nSims,
  resultKind,
  distribution,
  weeklyThroughput,
  displayPercentiles,
  riskScore,
  note,
  pageBreak,
}: {
  title: string;
  subtitle?: string;
  selectedProject: string;
  startDate: string;
  endDate: string;
  simulationMode: "backlog_to_weeks" | "weeks_to_items";
  includeZeroWeeks: boolean;
  backlogSize: number;
  targetWeeks: number;
  nSims: number;
  resultKind: ForecastKind;
  distribution: Array<{ x: number; count: number }>;
  weeklyThroughput: Array<{ week: string; throughput: number }>;
  displayPercentiles: Record<string, number>;
  riskScore?: number;
  note?: string;
  pageBreak: boolean;
}): string {
  const throughputRows = includeZeroWeeks ? weeklyThroughput : weeklyThroughput.filter((row) => row.throughput > 0);
  const throughputPoints: ThroughputExportPoint[] = throughputRows.map((point, index, arr) => {
    const windowSize = 4;
    const start = Math.max(0, index - windowSize + 1);
    const slice = arr.slice(start, index + 1);
    const average = slice.reduce((sum, p) => sum + p.throughput, 0) / slice.length;
    return { week: String(point.week).slice(0, 10), throughput: point.throughput, movingAverage: Number(average.toFixed(2)) };
  });

  const sortedDistribution = [...distribution]
    .map((p) => ({ x: Number(p.x), count: Number(p.count) }))
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.count) && p.count > 0)
    .sort((a, b) => a.x - b.x);
  const smoothed = smoothHistogramCounts(sortedDistribution);
  const distributionPoints: DistributionExportPoint[] = sortedDistribution.map((p, i) => ({
    x: p.x,
    count: p.count,
    gauss: smoothed[i],
  }));
  const probabilityPoints = buildProbabilityCurve(sortedDistribution, resultKind);
  const effectivePercentiles = resultKind === "items" ? buildAtLeastPercentiles(sortedDistribution, [50, 70, 90]) : displayPercentiles;

  const throughputSvg = renderThroughputChart(throughputPoints);
  const distributionSvg = renderDistributionChart(distributionPoints);
  const probabilitySvg = renderProbabilityChart(probabilityPoints);
  const modeSummary =
    simulationMode === "backlog_to_weeks"
      ? `Backlog vers semaines - backlog: ${String(backlogSize)} items`
      : `Semaines vers items - cible: ${String(targetWeeks)} semaines`;
  const resultLabel = resultKind === "items" ? "items (au moins)" : "semaines (au plus)";
  const modeZeroLabel = includeZeroWeeks ? "Semaines 0 incluses" : "Semaines 0 exclues";
  const risk =
    typeof riskScore === "number" && Number.isFinite(riskScore)
      ? formatRiskScoreFromValue(riskScore)
      : formatRiskScore(simulationMode, effectivePercentiles);

  return `
    <section class="page ${pageBreak ? "page-break" : ""}">
      <header class="header">
        <h1 class="title">${escapeHtml(title)}</h1>
        ${subtitle ? `<div class="subtitle"><i>${escapeHtml(subtitle)}</i></div>` : ""}
        <div class="meta">
          <div class="meta-row"><b>Projet:</b> ${escapeHtml(selectedProject)}</div>
          <div class="meta-row"><b>Période:</b> ${escapeHtml(startDate)} au ${escapeHtml(endDate)}</div>
          <div class="meta-row"><b>Mode:</b> ${escapeHtml(modeSummary)}</div>
          <div class="meta-row"><b>Échantillon:</b> ${escapeHtml(modeZeroLabel)}</div>
          <div class="meta-row"><b>Simulations:</b> ${escapeHtml(String(nSims))}</div>
        </div>
      </header>

      <section class="kpis">
        <div class="kpi"><span class="kpi-label">P50</span><span class="kpi-value">${Number(effectivePercentiles?.P50 ?? 0).toFixed(0)} ${escapeHtml(resultLabel)}</span></div>
        <div class="kpi"><span class="kpi-label">P70</span><span class="kpi-value">${Number(effectivePercentiles?.P70 ?? 0).toFixed(0)} ${escapeHtml(resultLabel)}</span></div>
        <div class="kpi"><span class="kpi-label">P90</span><span class="kpi-value">${Number(effectivePercentiles?.P90 ?? 0).toFixed(0)} ${escapeHtml(resultLabel)}</span></div>
        <div class="kpi"><span class="kpi-label">Risk Score</span><span class="kpi-value">${escapeHtml(risk.valueLabel)} <span style="color:${riskColor(risk.label)}">(${escapeHtml(risk.label)})</span></span></div>
      </section>

      <section class="section">
        <h2>Throughput hebdomadaire</h2>
        <div class="chart-wrap">${throughputSvg}</div>
        ${note ? `<div class="note">${escapeHtml(note)}</div>` : ""}
      </section>

      <section class="section">
        <h2>Distribution Monte Carlo</h2>
        <div class="chart-wrap">${distributionSvg}</div>
      </section>

      <section class="section">
        <h2>Courbe de probabilité</h2>
        <div class="chart-wrap">${probabilitySvg}</div>
      </section>
    </section>
  `;
}

function buildSummaryPage({
  selectedProject,
  startDate,
  endDate,
  includedTeams,
  arrimageRate,
  simulationMode,
  backlogSize,
  targetWeeks,
  scenarios,
}: {
  selectedProject: string;
  startDate: string;
  endDate: string;
  includedTeams: string[];
  arrimageRate: number;
  simulationMode: "backlog_to_weeks" | "weeks_to_items";
  backlogSize: number;
  targetWeeks: number;
  scenarios: PortfolioScenarioResult[];
}): string {
  const orderedScenarios = [...scenarios].sort((a, b) => getScenarioOrder(a.label) - getScenarioOrder(b.label));
  const effectiveFrictionLabel =
    orderedScenarios.find((scenario) => scenario.label.startsWith("Friction"))?.label ??
    `Friction (${Math.round((Math.max(0, Math.min(100, arrimageRate)) / 100) ** includedTeams.length * 100)}%)`;

  const rows = orderedScenarios
    .map((scenario) => {
      const summaryResultKind: ForecastKind = simulationMode === "weeks_to_items" ? "items" : "weeks";
      const sortedDistribution = [...scenario.distribution]
        .map((p) => ({ x: Number(p.x), count: Number(p.count) }))
        .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.count) && p.count > 0)
        .sort((a, b) => a.x - b.x);
      const effectivePercentiles =
        summaryResultKind === "items"
          ? buildAtLeastPercentiles(sortedDistribution, [50, 70, 90])
          : scenario.percentiles;
      const risk =
        summaryResultKind === "items"
          ? formatRiskScore(simulationMode, effectivePercentiles)
          : formatRiskScoreFromValue(Number(scenario.riskScore ?? computeRiskScoreFromPercentiles(simulationMode, effectivePercentiles)));
      return `
        <tr>
          <td>${escapeHtml(getScenarioDisplayLabel(scenario.label))}</td>
          <td>${Number(effectivePercentiles.P50 ?? 0).toFixed(0)}</td>
          <td>${Number(effectivePercentiles.P70 ?? 0).toFixed(0)}</td>
          <td>${Number(effectivePercentiles.P90 ?? 0).toFixed(0)}</td>
          <td><span class="risk-chip" style="color:${riskColor(risk.label)}">${escapeHtml(risk.valueLabel)} (${escapeHtml(risk.label)})</span></td>
        </tr>
      `;
    })
    .join("");

  const overlaySeries: OverlayProbabilitySeries[] = orderedScenarios.map((scenario) => {
    const summaryResultKind: ForecastKind = simulationMode === "weeks_to_items" ? "items" : "weeks";
    const sortedDistribution = [...scenario.distribution]
      .map((p) => ({ x: Number(p.x), count: Number(p.count) }))
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.count) && p.count > 0)
      .sort((a, b) => a.x - b.x);
    const points = buildProbabilityCurve(sortedDistribution, summaryResultKind);
    const color = scenario.label === "Optimiste"
      ? "#15803d"
      : scenario.label.startsWith("Arrime")
        ? "#2563eb"
        : scenario.label.startsWith("Friction")
          ? "#d97706"
          : "#dc2626";
    return {
      label: getScenarioDisplayLabel(scenario.label),
      color,
      points,
    };
  });
  const overlaySvg = renderOverlayProbabilityChart(overlaySeries);

  const hypotheses = [
    "1. Optimiste : Somme des débits de toutes les équipes. Hypothèse : livraison indépendante, aucun coût de synchronisation inter-équipes.",
    `2. Arrimé : ${String(arrimageRate)}% de la capacité combinée. Hypothèse : coûts de synchronisation (cérémonies, dépendances, alignement) absorbés sur le débit global.`,
    `3. ${getScenarioDisplayLabel(effectiveFrictionLabel)} : ${effectiveFrictionLabel.replace("Friction ", "")} de la capacité combinée. Hypothèse : chaque équipe supplémentaire absorbe un coût d'alignement identique.`,
    "4. Conservateur : Débit médian des équipes x nb équipes. Hypothèse : le portefeuille est contraint par l'équipe médiane, pas par la pire.",
  ];

  return `
    <section class="page page-break">
      <header class="header">
        <h1 class="title">Synthèse - Simulation Portefeuille</h1>
        <div class="meta">
          <div class="meta-row"><b>Projet:</b> ${escapeHtml(selectedProject)}</div>
          <div class="meta-row"><b>Période:</b> ${escapeHtml(startDate)} au ${escapeHtml(endDate)}</div>
          <div class="meta-row"><b>Mode:</b> ${escapeHtml(
            simulationMode === "backlog_to_weeks"
              ? `Backlog vers semaines - backlog: ${String(backlogSize)} items`
              : `Semaines vers items - cible: ${String(targetWeeks)} semaines`,
          )}</div>
          <div class="meta-row"><b>Équipes incluses:</b> ${escapeHtml(includedTeams.join(", ") || "Aucune")}</div>
          <div class="meta-row"><b>Taux d'arrimage:</b> ${escapeHtml(String(arrimageRate))}%</div>
        </div>
      </header>

      <section class="section">
        <h2>Synthèse décisionnelle</h2>
        <table class="summary-table">
          <thead>
            <tr><th>Scénario</th><th>P50</th><th>P70</th><th>P90</th><th>Risk Score</th></tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </section>

      <section class="section">
        <h2>Courbes de probabilités comparées</h2>
        <div class="chart-wrap">${overlaySvg}</div>
      </section>

      <section class="section section--hypotheses">
        <h2>Hypothèses</h2>
        ${hypotheses.map((line) => `<p class="hypothesis">${escapeHtml(line)}</p>`).join("")}
      </section>
    </section>
  `;
}

export function exportPortfolioPrintReport({
  selectedProject,
  startDate,
  endDate,
  arrimageRate,
  includedTeams,
  sections,
  scenarios,
}: {
  selectedProject: string;
  startDate: string;
  endDate: string;
  arrimageRate: number;
  includedTeams: string[];
  sections: PortfolioSectionInput[];
  scenarios: PortfolioScenarioResult[];
}): void {
  const printWindow = window.open("about:blank", "_blank");
  if (!printWindow) return;

  const simulationMode = sections[0]?.simulationMode ?? "backlog_to_weeks";
  const orderedScenarios = [...scenarios].sort((a, b) => getScenarioOrder(a.label) - getScenarioOrder(b.label));

  const summaryPage = buildSummaryPage({
    selectedProject,
    startDate,
    endDate,
    includedTeams,
    arrimageRate,
    simulationMode,
    backlogSize: sections[0]?.backlogSize ?? 0,
    targetWeeks: sections[0]?.targetWeeks ?? 0,
    scenarios: orderedScenarios,
  });

  const scenarioPages = orderedScenarios
    .map((scenario, idx) =>
      buildTeamLikePageHtml({
        title: `Scénario - ${getScenarioDisplayLabel(scenario.label)}`,
        subtitle: scenario.hypothese,
        selectedProject,
        startDate,
        endDate,
        simulationMode,
        includeZeroWeeks: true,
        backlogSize: sections[0]?.backlogSize ?? 0,
        targetWeeks: sections[0]?.targetWeeks ?? 0,
        nSims: sections[0]?.nSims ?? 0,
        resultKind: simulationMode === "weeks_to_items" ? "items" : "weeks",
        distribution: scenario.distribution,
        weeklyThroughput: scenario.weeklyData,
        displayPercentiles: scenario.percentiles,
        riskScore: scenario.riskScore,
        note: "Débit reconstruit par simulation bootstrap - non issu de l'historique réel.",
        pageBreak: idx < orderedScenarios.length - 1 || sections.length > 0,
      }),
    )
    .join("");

  const teamPages = sections
    .map((section, idx) =>
      buildTeamLikePageHtml({
        title: `Simulation Portefeuille - ${section.selectedTeam}`,
        selectedProject,
        startDate,
        endDate,
        simulationMode: section.simulationMode,
        includeZeroWeeks: section.includeZeroWeeks,
        backlogSize: section.backlogSize,
        targetWeeks: section.targetWeeks,
        nSims: section.nSims,
        resultKind: section.resultKind,
        distribution: section.distribution,
        weeklyThroughput: section.weeklyThroughput,
        displayPercentiles: section.displayPercentiles,
        riskScore: section.riskScore,
        pageBreak: idx < sections.length - 1,
      }),
    )
    .join("");

  const html = `
    <!doctype html>
    <html lang="fr">
    <head>
      <meta charset="utf-8" />
      <title>Export Portefeuille Monte Carlo</title>
      <style>
        * { box-sizing: border-box; }
        body { margin: 0; padding: 12px; font-family: Arial, sans-serif; color: #111827; }
        .header { margin-bottom: 8px; }
        .title { margin: 0; font-size: 20px; }
        .subtitle { margin-top: 4px; font-size: 12px; color: #4b5563; }
        .meta { margin-top: 6px; padding: 6px 8px; border: 1px solid #d1d5db; border-radius: 8px; background: #f9fafb; font-size: 11px; line-height: 1.35; }
        .meta-row { margin-bottom: 2px; }
        .kpis { display: flex; gap: 6px; margin-top: 8px; margin-bottom: 8px; }
        .kpi { border: 1px solid #d1d5db; border-radius: 8px; padding: 6px 8px; min-width: 140px; background: #f9fafb; }
        .kpi-label { display: block; font-size: 11px; color: #374151; font-weight: 700; }
        .kpi-value { display: block; margin-top: 2px; font-size: 16px; font-weight: 800; }
        .section { margin-top: 8px; page-break-inside: avoid; }
        .section--hypotheses { margin-top: 24px; }
        .section h2 { margin: 0 0 4px 0; font-size: 14px; }
        .note { margin-top: 4px; font-size: 11px; color: #4b5563; }
        .chart-wrap { width: 100%; overflow: hidden; border: 1px solid #d1d5db; border-radius: 8px; padding: 4px; background: #fff; }
        .chart-wrap svg { width: 100%; height: auto; display: block; }
        .summary-table { width: 100%; border-collapse: collapse; font-size: 12px; }
        .summary-table th, .summary-table td { border: 1px solid #d1d5db; padding: 6px; text-align: left; }
        .summary-table th { background: #f3f4f6; }
        .risk-chip { font-weight: 700; }
        .hypothesis { margin: 4px 0; font-size: 12px; }
        .print-action {
          position: fixed;
          top: 16px;
          right: 16px;
          z-index: 20;
          border: 1px solid #d1d5db;
          background: #111827;
          color: #ffffff;
          border-radius: 8px;
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }
        .page-break { page-break-after: always; }
        @media print {
          body { padding: 7mm; }
          .print-action { display: none; }
        }
      </style>
    </head>
    <body>
      <button type="button" id="download-pdf" class="print-action">Telecharger PDF</button>
      ${summaryPage}
      ${scenarioPages}
      ${teamPages}
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();

  const popup = printWindow as Window & { __downloadPdf?: () => void };
  popup.__downloadPdf = () => {
    const button = printWindow.document.getElementById("download-pdf") as HTMLButtonElement | null;
    if (button) {
      button.disabled = true;
      button.textContent = "Generation...";
    }
    void downloadPortfolioPdf(printWindow.document, selectedProject)
      .catch((err) => {
        console.error(err);
        const message = err instanceof Error ? err.message : String(err);
        if (typeof printWindow.alert === "function") {
          printWindow.alert(`Echec generation PDF: ${message}`);
        }
      })
      .finally(() => {
        if (button) {
          button.disabled = false;
          button.textContent = "Telecharger PDF";
        }
      });
  };

  const wireDownloadButton = () => {
    const button = printWindow.document.getElementById("download-pdf");
    const bindableButton = button as (HTMLElement & { __downloadBound?: boolean }) | null;
    if (!bindableButton || bindableButton.__downloadBound) return;
    bindableButton.__downloadBound = true;
    bindableButton.addEventListener("click", () => {
      popup.__downloadPdf?.();
    });
  };
  wireDownloadButton();
  if (typeof printWindow.addEventListener === "function") {
    printWindow.addEventListener("load", wireDownloadButton, { once: true });
  } else {
    printWindow.onload = wireDownloadButton;
  }
}
