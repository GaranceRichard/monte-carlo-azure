import type {
  HistoricalDataQuality,
  PortfolioComparisonDiagnostic,
  PortfolioEvidenceType,
  PortfolioHypothesis,
} from "./portfolioComparisonDiagnostic";

export const portfolioHypothesisLabels: Record<PortfolioHypothesis, string> = {
  independent: "Indépendant",
  aligned: "Arrimé",
  friction: "Friction",
  correlated: "Historique corrélé",
};

export type PortfolioPilotReference = PortfolioHypothesis | null;

export const portfolioPilotReferenceOptions: Array<{ value: PortfolioPilotReference; label: string }> = [
  { value: null, label: "Aucun" },
  ...(["independent", "aligned", "friction", "correlated"] as const).map((value) => ({
    value,
    label: portfolioHypothesisLabels[value],
  })),
];

export const insufficientEvidenceRecommendation = "Aucune recommandation de scénario issue des preuves disponibles.";
export const insufficientEvidencePreconization =
  "Ne pas privilégier automatiquement un scénario. Documenter les dépendances, calibrer les paramètres et backtester les hypothèses avant toute recommandation fondée sur les preuves.";
export const pilotReferenceGovernanceNote =
  "Choix de gouvernance utilisé comme convention de pilotage ; il ne constitue pas une recommandation issue des données.";

export function formatPortfolioScenarioLabel(label: string): string {
  if (label === "Optimiste") return portfolioHypothesisLabels.independent;
  if (label.startsWith("Arrime")) return label.replace("Arrime", portfolioHypothesisLabels.aligned);
  return label;
}

export const portfolioEvidenceLabels: Record<PortfolioEvidenceType, string> = {
  observed: "Fondée sur des observations historiques",
  calculated: "Calculée à partir d’un paramètre",
  user_input: "Paramètre saisi par l’utilisateur",
  unsupported: "Hypothèse non étayée par les données",
};

export const portfolioHistoricalQualityLabels: Record<HistoricalDataQuality, string> = {
  reliable: "Historique exploitable",
  mixed: "Historique hétérogène",
  fragile: "Historique fragile",
  insufficient: "Historique insuffisant",
};

export type PortfolioComparisonPresentation = {
  conclusion: string;
  comparisonConfidence: string;
  evidenceRecommendation: string;
  preconization: string | null;
  pilotReferenceLabel: string;
  pilotReferenceGovernanceNote: string | null;
  scenarioCredibilities: Array<{
    label: string;
    evidenceTypeLabel: string;
    evidence: string;
    limitations: string[];
  }>;
  significantRiskStatements: string[];
  historicalDataQuality: string;
};

/**
 * Presentation-only mapping shared by the UI and printable report.
 * It deliberately preserves the diagnostic supplied by the domain.
 */
export function presentPortfolioComparisonDiagnostic(
  diagnostic: PortfolioComparisonDiagnostic,
  pilotReference: PortfolioPilotReference = null,
): PortfolioComparisonPresentation {
  return {
    conclusion: diagnostic.conclusion,
    comparisonConfidence: diagnostic.comparisonConfidence.statement,
    evidenceRecommendation: diagnostic.preferredScenario === null
      ? insufficientEvidenceRecommendation
      : `Scénario recommandé par les preuves : ${portfolioHypothesisLabels[diagnostic.preferredScenario]}.`,
    preconization: diagnostic.preferredScenario === null ? insufficientEvidencePreconization : null,
    pilotReferenceLabel: pilotReference === null ? "Non définie" : portfolioHypothesisLabels[pilotReference],
    pilotReferenceGovernanceNote: pilotReference === null ? null : pilotReferenceGovernanceNote,
    scenarioCredibilities: diagnostic.hypothesisCredibility.map((scenario) => ({
      label: portfolioHypothesisLabels[scenario.hypothesis],
      evidenceTypeLabel: portfolioEvidenceLabels[scenario.evidenceType],
      evidence: scenario.evidence,
      limitations: scenario.limitations,
    })),
    significantRiskStatements: diagnostic.significantRisks.map((risk) => risk.statement),
    historicalDataQuality: portfolioHistoricalQualityLabels[diagnostic.historicalData.quality],
  };
}
