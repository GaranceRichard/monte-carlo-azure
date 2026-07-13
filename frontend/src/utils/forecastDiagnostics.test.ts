import { describe, expect, it } from "vitest";
import {
  diagnoseDataQuality,
  diagnoseForecastUncertainty,
  diagnoseHistoricalWindowSensitivity,
  recommendArbitration,
} from "./forecastDiagnostics";
import type { HistoricalWindowSimulation } from "./forecastDiagnostics";

const percentiles = { P50: 10, P70: 12, P90: 15 };
const lowReliability = { cv: 0.1, iqr_ratio: 0.1, slope_norm: 0.01, label: "fiable" as const, samples_count: 12 };

function windowSimulation(overrides: Partial<HistoricalWindowSimulation> = {}): HistoricalWindowSimulation {
  return {
    id: "current",
    selectedOrg: "org-a",
    selectedProject: "project-a",
    selectedTeam: "team-a",
    startDate: "2026-01-01",
    endDate: "2026-04-30",
    simulationMode: "weeks_to_items",
    includeZeroWeeks: true,
    backlogSize: 100,
    targetWeeks: 3,
    types: ["Bug", "Story"],
    doneStates: ["Closed", "Done"],
    p90: 12,
    usableWeeks: 17,
    ...overrides,
  };
}

describe("forecast diagnostics", () => {
  it("classifies insufficient, watched and sufficient data quality without conflating missing data", () => {
    expect(diagnoseDataQuality({ throughputSamples: [1, 2, 3, 4, 5] }).level).toBe("insufficient");
    const watch = diagnoseDataQuality({ throughputSamples: [1, 2, 3, 4, 5, 6], adoDataWarning: "lot incomplet", completenessIssues: ["champ absent"] });
    expect(watch.level).toBe("watch");
    expect(watch.factors.map((factor) => factor.code)).toEqual(expect.arrayContaining(["partial_ado_data", "completeness_issue"]));
    expect(diagnoseDataQuality({ throughputSamples: [0, 1, 2, 3, 4, 5], includeZeroWeeks: true }).level).toBe("watch");
    expect(diagnoseDataQuality({ throughputSamples: [1, 2, 3, 4, 5, 6, 7, 8] }).level).toBe("sufficient");
  });

  it("reports discarded non-finite and negative historical values alongside usable history", () => {
    const result = diagnoseDataQuality({ throughputSamples: [1, 2, 3, 4, 5, 6, NaN, -1] });
    expect(result.level).toBe("watch");
    expect(result.factors).toContainEqual(expect.objectContaining({ code: "discarded_history_values", value: 2 }));
  });

  it("reports unmeasurable uncertainty when a required percentile is absent", () => {
    const result = diagnoseForecastUncertainty({ percentiles: { P50: 10, P90: 15 } });
    expect(result.level).toBe("unmeasurable");
    expect(result.factors[0]).toMatchObject({ code: "missing_required_percentiles", value: "P70" });
  });

  it("distinguishes low, moderate and high uncertainty from dispersion and censures", () => {
    expect(diagnoseForecastUncertainty({ percentiles, throughputReliability: lowReliability }).level).toBe("low");
    expect(diagnoseForecastUncertainty({ percentiles, throughputReliability: { ...lowReliability, cv: 0.5 } }).level).toBe("moderate");
    expect(diagnoseForecastUncertainty({ percentiles, throughputReliability: lowReliability, completionSummary: { completed_count: 8, censored_count: 2, censored_rate: 0.2, horizon_weeks: 20 } }).level).toBe("moderate");
    expect(diagnoseForecastUncertainty({ percentiles, throughputReliability: { ...lowReliability, iqr_ratio: 1 } }).level).toBe("high");
    expect(diagnoseForecastUncertainty({ percentiles, riskScore: 0.8 }).level).toBe("high");
  });

  it("recommends independently for invalid data, unmeasurable forecasts and degraded combinations", () => {
    const insufficient = diagnoseDataQuality({ throughputSamples: [] });
    const low = diagnoseForecastUncertainty({ percentiles, throughputReliability: lowReliability });
    expect(recommendArbitration({ dataQuality: insufficient, forecastUncertainty: low })).toMatchObject({ level: "not_recommended", advisedAction: expect.stringContaining("Compléter") });

    const unmeasurable = diagnoseForecastUncertainty({ percentiles: { P50: 2 } });
    expect(recommendArbitration({ dataQuality: diagnoseDataQuality({ throughputSamples: [1,2,3,4,5,6,7,8] }), forecastUncertainty: unmeasurable })).toMatchObject({ level: "not_recommended", advisedAction: expect.stringContaining("percentiles") });

    const watched = diagnoseDataQuality({ throughputSamples: [1,2,3,4,5,6], adoDataWarning: "partiel" });
    const high = diagnoseForecastUncertainty({ percentiles, throughputReliability: { ...lowReliability, slope_norm: 0.1 } });
    expect(recommendArbitration({ dataQuality: watched, forecastUncertainty: high }).level).toBe("arbitration_required");
    expect(recommendArbitration({ dataQuality: watched, forecastUncertainty: low }).level).toBe("caution");
    expect(recommendArbitration({ dataQuality: diagnoseDataQuality({ throughputSamples: [1,2,3,4,5,6,7,8] }), forecastUncertainty: low }).level).toBe("supportable");
  });

  it("reports unavailable sensitivity when no prior simulation is comparable", () => {
    const result = diagnoseHistoricalWindowSensitivity({
      current: windowSimulation(),
      history: [windowSimulation({ id: "same-window" })],
    });

    expect(result).toMatchObject({ level: "unavailable", comparedSimulations: [] });
  });

  it("classifies stable and moderate historical-window sensitivity", () => {
    const current = windowSimulation({ p90: 108, usableWeeks: 9, startDate: "2026-03-01" });
    const stable = diagnoseHistoricalWindowSensitivity({
      current,
      history: [windowSimulation({ id: "long", p90: 100 })],
    });
    const moderate = diagnoseHistoricalWindowSensitivity({
      current: { ...current, p90: 115 },
      history: [windowSimulation({ id: "long", p90: 100 })],
    });

    expect(stable.level).toBe("stable");
    expect(moderate.level).toBe("moderate");
    const recommendation = recommendArbitration({
      dataQuality: diagnoseDataQuality({ throughputSamples: [1,2,3,4,5,6,7,8] }),
      forecastUncertainty: diagnoseForecastUncertainty({ percentiles, throughputReliability: lowReliability }),
      historicalSensitivity: stable,
    });
    expect(recommendation.level).toBe("supportable");
    expect(recommendation.factors).toContainEqual(expect.objectContaining({
      code: "historical_window_sensitivity",
      source: "historicalSensitivity",
    }));
  });

  it("detects the 12-to-18 items example as high sensitivity and recent improvement", () => {
    const result = diagnoseHistoricalWindowSensitivity({
      current: windowSimulation({ p90: 18, usableWeeks: 9, startDate: "2026-03-01" }),
      history: [windowSimulation({ id: "long", p90: 12, usableWeeks: 17 })],
    });

    expect(result).toMatchObject({
      level: "high",
      p90Minimum: 12,
      p90Maximum: 18,
      absoluteGap: 6,
      relativeGap: 0.5,
      recentTrend: "improved",
      recentWindow: { p90: 18, usableWeeks: 9 },
      longWindow: { p90: 12, usableWeeks: 17 },
    });
    expect(result.justification).toContain("peu de recul historique");
    expect(result.advisedAction).toContain("pilotage opérationnel");
    expect(result.advisedAction).toContain("scénario prudent");
  });

  it("inverts the recent-capacity interpretation for backlog_to_weeks", () => {
    const result = diagnoseHistoricalWindowSensitivity({
      current: windowSimulation({
        simulationMode: "backlog_to_weeks",
        p90: 8,
        usableWeeks: 9,
        startDate: "2026-03-01",
      }),
      history: [windowSimulation({
        id: "long",
        simulationMode: "backlog_to_weeks",
        p90: 12,
        usableWeeks: 17,
      })],
    });

    expect(result.level).toBe("high");
    expect(result.recentTrend).toBe("improved");
    expect(result.factors).toContainEqual(expect.objectContaining({ description: "Capacité récente en hausse" }));
  });

  it("normalizes ticket and state order while ignoring incompatible simulations", () => {
    const current = windowSimulation({ startDate: "2026-03-01", p90: 18, usableWeeks: 9 });
    const comparable = windowSimulation({
      id: "comparable",
      types: ["Story", "Bug"],
      doneStates: ["Done", "Closed"],
      p90: 12,
    });
    const incompatible = [
      windowSimulation({ id: "org", selectedOrg: "other", p90: 30 }),
      windowSimulation({ id: "project", selectedProject: "other", p90: 30 }),
      windowSimulation({ id: "team", selectedTeam: "other", p90: 30 }),
      windowSimulation({ id: "mode", simulationMode: "backlog_to_weeks", p90: 30 }),
      windowSimulation({ id: "objective", targetWeeks: 4, p90: 30 }),
      windowSimulation({ id: "types", types: ["Bug"], p90: 30 }),
      windowSimulation({ id: "states", doneStates: ["Done"], p90: 30 }),
      windowSimulation({ id: "zeros", includeZeroWeeks: false, p90: 30 }),
      windowSimulation({ id: "end", endDate: "2026-04-29", p90: 30 }),
      windowSimulation({ id: "start", startDate: current.startDate, p90: 30 }),
      windowSimulation({ id: "missing-p90", p90: null }),
    ];
    const result = diagnoseHistoricalWindowSensitivity({
      current,
      history: [comparable, { ...comparable, id: "duplicate-execution" }, ...incompatible],
    });

    expect(result.comparedSimulations.map((simulation) => simulation.id)).toEqual(["current", "comparable"]);
    expect(result.p90Maximum).toBe(18);
  });

  it("downgrades recommendation for moderate and high sensitivity without forcing not_recommended", () => {
    const dataQuality = diagnoseDataQuality({ throughputSamples: [1,2,3,4,5,6,7,8] });
    const uncertainty = diagnoseForecastUncertainty({ percentiles, throughputReliability: lowReliability });
    const moderate = diagnoseHistoricalWindowSensitivity({
      current: windowSimulation({ p90: 115, usableWeeks: 9, startDate: "2026-03-01" }),
      history: [windowSimulation({ id: "long", p90: 100 })],
    });
    const high = diagnoseHistoricalWindowSensitivity({
      current: windowSimulation({ p90: 18, usableWeeks: 9, startDate: "2026-03-01" }),
      history: [windowSimulation({ id: "long", p90: 12 })],
    });

    expect(recommendArbitration({ dataQuality, forecastUncertainty: uncertainty, historicalSensitivity: moderate }).level).toBe("caution");
    expect(recommendArbitration({ dataQuality, forecastUncertainty: uncertainty, historicalSensitivity: high }).level).toBe("arbitration_required");
    expect(recommendArbitration({
      dataQuality: diagnoseDataQuality({ throughputSamples: [] }),
      forecastUncertainty: uncertainty,
      historicalSensitivity: high,
    }).level).toBe("not_recommended");
  });
});
