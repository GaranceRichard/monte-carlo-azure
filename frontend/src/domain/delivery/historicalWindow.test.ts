import { describe, expect, it } from "vitest";
import {
  createDeliveryEvent,
  createDeliveryHistoryWindow,
  selectDeliveryHistoryEvents,
  type DeliveryEvent,
  type DeliveryEventKind,
} from ".";

function event(
  itemId: string,
  kind: DeliveryEventKind,
  occurredAt: string,
): DeliveryEvent {
  return createDeliveryEvent({ itemId, kind, occurredAt });
}

describe("DeliveryHistoryWindow", () => {
  it("normalizes immutable absolute bounds", () => {
    const window = createDeliveryHistoryWindow({
      startInclusive: "2026-01-10T01:00:00+01:00",
      endExclusive: "2026-01-20T00:00:00Z",
    });

    expect(window).toEqual({
      startInclusive: "2026-01-10T00:00:00.000Z",
      endExclusive: "2026-01-20T00:00:00.000Z",
    });
    expect(Object.isFrozen(window)).toBe(true);
  });

  it("rejects invalid or reversed bounds", () => {
    expect(() => createDeliveryHistoryWindow({
      startInclusive: "2026-01-20T00:00:00Z",
      endExclusive: "2026-01-10T00:00:00Z",
    })).toThrow("fin egale ou posterieure");
    expect(() => createDeliveryHistoryWindow({
      startInclusive: "2026-01-10",
      endExclusive: "2026-01-20T00:00:00Z",
    })).toThrow("instant");
  });

  it("selects delivered items on inclusive-start and exclusive-end bounds", () => {
    const window = createDeliveryHistoryWindow({
      startInclusive: "2026-01-10T00:00:00Z",
      endExclusive: "2026-01-20T00:00:00Z",
    });
    const events = [
      event("1", "work_started", "2026-01-01T00:00:00Z"),
      event("1", "item_delivered", "2026-01-10T00:00:00Z"),
      event("1", "work_completed", "2026-01-12T00:00:00Z"),
      event("2", "work_started", "2026-01-15T00:00:00Z"),
      event("2", "item_delivered", "2026-01-19T23:59:59.999Z"),
      event("3", "item_delivered", "2026-01-20T00:00:00Z"),
      event("4", "item_delivered", "2026-01-09T23:59:59.999Z"),
    ];

    expect(selectDeliveryHistoryEvents(window, events).map(
      (selected) => `${selected.itemId}:${selected.kind}`,
    )).toEqual([
      "1:work_started",
      "1:item_delivered",
      "1:work_completed",
      "2:work_started",
      "2:item_delivered",
    ]);
  });

  it("selects no event from an empty window", () => {
    const empty = createDeliveryHistoryWindow({
      startInclusive: "2026-01-10T00:00:00Z",
      endExclusive: "2026-01-10T00:00:00Z",
    });

    expect(selectDeliveryHistoryEvents(empty, [
      event("1", "item_delivered", "2026-01-10T00:00:00Z"),
    ])).toEqual([]);
  });
});
