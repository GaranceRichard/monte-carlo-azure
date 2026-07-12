import { describe, expect, it } from "vitest";
import { diagnoseDataQuality, diagnoseForecastUncertainty, recommendArbitration } from "./forecastDiagnostics";

const percentiles = { P50: 10, P70: 12, P90: 15 };
const lowReliability = { cv: 0.1, iqr_ratio: 0.1, slope_norm: 0.01, label: "fiable" as const, samples_count: 12 };

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
    expect(recommendArbitration({ dataQuality: insufficient, forecastUncertainty: low })).toMatchObject({ level: "not_recommended", advisedAction: expect.stringContaining("Completer") });

    const unmeasurable = diagnoseForecastUncertainty({ percentiles: { P50: 2 } });
    expect(recommendArbitration({ dataQuality: diagnoseDataQuality({ throughputSamples: [1,2,3,4,5,6,7,8] }), forecastUncertainty: unmeasurable })).toMatchObject({ level: "not_recommended", advisedAction: expect.stringContaining("percentiles") });

    const watched = diagnoseDataQuality({ throughputSamples: [1,2,3,4,5,6], adoDataWarning: "partiel" });
    const high = diagnoseForecastUncertainty({ percentiles, throughputReliability: { ...lowReliability, slope_norm: 0.1 } });
    expect(recommendArbitration({ dataQuality: watched, forecastUncertainty: high }).level).toBe("arbitration_required");
    expect(recommendArbitration({ dataQuality: watched, forecastUncertainty: low }).level).toBe("caution");
    expect(recommendArbitration({ dataQuality: diagnoseDataQuality({ throughputSamples: [1,2,3,4,5,6,7,8] }), forecastUncertainty: low }).level).toBe("supportable");
  });
});
