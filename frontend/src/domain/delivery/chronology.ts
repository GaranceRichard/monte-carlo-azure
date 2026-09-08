import {
  type DeliveryEvent,
  type DeliveryEventKind,
  type DeliveryInstant,
  type DeliveryItemId,
} from "./deliveryEvent";

export const DELIVERY_CHRONOLOGY_SEQUENCE = Object.freeze([
  "work_started",
  "work_completed",
  "item_delivered",
] as const satisfies readonly DeliveryEventKind[]);

export type DeliveryChronologyDiagnostic = Readonly<{
  code: "inverted_delivery_event_order";
  itemId: DeliveryItemId;
  predecessorKind: DeliveryEventKind;
  predecessorOccurredAt: DeliveryInstant;
  successorKind: DeliveryEventKind;
  successorOccurredAt: DeliveryInstant;
}>;

export type DeliveryChronologyResult = Readonly<{
  coherentEvents: readonly DeliveryEvent[];
  rejectedEvents: readonly DeliveryEvent[];
  diagnostics: readonly DeliveryChronologyDiagnostic[];
}>;

type FirstEventsByKind = Partial<Record<DeliveryEventKind, DeliveryEvent>>;

const KIND_INDEX = new Map<DeliveryEventKind, number>(
  DELIVERY_CHRONOLOGY_SEQUENCE.map((kind, index) => [kind, index]),
);

function compareEvents(left: DeliveryEvent, right: DeliveryEvent): number {
  return left.occurredAt.localeCompare(right.occurredAt)
    || left.itemId.localeCompare(right.itemId)
    || (KIND_INDEX.get(left.kind) ?? 0) - (KIND_INDEX.get(right.kind) ?? 0);
}

function firstEventsByItem(
  events: readonly DeliveryEvent[],
): Map<DeliveryItemId, FirstEventsByKind> {
  const firstEvents = new Map<DeliveryItemId, FirstEventsByKind>();
  for (const event of events) {
    const byKind = firstEvents.get(event.itemId) ?? {};
    const current = byKind[event.kind];
    if (!current || event.occurredAt < current.occurredAt) {
      byKind[event.kind] = event;
    }
    firstEvents.set(event.itemId, byKind);
  }
  return firstEvents;
}

function diagnostic(
  predecessor: DeliveryEvent,
  successor: DeliveryEvent,
): DeliveryChronologyDiagnostic {
  return Object.freeze({
    code: "inverted_delivery_event_order",
    itemId: predecessor.itemId,
    predecessorKind: predecessor.kind,
    predecessorOccurredAt: predecessor.occurredAt,
    successorKind: successor.kind,
    successorOccurredAt: successor.occurredAt,
  });
}

function itemDiagnostics(
  firstEvents: FirstEventsByKind,
): DeliveryChronologyDiagnostic[] {
  const diagnostics: DeliveryChronologyDiagnostic[] = [];
  for (let predecessorIndex = 0; predecessorIndex < DELIVERY_CHRONOLOGY_SEQUENCE.length; predecessorIndex += 1) {
    const predecessorKind = DELIVERY_CHRONOLOGY_SEQUENCE[predecessorIndex];
    const predecessor = firstEvents[predecessorKind];
    if (!predecessor) continue;

    for (let successorIndex = predecessorIndex + 1; successorIndex < DELIVERY_CHRONOLOGY_SEQUENCE.length; successorIndex += 1) {
      const successorKind = DELIVERY_CHRONOLOGY_SEQUENCE[successorIndex];
      const successor = firstEvents[successorKind];
      if (successor && predecessor.occurredAt > successor.occurredAt) {
        diagnostics.push(diagnostic(predecessor, successor));
      }
    }
  }
  return diagnostics;
}

export function qualifyDeliveryChronology(
  events: readonly DeliveryEvent[],
): DeliveryChronologyResult {
  const diagnostics = Array.from(firstEventsByItem(events).entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([, firstEvents]) => itemDiagnostics(firstEvents));
  const rejectedItemIds = new Set(diagnostics.map(({ itemId }) => itemId));
  const sortedEvents = [...events].sort(compareEvents);

  return Object.freeze({
    coherentEvents: Object.freeze(
      sortedEvents.filter(({ itemId }) => !rejectedItemIds.has(itemId)),
    ),
    rejectedEvents: Object.freeze(
      sortedEvents.filter(({ itemId }) => rejectedItemIds.has(itemId)),
    ),
    diagnostics: Object.freeze(diagnostics),
  });
}
