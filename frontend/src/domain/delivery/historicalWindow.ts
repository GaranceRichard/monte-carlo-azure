import {
  createDeliveryInstant,
  type DeliveryEvent,
  type DeliveryInstant,
} from "./deliveryEvent";

export type DeliveryHistoryWindow = Readonly<{
  startInclusive: DeliveryInstant;
  endExclusive: DeliveryInstant;
}>;

export type DeliveryHistoryWindowInput = Readonly<{
  startInclusive: unknown;
  endExclusive: unknown;
}>;

export function createDeliveryHistoryWindow(
  input: DeliveryHistoryWindowInput,
): DeliveryHistoryWindow {
  const startInclusive = createDeliveryInstant(input.startInclusive);
  const endExclusive = createDeliveryInstant(input.endExclusive);
  if (endExclusive < startInclusive) {
    throw new Error("delivery.historyWindow exige une fin egale ou posterieure au debut.");
  }
  return Object.freeze({ startInclusive, endExclusive });
}

export function selectDeliveryHistoryEvents(
  window: DeliveryHistoryWindow,
  events: readonly DeliveryEvent[],
): DeliveryEvent[] {
  if (window.startInclusive === window.endExclusive) return [];

  const deliveredItemIds = new Set(
    events
      .filter((event) => (
        event.kind === "item_delivered"
        && event.occurredAt >= window.startInclusive
        && event.occurredAt < window.endExclusive
      ))
      .map((event) => event.itemId),
  );

  return events.filter((event) => deliveredItemIds.has(event.itemId));
}
