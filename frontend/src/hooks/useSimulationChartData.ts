import { useMemo } from "react";
import type { ForecastResponse, WeeklyThroughputRow } from "../types";
import { buildAtLeastPercentiles, buildProbabilityCurve } from "./probability";
import type { ChartPoint, ProbabilityPoint, ThroughputPoint } from "./simulationTypes";

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
  includeZeroWeeks,
  result,
}: {
  weeklyThroughput: WeeklyThroughputRow[];
  includeZeroWeeks: boolean;
  result: ForecastResponse | null;
}) {
  const throughputData = useMemo((): ThroughputPoint[] => {
    const rows = includeZeroWeeks ? weeklyThroughput : weeklyThroughput.filter((row) => row.throughput > 0);
    return rows.map((row) => ({
      week: String(row.week).slice(0, 10),
      throughput: row.throughput,
    }));
  }, [weeklyThroughput, includeZeroWeeks]);

  const mcHistData = useMemo((): ChartPoint[] => {
    const buckets = result?.result_distribution;
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
    if (!result?.result_distribution?.length) return [];

    const points = result.result_distribution
      .map((b) => ({ x: Number(b.x), count: Number(b.count) }))
      .filter((b) => Number.isFinite(b.x) && Number.isFinite(b.count) && b.count > 0)
      .sort((a, b) => a.x - b.x);
    if (!points.length) return [];

    return buildProbabilityCurve(points, result.result_kind);
  }, [result]);

  const displayPercentiles = useMemo((): Record<string, number> => {
    if (!result) return {};
    if (result.result_kind !== "items") return result.result_percentiles;

    const points = result.result_distribution
      .map((b) => ({ x: Number(b.x), count: Number(b.count) }))
      .filter((b) => Number.isFinite(b.x) && Number.isFinite(b.count) && b.count > 0)
      .sort((a, b) => a.x - b.x);
    if (!points.length) return result.result_percentiles;

    return buildAtLeastPercentiles(points, [50, 70, 90]);
  }, [result]);

  return {
    throughputData,
    mcHistData,
    probabilityCurveData,
    displayPercentiles,
  };
}
