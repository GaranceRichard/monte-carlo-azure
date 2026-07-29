import type { SimulationResultKind } from "../domain/simulation";

export type ProbabilityPoint = { x: number; probability: number };

export function buildProbabilityCurve(
  points: Array<{ x: number; count: number }>,
  resultKind: SimulationResultKind,
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
