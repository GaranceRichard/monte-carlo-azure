import type { ThroughputReliability } from "../domain/simulation";

export type PortfolioHypothesis = "independent" | "aligned" | "friction" | "correlated";

export type PortfolioEvidenceType = "observed" | "calculated" | "user_input" | "unsupported";

export type PortfolioSimulationStability = "stable" | "uncertain" | "fragile" | "unavailable";

export type HistoricalDataQuality = "reliable" | "mixed" | "fragile" | "insufficient";

export type PortfolioComparisonConfidence = "insufficient";

export type TeamHistoricalObservation = {
  teamName: string;
  reliability: ThroughputReliability | null;
};

export type ScenarioSimulationObservation = {
  hypothesis: PortfolioHypothesis;
  riskScore?: number;
  riskLegend?: "fiable" | "incertain" | "fragile" | "non fiable";
};

export type PortfolioComparisonDiagnosticInput = {
  alignmentRate: number;
  frictionRate: number;
  teamObservations: TeamHistoricalObservation[];
  commonHistoricalWeeks: number;
  scenarioObservations: ScenarioSimulationObservation[];
};

export type TeamHistoricalFinding = {
  teamName: string;
  quality: ThroughputReliability["label"] | "indisponible";
  sampleCount: number;
  normalizedTrend: number | null;
  signals: Array<"fragile_history" | "declining_trend">;
  statement: string;
};

export type PortfolioSignificantRisk = {
  kind: "team_history" | "trend_divergence";
  teamNames: string[];
  statement: string;
};

export type PortfolioScenarioCredibility = {
  hypothesis: PortfolioHypothesis;
  evidenceType: PortfolioEvidenceType;
  evidence: string;
  limitations: string[];
};

export type PortfolioScenarioStabilityFinding = {
  hypothesis: PortfolioHypothesis;
  level: PortfolioSimulationStability;
  riskScore: number | null;
  statement: string;
};

export type PortfolioComparisonDiagnostic = {
  historicalData: {
    quality: HistoricalDataQuality;
    observedFacts: string[];
    teamFindings: TeamHistoricalFinding[];
  };
  simulationStability: PortfolioScenarioStabilityFinding[];
  hypothesisCredibility: PortfolioScenarioCredibility[];
  significantRisks: PortfolioSignificantRisk[];
  comparisonConfidence: {
    level: PortfolioComparisonConfidence;
    statement: string;
  };
  preferredScenario: PortfolioHypothesis | null;
  conclusion: string;
};

const PORTFOLIO_SCENARIO_DEFINITIONS: PortfolioHypothesis[] = ["independent", "aligned", "friction", "correlated"];

function buildTeamFinding(observation: TeamHistoricalObservation): TeamHistoricalFinding {
  const reliability = observation.reliability;
  if (!reliability) {
    return {
      teamName: observation.teamName,
      quality: "indisponible",
      sampleCount: 0,
      normalizedTrend: null,
      signals: [],
      statement: `Équipe ${observation.teamName} : qualité historique indisponible.`,
    };
  }

  const signals: TeamHistoricalFinding["signals"] = [];
  if (reliability.label === "fragile" || reliability.label === "non fiable") {
    signals.push("fragile_history");
  }
  if (reliability.slopeNorm <= -0.05) signals.push("declining_trend");

  const trendStatement = reliability.slopeNorm <= -0.05
    ? "tendance observée en baisse"
    : reliability.slopeNorm >= 0.05
      ? "tendance observée en hausse"
      : "sans tendance marquée";

  return {
    teamName: observation.teamName,
    quality: reliability.label,
    sampleCount: reliability.samplesCount,
    normalizedTrend: reliability.slopeNorm,
    signals,
    statement: `Équipe ${observation.teamName} : ${String(reliability.samplesCount)} semaines observées, historique ${reliability.label}, ${trendStatement}.`,
  };
}

function assessHistoricalQuality(findings: TeamHistoricalFinding[]): HistoricalDataQuality {
  if (!findings.length || findings.some((finding) => finding.quality === "indisponible")) return "insufficient";
  if (findings.some((finding) => finding.quality === "fragile" || finding.quality === "non fiable")) return "fragile";
  if (findings.some((finding) => finding.quality === "incertain")) return "mixed";
  return "reliable";
}

function buildSignificantRisks(findings: TeamHistoricalFinding[]): PortfolioSignificantRisk[] {
  const risks: PortfolioSignificantRisk[] = findings
    .filter((finding) => finding.signals.length > 0)
    .map((finding) => {
      const signalText = finding.signals.length === 2
        ? "un historique fragile et une tendance en baisse"
        : finding.signals[0] === "fragile_history"
          ? "un historique fragile"
          : "une tendance en baisse";
      return {
        kind: "team_history" as const,
        teamNames: [finding.teamName],
        statement: `L'équipe ${finding.teamName} présente ${signalText} : fait à vérifier au niveau portefeuille.`,
      };
    });

  const decliningTeams = findings.filter((finding) => (finding.normalizedTrend ?? 0) <= -0.05);
  const risingTeams = findings.filter((finding) => (finding.normalizedTrend ?? 0) >= 0.05);
  if (decliningTeams.length && risingTeams.length) {
    const teamNames = [...decliningTeams, ...risingTeams].map((finding) => finding.teamName);
    risks.push({
      kind: "trend_divergence",
      teamNames,
      statement: `Les tendances historiques divergent fortement entre ${teamNames.join(" et ")} : fait à vérifier, sans conclure à une compensation ni à une relation opérationnelle.`,
    });
  }

  return risks;
}

function buildScenarioStability(
  hypothesis: PortfolioHypothesis,
  observations: ScenarioSimulationObservation[],
): PortfolioScenarioStabilityFinding {
  const observation = observations.find((candidate) => candidate.hypothesis === hypothesis);
  const riskScore = typeof observation?.riskScore === "number" && Number.isFinite(observation.riskScore)
    ? observation.riskScore
    : null;
  const level: PortfolioSimulationStability = observation?.riskLegend === "fiable"
    ? "stable"
    : observation?.riskLegend === "incertain"
      ? "uncertain"
      : observation?.riskLegend === "fragile" || observation?.riskLegend === "non fiable"
        ? "fragile"
        : "unavailable";

  const statement = level === "unavailable"
    ? "Stabilité du résultat simulé indisponible."
    : `Résultat simulé ${level === "stable" ? "stable" : level === "uncertain" ? "incertain" : "fragile"} ; ce constat ne valide pas l'hypothèse du scénario.`;

  return { hypothesis, level, riskScore, statement };
}

function buildHypothesisCredibility(input: PortfolioComparisonDiagnosticInput): PortfolioScenarioCredibility[] {
  return [
    {
      hypothesis: "independent",
      evidenceType: "unsupported",
      evidence: "Tirages indépendants reconstruits par bootstrap à partir des historiques des équipes ; l'indépendance est modélisée, pas observée.",
      limitations: [
        "La reconstruction ne démontre pas que les équipes fonctionneront indépendamment.",
        "Une distribution simulée stable ne valide pas cette hypothèse.",
      ],
    },
    {
      hypothesis: "aligned",
      evidenceType: "user_input",
      evidence: `Coefficient d'alignement de ${String(input.alignmentRate)} % saisi par l'utilisateur ; il n'est pas calibré par les données historiques.`,
      limitations: [
        "Le taux saisi est un paramètre d'exploration, pas un fait démontré.",
        "Une distribution simulée stable ne valide pas ce coefficient.",
      ],
    },
    {
      hypothesis: "friction",
      evidenceType: "calculated",
      evidence: `Coefficient de friction de ${String(input.frictionRate)} % calculé à partir du taux saisi et de ${String(input.teamObservations.length)} équipes.`,
      limitations: [
        "Le coefficient est dérivé d'un paramètre utilisateur ; il n'est pas observé dans l'historique.",
        "Le calcul ne démontre pas un coût identique pour chaque équipe supplémentaire.",
      ],
    },
    {
      hypothesis: "correlated",
      evidenceType: "observed",
      evidence: `Agrégation de ${String(input.commonHistoricalWeeks)} semaines historiques communes réellement observées.`,
      limitations: [
        "L'historique commun ne démontre ni la substituabilité des équipes ni leurs relations opérationnelles.",
        "Les observations passées ne garantissent pas la validité future de cette hypothèse.",
        "Ce caractère observé ne suffit pas à recommander automatiquement ce scénario.",
      ],
    },
  ];
}

export function buildPortfolioComparisonDiagnostic(
  input: PortfolioComparisonDiagnosticInput,
): PortfolioComparisonDiagnostic {
  const teamFindings = input.teamObservations.map(buildTeamFinding);
  const observedFacts = [
    `${String(teamFindings.length)} équipes disposent de données historiques dans la comparaison.`,
    `${String(input.commonHistoricalWeeks)} semaines historiques sont communes à toutes les équipes.`,
    ...teamFindings.map((finding) => finding.statement),
  ];

  return {
    historicalData: {
      quality: assessHistoricalQuality(teamFindings),
      observedFacts,
      teamFindings,
    },
    simulationStability: PORTFOLIO_SCENARIO_DEFINITIONS.map((hypothesis) => buildScenarioStability(hypothesis, input.scenarioObservations)),
    hypothesisCredibility: buildHypothesisCredibility(input),
    significantRisks: buildSignificantRisks(teamFindings),
    comparisonConfidence: {
      level: "insufficient",
      statement: "Les historiques, les résultats simulés et le taux manuel ne suffisent pas à départager la crédibilité future des hypothèses.",
    },
    preferredScenario: null,
    conclusion: "Preuves insuffisantes pour privilégier une hypothèse.",
  };
}
