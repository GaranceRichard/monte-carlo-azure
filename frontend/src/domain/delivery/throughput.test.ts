import { describe, expect, it } from "vitest";
import {
  calculateDeliveryThroughput,
  createDeliveryEvent,
  createDeliveryHistoryPeriods,
  createDeliveryHistoryWindow,
  DELIVERY_THROUGHPUT_DEFINITION,
  qualifyDeliveryChronology,
  type CompleteDeliveryHistoryPeriod,
  type DeliveryEventInput,
} from ".";

function completePeriod(
  startInclusive = "2026-01-05T00:00:00Z",
  endExclusive = "2026-01-26T00:00:00Z",
): CompleteDeliveryHistoryPeriod {
  const classification = createDeliveryHistoryPeriods({
    window: createDeliveryHistoryWindow({ startInclusive, endExclusive }),
    referenceInstant: "2026-02-02T00:00:00Z",
  });
  if (!classification.completePeriod) {
    throw new Error("Test setup requires a complete delivery period.");
  }
  return classification.completePeriod;
}

function event(input: DeliveryEventInput) {
  return createDeliveryEvent(input);
}

function chronology(events: readonly DeliveryEventInput[]) {
  return qualifyDeliveryChronology(events.map(event));
}

describe("delivery throughput", () => {
  it("publishes the counted fact, period and unit as an immutable definition", () => {
    expect(DELIVERY_THROUGHPUT_DEFINITION).toEqual({
      countedFact: "item_delivered",
      period: "complete_iso_week",
      unit: "delivered_items_per_complete_iso_week",
    });
    expect(Object.isFrozen(DELIVERY_THROUGHPUT_DEFINITION)).toBe(true);
  });

  it("counts delivery facts per complete ISO week and preserves zero weeks", () => {
    const result = calculateDeliveryThroughput(completePeriod(), chronology([
      event({ itemId: "1", kind: "item_delivered", occurredAt: "2026-01-05T08:00:00Z" }),
      event({ itemId: "2", kind: "item_delivered", occurredAt: "2026-01-11T23:59:59.999Z" }),
      event({ itemId: "3", kind: "item_delivered", occurredAt: "2026-01-19T12:00:00Z" }),
      event({ itemId: "1", kind: "work_started", occurredAt: "2025-12-20T08:00:00Z" }),
      event({ itemId: "1", kind: "work_completed", occurredAt: "2026-01-05T08:00:00Z" }),
    ]));

    expect(result).toEqual([
      { week: "2026-01-05", throughput: 2 },
      { week: "2026-01-12", throughput: 0 },
      { week: "2026-01-19", throughput: 1 },
    ]);
    expect(result.every(Object.isFrozen)).toBe(true);
  });

  it("applies absolute, start-inclusive and end-exclusive boundaries", () => {
    const result = calculateDeliveryThroughput(completePeriod(), chronology([
      event({ itemId: "before", kind: "item_delivered", occurredAt: "2026-01-04T23:59:59.999Z" }),
      event({ itemId: "start", kind: "item_delivered", occurredAt: "2026-01-05T00:30:00+02:00" }),
      event({ itemId: "inside", kind: "item_delivered", occurredAt: "2026-01-05T00:30:00-02:00" }),
      event({ itemId: "last", kind: "item_delivered", occurredAt: "2026-01-25T23:59:59.999Z" }),
      event({ itemId: "end", kind: "item_delivered", occurredAt: "2026-01-26T00:00:00Z" }),
    ]));

    expect(result).toEqual([
      { week: "2026-01-05", throughput: 1 },
      { week: "2026-01-12", throughput: 0 },
      { week: "2026-01-19", throughput: 1 },
    ]);
  });

  it("returns every complete week at zero when no delivery fact exists", () => {
    expect(calculateDeliveryThroughput(completePeriod(), chronology([]))).toEqual([
      { week: "2026-01-05", throughput: 0 },
      { week: "2026-01-12", throughput: 0 },
      { week: "2026-01-19", throughput: 0 },
    ]);
  });
});
