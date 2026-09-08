import type { DeliveryChronologyResult } from "./chronology";
import type { DeliveryEvent, DeliveryInstant } from "./deliveryEvent";
import { deliveryWeekOf } from "./deliveryWeek";

export const CYCLE_TIME_DEFINITION = Object.freeze({
  unit: "calendar_days",
  precision: 2,
  startsOn: "first_work_started_event",
  endsOn: "first_work_completed_event",
  groupedBy: "completion_week",
  invalidLifecycle: "excluded_by_delivery_chronology",
} as const);

export type CycleTimePoint = {
  week: string;
  cycleTimeDays: number;
  count: number;
};

type DeliveryLifecycle = {
  startedAt?: DeliveryInstant;
  completedAt?: DeliveryInstant;
};

const MILLISECONDS_PER_CALENDAR_DAY = 24 * 60 * 60 * 1000;

function collectDeliveryLifecycles(
  events: readonly DeliveryEvent[],
): Map<string, DeliveryLifecycle> {
  const lifecycles = new Map<string, DeliveryLifecycle>();

  for (const event of [...events].sort((left, right) => (
    left.occurredAt.localeCompare(right.occurredAt)
  ))) {
    if (event.kind === "item_delivered") continue;
    const lifecycle = lifecycles.get(event.itemId) ?? {};
    if (event.kind === "work_started" && !lifecycle.startedAt) {
      lifecycle.startedAt = event.occurredAt;
    }
    if (event.kind === "work_completed" && !lifecycle.completedAt) {
      lifecycle.completedAt = event.occurredAt;
    }
    lifecycles.set(event.itemId, lifecycle);
  }

  return lifecycles;
}

function toCycleTimePoint(lifecycle: DeliveryLifecycle): CycleTimePoint | null {
  const { startedAt, completedAt } = lifecycle;
  if (!startedAt || !completedAt) return null;

  const elapsedMilliseconds = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  const cycleTimeDays = Number(
    (elapsedMilliseconds / MILLISECONDS_PER_CALENDAR_DAY)
      .toFixed(CYCLE_TIME_DEFINITION.precision),
  );
  return {
    week: deliveryWeekOf(completedAt),
    cycleTimeDays,
    count: 1,
  };
}

function aggregateCycleTimePoint(
  buckets: Map<string, CycleTimePoint>,
  point: CycleTimePoint,
): void {
  const key = `${point.week}::${point.cycleTimeDays.toFixed(CYCLE_TIME_DEFINITION.precision)}`;
  const existing = buckets.get(key);
  if (existing) {
    existing.count += 1;
    return;
  }
  buckets.set(key, point);
}

export function calculateCycleTime(
  chronology: DeliveryChronologyResult,
): CycleTimePoint[] {
  const buckets = new Map<string, CycleTimePoint>();

  collectDeliveryLifecycles(chronology.coherentEvents).forEach((lifecycle) => {
    const point = toCycleTimePoint(lifecycle);
    if (point) aggregateCycleTimePoint(buckets, point);
  });

  return Array.from(buckets.values()).sort((left, right) => (
    left.week.localeCompare(right.week)
    || left.cycleTimeDays - right.cycleTimeDays
  ));
}
