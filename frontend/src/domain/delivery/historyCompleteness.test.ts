import { describe, expect, it } from "vitest";
import {
  createDeliveryEvent,
  createDeliveryHistoryPeriods,
  createDeliveryHistoryResult,
  createDeliveryHistoryWindow,
  createDeliveryItemId,
  DELIVERY_HISTORY_COMPLETENESS_STATUSES,
  type CompleteDeliveryHistoryPeriod,
  type DeliveryEvent,
  type DeliveryEventKind,
} from ".";

function completePeriod(): CompleteDeliveryHistoryPeriod {
  const periods = createDeliveryHistoryPeriods({
    window: createDeliveryHistoryWindow({
      startInclusive: "2026-01-05T00:00:00Z",
      endExclusive: "2026-01-19T00:00:00Z",
    }),
    referenceInstant: "2026-01-26T00:00:00Z",
  });
  if (!periods.completePeriod) {
    throw new Error("Test setup requires a complete delivery period.");
  }
  return periods.completePeriod;
}

function event(
  itemId: string,
  kind: DeliveryEventKind,
  occurredAt = "2026-01-08T09:00:00Z",
): DeliveryEvent {
  return createDeliveryEvent({ itemId, kind, occurredAt });
}

describe("delivery history completeness", () => {
  it("publishes complete, incomplete and absent as the closed status set", () => {
    expect(DELIVERY_HISTORY_COMPLETENESS_STATUSES).toEqual([
      "complete",
      "incomplete",
      "absent",
    ]);
    expect(Object.isFrozen(DELIVERY_HISTORY_COMPLETENESS_STATUSES)).toBe(true);
  });

  it("qualifies a history as complete when every required item has a delivered fact", () => {
    const result = createDeliveryHistoryResult({
      period: completePeriod(),
      requiredItemIds: [createDeliveryItemId("2"), createDeliveryItemId("1")],
      events: [
        event("1", "work_started", "2025-12-20T09:00:00Z"),
        event("1", "item_delivered"),
        event("1", "work_completed"),
        event("2", "item_delivered", "2026-01-12T09:00:00Z"),
      ],
    });

    expect(result.completeness).toEqual({
      status: "complete",
      code: "delivery_history_complete",
      requiredItemCount: 2,
      observedItemCount: 2,
      missingItemIds: [],
    });
    expect(result.events.map((item) => `${item.itemId}:${item.kind}`)).toEqual([
      "1:work_started",
      "1:item_delivered",
      "1:work_completed",
      "2:item_delivered",
    ]);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.events)).toBe(true);
    expect(Object.isFrozen(result.completeness)).toBe(true);
    expect(Object.isFrozen(result.completeness.missingItemIds)).toBe(true);
  });

  it("qualifies a history as incomplete and identifies every missing required item", () => {
    const result = createDeliveryHistoryResult({
      period: completePeriod(),
      requiredItemIds: [
        createDeliveryItemId("3"),
        createDeliveryItemId("1"),
        createDeliveryItemId("2"),
        createDeliveryItemId("2"),
      ],
      events: [
        event("1", "item_delivered"),
        event("outside", "item_delivered"),
        event("2", "work_started"),
      ],
    });

    expect(result.completeness).toEqual({
      status: "incomplete",
      code: "delivery_history_incomplete",
      requiredItemCount: 3,
      observedItemCount: 1,
      missingItemIds: ["2", "3"],
    });
    expect(result.events).toEqual([event("1", "item_delivered")]);
  });

  it("keeps a collected period without deliveries complete as a valid zero-throughput history", () => {
    const result = createDeliveryHistoryResult({
      period: completePeriod(),
      requiredItemIds: [],
      events: [event("unrequested", "item_delivered")],
    });

    expect(result).toEqual({
      period: completePeriod(),
      events: [],
      completeness: {
        status: "complete",
        code: "delivery_history_complete",
        requiredItemCount: 0,
        observedItemCount: 0,
        missingItemIds: [],
      },
    });
  });

  it("keeps the absence explicit when no complete period exists", () => {
    const result = createDeliveryHistoryResult({
      period: null,
      requiredItemIds: [createDeliveryItemId("1")],
      events: [event("1", "item_delivered")],
    });

    expect(result.completeness).toEqual({
      status: "absent",
      code: "delivery_history_absent",
      requiredItemCount: 1,
      observedItemCount: 0,
      missingItemIds: ["1"],
    });
    expect(result.events).toEqual([]);
  });
});
