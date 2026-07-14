import { describe, expect, it } from "vitest";
import type { ThroughputReliability } from "../types";
import {
  buildPortfolioComparisonDiagnostic,
  type PortfolioComparisonDiagnosticInput,
} from "./portfolioComparisonDiagnostic";

function reliability(
  label: ThroughputReliability["label"] = "fiable",
  slope = 0,
): ThroughputReliability {
  return {
    cv: label === "fragile" ? 1.1 : 0.2,
    iqr_ratio: label === "fragile" ? 1.1 : 0.2,
    slope_norm: slope,
    label,
    samples_count: 12,
  };
}

function diagnosticInput(overrides: Partial<PortfolioComparisonDiagnosticInput> = {}): PortfolioComparisonDiagnosticInput {
  return {
    alignmentRate: 90,
    frictionRate: 81,
    commonHistoricalWeeks: 12,
    teamObservations: [
      { teamName: "Alpha", reliability: reliability() },
      { teamName: "Beta", reliability: reliability() },
      { teamName: "Gamma", reliability: reliability() },
    ],
    scenarioObservations: [
      { hypothesis: "independent", riskScore: 0.1, riskLegend: "fiable" },
      { hypothesis: "aligned", riskScore: 0.1, riskLegend: "fiable" },
      { hypothesis: "friction", riskScore: 0.1, riskLegend: "fiable" },
      { hypothesis: "correlated", riskScore: 0.1, riskLegend: "fiable" },
    ],
    ...overrides,
  };
}

describe("buildPortfolioComparisonDiagnostic", () => {
  it("does not prefer a scenario when all simulations are stable but comparative evidence is insufficient", () => {
    const diagnostic = buildPortfolioComparisonDiagnostic(diagnosticInput());

    expect(diagnostic.simulationStability.map((finding) => finding.level)).toEqual([
      "stable",
      "stable",
      "stable",
      "stable",
    ]);
    expect(diagnostic.simulationStability.every((finding) => finding.statement.includes("ne valide pas"))).toBe(true);
    expect(diagnostic.comparisonConfidence.level).toBe("insufficient");
    expect(diagnostic.preferredScenario).toBeNull();
    expect(diagnostic.conclusion).toBe("Preuves insuffisantes pour privilégier une hypothèse.");
  });

  it("identifies a 90 percent alignment rate as user input", () => {
    const diagnostic = buildPortfolioComparisonDiagnostic(diagnosticInput());
    const aligned = diagnostic.hypothesisCredibility.find((item) => item.hypothesis === "aligned");

    expect(aligned).toMatchObject({ evidenceType: "user_input" });
    expect(aligned?.evidence).toContain("90 % saisi par l'utilisateur");
    expect(aligned?.limitations.join(" ")).toContain("pas un fait démontré");
  });

  it("identifies 81 percent friction as calculated from a user parameter", () => {
    const diagnostic = buildPortfolioComparisonDiagnostic(diagnosticInput());
    const friction = diagnostic.hypothesisCredibility.find((item) => item.hypothesis === "friction");

    expect(friction).toMatchObject({ evidenceType: "calculated" });
    expect(friction?.evidence).toContain("81 % calculé à partir du taux saisi");
    expect(friction?.limitations.join(" ")).toContain("paramètre utilisateur");
  });

  it("marks common correlated history as observed without recommending it", () => {
    const diagnostic = buildPortfolioComparisonDiagnostic(diagnosticInput());
    const correlated = diagnostic.hypothesisCredibility.find((item) => item.hypothesis === "correlated");

    expect(correlated).toMatchObject({ evidenceType: "observed" });
    expect(correlated?.evidence).toContain("12 semaines historiques communes réellement observées");
    expect(correlated?.limitations.join(" ")).toContain("ne suffit pas à recommander automatiquement");
    expect(diagnostic.preferredScenario).toBeNull();
  });

  it("raises a fragile and declining team as a portfolio fact to verify", () => {
    const diagnostic = buildPortfolioComparisonDiagnostic(diagnosticInput({
      teamObservations: [
        { teamName: "Alpha", reliability: reliability("fragile", -0.12) },
        { teamName: "Beta", reliability: reliability() },
      ],
    }));

    expect(diagnostic.historicalData.quality).toBe("fragile");
    expect(diagnostic.historicalData.teamFindings[0].signals).toEqual(["fragile_history", "declining_trend"]);
    expect(diagnostic.significantRisks).toContainEqual(expect.objectContaining({
      kind: "team_history",
      teamNames: ["Alpha"],
      statement: expect.stringContaining("fait à vérifier"),
    }));
  });

  it("reports trend divergence without causal or unproven substitutability claims", () => {
    const diagnostic = buildPortfolioComparisonDiagnostic(diagnosticInput({
      teamObservations: [
        { teamName: "Alpha", reliability: reliability("incertain", -0.08) },
        { teamName: "Beta", reliability: reliability("incertain", 0.08) },
      ],
    }));
    const allText = JSON.stringify(diagnostic);

    expect(diagnostic.historicalData.quality).toBe("mixed");
    expect(diagnostic.significantRisks).toContainEqual(expect.objectContaining({ kind: "trend_divergence" }));
    expect(allText).not.toMatch(/se compensent|sont substituables|est causée par|est causé par/i);
    expect(allText).toContain("ne démontre ni la substituabilité");
  });

  it("keeps missing historical quality and simulation stability explicit", () => {
    const diagnostic = buildPortfolioComparisonDiagnostic(diagnosticInput({
      teamObservations: [{ teamName: "Alpha", reliability: null }],
      scenarioObservations: [
        { hypothesis: "aligned", riskScore: 0.3, riskLegend: "incertain" },
        { hypothesis: "friction", riskScore: 0.6, riskLegend: "fragile" },
        { hypothesis: "correlated", riskScore: Number.NaN, riskLegend: "non fiable" },
      ],
    }));

    expect(diagnostic.historicalData.quality).toBe("insufficient");
    expect(diagnostic.historicalData.teamFindings[0]).toMatchObject({
      quality: "indisponible",
      sampleCount: 0,
      normalizedTrend: null,
    });
    expect(diagnostic.simulationStability.map((finding) => finding.level)).toEqual([
      "unavailable",
      "uncertain",
      "fragile",
      "fragile",
    ]);
    expect(diagnostic.simulationStability[3].riskScore).toBeNull();
  });
});
