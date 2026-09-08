import { describe, expect, it } from "vitest";
import {
  createDeliveryEvent,
  DELIVERY_CHRONOLOGY_SEQUENCE,
  qualifyDeliveryChronology,
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

describe("delivery chronology", () => {
  it("publishes the immutable lifecycle sequence", () => {
    expect(DELIVERY_CHRONOLOGY_SEQUENCE).toEqual([
      "work_started",
      "work_completed",
      "item_delivered",
    ]);
    expect(Object.isFrozen(DELIVERY_CHRONOLOGY_SEQUENCE)).toBe(true);
  });

  it("accepts a valid lifecycle independently of input order", () => {
    const result = qualifyDeliveryChronology([
      event("42", "item_delivered", "2026-01-15T10:00:00Z"),
      event("42", "work_started", "2026-01-08T10:00:00Z"),
      event("42", "work_completed", "2026-01-14T10:00:00Z"),
    ]);

    expect(result.coherentEvents.map(({ kind }) => kind)).toEqual([
      "work_started",
      "work_completed",
      "item_delivered",
    ]);
    expect(result.rejectedEvents).toEqual([]);
    expect(result.diagnostics).toEqual([]);
  });

  it("rejects an inverted lifecycle with one stable localized diagnostic per relation", () => {
    const result = qualifyDeliveryChronology([
      event("42", "work_started", "2026-01-15T10:00:00Z"),
      event("42", "work_completed", "2026-01-14T10:00:00Z"),
      event("42", "item_delivered", "2026-01-13T10:00:00Z"),
    ]);

    expect(result.coherentEvents).toEqual([]);
    expect(result.rejectedEvents.map(({ kind }) => kind)).toEqual([
      "item_delivered",
      "work_completed",
      "work_started",
    ]);
    expect(result.diagnostics).toEqual([
      {
        code: "inverted_delivery_event_order",
        itemId: "42",
        predecessorKind: "work_started",
        predecessorOccurredAt: "2026-01-15T10:00:00.000Z",
        successorKind: "work_completed",
        successorOccurredAt: "2026-01-14T10:00:00.000Z",
      },
      {
        code: "inverted_delivery_event_order",
        itemId: "42",
        predecessorKind: "work_started",
        predecessorOccurredAt: "2026-01-15T10:00:00.000Z",
        successorKind: "item_delivered",
        successorOccurredAt: "2026-01-13T10:00:00.000Z",
      },
      {
        code: "inverted_delivery_event_order",
        itemId: "42",
        predecessorKind: "work_completed",
        predecessorOccurredAt: "2026-01-14T10:00:00.000Z",
        successorKind: "item_delivered",
        successorOccurredAt: "2026-01-13T10:00:00.000Z",
      },
    ]);
  });

  it("accepts simultaneous facts and orders their semantic tie deterministically", () => {
    const result = qualifyDeliveryChronology([
      event("42", "item_delivered", "2026-01-15T10:00:00Z"),
      event("42", "work_completed", "2026-01-15T10:00:00Z"),
      event("42", "work_started", "2026-01-15T10:00:00Z"),
    ]);

    expect(result.coherentEvents.map(({ kind }) => kind)).toEqual([
      "work_started",
      "work_completed",
      "item_delivered",
    ]);
    expect(result.diagnostics).toEqual([]);
  });

  it("isolates rejected items and freezes the complete delivery result", () => {
    const result = qualifyDeliveryChronology([
      event("valid", "work_started", "2026-01-08T10:00:00Z"),
      event("invalid", "work_started", "2026-01-15T10:00:00Z"),
      event("invalid", "work_completed", "2026-01-14T10:00:00Z"),
      event("valid", "work_completed", "2026-01-09T10:00:00Z"),
    ]);

    expect(result.coherentEvents.map(({ itemId }) => itemId)).toEqual(["valid", "valid"]);
    expect(result.rejectedEvents.map(({ itemId }) => itemId)).toEqual(["invalid", "invalid"]);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.coherentEvents)).toBe(true);
    expect(Object.isFrozen(result.rejectedEvents)).toBe(true);
    expect(Object.isFrozen(result.diagnostics)).toBe(true);
    expect(result.diagnostics.every(Object.isFrozen)).toBe(true);
  });
});
