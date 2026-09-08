import type { DeliveryEvent, DeliveryItemId } from "./deliveryEvent";
import type { CompleteDeliveryHistoryPeriod } from "./historicalPeriod";
import { selectDeliveryHistoryEvents } from "./historicalWindow";

export const DELIVERY_HISTORY_COMPLETENESS_STATUSES = Object.freeze([
  "complete",
  "incomplete",
  "absent",
] as const);

export type DeliveryHistoryCompletenessStatus =
  (typeof DELIVERY_HISTORY_COMPLETENESS_STATUSES)[number];

type CompletenessDiagnostic<
  Status extends DeliveryHistoryCompletenessStatus,
  Code extends string,
> = Readonly<{
  status: Status;
  code: Code;
  requiredItemCount: number;
  observedItemCount: number;
  missingItemIds: readonly DeliveryItemId[];
}>;

export type DeliveryHistoryCompletenessDiagnostic =
  | CompletenessDiagnostic<"complete", "delivery_history_complete">
  | CompletenessDiagnostic<"incomplete", "delivery_history_incomplete">
  | CompletenessDiagnostic<"absent", "delivery_history_absent">;

export type DeliveryHistoryResult = Readonly<{
  period: CompleteDeliveryHistoryPeriod | null;
  events: readonly DeliveryEvent[];
  completeness: DeliveryHistoryCompletenessDiagnostic;
}>;

export type DeliveryHistoryResultInput = Readonly<{
  period: CompleteDeliveryHistoryPeriod | null;
  requiredItemIds: readonly DeliveryItemId[];
  events: readonly DeliveryEvent[];
}>;

function uniqueSortedItemIds(itemIds: readonly DeliveryItemId[]): DeliveryItemId[] {
  return Array.from(new Set(itemIds)).sort((left, right) => left.localeCompare(right));
}

function completenessDiagnostic(
  period: CompleteDeliveryHistoryPeriod | null,
  requiredItemIds: readonly DeliveryItemId[],
  observedItemIds: ReadonlySet<DeliveryItemId>,
): DeliveryHistoryCompletenessDiagnostic {
  const missingItemIds = Object.freeze(
    requiredItemIds.filter((itemId) => !observedItemIds.has(itemId)),
  );
  const counts = {
    requiredItemCount: requiredItemIds.length,
    observedItemCount: observedItemIds.size,
    missingItemIds,
  };

  if (!period) {
    return Object.freeze({
      status: "absent",
      code: "delivery_history_absent",
      ...counts,
    });
  }
  if (missingItemIds.length > 0) {
    return Object.freeze({
      status: "incomplete",
      code: "delivery_history_incomplete",
      ...counts,
    });
  }
  return Object.freeze({
    status: "complete",
    code: "delivery_history_complete",
    ...counts,
  });
}

export function createDeliveryHistoryResult(
  input: DeliveryHistoryResultInput,
): DeliveryHistoryResult {
  const requiredItemIds = uniqueSortedItemIds(input.requiredItemIds);
  const requiredItemIdSet = new Set(requiredItemIds);
  const events = Object.freeze(
    input.period
      ? selectDeliveryHistoryEvents(input.period, input.events)
        .filter((event) => requiredItemIdSet.has(event.itemId))
      : [],
  );
  const observedItemIds = new Set(
    events
      .filter((event) => event.kind === "item_delivered")
      .map((event) => event.itemId),
  );

  return Object.freeze({
    period: input.period,
    events,
    completeness: completenessDiagnostic(
      input.period,
      requiredItemIds,
      observedItemIds,
    ),
  });
}
