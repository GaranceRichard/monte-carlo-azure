export function formatDateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function today(): string {
  return formatDateLocal(new Date());
}

export function nWeeksAgo(weeks: number): string {
  const date = new Date();
  date.setDate(date.getDate() - weeks * 7);
  return formatDateLocal(date);
}
