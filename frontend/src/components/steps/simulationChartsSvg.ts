export type ThroughputExportPoint = {
  week: string;
  throughput: number;
  movingAverage: number;
};

export type DistributionExportPoint = {
  x: number;
  count: number;
  gauss: number;
};

export type ProbabilityExportPoint = {
  x: number;
  probability: number;
};

export const CHART_WIDTH = 960;
export const CHART_HEIGHT = 360;
const MARGIN = { top: 16, right: 16, bottom: 36, left: 44 };

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatNum(value: number): string {
  if (!Number.isFinite(value)) return "0";
  if (Math.abs(value) >= 100) return value.toFixed(0);
  if (Math.abs(value) >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

function niceMax(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const exponent = Math.floor(Math.log10(value));
  const fraction = value / 10 ** exponent;
  let niceFraction = 1;
  if (fraction <= 1) niceFraction = 1;
  else if (fraction <= 2) niceFraction = 2;
  else if (fraction <= 5) niceFraction = 5;
  else niceFraction = 10;
  return niceFraction * 10 ** exponent;
}

function linePath(values: number[], yScale: (value: number) => number, xScale: (index: number) => number): string {
  if (!values.length) return "";
  return values
    .map((value, index) => `${index === 0 ? "M" : "L"} ${xScale(index).toFixed(2)} ${yScale(value).toFixed(2)}`)
    .join(" ");
}

function renderEmptyChart(title: string): string {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CHART_WIDTH} ${CHART_HEIGHT}" role="img" aria-label="${escapeHtml(title)}">
      <rect x="0" y="0" width="${CHART_WIDTH}" height="${CHART_HEIGHT}" fill="#ffffff" />
      <text x="${CHART_WIDTH / 2}" y="${CHART_HEIGHT / 2}" text-anchor="middle" fill="#6b7280" font-size="14">
        Donnees insuffisantes pour afficher ce graphique
      </text>
    </svg>
  `;
}

function renderGridAndYAxis(yTicks: number[], yScale: (value: number) => number): string {
  return yTicks
    .map((tick) => {
      const y = yScale(tick);
      return `
        <line x1="${MARGIN.left}" y1="${y}" x2="${CHART_WIDTH - MARGIN.right}" y2="${y}" stroke="#e5e7eb" stroke-dasharray="4 4" />
        <text x="${MARGIN.left - 8}" y="${y + 4}" text-anchor="end" fill="#6b7280" font-size="11">${formatNum(tick)}</text>
      `;
    })
    .join("");
}

export function renderThroughputChart(points: ThroughputExportPoint[]): string {
  if (!points.length) return renderEmptyChart("Throughput hebdomadaire");
  const plotWidth = CHART_WIDTH - MARGIN.left - MARGIN.right;
  const plotHeight = CHART_HEIGHT - MARGIN.top - MARGIN.bottom;
  const maxY = niceMax(Math.max(...points.map((p) => Math.max(p.throughput, p.movingAverage))));
  const yScale = (value: number) => MARGIN.top + plotHeight - (Math.max(0, value) / maxY) * plotHeight;
  const xStep = points.length > 1 ? plotWidth / (points.length - 1) : 0;
  const xScale = (index: number) => MARGIN.left + index * xStep;
  const tickStep = Math.max(1, Math.ceil(points.length / 8));
  const barWidth = Math.max(5, Math.min(20, (plotWidth / Math.max(1, points.length)) * 0.65));
  const yTicks = Array.from({ length: 5 }, (_, i) => (maxY * i) / 4);

  const bars = points
    .map((point, index) => {
      const x = xScale(index) - barWidth / 2;
      const y = yScale(point.throughput);
      const h = MARGIN.top + plotHeight - y;
      return `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${barWidth.toFixed(2)}" height="${Math.max(0, h).toFixed(2)}" fill="#93c5fd" />`;
    })
    .join("");
  const throughputPath = linePath(
    points.map((p) => p.throughput),
    yScale,
    xScale,
  );
  const averagePath = linePath(
    points.map((p) => p.movingAverage),
    yScale,
    xScale,
  );
  const xLabels = points
    .map((point, index) =>
      index % tickStep === 0 || index === points.length - 1
        ? `<text x="${xScale(index)}" y="${CHART_HEIGHT - 12}" text-anchor="middle" fill="#6b7280" font-size="10">${escapeHtml(point.week)}</text>`
        : "",
    )
    .join("");

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CHART_WIDTH} ${CHART_HEIGHT}" role="img" aria-label="Throughput hebdomadaire">
      <rect x="0" y="0" width="${CHART_WIDTH}" height="${CHART_HEIGHT}" fill="#ffffff" />
      ${renderGridAndYAxis(yTicks, yScale)}
      <line x1="${MARGIN.left}" y1="${MARGIN.top}" x2="${MARGIN.left}" y2="${MARGIN.top + plotHeight}" stroke="#9ca3af" />
      <line x1="${MARGIN.left}" y1="${MARGIN.top + plotHeight}" x2="${CHART_WIDTH - MARGIN.right}" y2="${MARGIN.top + plotHeight}" stroke="#9ca3af" />
      ${bars}
      <path d="${throughputPath}" fill="none" stroke="#2563eb" stroke-width="2" />
      <path d="${averagePath}" fill="none" stroke="#f97316" stroke-width="2.5" stroke-dasharray="8 4" />
      ${xLabels}
    </svg>
  `;
}

export function renderDistributionChart(points: DistributionExportPoint[]): string {
  if (!points.length) return renderEmptyChart("Distribution Monte Carlo");
  const sorted = [...points].sort((a, b) => a.x - b.x);
  const plotWidth = CHART_WIDTH - MARGIN.left - MARGIN.right;
  const plotHeight = CHART_HEIGHT - MARGIN.top - MARGIN.bottom;
  const maxY = niceMax(Math.max(...sorted.map((p) => Math.max(p.count, p.gauss))));
  const yScale = (value: number) => MARGIN.top + plotHeight - (Math.max(0, value) / maxY) * plotHeight;
  const xStep = sorted.length > 1 ? plotWidth / (sorted.length - 1) : 0;
  const xScale = (index: number) => MARGIN.left + index * xStep;
  const yTicks = Array.from({ length: 5 }, (_, i) => (maxY * i) / 4);
  const tickStep = Math.max(1, Math.ceil(sorted.length / 10));
  const barWidth = Math.max(4, Math.min(14, (plotWidth / Math.max(1, sorted.length)) * 0.55));

  const bars = sorted
    .map((point, index) => {
      const x = xScale(index) - barWidth / 2;
      const y = yScale(point.count);
      const h = MARGIN.top + plotHeight - y;
      return `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${barWidth.toFixed(2)}" height="${Math.max(0, h).toFixed(2)}" fill="#93c5fd" />`;
    })
    .join("");
  const gaussPath = linePath(
    sorted.map((p) => p.gauss),
    yScale,
    xScale,
  );
  const xLabels = sorted
    .map((point, index) =>
      index % tickStep === 0 || index === sorted.length - 1
        ? `<text x="${xScale(index)}" y="${CHART_HEIGHT - 12}" text-anchor="middle" fill="#6b7280" font-size="10">${escapeHtml(String(point.x))}</text>`
        : "",
    )
    .join("");

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CHART_WIDTH} ${CHART_HEIGHT}" role="img" aria-label="Distribution Monte Carlo">
      <rect x="0" y="0" width="${CHART_WIDTH}" height="${CHART_HEIGHT}" fill="#ffffff" />
      ${renderGridAndYAxis(yTicks, yScale)}
      <line x1="${MARGIN.left}" y1="${MARGIN.top}" x2="${MARGIN.left}" y2="${MARGIN.top + plotHeight}" stroke="#9ca3af" />
      <line x1="${MARGIN.left}" y1="${MARGIN.top + plotHeight}" x2="${CHART_WIDTH - MARGIN.right}" y2="${MARGIN.top + plotHeight}" stroke="#9ca3af" />
      ${bars}
      <path d="${gaussPath}" fill="none" stroke="#2563eb" stroke-width="2.5" />
      ${xLabels}
    </svg>
  `;
}

export function renderProbabilityChart(points: ProbabilityExportPoint[]): string {
  if (!points.length) return renderEmptyChart("Courbe de probabilite");
  const sorted = [...points].sort((a, b) => a.x - b.x);
  const plotWidth = CHART_WIDTH - MARGIN.left - MARGIN.right;
  const plotHeight = CHART_HEIGHT - MARGIN.top - MARGIN.bottom;
  const yScale = (value: number) => MARGIN.top + plotHeight - (Math.max(0, Math.min(100, value)) / 100) * plotHeight;
  const xStep = sorted.length > 1 ? plotWidth / (sorted.length - 1) : 0;
  const xScale = (index: number) => MARGIN.left + index * xStep;
  const yTicks = [0, 25, 50, 75, 100];
  const tickStep = Math.max(1, Math.ceil(sorted.length / 10));
  const probabilityPath = linePath(
    sorted.map((p) => p.probability),
    yScale,
    xScale,
  );
  const xLabels = sorted
    .map((point, index) =>
      index % tickStep === 0 || index === sorted.length - 1
        ? `<text x="${xScale(index)}" y="${CHART_HEIGHT - 12}" text-anchor="middle" fill="#6b7280" font-size="10">${escapeHtml(String(point.x))}</text>`
        : "",
    )
    .join("");

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CHART_WIDTH} ${CHART_HEIGHT}" role="img" aria-label="Courbe de probabilite">
      <rect x="0" y="0" width="${CHART_WIDTH}" height="${CHART_HEIGHT}" fill="#ffffff" />
      ${renderGridAndYAxis(yTicks, yScale)}
      <line x1="${MARGIN.left}" y1="${MARGIN.top}" x2="${MARGIN.left}" y2="${MARGIN.top + plotHeight}" stroke="#9ca3af" />
      <line x1="${MARGIN.left}" y1="${MARGIN.top + plotHeight}" x2="${CHART_WIDTH - MARGIN.right}" y2="${MARGIN.top + plotHeight}" stroke="#9ca3af" />
      <path d="${probabilityPath}" fill="none" stroke="#2563eb" stroke-width="2.5" />
      ${xLabels}
    </svg>
  `;
}
