import type { WeeklyThroughputRow } from "../types";

export function exportThroughputCsv(weeklyThroughput: WeeklyThroughputRow[], teamName: string): void {
  if (!weeklyThroughput.length) return;
  const header = "week,throughput";
  const rows = weeklyThroughput.map((row) => `${String(row.week).slice(0, 10)},${row.throughput}`);
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const now = new Date().toISOString().replace(/[:.]/g, "-");
  a.download = `throughput-${teamName || "team"}-${now}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
