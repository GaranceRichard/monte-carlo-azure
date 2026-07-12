import { SIMULATION_THROUGHPUT_SAMPLES_MIN } from "../simulationLimits";
import type {
  CompletionSummary,
  ForecastPercentiles,
  ThroughputReliability,
} from "../types";
import {
  computeRiskLegend,
  computeThroughputReliability,
} from "./simulation";

export type DataQualityLevel = "sufficient" | "watch" | "insufficient";
export type ForecastUncertaintyLevel = "low" | "moderate" | "high" | "unmeasurable";
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

export function diagnoseDataQuality({
  throughputSamples,
  includeZeroWeeks = false,
  adoDataWarning,
  completenessIssues = [],
}: DataQualityInput): DataQualityDiagnostic {
  const validSamples = throughputSamples.filter(
    (value) => Number.isFinite(value) && (includeZeroWeeks ? value >= 0 : value > 0),
  );
  const invalidSamplesCount = throughputSamples.filter(
    (value) => !Number.isFinite(value) || value < 0,
  ).length;
  const factors: DiagnosticFactor[] = [
    {
      code: "usable_history_weeks",
      description: "Semaines historiques exploitables",
      value: validSamples.length,
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
      description: "Probleme de completude",
      value: issue,
    });
  });

  if (validSamples.length < SIMULATION_THROUGHPUT_SAMPLES_MIN) {
    return {
      level: "insufficient",
      justification: "La profondeur historique exploitable est insuffisante.",
      factors,
    };
  }
  if (
    validSamples.length < DATA_QUALITY_WATCH_SAMPLES
    || invalidSamplesCount > 0
    || Boolean(adoDataWarning)
    || completenessIssues.length > 0
  ) {
    return {
      level: "watch",
      justification: "Les donnees sont exploitables, avec des limites de profondeur ou de completude.",
      factors,
    };
  }
  return {
    level: "sufficient",
    justification: "La profondeur et la completude des donnees sont suffisantes.",
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
      threshold: "faible jusqu'a 0.2; moderee jusqu'a 0.5; elevee au-dela",
    });
  }
  if (reliability) {
    factors.push(
      {
        code: "coefficient_of_variation",
        description: "Coefficient de variation du throughput",
        value: reliability.cv,
        threshold: "moderee des 0.5; elevee des 1",
      },
      {
        code: "iqr_ratio",
        description: "Dispersion interquartile relative",
        value: reliability.iqr_ratio,
        threshold: "moderee des 0.5; elevee des 1",
      },
      {
        code: "normalized_slope",
        description: "Pente normalisee du throughput",
        value: reliability.slope_norm,
        threshold: "moderee des |0.05|; elevee des |0.1|",
      },
    );
  }

  const censoredCount = completionSummary?.censored_count ?? 0;
  if (completionSummary) {
    factors.push({
      code: "censored_simulations",
      description: "Simulations censurees a l'horizon",
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
      justification: "La dispersion ou la volatilite historique est elevee.",
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
        ? "L'incertitude est renforcee par la dispersion ou la presence de censures."
        : "La dispersion ou la volatilite historique est moderee.",
      factors,
    };
  }

  return {
    level: "low",
    justification: "Les metriques disponibles indiquent une faible dispersion de prevision.",
    factors,
  };
}
