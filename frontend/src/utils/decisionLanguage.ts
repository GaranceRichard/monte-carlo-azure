import type {
  ArbitrationRecommendation,
  ArbitrationRecommendationFactor,
  DataQualityDiagnostic,
  DataQualityLevel,
  DiagnosticFactor,
  ForecastUncertaintyDiagnostic,
  ForecastUncertaintyLevel,
  HistoricalWindowSensitivityDiagnostic,
  HistoricalWindowSensitivityLevel,
} from "./forecastDiagnostics";

type DecisionLanguageFactor = DiagnosticFactor | ArbitrationRecommendationFactor;

export type DecisionLanguageDimension = {
  title: string;
  status: string;
  explanation: string;
  factors: readonly DecisionLanguageFactor[];
  action: string;
};

export type DecisionLanguage = {
  dataQuality: DecisionLanguageDimension;
  forecastUncertainty: DecisionLanguageDimension;
  decisionRecommendation: DecisionLanguageDimension;
  historicalSensitivity?: DecisionLanguageHistoricalSensitivity;
};

export type DecisionLanguageHistoricalSensitivity = DecisionLanguageDimension & {
  recentP90: string;
  longP90: string;
  gap: string;
  evolution: string;
};

export type DecisionLanguageInput = {
  dataQuality: DataQualityDiagnostic;
  forecastUncertainty: ForecastUncertaintyDiagnostic;
  decisionRecommendation: ArbitrationRecommendation;
  historicalSensitivity?: HistoricalWindowSensitivityDiagnostic | null;
};

const dataQualityStatuses: Record<DataQualityLevel, string> = {
  sufficient: "Données suffisantes",
  watch: "Données à surveiller",
  insufficient: "Données insuffisantes",
};

const forecastUncertaintyStatuses: Record<ForecastUncertaintyLevel, string> = {
  low: "Incertitude faible",
  moderate: "Incertitude modérée",
  high: "Incertitude élevée",
  unmeasurable: "Incertitude impossible à mesurer",
};

const dataQualityActions: Record<DataQualityLevel, string> = {
  sufficient: "Poursuivre avec les données disponibles.",
  watch: "Compléter ou surveiller l'historique avant un engagement important.",
  insufficient: "Enrichir ou corriger les données avant toute décision.",
};

const forecastUncertaintyActions: Record<ForecastUncertaintyLevel, string> = {
  low: "Utiliser la prévision dans l'arbitrage.",
  moderate: "Conserver une marge de prudence.",
  high: "Examiner les scénarios et réduire l'exposition.",
  unmeasurable: "Ne pas utiliser la prévision tant qu'elle ne peut pas être mesurée.",
};

const decisionRecommendationStatuses: Record<ArbitrationRecommendation["level"], string> = {
  supportable: "Décision appuyée par les données",
  caution: "Décision possible avec prudence",
  arbitration_required: "Arbitrage nécessaire",
  not_recommended: "Décision non recommandée",
};

const historicalSensitivityStatuses: Record<HistoricalWindowSensitivityLevel, string> = {
  stable: "Prévision stable entre les périodes",
  moderate: "Prévision sensible à la période choisie",
  high: "Forte sensibilité à la période choisie",
  unavailable: "Comparaison indisponible",
};

function formatDiagnosticNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(".", ",");
}

function formatSignedPercentage(value: number): string {
  const percentage = Math.round(value * 100);
  return `${percentage > 0 ? "+" : ""}${percentage} %`;
}

function buildSensitivityEvolution(
  sensitivity: HistoricalWindowSensitivityDiagnostic,
): string {
  if (!sensitivity.recentWindow || !sensitivity.longWindow || !sensitivity.recentTrend) return "";
  if (sensitivity.recentTrend === "unchanged") {
    return "Les résultats restent stables entre la période récente et la période longue.";
  }
  if (sensitivity.recentTrend === "improved") {
    return sensitivity.simulationMode === "weeks_to_items"
      ? "La période récente indique une capacité plus élevée : davantage d'items sont prévus au P90."
      : "La période récente indique une capacité plus élevée : le délai prévu au P90 diminue.";
  }
  return sensitivity.simulationMode === "weeks_to_items"
    ? "La période récente indique une capacité plus faible : moins d'items sont prévus au P90."
    : "La période récente indique une capacité plus faible : le délai prévu au P90 augmente.";
}

function buildHistoricalSensitivityLanguage(
  sensitivity?: HistoricalWindowSensitivityDiagnostic | null,
): DecisionLanguageHistoricalSensitivity | undefined {
  if (
    !sensitivity
    || sensitivity.level === "unavailable"
    || !sensitivity.recentWindow
    || !sensitivity.longWindow
    || sensitivity.recentChangeRate == null
  ) {
    return undefined;
  }

  const unit = sensitivity.simulationMode === "weeks_to_items" ? "items" : "semaines";
  return {
    title: "Sensibilité à la période historique",
    status: historicalSensitivityStatuses[sensitivity.level],
    explanation: sensitivity.justification,
    factors: sensitivity.factors,
    action: sensitivity.advisedAction,
    recentP90: `P90 période récente : ${formatDiagnosticNumber(sensitivity.recentWindow.p90)} ${unit} — ${sensitivity.recentWindow.usableWeeks} semaines`,
    longP90: `P90 période longue : ${formatDiagnosticNumber(sensitivity.longWindow.p90)} ${unit} — ${sensitivity.longWindow.usableWeeks} semaines`,
    gap: `Écart : ${formatSignedPercentage(sensitivity.recentChangeRate)}`,
    evolution: buildSensitivityEvolution(sensitivity),
  };
}

type RecommendationCauseKind =
  | "missingPercentiles"
  | "partialData"
  | "historicalSensitivity"
  | "limitedHistory"
  | "censoredForecast"
  | "highDispersion"
  | "discardedHistory"
  | "usableHistory"
  | "recentCapacity";

type RecommendationCause = {
  kind: RecommendationCauseKind;
  explanation: string;
};

const DISPERSION_FACTOR_CODES = new Set([
  "forecast_percentile_spread",
  "coefficient_of_variation",
  "iqr_ratio",
  "normalized_slope",
]);

function findRecommendationFactor(
  recommendation: ArbitrationRecommendation,
  ...codes: string[]
): DecisionLanguageFactor | undefined {
  return recommendation.factors.find((factor) => codes.includes(factor.code));
}

function isCensoredForecastCause(factor: DecisionLanguageFactor | undefined): boolean {
  if (!factor) return false;
  return typeof factor.value === "number" ? factor.value > 0 : true;
}

function buildRecommendationCauses({
  dataQuality,
  decisionRecommendation,
  historicalSensitivity,
}: DecisionLanguageInput): RecommendationCause[] {
  const causes: RecommendationCause[] = [];
  const missingPercentiles = findRecommendationFactor(decisionRecommendation, "missing_required_percentiles");
  const partialData = findRecommendationFactor(decisionRecommendation, "partial_ado_data", "completeness_issue");
  const sensitivity = findRecommendationFactor(decisionRecommendation, "historical_window_sensitivity");
  const limitedHistory = findRecommendationFactor(decisionRecommendation, "limited_recent_history");
  const censoredForecast = findRecommendationFactor(decisionRecommendation, "censored_simulations");
  const highDispersion = decisionRecommendation.factors.find((factor) => DISPERSION_FACTOR_CODES.has(factor.code));
  const discardedHistory = findRecommendationFactor(decisionRecommendation, "discarded_history_values");
  const usableHistory = findRecommendationFactor(decisionRecommendation, "usable_history_weeks");
  const recentCapacity = findRecommendationFactor(decisionRecommendation, "recent_capacity_direction");

  if (missingPercentiles) {
    causes.push({
      kind: "missingPercentiles",
      explanation: `Les percentiles requis (${String(missingPercentiles.value ?? "détail non disponible")}) ne sont pas tous disponibles.`,
    });
  }
  if (partialData) {
    causes.push({
      kind: "partialData",
      explanation: partialData.code === "partial_ado_data"
        ? "Certaines données Azure DevOps sont incomplètes ; la capacité observée peut être sous-estimée."
        : "Certaines données nécessaires sont incomplètes ; la capacité observée peut être sous-estimée.",
    });
  }
  if (sensitivity) {
    const recentDirection = historicalSensitivity?.recentTrend === "improved"
      ? "supérieure"
      : historicalSensitivity?.recentTrend === "declined"
        ? "inférieure"
        : "différente";
    const intensity = historicalSensitivity?.level === "high" ? "fortement " : "";
    causes.push({
      kind: "historicalSensitivity",
      explanation: `Le P90 varie ${intensity}selon la période sélectionnée : la capacité récente paraît ${recentDirection} à l'historique long.`,
    });
  }
  if (limitedHistory) {
    const recentWeeks = historicalSensitivity?.recentWindow?.usableWeeks;
    causes.push({
      kind: "limitedHistory",
      explanation: recentWeeks != null
        ? `La prévision repose sur seulement ${recentWeeks} semaines d'historique, ce qui limite le recul disponible.`
        : limitedHistory.value != null
          ? `La période récente repose sur ${String(limitedHistory.value)}, ce qui limite le recul disponible.`
          : "La période récente offre encore peu de recul historique.",
    });
  }
  if (censoredForecast && isCensoredForecastCause(censoredForecast)) {
    causes.push({
      kind: "censoredForecast",
      explanation: `${String(censoredForecast.value ?? "Certaines")} simulations n'aboutissent pas dans l'horizon prévu.`,
    });
  }
  if (highDispersion) {
    causes.push({
      kind: "highDispersion",
      explanation: "L'écart entre les scénarios centraux et prudents reste important.",
    });
  }
  if (discardedHistory) {
    causes.push({
      kind: "discardedHistory",
      explanation: `${String(discardedHistory.value ?? "Certaines")} valeurs historiques ne sont pas exploitables.`,
    });
  }
  if (
    usableHistory
    && dataQuality.level !== "sufficient"
    && !limitedHistory
  ) {
    causes.push({
      kind: "usableHistory",
      explanation: usableHistory.value == null
        ? "Le recul historique exploitable est limité."
        : `La prévision repose sur ${String(usableHistory.value)} semaines d'historique exploitable.`,
    });
  }
  if (recentCapacity && !sensitivity) {
    causes.push({
      kind: "recentCapacity",
      explanation: `${recentCapacity.description}.`,
    });
  }

  return causes.slice(0, 2);
}

function buildRecommendationAction(
  causes: readonly RecommendationCause[],
  historicalSensitivity?: HistoricalWindowSensitivityDiagnostic | null,
): string {
  const kinds = new Set(causes.map((cause) => cause.kind));
  if (kinds.has("missingPercentiles")) {
    return "Rétablir les percentiles requis avant de confirmer la décision.";
  }
  if (kinds.has("partialData")) {
    return kinds.has("limitedHistory") || kinds.has("usableHistory")
      ? "Compléter les données Azure DevOps et observer quelques semaines supplémentaires avant un engagement difficilement réversible."
      : "Compléter les données Azure DevOps avant de confirmer un engagement difficilement réversible.";
  }
  if (kinds.has("historicalSensitivity")) {
    if (historicalSensitivity?.recentTrend === "improved") {
      return "Utiliser la période récente pour le pilotage opérationnel et conserver la période longue comme scénario prudent avant un engagement externe.";
    }
    if (historicalSensitivity?.recentTrend === "declined") {
      return "Utiliser la période récente comme référence prudente et vérifier si la baisse de capacité se confirme.";
    }
    return "Comparer la période récente à la période longue avant de retenir une référence d'engagement.";
  }
  if (
    kinds.has("highDispersion")
    && (kinds.has("limitedHistory") || kinds.has("usableHistory"))
  ) {
    return "Planifier sur le P70, conserver le P90 comme marge de sécurité et vérifier la stabilité de la capacité sur quelques semaines supplémentaires.";
  }
  if (kinds.has("limitedHistory") || kinds.has("usableHistory")) {
    return "Vérifier la stabilité de la capacité récente sur quelques semaines supplémentaires.";
  }
  if (kinds.has("censoredForecast")) {
    return "Allonger l'horizon de simulation ou réduire l'engagement avant de confirmer la prévision.";
  }
  if (kinds.has("highDispersion")) {
    return "Planifier sur le P70 et conserver le P90 comme marge de sécurité.";
  }
  if (kinds.has("discardedHistory")) {
    return "Corriger les valeurs historiques non exploitables avant de confirmer l'engagement.";
  }
  if (kinds.has("recentCapacity")) {
    return "Vérifier que l'évolution récente de capacité se maintient avant de confirmer l'engagement.";
  }
  return "Examiner les données et les hypothèses avant de confirmer l'engagement ; la cause détaillée de la prudence n'est pas disponible.";
}

function buildDecisionRecommendationLanguage(
  input: DecisionLanguageInput,
): DecisionLanguageDimension {
  const { decisionRecommendation } = input;
  const shouldExplainFactors = decisionRecommendation.level === "caution"
    || decisionRecommendation.level === "arbitration_required";
  if (!shouldExplainFactors) {
    return {
      title: "Recommandation de décision",
      status: decisionRecommendationStatuses[decisionRecommendation.level],
      explanation: decisionRecommendation.justification,
      factors: decisionRecommendation.factors,
      action: decisionRecommendation.advisedAction,
    };
  }

  const causes = buildRecommendationCauses(input);
  return {
    title: "Recommandation de décision",
    status: decisionRecommendationStatuses[decisionRecommendation.level],
    explanation: causes.length > 0
      ? causes.map((cause) => cause.explanation).join(" ")
      : "La décision exige de la prudence, mais la cause détaillée n'est pas disponible dans les diagnostics actuels.",
    factors: decisionRecommendation.factors,
    action: buildRecommendationAction(causes, input.historicalSensitivity),
  };
}

export function getDataQualityAction(level: DataQualityLevel): string {
  return dataQualityActions[level];
}

export function getForecastUncertaintyAction(level: ForecastUncertaintyLevel): string {
  return forecastUncertaintyActions[level];
}

export function buildDecisionLanguage({
  dataQuality,
  forecastUncertainty,
  decisionRecommendation,
  historicalSensitivity,
}: DecisionLanguageInput): DecisionLanguage {
  return {
    dataQuality: {
      title: "Qualité des données",
      status: dataQualityStatuses[dataQuality.level],
      explanation: dataQuality.justification,
      factors: dataQuality.factors,
      action: getDataQualityAction(dataQuality.level),
    },
    forecastUncertainty: {
      title: "Incertitude de prévision",
      status: forecastUncertaintyStatuses[forecastUncertainty.level],
      explanation: forecastUncertainty.justification,
      factors: forecastUncertainty.factors,
      action: getForecastUncertaintyAction(forecastUncertainty.level),
    },
    decisionRecommendation: buildDecisionRecommendationLanguage({
      dataQuality,
      forecastUncertainty,
      decisionRecommendation,
      historicalSensitivity,
    }),
    historicalSensitivity: buildHistoricalSensitivityLanguage(historicalSensitivity),
  };
}
