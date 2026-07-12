import type {
  ArbitrationRecommendation,
  ArbitrationRecommendationFactor,
  DataQualityDiagnostic,
  DataQualityLevel,
  DiagnosticFactor,
  ForecastUncertaintyDiagnostic,
  ForecastUncertaintyLevel,
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
};

export type DecisionLanguageInput = {
  dataQuality: DataQualityDiagnostic;
  forecastUncertainty: ForecastUncertaintyDiagnostic;
  decisionRecommendation: ArbitrationRecommendation;
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
    decisionRecommendation: {
      title: "Recommandation de décision",
      status: decisionRecommendationStatuses[decisionRecommendation.level],
      explanation: decisionRecommendation.justification,
      factors: decisionRecommendation.factors,
      action: decisionRecommendation.advisedAction,
    },
  };
}
