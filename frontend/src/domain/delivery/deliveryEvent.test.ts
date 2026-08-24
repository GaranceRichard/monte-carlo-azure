import { describe, expect, it } from "vitest";
import {
  createDeliveryEvent,
  createDeliveryInstant,
  createDeliveryItemId,
} from ".";

describe("DeliveryEvent", () => {
  it("normalizes an opaque item identity and an absolute instant", () => {
    expect(createDeliveryEvent({
      itemId: " 42 ",
      kind: "item_delivered",
      occurredAt: "2026-01-12T10:30:00+02:00",
    })).toEqual({
      itemId: "42",
      kind: "item_delivered",
      occurredAt: "2026-01-12T08:30:00.000Z",
    });
  });

  it("creates immutable events", () => {
    expect(Object.isFrozen(createDeliveryEvent({
      itemId: "42",
      kind: "work_started",
      occurredAt: "2026-01-12T08:30:00Z",
    }))).toBe(true);
  });

  it.each([undefined, null, "", "   ", 42])(
    "rejects an invalid item identity: %s",
    (value) => {
      expect(() => createDeliveryItemId(value)).toThrow("chaine non vide");
    },
  );

  it.each([
    "2026-01-12",
    "2026-01-12T08:30:00",
    "not-a-date",
    "",
    42,
  ])("rejects a non-absolute instant: %s", (value) => {
    expect(() => createDeliveryInstant(value)).toThrow(/instant/);
  });

  it("rejects facts outside the delivery vocabulary", () => {
    expect(() => createDeliveryEvent({
      itemId: "42",
      kind: "System.State",
      occurredAt: "2026-01-12T08:30:00Z",
    })).toThrow("fait metier connu");
  });
});
