import { describe, expect, it } from "vitest";
import {
  DEMO_CONFIG,
  DEMO_TEAM_CYCLE_TIME,
  DEMO_PORTFOLIO_TEAM_CONFIGS,
  DEMO_TEAM_WEEKLY,
  getDemoCycleTime,
  getDemoThroughputSamples,
  getDemoWeeklyThroughput,
} from "./demoData";
import {
  diagnoseDataQuality,
  diagnoseForecastUncertainty,
  recommendArbitration,
} from "./utils/forecastDiagnostics";
import { simulateMonteCarloLocal } from "./utils/simulation";
import { buildSimulationDecisionLanguage } from "./utils/simulationDecisionDiagnostic";

function buildDemoDiagnostic(teamName: string) {
  const throughputSamples = getDemoThroughputSamples(teamName);
  const weeklyThroughput = getDemoWeeklyThroughput(teamName);
  const result = simulateMonteCarloLocal({
    throughputSamples,
    includeZeroWeeks: true,
    mode: "backlog_to_weeks",
    backlogSize: 120,
    nSims: 4_000,
    seed: 12_345,
  });
  const dataQuality = diagnoseDataQuality({ throughputSamples, includeZeroWeeks: true });
  const forecastUncertainty = diagnoseForecastUncertainty({
    percentiles: result.resultPercentiles,
    completionSummary: result.completionSummary,
    riskScore: result.riskScore,
    throughputReliability: result.throughputReliability,
    throughputSamples,
  });
  return {
    result,
    dataQuality,
    forecastUncertainty,
    recommendation: recommendArbitration({ dataQuality, forecastUncertainty }),
    language: buildSimulationDecisionLanguage({
      hasResult: true,
      throughputSamples,
      includeZeroWeeks: true,
      percentiles: result.resultPercentiles,
      completionSummary: result.completionSummary,
      riskScore: result.riskScore,
      throughputReliability: result.throughputReliability,
      selectedOrg: DEMO_CONFIG.org,
      selectedProject: DEMO_CONFIG.project,
      selectedTeam: teamName,
      startDate: weeklyThroughput[0]?.week ?? DEMO_CONFIG.startDate,
      endDate: weeklyThroughput.at(-1)?.week ?? DEMO_CONFIG.endDate,
      simulationMode: "backlog_to_weeks",
      backlogSize: 120,
      targetWeeks: 12,
      types: DEMO_CONFIG.defaultTypes,
      doneStates: DEMO_CONFIG.defaultDoneStates,
    }),
  };
}

describe("demoData", () => {
  it("returns defensive copies for demo weekly throughput", () => {
    const weekly = getDemoWeeklyThroughput("Alpha");
    expect(weekly).toEqual(DEMO_TEAM_WEEKLY.Alpha);

    weekly[0]!.throughput = 999;

    expect(getDemoWeeklyThroughput("Alpha")[0]?.throughput).not.toBe(999);
  });

  it("returns defensive copies for demo throughput samples and empty arrays for unknown teams", () => {
    const samples = getDemoThroughputSamples("Alpha");
    expect(samples.length).toBeGreaterThan(0);

    samples[0] = 999;

    expect(getDemoThroughputSamples("Alpha")[0]).not.toBe(999);
    expect(getDemoThroughputSamples("Unknown")).toEqual([]);
    expect(getDemoWeeklyThroughput("Unknown")).toEqual([]);
  });

  it("returns defensive copies for demo cycle time and stays coherent with every throughput week", () => {
    const cycleTime = getDemoCycleTime("Alpha");
    expect(cycleTime).toEqual(DEMO_TEAM_CYCLE_TIME.Alpha);

    cycleTime[0]!.count = 999;

    expect(getDemoCycleTime("Alpha")[0]?.count).not.toBe(999);
    expect(getDemoCycleTime("Unknown")).toEqual([]);
    Object.entries(DEMO_TEAM_WEEKLY).forEach(([teamName, weeklyRows]) => {
      const cycleTimeRows = DEMO_TEAM_CYCLE_TIME[teamName] ?? [];
      weeklyRows.forEach((weeklyRow) => {
        expect(cycleTimeRows
          .filter((cycleTimeRow) => cycleTimeRow.week === weeklyRow.week)
          .reduce((sum, cycleTimeRow) => sum + cycleTimeRow.count, 0))
          .toBe(weeklyRow.throughput);
      });
    });
  });

  it("keeps demo dates valid, ordered and aligned across throughput and Cycle Time", () => {
    Object.entries(DEMO_TEAM_WEEKLY).forEach(([teamName, weeklyRows]) => {
      const dates = weeklyRows.map((row) => Date.parse(row.week));
      expect(dates.every(Number.isFinite)).toBe(true);
      expect(dates).toEqual([...dates].sort((left, right) => left - right));
      expect((DEMO_TEAM_CYCLE_TIME[teamName] ?? []).every((row) =>
        weeklyRows.some((weeklyRow) => weeklyRow.week === row.week))).toBe(true);
    });
  });

  it.each([
    ["Alpha", "sufficient", "low", "supportable"],
    ["Beta", "sufficient", "high", "caution"],
    ["Gamma", "watch", "high", "arbitration_required"],
  ] as const)(
    "produces the expected decision profile for %s through production diagnostics",
    (teamName, qualityLevel, uncertaintyLevel, recommendationLevel) => {
      const diagnostic = buildDemoDiagnostic(teamName);

      expect(diagnostic.dataQuality.level).toBe(qualityLevel);
      expect(diagnostic.forecastUncertainty.level).toBe(uncertaintyLevel);
      expect(diagnostic.recommendation.level).toBe(recommendationLevel);
    },
  );

  it("exposes differentiated and coherent public decision language for the three demo teams", () => {
    const alpha = buildDemoDiagnostic("Alpha");
    const beta = buildDemoDiagnostic("Beta");
    const gamma = buildDemoDiagnostic("Gamma");

    expect(alpha.language?.decisionRecommendation).toMatchObject({
      status: "Décision appuyée par les données",
      action: "Utiliser la prévision en conservant les hypothèses documentées.",
    });
    expect(beta.result.completionSummary?.censoredCount).toBe(0);
    expect(beta.language?.decisionRecommendation.explanation).toContain("scénarios centraux et prudents");
    expect(beta.language?.decisionRecommendation.explanation).not.toContain("simulations n'aboutissent pas");
    expect(beta.language?.decisionRecommendation.action).toBe(
      "Planifier sur le P70 et conserver le P90 comme marge de sécurité.",
    );
    expect(gamma.language?.decisionRecommendation.explanation).toContain("7 semaines d'historique exploitable");
    expect(gamma.language?.decisionRecommendation.explanation).toContain("scénarios centraux et prudents");
    expect(gamma.language?.decisionRecommendation.action).toContain("P70");
    expect(gamma.language?.decisionRecommendation.action).toContain("P90");
    expect(gamma.language?.decisionRecommendation.action).toContain("semaines supplémentaires");
  });

  it("exposes coherent demo portfolio and app defaults", () => {
    expect(DEMO_CONFIG.selectedTeam).toBe("Alpha");
    expect(DEMO_PORTFOLIO_TEAM_CONFIGS.map((team) => team.teamName)).toEqual(
      DEMO_CONFIG.teams.map((team) => team.name),
    );
    expect(DEMO_PORTFOLIO_TEAM_CONFIGS[0]?.types).toEqual(DEMO_CONFIG.defaultTypes);
    expect(DEMO_PORTFOLIO_TEAM_CONFIGS[0]?.doneStates).toEqual(DEMO_CONFIG.defaultDoneStates);
  });
});
