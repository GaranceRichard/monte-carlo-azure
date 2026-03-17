import { describe, expect, it } from "vitest";
import { buildCycleTimeTrendData, calculateCycleTimeData, summarizeCycleTime } from "./cycleTime";

describe("calculateCycleTimeData", () => {
  it("calculates nominal cycle time points and aggregates identical coordinates", () => {
    const result = calculateCycleTimeData(
      [
        {
          revisions: [
            { changedDate: "2026-01-06T09:00:00Z", state: "New" },
            { changedDate: "2026-01-08T09:00:00Z", state: "Active" },
            { changedDate: "2026-01-15T09:00:00Z", state: "Done" },
          ],
        },
        {
          revisions: [
            { changedDate: "2026-01-07T09:00:00Z", state: "New" },
            { changedDate: "2026-01-09T09:00:00Z", state: "Committed" },
            { changedDate: "2026-01-16T09:00:00Z", state: "Done" },
          ],
        },
      ],
      ["Done"],
    );

    expect(result).toEqual([{ week: "2026-01-12", cycleTime: 1, count: 2 }]);
  });

  it("excludes items that never left new", () => {
    const result = calculateCycleTimeData(
      [
        {
          revisions: [
            { changedDate: "2026-01-06T09:00:00Z", state: "New" },
            { changedDate: "2026-01-15T09:00:00Z", state: "New" },
          ],
        },
      ],
      ["Done"],
    );

    expect(result).toEqual([]);
  });

  it("excludes items without a closing date in selected done states", () => {
    const result = calculateCycleTimeData(
      [
        {
          revisions: [
            { changedDate: "2026-01-06T09:00:00Z", state: "New" },
            { changedDate: "2026-01-08T09:00:00Z", state: "Active" },
            { changedDate: "2026-01-15T09:00:00Z", state: "Resolved" },
          ],
        },
      ],
      ["Done"],
    );

    expect(result).toEqual([]);
  });

  it("sorts points by week then by cycle time within the same week", () => {
    const result = calculateCycleTimeData(
      [
        {
          revisions: [
            { changedDate: "2026-01-05T09:00:00Z", state: "New" },
            { changedDate: "2026-01-09T09:00:00Z", state: "Active" },
            { changedDate: "2026-01-17T09:00:00Z", state: "Done" },
          ],
        },
        {
          revisions: [
            { changedDate: "2026-01-05T09:00:00Z", state: "New" },
            { changedDate: "2026-01-06T09:00:00Z", state: "Active" },
            { changedDate: "2026-01-17T09:00:00Z", state: "Done" },
          ],
        },
      ],
      ["Done"],
    );

    expect(result).toEqual([
      { week: "2026-01-12", cycleTime: 1.57, count: 1 },
      { week: "2026-01-12", cycleTime: 1.14, count: 1 },
    ].sort((left, right) => left.cycleTime - right.cycleTime));
  });

  it("sorts points across weeks and skips invalid revision dates", () => {
    const result = calculateCycleTimeData(
      [
        {
          revisions: [
            { changedDate: "2026-01-10T09:00:00Z", state: "New" },
            { changedDate: "2026-01-12T09:00:00Z", state: "Active" },
            { changedDate: "invalid-date", state: "Done" },
          ],
        },
        {
          revisions: [
            { changedDate: "2026-01-01T09:00:00Z", state: "New" },
            { changedDate: "2026-01-03T09:00:00Z", state: "Active" },
            { changedDate: "2026-01-12T09:00:00Z", state: "Done" },
          ],
        },
      ],
      ["Done"],
    );

    expect(result).toEqual([{ week: "2026-01-12", cycleTime: 1.29, count: 1 }]);
  });
});

describe("cycle time chart helpers", () => {
  it("returns an empty trend when there is no cycle time data", () => {
    expect(buildCycleTimeTrendData([])).toEqual([]);
  });

  it("builds rolling averages and std-dev bands from aggregated data", () => {
    const points = [
      { week: "2026-01-05", cycleTime: 1, count: 2 },
      { week: "2026-01-12", cycleTime: 2, count: 1 },
      { week: "2026-01-19", cycleTime: 3, count: 1 },
    ];

    expect(buildCycleTimeTrendData(points, 2)).toEqual([
      { week: "2026-01-05", average: 1, lowerBound: 1, upperBound: 1, itemCount: 2 },
      { week: "2026-01-12", average: 1.33, lowerBound: 0.86, upperBound: 1.8, itemCount: 3 },
      { week: "2026-01-19", average: 2.5, lowerBound: 2, upperBound: 3, itemCount: 2 },
    ]);
  });

  it("groups several points for the same week into the same rolling window", () => {
    const points = [
      { week: "2026-01-05", cycleTime: 1, count: 1 },
      { week: "2026-01-05", cycleTime: 3, count: 1 },
      { week: "2026-01-12", cycleTime: 5, count: 1 },
    ];

    expect(buildCycleTimeTrendData(points, 2)).toEqual([
      { week: "2026-01-05", average: 2, lowerBound: 1, upperBound: 3, itemCount: 2 },
      { week: "2026-01-12", average: 3, lowerBound: 1.37, upperBound: 4.63, itemCount: 3 },
    ]);
  });

  it("falls back to zeroed trend values when a week contains no usable item count", () => {
    expect(buildCycleTimeTrendData([{ week: "2026-01-05", cycleTime: 2, count: 0 }], 1)).toEqual([
      { week: "2026-01-05", average: 0, lowerBound: 0, upperBound: 0, itemCount: 0 },
    ]);
  });

  it("summarizes weighted count and average and detects insufficient data", () => {
    expect(
      summarizeCycleTime([
        { week: "2026-01-05", cycleTime: 1, count: 2 },
        { week: "2026-01-12", cycleTime: 2, count: 1 },
      ]),
    ).toEqual({
      itemCount: 3,
      average: 1.33,
      hasSufficientData: true,
    });

    expect(
      summarizeCycleTime([{ week: "2026-01-05", cycleTime: 1, count: 1 }]),
    ).toEqual({
      itemCount: 1,
      average: 1,
      hasSufficientData: false,
    });

    expect(
      summarizeCycleTime([{ week: "2026-01-05", cycleTime: 2, count: 0 }]),
    ).toEqual({
      itemCount: 0,
      average: null,
      hasSufficientData: false,
    });

    expect(summarizeCycleTime([])).toEqual({
      itemCount: 0,
      average: null,
      hasSufficientData: false,
    });
  });
});
