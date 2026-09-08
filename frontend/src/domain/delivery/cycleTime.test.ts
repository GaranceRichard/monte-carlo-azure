import { describe, expect, it } from "vitest";
import {
  calculateCycleTime,
  createDeliveryEvent,
  CYCLE_TIME_DEFINITION,
  qualifyDeliveryChronology,
  type DeliveryEvent,
  type DeliveryEventKind,
} from ".";

const productionSources = import.meta.glob("../../**/*.{ts,tsx}", {
  eager: true,
  import: "default",
  query: "?raw",
}) as Record<string, string>;

function event(
  itemId: string,
  kind: DeliveryEventKind,
  occurredAt: string,
): DeliveryEvent {
  return createDeliveryEvent({ itemId, kind, occurredAt });
}

function calculate(events: readonly DeliveryEvent[]) {
  return calculateCycleTime(qualifyDeliveryChronology(events));
}

describe("Cycle Time delivery definition", () => {
  it("publishes the single explicit lifecycle and calendar-day definition", () => {
    expect(CYCLE_TIME_DEFINITION).toEqual({
      unit: "calendar_days",
      precision: 2,
      startsOn: "first_work_started_event",
      endsOn: "first_work_completed_event",
      groupedBy: "completion_week",
      invalidLifecycle: "excluded_by_delivery_chronology",
    });
    expect(Object.isFrozen(CYCLE_TIME_DEFINITION)).toBe(true);
  });

  it("calculates elapsed calendar days and groups identical observations", () => {
    expect(calculate([
      event("1", "work_started", "2026-01-08T09:00:00Z"),
      event("1", "work_completed", "2026-01-15T21:00:00Z"),
      event("2", "work_started", "2026-01-09T03:00:00-06:00"),
      event("2", "work_completed", "2026-01-16T15:00:00-06:00"),
    ])).toEqual([
      { week: "2026-01-12", cycleTimeDays: 7.5, count: 2 },
    ]);
  });

  it("rounds elapsed days to the declared precision", () => {
    expect(calculate([
      event("1", "work_started", "2026-01-12T00:00:00Z"),
      event("1", "work_completed", "2026-01-12T08:00:00Z"),
    ])).toEqual([
      { week: "2026-01-12", cycleTimeDays: 0.33, count: 1 },
    ]);
  });

  it("uses the first lifecycle facts and accepts a zero-day cycle", () => {
    expect(calculate([
      event("1", "work_completed", "2026-01-12T09:00:00Z"),
      event("1", "work_started", "2026-01-12T09:00:00Z"),
      event("1", "work_started", "2026-01-13T09:00:00Z"),
      event("1", "work_completed", "2026-01-14T09:00:00Z"),
    ])).toEqual([
      { week: "2026-01-12", cycleTimeDays: 0, count: 1 },
    ]);
  });

  it("excludes delivery-only, incomplete and chronologically invalid lifecycles", () => {
    expect(calculate([
      event("delivered", "item_delivered", "2026-01-15T09:00:00Z"),
      event("started", "work_started", "2026-01-08T09:00:00Z"),
      event("completed", "work_completed", "2026-01-16T09:00:00Z"),
      event("invalid", "work_completed", "2026-01-10T09:00:00Z"),
      event("invalid", "work_started", "2026-01-15T09:00:00Z"),
    ])).toEqual([]);
  });

  it("sorts observations by completion week then elapsed days", () => {
    expect(calculate([
      event("later", "work_completed", "2026-01-19T09:00:00Z"),
      event("longer", "work_completed", "2026-01-17T09:00:00Z"),
      event("shorter", "work_completed", "2026-01-17T09:00:00Z"),
      event("later", "work_started", "2026-01-17T09:00:00Z"),
      event("longer", "work_started", "2026-01-06T09:00:00Z"),
      event("shorter", "work_started", "2026-01-09T09:00:00Z"),
    ])).toEqual([
      { week: "2026-01-12", cycleTimeDays: 8, count: 1 },
      { week: "2026-01-12", cycleTimeDays: 11, count: 1 },
      { week: "2026-01-19", cycleTimeDays: 2, count: 1 },
    ]);
  });

  it("prevents a competing event-duration calculation outside delivery", () => {
    const competingDurationSources = Object.entries(productionSources)
      .filter(([path]) => !/\.(?:test|spec)\.[jt]sx?$/.test(path))
      .filter(([path]) => path !== "./cycleTime.ts")
      .filter(([, source]) => /cycleTime/i.test(source))
      .filter(([, source]) => (
        /(?:MILLISECONDS_PER_(?:CALENDAR_)?DAY|DAY_MS|86_?400_?000)/.test(source)
        || /24\s*\*\s*60\s*\*\s*60\s*\*\s*1000/.test(source)
        || /getTime\(\)\s*-\s*[^;\n]+getTime\(\)/.test(source)
      ));
    const calculatorAuthorities = Object.entries(productionSources)
      .filter(([path]) => !/\.(?:test|spec)\.[jt]sx?$/.test(path))
      .filter(([, source]) => /export\s+function\s+calculateCycleTime(?:Data)?\s*\(/.test(source));
    const competingTypeAuthorities = Object.entries(productionSources)
      .filter(([path]) => !/\.(?:test|spec)\.[jt]sx?$/.test(path))
      .filter(([, source]) => /export\s+type\s+CycleTimePoint\s*=/.test(source));

    expect(competingDurationSources).toEqual([]);
    expect(calculatorAuthorities.map(([path]) => path)).toEqual([
      "./cycleTime.ts",
    ]);
    expect(competingTypeAuthorities.map(([path]) => path)).toEqual([
      "./cycleTime.ts",
    ]);
  });
});
