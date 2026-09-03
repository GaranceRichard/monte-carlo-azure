import { useMemo } from "react";
import type { SimulationPercentiles, SimulationResult } from "../domain/simulation";
import type { CycleTimePoint, WeeklyThroughputRow } from "../types";
import { buildProbabilityCurve } from "./probability";
import type { ChartPoint, ProbabilityPoint, ThroughputPoint } from "./simulationTypes";
import { buildCycleTimeTrendData, summarizeCycleTime } from "../utils/cycleTime";
import { createDeliveryWeek } from "../domain/delivery";

function smoothHistogramCounts(points: Array<{ x: number; count: number }>): number[] {
  if (!points.length) return [];
  const weights = [1, 2, 3, 2, 1];
  const radius = 2;
  return points.map((_, i) => {
    let weightedSum = 0;
    let weightTotal = 0;
    for (let offset = -radius; offset <= radius; offset += 1) {
      const idx = i + offset;
      if (idx < 0 || idx >= points.length) continue;
      const w = weights[offset + radius];
      weightedSum += points[idx].count * w;
      weightTotal += w;
    }
    return weightTotal > 0 ? weightedSum / weightTotal : points[i].count;
  });
}

export function useSimulationChartData({
  weeklyThroughput,
  cycleTimeDaysData,
  includeZeroWeeks,
  result,
}: {
  weeklyThroughput: WeeklyThroughputRow[];
  cycleTimeDaysData: CycleTimePoint[];
  includeZeroWeeks: boolean;
  result: SimulationResult | null;
}) {
  const throughputData = useMemo((): ThroughputPoint[] => {
    const rows = includeZeroWeeks ? weeklyThroughput : weeklyThroughput.filter((row) => row.throughput > 0);
    return rows.map((row) => ({
      week: createDeliveryWeek(row.week),
      throughput: row.throughput,
    }));
  }, [weeklyThroughput, includeZeroWeeks]);

  const cycleTimeTrendData = useMemo(() => buildCycleTimeTrendData(cycleTimeDaysData), [cycleTimeDaysData]);
  const cycleTimeSummary = useMemo(() => summarizeCycleTime(cycleTimeDaysData), [cycleTimeDaysData]);

  const mcHistData = useMemo((): ChartPoint[] => {
    const buckets = result?.resultDistribution;
    if (!buckets?.length) return [];

    const points = buckets
      .map((b) => ({ x: Number(b.x), count: Number(b.count) }))
      .filter((b) => Number.isFinite(b.x) && Number.isFinite(b.count) && b.count > 0)
      .sort((a, b) => a.x - b.x);
    if (!points.length) return [];

    const smoothed = smoothHistogramCounts(points);

    return points.map((p, idx) => ({
      x: p.x,
      count: p.count,
      gauss: smoothed[idx],
    }));
  }, [result]);

  const probabilityCurveData = useMemo((): ProbabilityPoint[] => {
    if (!result?.resultDistribution?.length) return [];

    const points = result.resultDistribution
      .map((b) => ({ x: Number(b.x), count: Number(b.count) }))
      .filter((b) => Number.isFinite(b.x) && Number.isFinite(b.count) && b.count > 0)
      .sort((a, b) => a.x - b.x);
    if (!points.length) return [];

    const totalCount = result.completionSummary
      ? result.completionSummary.completedCount + result.completionSummary.censoredCount
      : undefined;
    return buildProbabilityCurve(points, result.resultKind, totalCount);
  }, [result]);

  const displayPercentiles = useMemo((): SimulationPercentiles => {
    return result?.resultPercentiles ?? {};
  }, [result]);

  return {
    throughputData,
    cycleTimeDaysData,
    cycleTimeTrendData,
    cycleTimeSummary,
    mcHistData,
    probabilityCurveData,
    displayPercentiles,
  };
}
