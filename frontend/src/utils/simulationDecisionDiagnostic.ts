import type { CompletionSummary, ForecastMode, ForecastPercentiles, ThroughputReliability } from "../types";
import type { SimulationHistoryEntry } from "../hooks/simulationTypes";
import {
  countUsableThroughputSamples,
  diagnoseDataQuality,
  diagnoseForecastUncertainty,
  diagnoseHistoricalWindowSensitivity,
  recommendArbitration,
} from "./forecastDiagnostics";
import { buildDecisionLanguage, type DecisionLanguage, type DecisionLanguageDimension } from "./decisionLanguage";

const TECHNICAL_FACTOR_CODES = new Set([
  "forecast_percentile_spread",
  "coefficient_of_variation",
  "iqr_ratio",
  "normalized_slope",
]);

type SimulationDecisionDiagnosticInput = {
  hasResult: boolean;
  throughputSamples: readonly number[];
  includeZeroWeeks: boolean;
  adoDataWarning?: string | null;
  percentiles: ForecastPercentiles;
  completionSummary?: CompletionSummary;
  riskScore?: number | null;
  throughputReliability?: ThroughputReliability | null;
  selectedOrg: string;
  selectedProject: string;
  selectedTeam: string;
  startDate: string;
  endDate: string;
  simulationMode: ForecastMode;
  backlogSize: number | string;
  targetWeeks: number | string;
  types: readonly string[];
  doneStates: readonly string[];
  usableWeeks?: number | null;
  history?: readonly SimulationHistoryEntry[];
};

export function buildSimulationDecisionLanguage({
  hasResult,
  throughputSamples,
  includeZeroWeeks,
  adoDataWarning,
  percentiles,
  completionSummary,
  riskScore,
  throughputReliability,
  selectedOrg,
  selectedProject,
  selectedTeam,
  startDate,
  endDate,
  simulationMode,
  backlogSize,
  targetWeeks,
  types,
  doneStates,
  usableWeeks,
  history = [],
}: SimulationDecisionDiagnosticInput): DecisionLanguage | undefined {
  const hasDisplayPercentile = ["P50", "P70", "P90"].some(
    (key) => {
      const value = percentiles[key as keyof ForecastPercentiles];
      return typeof value === "number" && Number.isFinite(value);
    },
  );
  if (!hasResult || throughputSamples.length === 0 || !hasDisplayPercentile) return undefined;

  const dataQuality = diagnoseDataQuality({
    throughputSamples,
    includeZeroWeeks,
    adoDataWarning: adoDataWarning ?? null,
  });
  const forecastUncertainty = diagnoseForecastUncertainty({
    percentiles,
    completionSummary,
    riskScore,
    throughputReliability,
    throughputSamples,
  });
  const historicalSensitivity = diagnoseHistoricalWindowSensitivity({
    current: {
      id: "current-simulation",
      selectedOrg,
      selectedProject,
      selectedTeam,
      startDate,
      endDate,
      simulationMode,
      includeZeroWeeks,
      backlogSize: Number(backlogSize),
      targetWeeks: Number(targetWeeks),
      types,
      doneStates,
      p90: percentiles.P90,
      usableWeeks: usableWeeks ?? countUsableThroughputSamples(throughputSamples, includeZeroWeeks),
    },
    history: history.map((entry) => ({
      id: entry.id,
      selectedOrg: entry.selectedOrg,
      selectedProject: entry.selectedProject,
      selectedTeam: entry.selectedTeam,
      startDate: entry.startDate,
      endDate: entry.endDate,
      simulationMode: entry.simulationMode,
      includeZeroWeeks: entry.includeZeroWeeks,
      backlogSize: entry.backlogSize,
      targetWeeks: entry.targetWeeks,
      types: entry.types,
      doneStates: entry.doneStates,
      p90: entry.result.result_percentiles?.P90,
      usableWeeks: entry.sampleStats?.usedWeeks
        ?? countUsableThroughputSamples(
          entry.weeklyThroughput.map((point) => point.throughput),
          entry.includeZeroWeeks,
        ),
    })),
  });
  const decisionRecommendation = recommendArbitration({
    dataQuality,
    forecastUncertainty,
    historicalSensitivity,
  });

  return buildDecisionLanguage({
    dataQuality,
    forecastUncertainty,
    decisionRecommendation,
    historicalSensitivity,
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return String(value);
  return "";
}

function renderFactors(factors: DecisionLanguageDimension["factors"]): string {
  const items = factors
    .filter((factor) => !TECHNICAL_FACTOR_CODES.has(factor.code))
    .map((factor) => {
      const description = safeText(factor.description);
      const value = safeText(factor.value);
      return description ? `<li>${escapeHtml(description)}${value ? ` : ${escapeHtml(value)}` : ""}</li>` : "";
    })
    .filter(Boolean)
    .join("");

  return items ? `<ul class="decision-factors">${items}</ul>` : "";
}

function renderDimension(dimension: DecisionLanguageDimension): string {
  const title = safeText(dimension.title);
  const status = safeText(dimension.status);
  const explanation = safeText(dimension.explanation);
  const action = safeText(dimension.action);
  if (!title || !status || !explanation || !action) return "";

  return `<div class="decision-dimension"><b>${escapeHtml(title)} — statut :</b> ${escapeHtml(status)}<br /><b>Justification :</b> ${escapeHtml(explanation)}${renderFactors(dimension.factors)}<b>Action conseillée :</b> ${escapeHtml(action)}</div>`;
}

export function renderDecisionDiagnosticHtml(diagnostic?: DecisionLanguage): string {
  if (!diagnostic) return "";

  const recommendation = diagnostic.decisionRecommendation;
  const status = safeText(recommendation.status);
  const explanation = safeText(recommendation.explanation);
  const action = safeText(recommendation.action);
  if (!status || !explanation || !action) return "";

  const sensitivity = diagnostic.historicalSensitivity;
  const sensitivityHtml = sensitivity
    && [sensitivity.title, sensitivity.status, sensitivity.recentP90, sensitivity.longP90, sensitivity.gap, sensitivity.action]
      .every((value) => safeText(value))
    ? `<div class="decision-dimension"><b>${escapeHtml(sensitivity.title)} — statut :</b> ${escapeHtml(sensitivity.status)}<br />${escapeHtml(sensitivity.recentP90)}<br />${escapeHtml(sensitivity.longP90)}<br /><b>${escapeHtml(sensitivity.gap)}</b>${safeText(sensitivity.evolution) ? `<br />${escapeHtml(sensitivity.evolution)}` : ""}<br /><b>Scénario recommandé :</b> ${escapeHtml(sensitivity.action)}</div>`
    : "";

  return `<section class="section decision-diagnostic"><h2>Diagnostic décisionnel</h2><div class="decision-dimension"><b>Statut de décision :</b> ${escapeHtml(status)}<br /><b>Justification métier :</b> ${escapeHtml(explanation)}${renderFactors(recommendation.factors)}<b>Action conseillée :</b> ${escapeHtml(action)}</div>${renderDimension(diagnostic.dataQuality)}${renderDimension(diagnostic.forecastUncertainty)}${sensitivityHtml}</section>`;
}
