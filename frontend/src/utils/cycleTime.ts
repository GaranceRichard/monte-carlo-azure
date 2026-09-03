import {
  deliveryWeekOf,
  type DeliveryEvent,
  type DeliveryInstant,
} from "../domain/delivery";
import type { CycleTimePoint } from "../types";
import type { CycleTimeSummary, CycleTimeTrendPoint } from "../hooks/simulationTypes";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function toRoundedCalendarDays(start: Date, end: Date): number {
  return Number(((end.getTime() - start.getTime()) / DAY_MS).toFixed(2));
}

function aggregateCycleTimePoint(
  buckets: Map<string, CycleTimePoint>,
  week: string,
  cycleTimeDays: number,
): void {
  const key = `${week}::${cycleTimeDays.toFixed(2)}`;
  const existing = buckets.get(key);
  if (existing) {
    existing.count += 1;
    return;
  }
  buckets.set(key, { week, cycleTimeDays, count: 1 });
}

export function calculateCycleTimeData(
  events: readonly DeliveryEvent[],
): CycleTimePoint[] {
  if (!events.length) return [];

  const eventPairs = new Map<
    string,
    { startedAt?: DeliveryInstant; completedAt?: DeliveryInstant }
  >();
  [...events]
    .sort((left, right) => (
      new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime()
    ))
    .forEach((event) => {
      if (event.kind === "item_delivered") return;
      const pair = eventPairs.get(event.itemId) ?? {};
      if (event.kind === "work_started" && !pair.startedAt) {
        pair.startedAt = event.occurredAt;
      }
      if (event.kind === "work_completed" && !pair.completedAt) {
        pair.completedAt = event.occurredAt;
      }
      eventPairs.set(event.itemId, pair);
    });

  const buckets = new Map<string, CycleTimePoint>();

  eventPairs.forEach(({ startedAt, completedAt }) => {
    if (!startedAt || !completedAt) return;
    const startedDate = new Date(startedAt);
    const completedDate = new Date(completedAt);
    if (completedDate < startedDate) return;
    aggregateCycleTimePoint(
      buckets,
      deliveryWeekOf(completedAt),
      toRoundedCalendarDays(startedDate, completedDate),
    );
  });

  return Array.from(buckets.values()).sort((left, right) => {
    if (left.week !== right.week) return left.week.localeCompare(right.week);
    return left.cycleTimeDays - right.cycleTimeDays;
  });
}

function summarizeWindow(points: CycleTimePoint[]): { average: number; stdDev: number; itemCount: number } | null {
  const itemCount = points.reduce((sum, point) => sum + point.count, 0);
  if (itemCount <= 0) return null;
  const average = points.reduce((sum, point) => sum + point.cycleTimeDays * point.count, 0) / itemCount;
  const variance =
    points.reduce((sum, point) => sum + ((point.cycleTimeDays - average) ** 2) * point.count, 0) / itemCount;

  return {
    average: Number(average.toFixed(2)),
    stdDev: Number(Math.sqrt(variance).toFixed(2)),
    itemCount,
  };
}

export function buildCycleTimeTrendData(
  cycleTimeData: CycleTimePoint[],
  windowSize = 4,
): CycleTimeTrendPoint[] {
  if (!cycleTimeData.length) return [];

  const weeklyGroups = new Map<string, CycleTimePoint[]>();
  cycleTimeData.forEach((point) => {
    const group = weeklyGroups.get(point.week);
    if (group) {
      group.push(point);
      return;
    }
    weeklyGroups.set(point.week, [point]);
  });

  const weeks = Array.from(weeklyGroups.keys()).sort((left, right) => left.localeCompare(right));
  return weeks.map((week, index) => {
    const windowStart = Math.max(0, index - windowSize + 1);
    const windowWeeks = weeks.slice(windowStart, index + 1);
    const windowPoints = windowWeeks.flatMap((key) => weeklyGroups.get(key) ?? []);
    const summary = summarizeWindow(windowPoints);
    if (!summary) {
      return {
        week,
        averageDays: 0,
        lowerBoundDays: 0,
        upperBoundDays: 0,
        itemCount: 0,
      };
    }

    return {
      week,
      averageDays: summary.average,
      lowerBoundDays: Number(Math.max(0, summary.average - summary.stdDev).toFixed(2)),
      upperBoundDays: Number((summary.average + summary.stdDev).toFixed(2)),
      itemCount: summary.itemCount,
    };
  });
}

export function summarizeCycleTime(cycleTimeData: CycleTimePoint[]): CycleTimeSummary {
  const summary = summarizeWindow(cycleTimeData);
  const weekCount = new Set(cycleTimeData.map((point) => point.week)).size;
  return {
    itemCount: summary?.itemCount ?? 0,
    averageDays: summary ? Number(summary.average.toFixed(2)) : null,
    hasSufficientData: weekCount >= 2 && (summary?.itemCount ?? 0) >= 2,
  };
}
