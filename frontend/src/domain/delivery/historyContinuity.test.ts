import { describe, expect, it } from "vitest";
import {
  createDeliveryEvent,
  createDeliveryHistory,
  DELIVERY_HISTORY_CONTINUITY_DEFINITION,
  DELIVERY_HISTORY_CONTINUITY_STATUSES,
  type DeliveryEventInput,
} from ".";

function event(input: DeliveryEventInput) {
  return createDeliveryEvent(input);
}

describe("delivery history continuity", () => {
  it("publishes an immutable and closed continuity policy", () => {
    expect(DELIVERY_HISTORY_CONTINUITY_STATUSES).toEqual([
      "continuous",
      "discontinuous",
      "ambiguous",
    ]);
    expect(DELIVERY_HISTORY_CONTINUITY_DEFINITION).toEqual({
      expectedFact: "item_delivered",
      missingExpectedFact: "discontinuous",
      unavailableEventHistory: "ambiguous",
    });
    expect(Object.isFrozen(DELIVERY_HISTORY_CONTINUITY_STATUSES)).toBe(true);
    expect(Object.isFrozen(DELIVERY_HISTORY_CONTINUITY_DEFINITION)).toBe(true);
  });

  it("distinguishes a continuous zero-activity history from a collection gap", () => {
    const noActivity = createDeliveryHistory({
      expectedDeliveredItemIds: [],
      events: [],
    });
    const continuous = createDeliveryHistory({
      expectedDeliveredItemIds: ["1", "2"],
      events: [
        event({ itemId: "2", kind: "item_delivered", occurredAt: "2026-01-13T10:00:00Z" }),
        event({ itemId: "1", kind: "work_started", occurredAt: "2026-01-05T10:00:00Z" }),
        event({ itemId: "1", kind: "item_delivered", occurredAt: "2026-01-06T10:00:00Z" }),
      ],
    });

    expect(noActivity).toMatchObject({
      continuity: "continuous",
      expectedDeliveredEventCount: 0,
      observedDeliveredEventCount: 0,
      missingDeliveredEventCount: 0,
      gapCount: 0,
      diagnostics: [],
    });
    expect(continuous).toMatchObject({
      continuity: "continuous",
      expectedDeliveredEventCount: 2,
      observedDeliveredEventCount: 2,
      missingDeliveredEventCount: 0,
      gapCount: 0,
      diagnostics: [],
    });
    expect(continuous.events).toHaveLength(3);
    expect(Object.isFrozen(continuous)).toBe(true);
    expect(Object.isFrozen(continuous.events)).toBe(true);
    expect(Object.isFrozen(continuous.diagnostics)).toBe(true);
  });

  it("emits one stable diagnostic for each detectable rupture", () => {
    const result = createDeliveryHistory({
      expectedDeliveredItemIds: ["1", "2", "3", "4", "5", "6", "7"],
      events: [
        event({ itemId: "1", kind: "item_delivered", occurredAt: "2026-01-05T10:00:00Z" }),
        event({ itemId: "4", kind: "item_delivered", occurredAt: "2026-01-12T10:00:00Z" }),
        event({ itemId: "7", kind: "item_delivered", occurredAt: "2026-01-19T10:00:00Z" }),
      ],
    });

    expect(result).toMatchObject({
      continuity: "discontinuous",
      expectedDeliveredEventCount: 7,
      observedDeliveredEventCount: 3,
      missingDeliveredEventCount: 4,
      gapCount: 2,
    });
    expect(result.diagnostics).toEqual([
      {
        code: "missing_expected_delivery_events",
        firstExpectedPosition: 2,
        lastExpectedPosition: 3,
        itemIds: ["2", "3"],
      },
      {
        code: "missing_expected_delivery_events",
        firstExpectedPosition: 5,
        lastExpectedPosition: 6,
        itemIds: ["5", "6"],
      },
    ]);
    expect(result.diagnostics.every(Object.isFrozen)).toBe(true);
    expect(result.diagnostics.every((diagnostic) => Object.isFrozen(diagnostic.itemIds))).toBe(true);
  });

  it("keeps a rupture reaching the end of the expected sequence", () => {
    const result = createDeliveryHistory({
      expectedDeliveredItemIds: ["1", "2", "3"],
      events: [
        event({ itemId: "1", kind: "item_delivered", occurredAt: "2026-01-05T10:00:00Z" }),
      ],
    });

    expect(result.diagnostics).toEqual([{
      code: "missing_expected_delivery_events",
      firstExpectedPosition: 2,
      lastExpectedPosition: 3,
      itemIds: ["2", "3"],
    }]);
  });

  it("qualifies irreconcilable and unavailable event histories as ambiguous", () => {
    const result = createDeliveryHistory({
      expectedDeliveredItemIds: ["2", "1", "1"],
      events: [
        event({ itemId: "1", kind: "item_delivered", occurredAt: "2026-01-05T10:00:00Z" }),
        event({ itemId: "1", kind: "item_delivered", occurredAt: "2026-01-06T10:00:00Z" }),
        event({ itemId: "3", kind: "item_delivered", occurredAt: "2026-01-07T10:00:00Z" }),
      ],
      unavailableEventHistoryItemIds: ["2", "2"],
    });

    expect(result.continuity).toBe("ambiguous");
    expect(result.diagnostics).toEqual([
      {
        code: "missing_expected_delivery_events",
        firstExpectedPosition: 1,
        lastExpectedPosition: 1,
        itemIds: ["2"],
      },
      {
        code: "ambiguous_delivery_event_sequence",
        reason: "duplicate_expected_item",
        itemIds: ["1"],
      },
      {
        code: "ambiguous_delivery_event_sequence",
        reason: "duplicate_observed_delivery_event",
        itemIds: ["1"],
      },
      {
        code: "ambiguous_delivery_event_sequence",
        reason: "unexpected_delivery_event",
        itemIds: ["3"],
      },
      {
        code: "ambiguous_delivery_event_sequence",
        reason: "unavailable_item_event_history",
        itemIds: ["2"],
      },
    ]);
  });

  it("rejects an expected identity outside the delivery identity contract", () => {
    expect(() => createDeliveryHistory({
      expectedDeliveredItemIds: [""],
      events: [],
    })).toThrow("delivery.itemId");
    expect(() => createDeliveryHistory({
      expectedDeliveredItemIds: [],
      events: [],
      unavailableEventHistoryItemIds: [null],
    })).toThrow("delivery.itemId");
  });
});
