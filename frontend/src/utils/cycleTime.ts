import { formatDateLocal } from "../date";
import type { CycleTimePoint } from "../types";
import type { CycleTimeSummary, CycleTimeTrendPoint } from "../hooks/simulationTypes";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type WorkItemRevisionSnapshot = {
  changedDate: string;
  state: string;
};

export type WorkItemCycleTimeSource = {
  revisions: WorkItemRevisionSnapshot[];
};

function normalizeState(value: string): string {
  return value.trim().toLowerCase();
}

function getWeekKey(date: Date): string {
  const monday = new Date(date);
  monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return formatDateLocal(monday);
}

function toRoundedCalendarDays(start: Date, end: Date): number {
  return Number(((end.getTime() - start.getTime()) / DAY_MS).toFixed(2));
}

function toValidDate(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
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
  workItems: WorkItemCycleTimeSource[],
  doneStates: string[],
): CycleTimePoint[] {
  if (!workItems.length || !doneStates.length) return [];

  const doneStateSet = new Set(doneStates.map(normalizeState));
  const buckets = new Map<string, CycleTimePoint>();

  workItems.forEach((item) => {
    const revisions = [...(item.revisions ?? [])]
      .map((revision) => ({
        state: String(revision.state ?? "").trim(),
        changedDate: String(revision.changedDate ?? "").trim(),
      }))
      .filter((revision) => revision.state && revision.changedDate)
      .sort((left, right) => left.changedDate.localeCompare(right.changedDate));
    if (revisions.length < 2) return;

    let activatedDate: Date | null = null;
    let doneDate: Date | null = null;

    for (let index = 1; index < revisions.length; index += 1) {
      const previousState = normalizeState(revisions[index - 1]?.state ?? "");
      const currentState = normalizeState(revisions[index]?.state ?? "");
      const transitionDate = toValidDate(revisions[index]?.changedDate ?? "");
      if (!transitionDate) continue;

      if (!activatedDate && previousState === "new" && currentState && currentState !== "new") {
        activatedDate = transitionDate;
      }

      if (!doneDate && doneStateSet.has(currentState) && currentState !== previousState) {
        doneDate = transitionDate;
      }

      if (activatedDate && doneDate) break;
    }

    if (!activatedDate || !doneDate || doneDate < activatedDate) return;
    aggregateCycleTimePoint(buckets, getWeekKey(doneDate), toRoundedCalendarDays(activatedDate, doneDate));
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
