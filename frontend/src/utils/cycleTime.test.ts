import { describe, expect, it } from "vitest";
import {
  createDeliveryEvent,
  type DeliveryEvent,
  type DeliveryEventKind,
} from "../domain/delivery";
import { buildCycleTimeTrendData, calculateCycleTimeData, summarizeCycleTime } from "./cycleTime";

function event(
  itemId: string,
  kind: DeliveryEventKind,
  occurredAt: string,
): DeliveryEvent {
  return createDeliveryEvent({ itemId, kind, occurredAt });
}

describe("calculateCycleTimeData", () => {
  it("returns an empty array when no lifecycle event is available", () => {
    expect(calculateCycleTimeData([])).toEqual([]);
    expect(calculateCycleTimeData([
      event("1", "item_delivered", "2026-01-15T09:00:00Z"),
    ])).toEqual([]);
  });

  it("calculates nominal cycle time points and aggregates identical coordinates", () => {
    const result = calculateCycleTimeData(
      [
        event("1", "work_started", "2026-01-08T09:00:00Z"),
        event("1", "work_completed", "2026-01-15T09:00:00Z"),
        event("2", "work_started", "2026-01-09T09:00:00Z"),
        event("2", "work_completed", "2026-01-16T09:00:00Z"),
      ],
    );

    expect(result).toEqual([{ week: "2026-01-12", cycleTimeDays: 7, count: 2 }]);
  });

  it("excludes items with an incomplete lifecycle", () => {
    const result = calculateCycleTimeData(
      [
        event("1", "work_started", "2026-01-08T09:00:00Z"),
        event("2", "work_completed", "2026-01-16T09:00:00Z"),
      ],
    );

    expect(result).toEqual([]);
  });

  it("sorts points by week then by cycle time within the same week", () => {
    const result = calculateCycleTimeData(
      [
        event("1", "work_started", "2026-01-09T09:00:00Z"),
        event("1", "work_completed", "2026-01-17T09:00:00Z"),
        event("2", "work_started", "2026-01-06T09:00:00Z"),
        event("2", "work_completed", "2026-01-17T09:00:00Z"),
      ],
    );

    expect(result).toEqual([
      { week: "2026-01-12", cycleTimeDays: 11, count: 1 },
      { week: "2026-01-12", cycleTimeDays: 8, count: 1 },
    ].sort((left, right) => left.cycleTimeDays - right.cycleTimeDays));
  });

  it("sorts points across weeks regardless of input order", () => {
    const result = calculateCycleTimeData(
      [
        event("2", "work_completed", "2026-01-19T09:00:00Z"),
        event("1", "work_completed", "2026-01-12T09:00:00Z"),
        event("2", "work_started", "2026-01-17T09:00:00Z"),
        event("1", "work_started", "2026-01-03T09:00:00Z"),
      ],
    );

    expect(result).toEqual([
      { week: "2026-01-12", cycleTimeDays: 9, count: 1 },
      { week: "2026-01-19", cycleTimeDays: 2, count: 1 },
    ]);
  });

  it("ignores items whose completion happens before activation", () => {
    const result = calculateCycleTimeData(
      [
        event("1", "work_completed", "2026-01-10T09:00:00Z"),
        event("1", "work_started", "2026-01-15T09:00:00Z"),
      ],
    );

    expect(result).toEqual([]);
  });
});

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
