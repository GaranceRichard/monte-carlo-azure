import { SIMULATION_THROUGHPUT_SAMPLES_MIN } from "../simulationLimits";
import type {
  CompletionSummary,
  ForecastMode,
  ForecastPercentiles,
  ThroughputReliability,
} from "../types";
import {
  computeRiskLegend,
  computeThroughputReliability,
} from "./simulation";

export type DataQualityLevel = "sufficient" | "watch" | "insufficient";
export type ForecastUncertaintyLevel = "low" | "moderate" | "high" | "unmeasurable";
export type ArbitrationRecommendationLevel =
  | "supportable"
  | "caution"
  | "arbitration_required"
  | "not_recommended";
export type ForecastPercentileKey = keyof ForecastPercentiles;

export type DiagnosticFactor = {
  code: string;
  description: string;
  value?: number | string | boolean;
  threshold?: number | string;
};

export type BusinessDiagnostic<Level extends string> = {
  level: Level;
  justification: string;
  factors: DiagnosticFactor[];
};

export type DataQualityDiagnostic = BusinessDiagnostic<DataQualityLevel>;
export type ForecastUncertaintyDiagnostic = BusinessDiagnostic<ForecastUncertaintyLevel>;

export type ArbitrationRecommendationFactor = DiagnosticFactor & {
  source: "dataQuality" | "forecastUncertainty" | "historicalSensitivity";
};

export type HistoricalWindowSensitivityLevel = "stable" | "moderate" | "high" | "unavailable";
export type HistoricalWindowTrend = "improved" | "declined" | "unchanged";

export type HistoricalWindowSimulation = {
  id: string;
  selectedOrg: string;
  selectedProject: string;
  selectedTeam: string;
  startDate: string;
  endDate: string;
  simulationMode: ForecastMode;
  includeZeroWeeks: boolean;
  backlogSize: number;
  targetWeeks: number;
  types: readonly string[];
  doneStates: readonly string[];
  p90: number | null | undefined;
  usableWeeks: number;
};

export type HistoricalWindowSimulationSummary = {
  id: string;
  startDate: string;
  endDate: string;
  p90: number;
  usableWeeks: number;
};

export type HistoricalWindowSensitivityDiagnostic = {
  level: HistoricalWindowSensitivityLevel;
  simulationMode: ForecastMode;
  comparedSimulations: HistoricalWindowSimulationSummary[];
  p90Minimum: number | null;
  p90Maximum: number | null;
  absoluteGap: number | null;
  relativeGap: number | null;
  recentChangeRate: number | null;
  recentWindow: HistoricalWindowSimulationSummary | null;
  longWindow: HistoricalWindowSimulationSummary | null;
  recentTrend: HistoricalWindowTrend | null;
  justification: string;
  advisedAction: string;
  factors: DiagnosticFactor[];
};

export type ArbitrationRecommendation = {
  level: ArbitrationRecommendationLevel;
  justification: string;
  factors: ArbitrationRecommendationFactor[];
  advisedAction: string;
};

export type ArbitrationRecommendationInput = {
  dataQuality: DataQualityDiagnostic;
  forecastUncertainty: ForecastUncertaintyDiagnostic;
  historicalSensitivity?: HistoricalWindowSensitivityDiagnostic | null;
};

export type DataQualityInput = {
  throughputSamples: readonly number[];
  includeZeroWeeks?: boolean;
  adoDataWarning?: string | null;
  completenessIssues?: readonly string[];
};

export type ForecastUncertaintyInput = {
  percentiles: ForecastPercentiles;
  requiredPercentiles?: readonly ForecastPercentileKey[];
  completionSummary?: CompletionSummary | null;
  riskScore?: number | null;
  throughputReliability?: ThroughputReliability | null;
  throughputSamples?: readonly number[];
};

const DATA_QUALITY_WATCH_SAMPLES = 8;
const DEFAULT_REQUIRED_PERCENTILES: readonly ForecastPercentileKey[] = ["P50", "P70", "P90"];
export const HISTORICAL_SENSITIVITY_MODERATE_MIN = 0.1;
export const HISTORICAL_SENSITIVITY_HIGH_MIN = 0.25;
export const HISTORICAL_SENSITIVITY_RECENT_WEEKS_MIN = 12;

export function countUsableThroughputSamples(
  throughputSamples: readonly number[],
  includeZeroWeeks = false,
): number {
  return throughputSamples.filter(
    (value) => Number.isFinite(value) && (includeZeroWeeks ? value >= 0 : value > 0),
  ).length;
}

function normalizeStringArray(values: readonly string[]): string[] {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function haveSameValues(left: readonly string[], right: readonly string[]): boolean {
  const normalizedLeft = normalizeStringArray(left);
  const normalizedRight = normalizeStringArray(right);
  return normalizedLeft.length === normalizedRight.length
    && normalizedLeft.every((value, index) => value === normalizedRight[index]);
}

function isComparableHistoricalWindow(
  current: HistoricalWindowSimulation,
  candidate: HistoricalWindowSimulation,
): boolean {
  const hasSameObjective = current.simulationMode === "weeks_to_items"
    ? current.targetWeeks === candidate.targetWeeks
    : current.backlogSize === candidate.backlogSize;

  return current.selectedOrg === candidate.selectedOrg
    && current.selectedProject === candidate.selectedProject
    && current.selectedTeam === candidate.selectedTeam
    && current.simulationMode === candidate.simulationMode
    && hasSameObjective
    && haveSameValues(current.types, candidate.types)
    && haveSameValues(current.doneStates, candidate.doneStates)
    && current.includeZeroWeeks === candidate.includeZeroWeeks
    && current.endDate === candidate.endDate
    && current.startDate !== candidate.startDate
    && typeof candidate.p90 === "number"
    && Number.isFinite(candidate.p90)
    && candidate.usableWeeks > 0;
}

function summarizeHistoricalWindow(
  simulation: HistoricalWindowSimulation,
): HistoricalWindowSimulationSummary {
  return {
    id: simulation.id,
    startDate: simulation.startDate,
    endDate: simulation.endDate,
    p90: Number(simulation.p90),
    usableWeeks: simulation.usableWeeks,
  };
}

function buildUnavailableHistoricalSensitivity(
  simulationMode: ForecastMode,
): HistoricalWindowSensitivityDiagnostic {
  return {
    level: "unavailable",
    simulationMode,
    comparedSimulations: [],
    p90Minimum: null,
    p90Maximum: null,
    absoluteGap: null,
    relativeGap: null,
    recentChangeRate: null,
    recentWindow: null,
    longWindow: null,
    recentTrend: null,
    justification: "Aucune autre simulation locale comparable n'est disponible.",
    advisedAction: "Conserver le diagnostic courant sans comparaison de fenêtres historiques.",
    factors: [],
  };
}

export function diagnoseHistoricalWindowSensitivity({
  current,
  history,
}: {
  current: HistoricalWindowSimulation;
  history: readonly HistoricalWindowSimulation[];
}): HistoricalWindowSensitivityDiagnostic {
  if (
    typeof current.p90 !== "number"
    || !Number.isFinite(current.p90)
    || current.usableWeeks <= 0
  ) {
    return buildUnavailableHistoricalSensitivity(current.simulationMode);
  }

  const comparedStartDates = new Set<string>();
  const comparableHistory = history.filter((candidate) => {
    if (!isComparableHistoricalWindow(current, candidate)) return false;
    if (comparedStartDates.has(candidate.startDate)) return false;
    comparedStartDates.add(candidate.startDate);
    return true;
  });
  if (comparableHistory.length === 0) {
    return buildUnavailableHistoricalSensitivity(current.simulationMode);
  }

  const compared = [current, ...comparableHistory];
  const byWindowLength = [...compared].sort((left, right) => (
    left.usableWeeks - right.usableWeeks
    || right.startDate.localeCompare(left.startDate)
  ));
  const recentWindow = summarizeHistoricalWindow(byWindowLength[0]);
  const longWindow = summarizeHistoricalWindow(byWindowLength[byWindowLength.length - 1]);
  const summaries = compared.map(summarizeHistoricalWindow);
  const p90Values = summaries.map((simulation) => simulation.p90);
  const p90Minimum = Math.min(...p90Values);
  const p90Maximum = Math.max(...p90Values);
  const absoluteGap = p90Maximum - p90Minimum;
  const relativeGap = p90Minimum > 0 ? absoluteGap / p90Minimum : absoluteGap === 0 ? 0 : 1;
  const recentChangeRate = longWindow.p90 !== 0
    ? (recentWindow.p90 - longWindow.p90) / Math.abs(longWindow.p90)
    : recentWindow.p90 === 0 ? 0 : 1;

  const level: HistoricalWindowSensitivityLevel = relativeGap >= HISTORICAL_SENSITIVITY_HIGH_MIN
    ? "high"
    : relativeGap >= HISTORICAL_SENSITIVITY_MODERATE_MIN
      ? "moderate"
      : "stable";
  const isRecentImprovement = current.simulationMode === "weeks_to_items"
    ? recentWindow.p90 > longWindow.p90
    : recentWindow.p90 < longWindow.p90;
  const recentTrend: HistoricalWindowTrend = recentWindow.p90 === longWindow.p90
    ? "unchanged"
    : isRecentImprovement ? "improved" : "declined";
  const directionDescription = recentTrend === "improved"
    ? "Capacité récente en hausse"
    : recentTrend === "declined"
      ? "Capacité récente en baisse"
      : "Capacité stable entre les fenêtres";
  const limitedRecentHistory = level === "high"
    && recentWindow.usableWeeks < HISTORICAL_SENSITIVITY_RECENT_WEEKS_MIN;
  const factors: DiagnosticFactor[] = [
    {
      code: "historical_window_sensitivity",
      description: level === "stable"
        ? "Résultats stables entre les fenêtres historiques"
        : "Prévision sensible à la période historique choisie",
      value: `${Math.round(relativeGap * 100)} % d'écart entre les P90`,
    },
    {
      code: "recent_capacity_direction",
      description: directionDescription,
      value: `${recentWindow.usableWeeks} semaines récentes comparées à ${longWindow.usableWeeks} semaines`,
    },
  ];
  if (limitedRecentHistory) {
    factors.push({
      code: "limited_recent_history",
      description: "Recul historique récent limité",
      value: `${recentWindow.usableWeeks} semaines exploitables`,
      threshold: `au moins ${HISTORICAL_SENSITIVITY_RECENT_WEEKS_MIN} semaines`,
    });
  }

  const sensitivityJustification = level === "stable"
    ? "Les résultats restent stables entre les fenêtres historiques comparables."
    : level === "moderate"
      ? "La prévision varie modérément selon la période historique choisie."
      : "La prévision varie fortement selon la période historique choisie.";
  const trendJustification = recentTrend === "improved"
    ? "La fenêtre récente indique une capacité plus élevée."
    : recentTrend === "declined"
      ? "La fenêtre récente indique une capacité plus faible."
      : "La fenêtre récente ne montre pas de changement de capacité.";
  const limitedHistoryJustification = limitedRecentHistory
    ? " Cette capacité récente repose encore sur peu de recul historique."
    : "";
  const advisedAction = level === "high" && recentTrend === "improved"
    ? "Utiliser la période récente pour le pilotage opérationnel si le changement de capacité est durable; conserver la période longue comme scénario prudent pour un engagement externe ou difficilement réversible. Vérifier si l'écart vient d'une équipe stabilisée, d'une nouvelle organisation, d'une amélioration durable du flux ou d'une variation temporaire."
    : level === "high" && recentTrend === "declined"
      ? "Utiliser la période récente comme référence prudente tant que la baisse n'est pas expliquée; ne retenir la période longue que si le changement récent est temporaire."
      : level === "moderate"
        ? "Vérifier la permanence du changement avant de choisir entre la référence récente et le scénario historique long."
        : "Les deux fenêtres donnent des résultats proches; choisir selon l'horizon de décision et documenter la période retenue.";

  return {
    level,
    simulationMode: current.simulationMode,
    comparedSimulations: summaries,
    p90Minimum,
    p90Maximum,
    absoluteGap,
    relativeGap,
    recentChangeRate,
    recentWindow,
    longWindow,
    recentTrend,
    justification: `${sensitivityJustification} ${trendJustification}${limitedHistoryJustification}`,
    advisedAction,
    factors,
  };
}

export function diagnoseDataQuality({
  throughputSamples,
  includeZeroWeeks = false,
  adoDataWarning,
  completenessIssues = [],
}: DataQualityInput): DataQualityDiagnostic {
  const validSamplesCount = countUsableThroughputSamples(throughputSamples, includeZeroWeeks);
  const invalidSamplesCount = throughputSamples.filter(
    (value) => !Number.isFinite(value) || value < 0,
  ).length;
  const factors: DiagnosticFactor[] = [
    {
      code: "usable_history_weeks",
      description: "Semaines historiques exploitables",
      value: validSamplesCount,
      threshold: `minimum ${SIMULATION_THROUGHPUT_SAMPLES_MIN}; vigilance sous ${DATA_QUALITY_WATCH_SAMPLES}`,
    },
  ];

  if (invalidSamplesCount > 0) {
    factors.push({
      code: "discarded_history_values",
      description: "Valeurs historiques non exploitables",
      value: invalidSamplesCount,
    });
  }
  if (adoDataWarning) {
    factors.push({
      code: "partial_ado_data",
      description: "Collecte Azure DevOps partielle",
      value: adoDataWarning,
    });
  }
  completenessIssues.forEach((issue) => {
    factors.push({
      code: "completeness_issue",
      description: "Problème de complétude",
      value: issue,
    });
  });

  if (validSamplesCount < SIMULATION_THROUGHPUT_SAMPLES_MIN) {
    return {
      level: "insufficient",
      justification: "La profondeur historique exploitable est insuffisante.",
      factors,
    };
  }
  if (
    validSamplesCount < DATA_QUALITY_WATCH_SAMPLES
    || invalidSamplesCount > 0
    || Boolean(adoDataWarning)
    || completenessIssues.length > 0
  ) {
    return {
      level: "watch",
      justification: "Les données sont exploitables, avec des limites de profondeur ou de complétude.",
      factors,
    };
  }
  return {
    level: "sufficient",
    justification: "La profondeur et la complétude des données sont suffisantes.",
    factors,
  };
}

export function diagnoseForecastUncertainty({
  percentiles,
  requiredPercentiles = DEFAULT_REQUIRED_PERCENTILES,
  completionSummary,
  riskScore,
  throughputReliability,
  throughputSamples,
}: ForecastUncertaintyInput): ForecastUncertaintyDiagnostic {
  const missingPercentiles = requiredPercentiles.filter(
    (key) => typeof percentiles[key] !== "number" || !Number.isFinite(percentiles[key]),
  );
  const factors: DiagnosticFactor[] = [];

  if (missingPercentiles.length > 0) {
    factors.push({
      code: "missing_required_percentiles",
      description: "Percentiles requis non calculables",
      value: missingPercentiles.join(", "),
    });
    return {
      level: "unmeasurable",
      justification: "L'incertitude est non mesurable car un percentile requis est absent.",
      factors,
    };
  }

  const reliability = throughputReliability
    ?? (throughputSamples ? computeThroughputReliability([...throughputSamples]) : null);
  const usableRiskScore = typeof riskScore === "number" && Number.isFinite(riskScore) && riskScore >= 0
    ? riskScore
    : null;
  const riskLegend = usableRiskScore == null ? null : computeRiskLegend(usableRiskScore);
  if (usableRiskScore != null) {
    factors.push({
      code: "forecast_percentile_spread",
      description: "Risk Score existant, indicateur de dispersion entre P50 et P90",
      value: Number(usableRiskScore.toFixed(4)),
      threshold: "faible jusqu'à 0,2 ; modérée jusqu'à 0,5 ; élevée au-delà",
    });
  }
  if (reliability) {
    factors.push(
      {
        code: "coefficient_of_variation",
        description: "Coefficient de variation du throughput",
        value: reliability.cv,
        threshold: "modérée dès 0,5 ; élevée dès 1",
      },
      {
        code: "iqr_ratio",
        description: "Dispersion interquartile relative",
        value: reliability.iqr_ratio,
        threshold: "modérée dès 0,5 ; élevée dès 1",
      },
      {
        code: "normalized_slope",
        description: "Pente normalisée du throughput",
        value: reliability.slope_norm,
        threshold: "modérée dès |0,05| ; élevée dès |0,1|",
      },
    );
  }

  const censoredCount = completionSummary?.censored_count ?? 0;
  if (completionSummary) {
    factors.push({
      code: "censored_simulations",
      description: "Simulations censurées à l'horizon",
      value: censoredCount,
      threshold: `sur ${completionSummary.completed_count + completionSummary.censored_count} simulations`,
    });
  }

  const hasHighDispersion = Boolean(
    riskLegend === "fragile"
    || riskLegend === "non fiable"
    || (
      reliability
      && (
        reliability.cv >= 1
        || reliability.iqr_ratio >= 1
        || Math.abs(reliability.slope_norm) >= 0.1
      )
    ),
  );
  if (hasHighDispersion) {
    return {
      level: "high",
      justification: "La dispersion ou la volatilité historique est élevée.",
      factors,
    };
  }

  const hasModerateDispersion = Boolean(
    riskLegend === "incertain"
    || (
      reliability
      && (
        reliability.cv >= 0.5
        || reliability.iqr_ratio >= 0.5
        || Math.abs(reliability.slope_norm) >= 0.05
      )
    ),
  );
  if (hasModerateDispersion || censoredCount > 0) {
    return {
      level: "moderate",
      justification: censoredCount > 0
        ? "L'incertitude est renforcée par la dispersion ou la présence de censures."
        : "La dispersion ou la volatilité historique est modérée.",
      factors,
    };
  }

  return {
    level: "low",
    justification: "Les métriques disponibles indiquent une faible dispersion de prévision.",
    factors,
  };
}

function recommendWithoutHistoricalSensitivity({
  dataQuality,
  forecastUncertainty,
}: ArbitrationRecommendationInput): ArbitrationRecommendation {
  const dataFactors = dataQuality.factors.map((factor) => ({
    ...factor,
    source: "dataQuality" as const,
  }));
  const uncertaintyFactors = forecastUncertainty.factors.map((factor) => ({
    ...factor,
    source: "forecastUncertainty" as const,
  }));
  const factors = [...dataFactors, ...uncertaintyFactors];
  const hasFactor = (code: string) => factors.some((factor) => factor.code === code);

  const missingRequiredPercentile = hasFactor("missing_required_percentiles");
  if (dataQuality.level === "insufficient") {
    return {
      level: "not_recommended",
      justification: "Les données disponibles ne peuvent pas soutenir une décision.",
      factors: dataFactors,
      advisedAction: "Compléter l'historique avant tout arbitrage.",
    };
  }
  if (forecastUncertainty.level === "unmeasurable" || missingRequiredPercentile) {
    return {
      level: "not_recommended",
      justification: "La prévision ne permet pas de mesurer l'incertitude indispensable à la décision.",
      factors: uncertaintyFactors,
      advisedAction: "Rétablir les percentiles requis avant de décider.",
    };
  }

  const hasPartialOrIncompleteAdoData = hasFactor("partial_ado_data")
    || hasFactor("completeness_issue");
  const hasCensoredSimulations = factors.some(
    (factor) => factor.code === "censored_simulations"
      && typeof factor.value === "number"
      && factor.value > 0,
  );
  const hasDegradedData = dataQuality.level === "watch" || hasPartialOrIncompleteAdoData;
  const hasDegradedForecast = forecastUncertainty.level === "high" || hasCensoredSimulations;

  if (hasDegradedData && hasDegradedForecast) {
    return {
      level: "arbitration_required",
      justification: "Plusieurs signaux de qualité ou d'incertitude dégradent la prévision.",
      factors,
      advisedAction: "Faire valider les hypothèses et les limites par un responsable.",
    };
  }
  if (hasDegradedData || hasDegradedForecast) {
    return {
      level: "caution",
      justification: "La décision reste possible, mais un signal dégradé doit être explicite.",
      factors: hasDegradedData ? dataFactors : uncertaintyFactors,
      advisedAction: "Décider avec une marge et documenter la limite identifiée.",
    };
  }

  return {
    level: "supportable",
    justification: "Les données et l'incertitude disponible soutiennent raisonnablement la décision.",
    factors,
    advisedAction: "Utiliser la prévision en conservant les hypothèses documentées.",
  };
}

export function recommendArbitration(
  input: ArbitrationRecommendationInput,
): ArbitrationRecommendation {
  const baseRecommendation = recommendWithoutHistoricalSensitivity(input);
  const sensitivity = input.historicalSensitivity;
  if (!sensitivity || sensitivity.level === "unavailable") {
    return baseRecommendation;
  }

  const sensitivityFactors: ArbitrationRecommendationFactor[] = sensitivity.factors.map((factor) => ({
    ...factor,
    source: "historicalSensitivity",
  }));
  if (sensitivity.level === "stable") {
    return baseRecommendation.level === "supportable"
      ? { ...baseRecommendation, factors: [...baseRecommendation.factors, ...sensitivityFactors] }
      : baseRecommendation;
  }
  if (sensitivity.level === "moderate" && baseRecommendation.level === "supportable") {
    return {
      level: "caution",
      justification: sensitivity.justification,
      factors: sensitivityFactors,
      advisedAction: "Décider avec prudence et documenter la période historique retenue.",
    };
  }
  if (
    sensitivity.level === "high"
    && (baseRecommendation.level === "supportable" || baseRecommendation.level === "caution")
  ) {
    return {
      level: "arbitration_required",
      justification: sensitivity.justification,
      factors: baseRecommendation.level === "caution"
        ? [...baseRecommendation.factors, ...sensitivityFactors]
        : sensitivityFactors,
      advisedAction: "Faire valider le choix de période historique avant tout engagement.",
    };
  }

  return baseRecommendation;
}
