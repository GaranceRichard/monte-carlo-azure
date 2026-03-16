import type { ForecastKind } from "../../types";
import type { ThroughputReliability } from "../../types";
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

function formatScenarioDisplayLabel(label: string): string {
  return label.startsWith("Arrime") ? label.replace("Arrime", "Arrim\u00E9") : label;
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
  displayPercentiles: Record<string, number>;
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

function formatMetric(value: number): string {
  return Number(value ?? 0).toFixed(2).replace(".", ",");
}

function formatReliabilityScore(reliability?: ThroughputReliability | null): string {
  if (!reliability) return "Non disponible";
  return `${formatMetric(reliability.cv)} (${reliability.label})`;
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
      text: "Throughput en forte baisse sur les dernieres semaines.",
    },
    {
      matches: reliability.slope_norm <= -0.05,
      text: "Throughput en baisse sur les dernieres semaines.",
    },
    {
      matches: reliability.slope_norm >= 0.1,
      text: "Throughput en forte hausse sur les dernieres semaines.",
    },
    {
      matches: reliability.slope_norm >= 0.05,
      text: "Throughput en hausse sur les dernieres semaines.",
    },
    {
      matches: reliability.cv >= 1 || reliability.iqr_ratio >= 1,
      text: "Dispersion elevee du throughput historique.",
    },
    {
      matches: reliability.samples_count < 8,
      text: "Volume historique encore limite.",
    },
  ].find((entry) => entry.matches);

  return summary?.text ?? "Historique globalement stable.";
}

function renderHypothesisBlock(block: HypothesisBlock): string {
  if (block.kind === "reading-rule") {
    return `<p class="hypothesis reading-rule"><strong>${escapeHtml(block.lead)}</strong><br />${escapeHtml(block.body)}</p>`;
  }

  if (!block.lead) {
    return `<p class="hypothesis">${escapeHtml(block.body)}</p>`;
  }

  return `<p class="hypothesis">${block.emphasizedLead ? `<strong>${escapeHtml(block.lead)}</strong>` : escapeHtml(block.lead)}${escapeHtml(block.body)}</p>`;
}

function resolveRiskScore({
  simulationMode,
  resultKind,
  displayPercentiles,
  distribution,
  riskScore,
}: {
  simulationMode: "backlog_to_weeks" | "weeks_to_items";
  resultKind: ForecastKind;
  displayPercentiles: Record<string, number>;
  distribution: Array<{ x: number; count: number }>;
  riskScore?: number;
}): { score: number; label: string; valueLabel: string } {
  const effectivePercentiles =
    resultKind === "items" ? buildAtLeastPercentiles(distribution, [50, 70, 90]) : displayPercentiles;
  if (resultKind === "items") {
    return formatRiskScore(simulationMode, effectivePercentiles);
  }
  if (typeof riskScore === "number" && Number.isFinite(riskScore)) {
    return formatRiskScoreFromValue(riskScore);
  }
  return formatRiskScore(simulationMode, effectivePercentiles);
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
  throughputReliability,
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
  types?: string[];
  doneStates?: string[];
  resultKind: ForecastKind;
  distribution: Array<{ x: number; count: number }>;
  weeklyThroughput: Array<{ week: string; throughput: number }>;
  displayPercentiles: Record<string, number>;
  riskScore?: number;
  throughputReliability?: ThroughputReliability | null;
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

  const throughputSvg = renderThroughputChart(throughputPoints).replaceAll(
    "Throughput hebdomadaire",
    "Courbes de probabilités comparées",
  );
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
    resultKind,
    displayPercentiles: effectivePercentiles,
    distribution: sortedDistribution,
    riskScore,
  });
  const reliabilitySummary = buildReliabilitySummary(throughputReliability);
  const reliabilityScoreLabel = formatReliabilityScore(throughputReliability);

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
          <div class="meta-row"><b>Etats:</b> ${escapeHtml(stateSummary)}</div>
          <div class="meta-row"><b>Échantillon:</b> ${escapeHtml(modeZeroLabel)}</div>
          <div class="meta-row"><b>Simulations:</b> ${escapeHtml(String(nSims))}</div>
          </div>
          <aside class="diagnostic-card">
            <h2 class="diagnostic-title">Diagnostic</h2>
            <div class="meta-row"><b>Lecture:</b> ${escapeHtml(reliabilitySummary)}</div>
            <div class="meta-row"><b>CV:</b> ${escapeHtml(formatMetric(throughputReliability?.cv ?? 0))}</div>
            <div class="meta-row"><b>IQR ratio:</b> ${escapeHtml(formatMetric(throughputReliability?.iqr_ratio ?? 0))}</div>
            <div class="meta-row"><b>Pente normalisee:</b> ${escapeHtml(formatMetric(throughputReliability?.slope_norm ?? 0))}</div>
            <div class="meta-row"><b>Semaines utilisees:</b> ${escapeHtml(String(throughputReliability?.samples_count ?? 0))}</div>
          </aside>
        </div>
      </header>

      <section class="kpis">
        <div class="kpi"><span class="kpi-label">P50</span><span class="kpi-value">${Number(effectivePercentiles?.P50 ?? 0).toFixed(0)} ${escapeHtml(resultLabel)}</span></div>
        <div class="kpi"><span class="kpi-label">P70</span><span class="kpi-value">${Number(effectivePercentiles?.P70 ?? 0).toFixed(0)} ${escapeHtml(resultLabel)}</span></div>
        <div class="kpi"><span class="kpi-label">P90</span><span class="kpi-value">${Number(effectivePercentiles?.P90 ?? 0).toFixed(0)} ${escapeHtml(resultLabel)}</span></div>
      </section>
      <section class="kpis">
        <div class="kpi"><span class="kpi-label">Risk Score</span><span class="kpi-value">${escapeHtml(risk.valueLabel)} <span style="color:${riskColor(risk.label)}">(${escapeHtml(risk.label)})</span></span></div>
        <div class="kpi"><span class="kpi-label">Fiabilite</span><span class="kpi-value">${escapeHtml(reliabilityScoreLabel)}</span></div>
      </section>

      <section class="section">
        <h2>Courbes de probabilit\u00E9s compar\u00E9es</h2>
        <div class="chart-wrap">${throughputSvg}</div>
        ${note ? `<div class="note">${escapeHtml(note)}</div>` : ""}
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
    `Friction (${Math.round((Math.max(0, Math.min(100, alignmentRate)) / 100) ** includedTeams.length * 100)}%)`;

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
      const reliability = formatReliabilityScore(scenario.throughputReliability);
      return `
        <tr>
          <td>${escapeHtml(formatScenarioDisplayLabel(scenario.label))}</td>
          <td>${Number(effectivePercentiles.P50 ?? 0).toFixed(0)}</td>
          <td>${Number(effectivePercentiles.P70 ?? 0).toFixed(0)}</td>
          <td>${Number(effectivePercentiles.P90 ?? 0).toFixed(0)}</td>
          <td><span class="risk-chip" style="color:${riskColor(risk.label)}">${escapeHtml(risk.valueLabel)} (${escapeHtml(risk.label)})</span></td>
          <td>${escapeHtml(reliability)}</td>
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
      label: formatScenarioDisplayLabel(scenario.label),
      color,
      points,
    };
  });
  const overlaySvg = renderOverlayProbabilityChart(overlaySeries);

  const hypothesisBlocks: HypothesisBlock[] = [
    {
      kind: "paragraph",
      lead: "Optimiste :",
      emphasizedLead: true,
      body:
        " Somme des d\u00E9bits de toutes les \u00E9quipes. Hypoth\u00E8se : livraison ind\u00E9pendante, aucun co\u00FBt de synchronisation inter-\u00E9quipes. En pr\u00E9sence de d\u00E9pendances fortes entre \u00E9quipes, pr\u00E9f\u00E9rer les sc\u00E9narios Arrim\u00E9 ou Friction.",
    },
    {
      kind: "paragraph",
      lead: "Arrim\u00E9 :",
      emphasizedLead: true,
      body:
        ` ${String(alignmentRate)}% de la capacit\u00E9 combin\u00E9e. Hypoth\u00E8se : co\u00FBts de synchronisation (c\u00E9r\u00E9monies, d\u00E9pendances, alignement) absorb\u00E9s sur le d\u00E9bit global.`,
    },
    {
      kind: "paragraph",
      lead: `${formatScenarioDisplayLabel(effectiveFrictionLabel)} :`,
      emphasizedLead: true,
      body:
        ` ${effectiveFrictionLabel.replace("Friction ", "")} de la capacit\u00E9 combin\u00E9e. Hypoth\u00E8se : chaque \u00E9quipe suppl\u00E9mentaire absorbe un co\u00FBt d'alignement identique.`,
    },
    {
      kind: "paragraph",
      body:
        "Conservateur : D\u00E9bit m\u00E9dian des \u00E9quipes x nb \u00E9quipes. Hypoth\u00E8se : le portefeuille est contraint par l'\u00E9quipe m\u00E9diane, pas par la pire.",
    },
    {
      kind: "paragraph",
      lead: "Risk Score :",
      emphasizedLead: true,
      body:
        " (P90 - P50) / P50. Plus le score est faible, plus la pr\u00E9vision est stable. Le Risk Score mesure la dispersion du r\u00E9sultat simul\u00E9 - il ne qualifie pas la fiabilit\u00E9 des donn\u00E9es sources.",
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
        "Commencer par la fiabilit\u00E9 de l'historique, puis le Risk Score, puis les percentiles. Un P85 sur un historique fiable et un Risk Score faible constitue un engagement d\u00E9fendable. Le m\u00EAme P85 sur un historique fragile reste un chiffre calculable - mais son usage en comit\u00E9 n\u00E9cessite de mentionner explicitement les limites de l'historique source.",
    },
  ];

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
            <col class="summary-col summary-col--reliability" />
          </colgroup>
          <thead>
            <tr><th>Sc\u00E9nario</th><th>P50</th><th>P70</th><th>P90</th><th>Risk Score</th><th>Fiabilit\u00E9</th></tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </section>

      <section class="section">
        <h2>Courbes de probabilit\u00E9s compar\u00E9es</h2>
        <div class="chart-wrap">${overlaySvg}</div>
      </section>

      <section class="section section--hypotheses">
        <h2>Hypoth\u00E8ses</h2>
        ${hypothesisBlocks.map((block) => renderHypothesisBlock(block)).join("")}
      </section>
    </section>
  `;
}

export function exportPortfolioPrintReport({
  selectedProject,
  startDate,
  endDate,
  alignmentRate,
  includedTeams,
  sections,
  scenarios,
}: {
  selectedProject: string;
  startDate: string;
  endDate: string;
  alignmentRate: number;
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
    alignmentRate,
    simulationMode,
    backlogSize: sections[0]?.backlogSize ?? 0,
    targetWeeks: sections[0]?.targetWeeks ?? 0,
    scenarios: orderedScenarios,
  });

  const scenarioPages = orderedScenarios
    .map((scenario, idx) =>
      buildTeamLikePageHtml({
        title: `Scénario - ${formatScenarioDisplayLabel(scenario.label)}`,
        subtitle: scenario.hypothesis,
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
        throughputReliability: scenario.throughputReliability,
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
        types: section.types ?? [],
        doneStates: section.doneStates ?? [],
        resultKind: section.resultKind,
        distribution: section.distribution,
        weeklyThroughput: section.weeklyThroughput,
        displayPercentiles: section.displayPercentiles,
        riskScore: section.riskScore,
        throughputReliability: section.throughputReliability,
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
        .section--hypotheses { margin-top: 24px; }
        .section h2 { margin: 0 0 4px 0; font-size: 14px; }
        .note { margin-top: 4px; font-size: 11px; color: #4b5563; }
        .chart-wrap { width: 100%; overflow: hidden; border: 1px solid #d1d5db; border-radius: 8px; padding: 4px; background: #fff; }
        .chart-wrap svg { width: 100%; height: auto; display: block; }
        .summary-table { width: 100%; border-collapse: collapse; font-size: 10px; table-layout: fixed; }
        .summary-table--compact .summary-col--scenario { width: 24%; }
        .summary-table--compact .summary-col--percentile { width: 10%; }
        .summary-table--compact .summary-col--risk { width: 20%; }
        .summary-table--compact .summary-col--reliability { width: 26%; }
        .summary-table th, .summary-table td { border: 1px solid #d1d5db; padding: 4px; text-align: left; vertical-align: top; overflow-wrap: anywhere; word-break: break-word; }
        .summary-table th { background: #f3f4f6; }
        .risk-chip { font-weight: 700; }
        .hypothesis { margin: 4px 0; font-size: 12px; }
        .hypothesis strong { font-weight: 700; }
        .reading-rule { margin-top: 10px; font-size: 13px; line-height: 1.4; }
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
        @media (max-width: 720px) {
          .summary-grid { grid-template-columns: 1fr; }
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
