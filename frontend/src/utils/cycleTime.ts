import type { CycleTimePoint } from "../domain/delivery";
import type { CycleTimeSummary, CycleTimeTrendPoint } from "../hooks/simulationTypes";

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
