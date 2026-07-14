import type { CompletionSummary, ForecastKind, ForecastPercentiles, ThroughputReliability } from "../../types";
import type { PortfolioScenarioResult } from "../../hooks/simulationTypes";
import { buildProbabilityCurve } from "../../hooks/probability";
import {
  computeFrictionRatePercent,
  computeRiskLegend,
  computeRiskScoreFromPercentiles,
} from "../../utils/simulation";
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
import type { DecisionLanguage } from "../../utils/decisionLanguage";
import { renderDecisionDiagnosticHtml } from "../../utils/simulationDecisionDiagnostic";
import type { PortfolioComparisonDiagnostic } from "../../utils/portfolioComparisonDiagnostic";
import {
  formatPortfolioScenarioLabel,
  presentPortfolioComparisonDiagnostic,
  type PortfolioPilotReference,
} from "../../utils/portfolioComparisonPresentation";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatScenarioDisplayLabel(label: string): string {
  return formatPortfolioScenarioLabel(label);
}

function buildDetachedReportDocument(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

const SCENARIO_ORDER_MATCHERS = [
  (label: PortfolioScenarioResult["label"]) => label === "Optimiste",
  (label: PortfolioScenarioResult["label"]) => label.startsWith("Arrime"),
  (label: PortfolioScenarioResult["label"]) => label.startsWith("Friction"),
];

function getScenarioOrder(label: PortfolioScenarioResult["label"]): number {
  const matchIndex = SCENARIO_ORDER_MATCHERS.findIndex((matcher) => matcher(label));
  return matchIndex >= 0 ? matchIndex : 3;
}

type PortfolioSectionInput = {
  selectedTeam: string;
  seed: number;
  simulationMode: "backlog_to_weeks" | "weeks_to_items";
  includeZeroWeeks: boolean;
  backlogSize: number;
  targetWeeks: number;
  nSims: number;
  types?: string[];
  doneStates?: string[];
  resultKind: ForecastKind;
  riskScore?: number;
  throughputReliability?: ThroughputReliability | null;
  distribution: Array<{ x: number; count: number }>;
  weeklyThroughput: Array<{ week: string; throughput: number }>;
  displayPercentiles: ForecastPercentiles;
  completionSummary?: CompletionSummary;
  decisionDiagnostic?: DecisionLanguage;
};

type HypothesisBlock =
  | {
      kind: "paragraph";
      lead?: string;
      body: string;
      emphasizedLead?: boolean;
    }
  | {
      kind: "reading-rule";
      lead: string;
      body: string;
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
  return {
    fiable: "#15803d",
    incertain: "#d97706",
    fragile: "#dc2626",
  }[label] ?? "#111827";
}

function formatRiskScore(
  mode: "backlog_to_weeks" | "weeks_to_items",
  percentiles: ForecastPercentiles,
): { score: number; label: string; valueLabel: string } | null {
  const score = computeRiskScoreFromPercentiles(mode, percentiles);
  if (score == null) return null;
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

function formatMetric(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2).replace(".", ",") : "";
}

function formatPercentile(value: number | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(0) : "";
}

function renderTechnicalMetricRow(label: string, value: number | undefined): string {
  const formatted = typeof value === "number" ? formatMetric(value) : "";
  return formatted ? `<div class="meta-row"><b>${escapeHtml(label)}:</b> ${escapeHtml(formatted)}</div>` : "";
}

function formatReliabilityScore(reliability?: ThroughputReliability | null): string {
  if (!reliability) return "Non disponible";
  const score = formatMetric(reliability.cv);
  return score ? `${score} (${reliability.label})` : "Non disponible";
}

function buildReliabilitySummary(reliability?: ThroughputReliability | null): string {
  if (!reliability) return "Non disponible";

  const summary = [
    {
      matches: reliability.samples_count < 6,
      text: "Historique trop court pour projeter avec confiance.",
    },
    {
      matches: reliability.slope_norm <= -0.15,
      text: "Throughput en forte baisse sur les dernières semaines.",
    },
    {
      matches: reliability.slope_norm <= -0.05,
      text: "Throughput en baisse sur les dernières semaines.",
    },
    {
      matches: reliability.slope_norm >= 0.1,
      text: "Throughput en forte hausse sur les dernières semaines.",
    },
    {
      matches: reliability.slope_norm >= 0.05,
      text: "Throughput en hausse sur les dernières semaines.",
    },
    {
      matches: reliability.cv >= 1 || reliability.iqr_ratio >= 1,
      text: "Dispersion élevée du throughput historique.",
    },
    {
      matches: reliability.samples_count < 8,
      text: "Volume historique encore limité.",
    },
  ].find((entry) => entry.matches);

  return summary?.text ?? "Historique globalement stable.";
}

function renderHypothesisBlock(block: HypothesisBlock): string {
  if (block.kind === "reading-rule") {
    return `<p class="hypothesis reading-rule"><strong>${escapeHtml(block.lead)}</strong><br />${escapeHtml(block.body)}</p>`;
  }

  const renderedLead = block.lead
    ? block.emphasizedLead
      ? `<strong>${escapeHtml(block.lead)}</strong>`
      : escapeHtml(block.lead)
    : "";
  return `<p class="hypothesis">${renderedLead}${escapeHtml(block.body)}</p>`;
}

function resolveRiskScore({
  simulationMode,
  displayPercentiles,
  riskScore,
}: {
  simulationMode: "backlog_to_weeks" | "weeks_to_items";
  displayPercentiles: ForecastPercentiles;
  riskScore?: number;
}): { score: number; label: string; valueLabel: string } | null {
  if (typeof riskScore === "number" && Number.isFinite(riskScore)) {
    return formatRiskScoreFromValue(riskScore);
  }
  return formatRiskScore(simulationMode, displayPercentiles);
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
  types = [],
  doneStates = [],
  resultKind,
  distribution,
  weeklyThroughput,
  displayPercentiles,
  riskScore,
  completionSummary,
  throughputReliability,
  throughputChartTitle,
  note,
  pageBreak,
  decisionDiagnostic,
  showSourceDiagnostic,
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
  types?: string[];
  doneStates?: string[];
  resultKind: ForecastKind;
  distribution: Array<{ x: number; count: number }>;
  weeklyThroughput: Array<{ week: string; throughput: number }>;
  displayPercentiles: ForecastPercentiles;
  riskScore?: number;
  completionSummary?: CompletionSummary;
  throughputReliability?: ThroughputReliability | null;
  throughputChartTitle: string;
  note?: string;
  pageBreak: boolean;
  decisionDiagnostic?: DecisionLanguage;
  showSourceDiagnostic: boolean;
}): string {
  const throughputRows = includeZeroWeeks ? weeklyThroughput : weeklyThroughput.filter((row) => row.throughput > 0);
  const effectiveNote =
    title.includes("Historique corr\u00E9l\u00E9")
      ? "La distribution repose sur des semaines communes observées ; ce caractère observé ne valide ni la crédibilité future du scénario, ni la substituabilité ou les dépendances entre équipes."
      : note;
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
  const totalSimulationCount = completionSummary
    ? completionSummary.completed_count + completionSummary.censored_count
    : undefined;
  const probabilityPoints = buildProbabilityCurve(sortedDistribution, resultKind, totalSimulationCount);
  const effectivePercentiles = displayPercentiles;

  const throughputSvg = renderThroughputChart(throughputPoints, throughputChartTitle);
  const distributionSvg = renderDistributionChart(distributionPoints);
  const probabilitySvg = renderProbabilityChart(probabilityPoints);
  const modeSummary =
    simulationMode === "backlog_to_weeks"
      ? `Backlog vers semaines - backlog: ${String(backlogSize)} items`
      : `Semaines vers items - cible: ${String(targetWeeks)} semaines`;
  const typeSummary = types.length ? types.join(", ") : "Agrégé portefeuille";
  const stateSummary = doneStates.length ? doneStates.join(", ") : "Agrégé portefeuille";
  const resultLabel = resultKind === "items" ? "items (au moins)" : "semaines (au plus)";
  const modeZeroLabel = includeZeroWeeks ? "Semaines 0 incluses" : "Semaines 0 exclues";
  const risk = resolveRiskScore({
    simulationMode,
    displayPercentiles: effectivePercentiles,
    riskScore,
  });
  const reliabilitySummary = showSourceDiagnostic ? buildReliabilitySummary(throughputReliability) : "";
  const reliabilityScoreLabel = showSourceDiagnostic ? formatReliabilityScore(throughputReliability) : "";

  return `
    <section class="page ${pageBreak ? "page-break" : ""}">
      <header class="header">
        <h1 class="title">${escapeHtml(title)}</h1>
        ${subtitle ? `<div class="subtitle"><i>${escapeHtml(subtitle)}</i></div>` : ""}
        <div class="summary-grid">
          <div class="meta">
          <div class="meta-row"><b>Projet:</b> ${escapeHtml(selectedProject)}</div>
          <div class="meta-row"><b>Période:</b> ${escapeHtml(startDate)} au ${escapeHtml(endDate)}</div>
          <div class="meta-row"><b>Mode:</b> ${escapeHtml(modeSummary)}</div>
          <div class="meta-row"><b>Tickets:</b> ${escapeHtml(typeSummary)}</div>
          <div class="meta-row"><b>États:</b> ${escapeHtml(stateSummary)}</div>
          <div class="meta-row"><b>Échantillon:</b> ${escapeHtml(modeZeroLabel)}</div>
          <div class="meta-row"><b>Simulations:</b> ${escapeHtml(String(nSims))}</div>
          </div>
          ${showSourceDiagnostic && throughputReliability ? `<aside class="diagnostic-card">
            <h2 class="diagnostic-title">Diagnostic</h2>
            <div class="meta-row"><b>Lecture:</b> ${escapeHtml(reliabilitySummary)}</div>
            ${renderTechnicalMetricRow("CV", throughputReliability.cv)}
            ${renderTechnicalMetricRow("IQR ratio", throughputReliability.iqr_ratio)}
            ${renderTechnicalMetricRow("Pente normalisée", throughputReliability.slope_norm)}
            ${Number.isFinite(throughputReliability.samples_count) ? `<div class="meta-row"><b>Semaines utilisées:</b> ${escapeHtml(String(throughputReliability.samples_count))}</div>` : ""}
          </aside>` : ""}
        </div>
      </header>

      <section class="kpis">
        ${["P50", "P70", "P90"]
          .filter((key) => {
            const value = effectivePercentiles?.[key as keyof ForecastPercentiles];
            return typeof value === "number" && Number.isFinite(value);
          })
          .map(
            (key) =>
              `<div class="kpi"><span class="kpi-label">${key}</span><span class="kpi-value">${formatPercentile(effectivePercentiles?.[key as keyof ForecastPercentiles])} ${escapeHtml(resultLabel)}</span></div>`,
          )
          .join("")}
      </section>
      <section class="kpis">
        ${
          risk
            ? `<div class="kpi"><span class="kpi-label">Risk Score</span><span class="kpi-value">${escapeHtml(risk.valueLabel)} <span style="color:${riskColor(risk.label)}">(${escapeHtml(risk.label)})</span></span></div>`
            : ""
        }
        ${showSourceDiagnostic ? `<div class="kpi"><span class="kpi-label">Fiabilité</span><span class="kpi-value">${escapeHtml(reliabilityScoreLabel)}</span></div>` : ""}
      </section>
      ${showSourceDiagnostic ? renderDecisionDiagnosticHtml(decisionDiagnostic) : ""}
      ${
        completionSummary && completionSummary.censored_count > 0
          ? `<section class="section"><div class="meta"><div class="meta-row"><b>Limite d'horizon:</b> ${escapeHtml(String(completionSummary.horizon_weeks))} semaines</div><div class="meta-row"><b>Censures:</b> ${escapeHtml(String(completionSummary.censored_count))} sur ${escapeHtml(String(completionSummary.completed_count + completionSummary.censored_count))} (${escapeHtml(formatMetric(completionSummary.censored_rate))})</div><div class="meta-row"><b>Lecture:</b> la distribution et les percentiles ne couvrent que les simulations terminées. Un percentile absent n'est pas identifiable avant l'horizon.</div></div></section>`
          : ""
      }

      <section class="section">
        <h2>${escapeHtml(throughputChartTitle)}</h2>
        <div class="chart-wrap">${throughputSvg}</div>
        ${effectiveNote ? `<div class="note">${escapeHtml(effectiveNote)}</div>` : ""}
      </section>

      <section class="section">
        <h2>Distribution Monte Carlo</h2>
        <div class="chart-wrap">${distributionSvg}</div>
      </section>

      <section class="section">
        <h2>Courbe de probabilit\u00E9</h2>
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
  alignmentRate,
  simulationMode,
  backlogSize,
  targetWeeks,
  scenarios,
}: {
  selectedProject: string;
  startDate: string;
  endDate: string;
  includedTeams: string[];
  alignmentRate: number;
  simulationMode: "backlog_to_weeks" | "weeks_to_items";
  backlogSize: number;
  targetWeeks: number;
  scenarios: PortfolioScenarioResult[];
}): string {
  const orderedScenarios = [...scenarios].sort((a, b) => getScenarioOrder(a.label) - getScenarioOrder(b.label));
  const effectiveFrictionLabel =
    orderedScenarios.find((scenario) => scenario.label.startsWith("Friction"))?.label ??
    `Friction (${computeFrictionRatePercent(includedTeams.length, alignmentRate)}%)`;

  const rows = orderedScenarios
    .map((scenario) => {
      const effectivePercentiles = scenario.percentiles;
      const computedRisk = computeRiskScoreFromPercentiles(simulationMode, effectivePercentiles);
      const risk =
        typeof scenario.riskScore === "number" && Number.isFinite(scenario.riskScore)
          ? formatRiskScoreFromValue(scenario.riskScore)
          : computedRisk == null
            ? null
            : formatRiskScoreFromValue(computedRisk);
      return `
        <tr>
          <td>${escapeHtml(formatScenarioDisplayLabel(scenario.label))}</td>
          <td>${formatPercentile(effectivePercentiles.P50)}</td>
          <td>${formatPercentile(effectivePercentiles.P70)}</td>
          <td>${formatPercentile(effectivePercentiles.P90)}</td>
          <td>${risk ? `<span class="risk-chip" style="color:${riskColor(risk.label)}">${escapeHtml(risk.valueLabel)} (${escapeHtml(risk.label)})</span>` : ""}</td>
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
    const totalSimulationCount = scenario.completionSummary
      ? scenario.completionSummary.completed_count + scenario.completionSummary.censored_count
      : undefined;
    const points = buildProbabilityCurve(sortedDistribution, summaryResultKind, totalSimulationCount);
    const color = scenario.label === "Optimiste"
      ? "#15803d"
      : scenario.label.startsWith("Arrime")
        ? "#2563eb"
        : scenario.label.startsWith("Friction")
          ? "#d97706"
          : "#dc2626";
    return {
      label: formatScenarioDisplayLabel(scenario.label),
      color,
      points,
    };
  });
  const overlaySvg = renderOverlayProbabilityChart(overlaySeries);

  const hypothesisBlocks: HypothesisBlock[] = [
    {
      kind: "paragraph",
      lead: "Indépendant :",
      emphasizedLead: true,
      body:
        " addition de tirages synthétiques reconstruits par bootstrap. L’indépendance est modélisée, sans être étayée par une observation historique.",
    },
    {
      kind: "paragraph",
      lead: "Arrim\u00E9 :",
      emphasizedLead: true,
      body:
        ` ${String(alignmentRate)}% de la capacité combinée, à partir d’un paramètre saisi par l’utilisateur ; ce taux est une exploration, pas un fait historique démontré.`,
    },
    {
      kind: "paragraph",
      lead: `${formatScenarioDisplayLabel(effectiveFrictionLabel)} :`,
      emphasizedLead: true,
      body:
        ` ${effectiveFrictionLabel.replace("Friction ", "")} de la capacité combinée, calculée à partir du paramètre saisi ; ce calcul ne constitue pas une observation historique.`,
    },
    {
      kind: "paragraph",
      lead: "Historique corr\u00E9l\u00E9 :",
      emphasizedLead: true,
      body:
        " agrégation des semaines historiques communes observées. Ce caractère observé ne valide pas automatiquement ce scénario ni sa crédibilité future.",
    },
    {
      kind: "paragraph",
      lead: "Risk Score :",
      emphasizedLead: true,
      body:
        ` ${
          simulationMode === "weeks_to_items" ? "(P50 - P90) / P50." : "(P90 - P50) / P50."
        } Plus le score est faible, plus la pr\u00E9vision est stable. Le Risk Score mesure la dispersion du r\u00E9sultat simul\u00E9 - il ne qualifie pas la fiabilit\u00E9 des donn\u00E9es sources.`,
    },
    {
      kind: "paragraph",
      lead: "Fiabilit\u00E9 de l'historique :",
      emphasizedLead: true,
      body:
        " combinaison de trois signaux - dispersion globale du throughput (coefficient de variation), dispersion hors valeurs extr\u00EAmes (IQR ratio), et tendance r\u00E9cente (r\u00E9gression lin\u00E9aire sur la p\u00E9riode retenue). Quatre niveaux : fiable - historique stable, pas de tendance marqu\u00E9e / incertain - dispersion mod\u00E9r\u00E9e ou historique court / fragile - forte volatilit\u00E9 ou tendance descendante / non fiable - historique trop court ou effondrement du throughput. \u00C0 lire avant le Risk Score : un historique fragile limite la port\u00E9e d\u00E9cisionnelle de l'ensemble de la simulation.",
    },
    {
      kind: "reading-rule",
      lead: "R\u00E8gle de lecture :",
      body:
        "Commencer par la fiabilit\u00E9 de l'historique, puis le Risk Score, puis les percentiles. Un P90 sur un historique fiable et un Risk Score faible constitue un engagement d\u00E9fendable. Le m\u00EAme P90 sur un historique fragile reste un chiffre calculable - mais son usage en comit\u00E9 n\u00E9cessite de mentionner explicitement les limites de l'historique source.",
    },
  ];
  const summaryHypothesisColumns = [hypothesisBlocks.slice(0, 4), hypothesisBlocks.slice(4)];

  return `
    <section class="page page-break">
      <header class="header">
        <h1 class="title">Synth\u00E8se - Simulation Portefeuille</h1>
        <div class="meta">
          <div class="meta-row"><b>Projet:</b> ${escapeHtml(selectedProject)}</div>
          <div class="meta-row"><b>P\u00E9riode:</b> ${escapeHtml(startDate)} au ${escapeHtml(endDate)}</div>
          <div class="meta-row"><b>Mode:</b> ${escapeHtml(
            simulationMode === "backlog_to_weeks"
              ? `Backlog vers semaines - backlog: ${String(backlogSize)} items`
              : `Semaines vers items - cible: ${String(targetWeeks)} semaines`,
          )}</div>
          <div class="meta-row"><b>\u00C9quipes incluses:</b> ${escapeHtml(includedTeams.join(", ") || "Aucune")}</div>
          <div class="meta-row"><b>Taux d'arrimage:</b> ${escapeHtml(String(alignmentRate))}%</div>
        </div>
      </header>

      <section class="section">
        <h2>Synth\u00E8se d\u00E9cisionnelle</h2>
        <table class="summary-table summary-table--compact">
          <colgroup>
            <col class="summary-col summary-col--scenario" />
            <col class="summary-col summary-col--percentile" />
            <col class="summary-col summary-col--percentile" />
            <col class="summary-col summary-col--percentile" />
            <col class="summary-col summary-col--risk" />
          </colgroup>
          <thead>
            <tr><th>Sc\u00E9nario</th><th>P50</th><th>P70</th><th>P90</th><th>Risk Score</th></tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </section>

      <section class="section section--summary-chart">
        <h2>Courbes de probabilit\u00E9s compar\u00E9es</h2>
        <div class="chart-wrap">${overlaySvg}</div>
      </section>

      <section class="section section--hypotheses">
        <h2>Hypoth\u00E8ses</h2>
        <div class="hypothesis-grid">
          ${summaryHypothesisColumns
            .map((column) => `<div class="hypothesis-column">${column.map((block) => renderHypothesisBlock(block)).join("")}</div>`)
            .join("")}
        </div>
      </section>
    </section>
  `;
}

function buildComparisonPage(
  diagnostic: PortfolioComparisonDiagnostic,
  pilotReference: PortfolioPilotReference,
): string {
  const presentation = presentPortfolioComparisonDiagnostic(diagnostic, pilotReference);
  const scenarioCredibilities = presentation.scenarioCredibilities
    .map((hypothesis) => `
      <article class="comparison-hypothesis">
        <h3>${escapeHtml(hypothesis.label)}</h3>
        <p class="comparison-evidence-type">${escapeHtml(hypothesis.evidenceTypeLabel)}</p>
        <p>${escapeHtml(hypothesis.evidence)}</p>
        <h4>Limites à garder en tête</h4>
        <ul>${hypothesis.limitations.map((limitation) => `<li>${escapeHtml(limitation)}</li>`).join("")}</ul>
      </article>
    `)
    .join("");
  const risks = presentation.significantRiskStatements.length
    ? `<ul class="comparison-risks">${presentation.significantRiskStatements.map((statement) => `<li>${escapeHtml(statement)}</li>`).join("")}</ul>`
    : "<p>Aucun risque significatif d’équipe n’est remonté par le diagnostic.</p>";

  return `
    <section class="page page-break comparison-page">
      <div class="comparison-intro">
        <header class="header"><h1 class="title">Comparaison des hypothèses</h1></header>
        <section class="section comparison-overview">
          <h2>Conclusion comparative</h2>
          <p>${escapeHtml(presentation.conclusion)}</p>
          <div class="comparison-confidence"><strong>Niveau de confiance comparatif</strong><br />${escapeHtml(presentation.comparisonConfidence)}</div>
          <div class="comparison-label-value"><strong>Recommandation issue des preuves</strong><br />${escapeHtml(presentation.evidenceRecommendation)}</div>
          ${presentation.preconization ? `<div class="comparison-label-value"><strong>Préconisation</strong><br />${escapeHtml(presentation.preconization)}</div>` : ""}
          <div class="comparison-label-value comparison-pilot-reference"><strong>Référence de pilotage</strong><br />${escapeHtml(presentation.pilotReferenceLabel)}</div>
          ${presentation.pilotReferenceGovernanceNote ? `<p class="comparison-governance-note">${escapeHtml(presentation.pilotReferenceGovernanceNote)}</p>` : ""}
        </section>
      </div>
      <section class="section">
        <h2>Lecture comparative</h2>
        <div class="comparison-hypotheses">${scenarioCredibilities}</div>
      </section>
      <section class="section">
        <h2>Faits à vérifier</h2>
        ${risks}
      </section>
      <section class="section comparison-readings">
        <h2>Trois lectures distinctes</h2>
        <div><strong>Qualité des données historiques</strong><br />${escapeHtml(presentation.historicalDataQuality)} : ce que les semaines observées permettent d’étayer.</div>
        <div><strong>Stabilité des résultats simulés</strong><br />La régularité des résultats simulés ne valide pas une hypothèse de portefeuille.</div>
        <div><strong>Crédibilité des hypothèses portefeuille</strong><br />Elle dépend du type de preuve et des limites affichées pour chaque hypothèse.</div>
      </section>
    </section>
  `;
}

type PortfolioPrintReportArgs = {
  isDemo?: boolean;
  selectedProject: string;
  startDate: string;
  endDate: string;
  alignmentRate: number;
  includedTeams: string[];
  sections: PortfolioSectionInput[];
  scenarios: PortfolioScenarioResult[];
  portfolioComparisonDiagnostic?: PortfolioComparisonDiagnostic | null;
  pilotReference?: PortfolioPilotReference;
};

export function buildPortfolioPrintReportHtml({
  selectedProject,
  startDate,
  endDate,
  alignmentRate,
  includedTeams,
  sections,
  scenarios,
  portfolioComparisonDiagnostic,
  pilotReference = null,
}: PortfolioPrintReportArgs): string {
  const simulationMode = sections[0]?.simulationMode ?? "backlog_to_weeks";
  const orderedScenarios = [...scenarios].sort((a, b) => getScenarioOrder(a.label) - getScenarioOrder(b.label));

  const summaryPage = buildSummaryPage({
    selectedProject,
    startDate,
    endDate,
    includedTeams,
    alignmentRate,
    simulationMode,
    backlogSize: sections[0]?.backlogSize ?? 0,
    targetWeeks: sections[0]?.targetWeeks ?? 0,
    scenarios: orderedScenarios,
  });
  const comparisonPage = portfolioComparisonDiagnostic
    ? buildComparisonPage(portfolioComparisonDiagnostic, pilotReference)
    : "";

  const scenarioPages = orderedScenarios
    .map((scenario, idx) =>
      buildTeamLikePageHtml({
        title: `Scénario - ${formatScenarioDisplayLabel(scenario.label)}`,
        subtitle: undefined,
        selectedProject,
        startDate,
        endDate,
        simulationMode,
        includeZeroWeeks: true,
        backlogSize: sections[0]?.backlogSize ?? 0,
        targetWeeks: sections[0]?.targetWeeks ?? 0,
        nSims: sections[0]?.nSims ?? 0,
        types: [],
        doneStates: [],
        resultKind: simulationMode === "weeks_to_items" ? "items" : "weeks",
        distribution: scenario.distribution,
        weeklyThroughput: scenario.weeklyData,
        displayPercentiles: scenario.percentiles,
        riskScore: scenario.riskScore,
        completionSummary: scenario.completionSummary,
        throughputReliability: scenario.throughputReliability,
        decisionDiagnostic: scenario.decisionDiagnostic,
        throughputChartTitle:
          scenario.label === "Historique corr\u00E9l\u00E9" ? "Throughput historique corr\u00E9l\u00E9" : "D\u00E9bit simul\u00E9 du sc\u00E9nario",
        note:
          scenario.label === "Historique corr\u00E9l\u00E9"
            ? undefined
            : "D\u00E9bit synth\u00E9tique reconstruit par bootstrap, non issu de l'historique r\u00E9el.",
        pageBreak: idx < orderedScenarios.length - 1 || sections.length > 0,
        showSourceDiagnostic: false,
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
        types: section.types ?? [],
        doneStates: section.doneStates ?? [],
        resultKind: section.resultKind,
        distribution: section.distribution,
        weeklyThroughput: section.weeklyThroughput,
        displayPercentiles: section.displayPercentiles,
        riskScore: section.riskScore,
        completionSummary: section.completionSummary,
        decisionDiagnostic: section.decisionDiagnostic,
        throughputReliability: section.throughputReliability,
        throughputChartTitle: "Throughput hebdomadaire",
        pageBreak: idx < sections.length - 1,
        showSourceDiagnostic: true,
      }),
    )
    .join("");

  return `
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
        .summary-grid { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(260px, 0.9fr); gap: 8px; margin-top: 6px; }
        .meta { margin-top: 6px; padding: 6px 8px; border: 1px solid #d1d5db; border-radius: 8px; background: #f9fafb; font-size: 11px; line-height: 1.35; }
        .diagnostic-card { margin-top: 6px; padding: 6px 8px; border: 1px solid #d1d5db; border-radius: 8px; background: #f9fafb; font-size: 11px; line-height: 1.35; }
        .diagnostic-title { margin: 0 0 4px 0; font-size: 12px; font-weight: 700; color: #374151; }
        .meta-row { margin-bottom: 2px; }
        .kpis { display: flex; gap: 6px; margin-top: 8px; margin-bottom: 8px; }
        .kpi { border: 1px solid #d1d5db; border-radius: 8px; padding: 6px 8px; min-width: 140px; background: #f9fafb; }
        .kpi-label { display: block; font-size: 11px; color: #374151; font-weight: 700; }
        .kpi-value { display: block; margin-top: 2px; font-size: 16px; font-weight: 800; }
        .section { margin-top: 8px; page-break-inside: avoid; }
        .decision-diagnostic { padding: 6px 8px; border: 1px solid #d1d5db; border-radius: 8px; background: #f9fafb; font-size: 11px; line-height: 1.35; break-inside: avoid; }
        .decision-dimension + .decision-dimension { margin-top: 6px; padding-top: 6px; border-top: 1px solid #e5e7eb; }
        .decision-factors { margin: 3px 0; padding-left: 16px; }
        .section--summary-chart { page-break-after: auto; break-after: auto; }
        .section--hypotheses { margin-top: 8px; break-before: auto; page-break-before: auto; break-inside: auto; page-break-inside: auto; }
        .comparison-page .section { page-break-inside: auto; break-inside: auto; }
        .comparison-intro { break-inside: avoid; page-break-inside: avoid; }
        .comparison-overview, .comparison-confidence, .comparison-hypothesis, .comparison-readings > div, .comparison-risks > li { overflow-wrap: anywhere; word-break: break-word; }
        .comparison-confidence, .comparison-hypothesis, .comparison-readings > div, .comparison-risks > li { border: 1px solid #d1d5db; border-radius: 8px; background: #f9fafb; padding: 7px 8px; }
        .comparison-label-value { margin-top: 5px; }
        .comparison-pilot-reference { border-left: 3px solid #6b7280; padding-left: 7px; }
        .comparison-governance-note { color: #4b5563; font-style: italic; }
        .comparison-hypotheses { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
        .comparison-hypothesis { break-inside: avoid; page-break-inside: avoid; }
        .comparison-hypothesis h3, .comparison-hypothesis h4 { margin: 0 0 4px 0; }
        .comparison-hypothesis h3 { font-size: 12px; }
        .comparison-hypothesis h4, .comparison-evidence-type { font-size: 11px; }
        .comparison-evidence-type { margin: 0 0 5px 0; font-weight: 700; color: #374151; }
        .comparison-hypothesis p, .comparison-hypothesis ul, .comparison-risks { margin: 4px 0; }
        .comparison-hypothesis ul, .comparison-risks { padding-left: 18px; }
        .comparison-risks { display: grid; gap: 6px; list-style-position: inside; padding-left: 0; }
        .comparison-readings { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
        .comparison-page h2, .comparison-hypothesis h3, .comparison-hypothesis h4 { break-after: avoid; page-break-after: avoid; }
        .comparison-readings h2 { grid-column: 1 / -1; }
        .section h2 { margin: 0 0 4px 0; font-size: 14px; }
        .note { margin-top: 4px; font-size: 11px; color: #4b5563; }
        .chart-wrap { width: 100%; overflow: hidden; border: 1px solid #d1d5db; border-radius: 8px; padding: 4px; background: #fff; }
        .chart-wrap svg { width: 100%; height: auto; display: block; }
        .summary-table { width: 100%; border-collapse: collapse; font-size: 10px; table-layout: fixed; }
        .summary-table--compact .summary-col--scenario { width: 32%; }
        .summary-table--compact .summary-col--percentile { width: 14%; }
        .summary-table--compact .summary-col--risk { width: 26%; }
        .summary-table th, .summary-table td { border: 1px solid #d1d5db; padding: 4px; text-align: left; vertical-align: top; overflow-wrap: anywhere; word-break: break-word; }
        .summary-table th { background: #f3f4f6; }
        .risk-chip { font-weight: 700; }
        .hypothesis-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); column-gap: 14px; }
        .hypothesis-column { min-width: 0; }
        .hypothesis { margin: 4px 0; font-size: 12px; }
        .section--hypotheses .hypothesis { margin: 0 0 3px; font-size: 10px; line-height: 1.25; }
        .hypothesis strong { font-weight: 700; }
        .reading-rule { margin-top: 10px; font-size: 13px; line-height: 1.4; }
        .section--hypotheses .reading-rule { margin-top: 4px; font-size: 10px; line-height: 1.28; }
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
          .hypothesis-grid { display: block; column-count: 2; column-gap: 14px; }
          .hypothesis-column { break-inside: auto; page-break-inside: auto; }
          .section--hypotheses .hypothesis { break-inside: avoid; page-break-inside: avoid; }
          .comparison-hypotheses { display: block; column-count: 2; column-gap: 14px; }
          .comparison-hypothesis { margin-bottom: 8px; }
        }
        @media (max-width: 720px) {
          .summary-grid { grid-template-columns: 1fr; }
          .comparison-hypotheses, .comparison-readings { grid-template-columns: 1fr; column-count: 1; }
        }
      </style>
    </head>
    <body>
      ${summaryPage}
      ${comparisonPage}
      ${scenarioPages}
      ${teamPages}
    </body>
    </html>
  `;
}

export async function exportPortfolioPrintReport(
  args: Parameters<typeof buildPortfolioPrintReportHtml>[0],
): Promise<void> {
  const reportDocument = buildDetachedReportDocument(buildPortfolioPrintReportHtml(args));
  try {
    await downloadPortfolioPdf(reportDocument, args.selectedProject, args.isDemo);
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : String(err);
    if (typeof window.alert === "function") {
      window.alert(`Echec generation PDF: ${message}`);
    }
    throw err;
  }
}
