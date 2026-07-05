import type { ForecastKind } from "../types";

export type ProbabilityPoint = { x: number; probability: number };

export function buildProbabilityCurve(
  points: Array<{ x: number; count: number }>,
  resultKind: ForecastKind,
  totalCount?: number,
): ProbabilityPoint[] {
  if (!points.length) return [];
  const visibleCount = points.reduce((acc, p) => acc + p.count, 0);
  const n = Math.max(visibleCount, Math.floor(Number(totalCount ?? visibleCount)));
  if (n <= 0) return [];

  if (resultKind === "items") {
    let remaining = visibleCount;
    return points.map((p) => {
      const probability = (remaining / n) * 100;
      remaining -= p.count;
      return { x: p.x, probability };
    });
  }

  let cumulative = 0;
  return points.map((p) => {
    cumulative += p.count;
    return { x: p.x, probability: (cumulative / n) * 100 };
  });
}

export function buildAtLeastPercentiles(
  points: Array<{ x: number; count: number }>,
  levels: number[] = [50, 70, 90],
): Record<string, number> {
  if (!points.length) return {};
  const total = points.reduce((acc, p) => acc + p.count, 0);
  if (total <= 0) return {};

  const descending = [...points].sort((a, b) => b.x - a.x);
  const out: Record<string, number> = {};

  for (const level of levels) {
    const target = (total * level) / 100;
    let cumulative = 0;
    let chosen = descending[descending.length - 1].x;
    for (const p of descending) {
      cumulative += p.count;
      chosen = p.x;
      if (cumulative >= target) break;
    }
    out[`P${level}`] = chosen;
  }

  return out;
}
