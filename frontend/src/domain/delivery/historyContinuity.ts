import {
  createDeliveryItemId,
  type DeliveryEvent,
  type DeliveryItemId,
} from "./deliveryEvent";

export const DELIVERY_HISTORY_CONTINUITY_STATUSES = Object.freeze([
  "continuous",
  "discontinuous",
  "ambiguous",
] as const);

export const DELIVERY_HISTORY_CONTINUITY_DEFINITION = Object.freeze({
  expectedFact: "item_delivered",
  missingExpectedFact: "discontinuous",
  unavailableEventHistory: "ambiguous",
} as const);

export type DeliveryHistoryContinuityStatus =
  (typeof DELIVERY_HISTORY_CONTINUITY_STATUSES)[number];

export type DeliveryHistoryGapDiagnostic = Readonly<{
  code: "missing_expected_delivery_events";
  firstExpectedPosition: number;
  lastExpectedPosition: number;
  itemIds: readonly DeliveryItemId[];
}>;

export type DeliveryHistoryAmbiguityReason =
  | "duplicate_expected_item"
  | "duplicate_observed_delivery_event"
  | "unexpected_delivery_event"
  | "unavailable_item_event_history";

export type DeliveryHistoryAmbiguityDiagnostic = Readonly<{
  code: "ambiguous_delivery_event_sequence";
  reason: DeliveryHistoryAmbiguityReason;
  itemIds: readonly DeliveryItemId[];
}>;

export type DeliveryHistoryContinuityDiagnostic =
  | DeliveryHistoryGapDiagnostic
  | DeliveryHistoryAmbiguityDiagnostic;

export type DeliveryHistory = Readonly<{
  events: readonly DeliveryEvent[];
  continuity: DeliveryHistoryContinuityStatus;
  expectedDeliveredEventCount: number;
  observedDeliveredEventCount: number;
  missingDeliveredEventCount: number;
  gapCount: number;
  diagnostics: readonly DeliveryHistoryContinuityDiagnostic[];
}>;

export type DeliveryHistoryInput = Readonly<{
  expectedDeliveredItemIds: readonly unknown[];
  events: readonly DeliveryEvent[];
  unavailableEventHistoryItemIds?: readonly unknown[];
}>;

function duplicateItemIds(itemIds: readonly DeliveryItemId[]): DeliveryItemId[] {
  const counts = new Map<DeliveryItemId, number>();
  itemIds.forEach((itemId) => counts.set(itemId, (counts.get(itemId) ?? 0) + 1));
  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([itemId]) => itemId)
    .sort((left, right) => left.localeCompare(right));
}

function gapDiagnostics(
  expectedItemIds: readonly DeliveryItemId[],
  observedItemIds: ReadonlySet<DeliveryItemId>,
): DeliveryHistoryGapDiagnostic[] {
  const diagnostics: DeliveryHistoryGapDiagnostic[] = [];
  let currentGap: { first: number; last: number; itemIds: DeliveryItemId[] } | null = null;

  for (const [index, itemId] of expectedItemIds.entries()) {
    if (observedItemIds.has(itemId)) {
      if (currentGap) {
        diagnostics.push(Object.freeze({
          code: "missing_expected_delivery_events",
          firstExpectedPosition: currentGap.first,
          lastExpectedPosition: currentGap.last,
          itemIds: Object.freeze(currentGap.itemIds),
        }));
        currentGap = null;
      }
      continue;
    }

    const position = index + 1;
    if (currentGap) {
      currentGap.last = position;
      currentGap.itemIds.push(itemId);
      continue;
    }
    currentGap = { first: position, last: position, itemIds: [itemId] };
  }

  if (currentGap) {
    diagnostics.push(Object.freeze({
      code: "missing_expected_delivery_events",
      firstExpectedPosition: currentGap.first,
      lastExpectedPosition: currentGap.last,
      itemIds: Object.freeze(currentGap.itemIds),
    }));
  }
  return diagnostics;
}

function ambiguityDiagnostic(
  reason: DeliveryHistoryAmbiguityReason,
  itemIds: readonly DeliveryItemId[],
): DeliveryHistoryAmbiguityDiagnostic | null {
  if (itemIds.length === 0) return null;
  return Object.freeze({
    code: "ambiguous_delivery_event_sequence",
    reason,
    itemIds: Object.freeze([...new Set(itemIds)].sort((left, right) => left.localeCompare(right))),
  });
}

export function createDeliveryHistory(input: DeliveryHistoryInput): DeliveryHistory {
  const expectedItemIds = input.expectedDeliveredItemIds.map(createDeliveryItemId);
  const deliveredItemIds = input.events
    .filter((event) => event.kind === DELIVERY_HISTORY_CONTINUITY_DEFINITION.expectedFact)
    .map((event) => event.itemId);
  const expectedItemIdSet = new Set(expectedItemIds);
  const observedItemIdSet = new Set(deliveredItemIds);
  const gaps = gapDiagnostics(expectedItemIds, observedItemIdSet);
  const ambiguityCandidates = [
    ambiguityDiagnostic("duplicate_expected_item", duplicateItemIds(expectedItemIds)),
    ambiguityDiagnostic("duplicate_observed_delivery_event", duplicateItemIds(deliveredItemIds)),
    ambiguityDiagnostic(
      "unexpected_delivery_event",
      deliveredItemIds.filter((itemId) => !expectedItemIdSet.has(itemId)),
    ),
    ambiguityDiagnostic(
      "unavailable_item_event_history",
      (input.unavailableEventHistoryItemIds ?? []).map(createDeliveryItemId),
    ),
  ];
  const ambiguities = ambiguityCandidates.filter(
    (diagnostic): diagnostic is DeliveryHistoryAmbiguityDiagnostic => diagnostic !== null,
  );
  const diagnostics = Object.freeze<DeliveryHistoryContinuityDiagnostic[]>([
    ...gaps,
    ...ambiguities,
  ]);
  const missingDeliveredEventCount = gaps.reduce(
    (count, diagnostic) => count + diagnostic.itemIds.length,
    0,
  );
  const continuity: DeliveryHistoryContinuityStatus = ambiguities.length > 0
    ? "ambiguous"
    : gaps.length > 0
      ? "discontinuous"
      : "continuous";

  return Object.freeze({
    events: Object.freeze([...input.events]),
    continuity,
    expectedDeliveredEventCount: expectedItemIds.length,
    observedDeliveredEventCount: deliveredItemIds.length,
    missingDeliveredEventCount,
    gapCount: gaps.length,
    diagnostics,
  });
}
