import type { CompleteDeliveryHistoryPeriod } from "./historicalPeriod";
import type { DeliveryEvent } from "./deliveryEvent";
import {
  deliveryWeekOf,
  nextDeliveryWeek,
  type DeliveryWeek,
} from "./deliveryWeek";

export const DELIVERY_THROUGHPUT_DEFINITION = Object.freeze({
  countedFact: "item_delivered",
  period: "complete_iso_week",
  unit: "delivered_items_per_complete_iso_week",
} as const);

export type DeliveryThroughput = Readonly<{
  week: DeliveryWeek;
  throughput: number;
}>;

function deliveredEventsInPeriod(
  period: CompleteDeliveryHistoryPeriod,
  events: readonly DeliveryEvent[],
): DeliveryEvent[] {
  return events.filter((event) => (
    event.kind === DELIVERY_THROUGHPUT_DEFINITION.countedFact
    && event.occurredAt >= period.startInclusive
    && event.occurredAt < period.endExclusive
  ));
}

export function calculateDeliveryThroughput(
  period: CompleteDeliveryHistoryPeriod,
  events: readonly DeliveryEvent[],
): DeliveryThroughput[] {
  const countsByWeek = new Map<DeliveryWeek, number>();
  deliveredEventsInPeriod(period, events).forEach((event) => {
    const week = deliveryWeekOf(event.occurredAt);
    countsByWeek.set(week, (countsByWeek.get(week) ?? 0) + 1);
  });

  const throughput: DeliveryThroughput[] = [];
  let week = deliveryWeekOf(period.startInclusive);
  const endWeek = deliveryWeekOf(period.endExclusive);
  while (week < endWeek) {
    throughput.push(Object.freeze({
      week,
      throughput: countsByWeek.get(week) ?? 0,
    }));
    week = nextDeliveryWeek(week);
  }
  return throughput;
}
