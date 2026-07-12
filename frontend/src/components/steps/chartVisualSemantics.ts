export const SMOOTHED_SERIES_STROKE_DASHARRAY = "8 4";

export type ChartLegendVisual = "band" | "bar" | "dashed-line" | "point" | "solid-line";

export const chartLegendVisualByDataKey: Record<string, ChartLegendVisual> = {
  averageDays: "dashed-line",
  bandRangeDays: "band",
  count: "bar",
  gauss: "dashed-line",
  movingAverage: "dashed-line",
  observedAverage: "point",
  probability: "solid-line",
  throughput: "bar",
};
