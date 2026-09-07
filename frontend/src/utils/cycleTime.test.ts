import { describe, expect, it } from "vitest";
import { buildCycleTimeTrendData, summarizeCycleTime } from "./cycleTime";

describe("cycle time chart helpers", () => {
  it("returns an empty trend when there is no cycle time data", () => {
    expect(buildCycleTimeTrendData([])).toEqual([]);
  });

  it("builds rolling averages and std-dev bands from aggregated data", () => {
    const points = [
      { week: "2026-01-05", cycleTimeDays: 1, count: 2 },
      { week: "2026-01-12", cycleTimeDays: 2, count: 1 },
      { week: "2026-01-19", cycleTimeDays: 3, count: 1 },
    ];

    expect(buildCycleTimeTrendData(points, 2)).toEqual([
      { week: "2026-01-05", averageDays: 1, lowerBoundDays: 1, upperBoundDays: 1, itemCount: 2 },
      { week: "2026-01-12", averageDays: 1.33, lowerBoundDays: 0.86, upperBoundDays: 1.8, itemCount: 3 },
      { week: "2026-01-19", averageDays: 2.5, lowerBoundDays: 2, upperBoundDays: 3, itemCount: 2 },
    ]);
  });

  it("groups several points for the same week into the same rolling window", () => {
    const points = [
      { week: "2026-01-05", cycleTimeDays: 1, count: 1 },
      { week: "2026-01-05", cycleTimeDays: 3, count: 1 },
      { week: "2026-01-12", cycleTimeDays: 5, count: 1 },
    ];

    expect(buildCycleTimeTrendData(points, 2)).toEqual([
      { week: "2026-01-05", averageDays: 2, lowerBoundDays: 1, upperBoundDays: 3, itemCount: 2 },
      { week: "2026-01-12", averageDays: 3, lowerBoundDays: 1.37, upperBoundDays: 4.63, itemCount: 3 },
    ]);
  });

  it("falls back to zeroed trend values when a week contains no usable item count", () => {
    expect(buildCycleTimeTrendData([{ week: "2026-01-05", cycleTimeDays: 2, count: 0 }], 1)).toEqual([
      { week: "2026-01-05", averageDays: 0, lowerBoundDays: 0, upperBoundDays: 0, itemCount: 0 },
    ]);
  });

  it("summarizes weighted count and average and detects insufficient data", () => {
    expect(
      summarizeCycleTime([
        { week: "2026-01-05", cycleTimeDays: 1, count: 2 },
        { week: "2026-01-12", cycleTimeDays: 2, count: 1 },
      ]),
    ).toEqual({
      itemCount: 3,
      averageDays: 1.33,
      hasSufficientData: true,
    });

    expect(
      summarizeCycleTime([{ week: "2026-01-05", cycleTimeDays: 1, count: 1 }]),
    ).toEqual({
      itemCount: 1,
      averageDays: 1,
      hasSufficientData: false,
    });

    expect(
      summarizeCycleTime([{ week: "2026-01-05", cycleTimeDays: 2, count: 0 }]),
    ).toEqual({
      itemCount: 0,
      averageDays: null,
      hasSufficientData: false,
    });

    expect(summarizeCycleTime([])).toEqual({
      itemCount: 0,
      averageDays: null,
      hasSufficientData: false,
    });
  });
});
