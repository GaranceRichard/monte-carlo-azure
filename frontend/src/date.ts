export function formatDateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseLocalIsoDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) throw new Error(`Invalid ISO local date: ${value}`);

  const [, yearRaw, monthRaw, dayRaw] = match;
  const year = Number(yearRaw);
  const monthIndex = Number(monthRaw) - 1;
  const day = Number(dayRaw);
  const date = new Date(year, monthIndex, day);

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== monthIndex ||
    date.getDate() !== day
  ) {
    throw new Error(`Invalid ISO local date: ${value}`);
  }

  return date;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function startOfIsoWeek(date: Date): Date {
  return addDays(date, -((date.getDay() + 6) % 7));
}

export function nextMonday(date: Date): Date {
  const monday = startOfIsoWeek(date);
  return date.getDay() === 1 ? monday : addDays(monday, 7);
}

export function previousSunday(date: Date): Date {
  return addDays(date, -(date.getDay() || 0));
}

function lastCompletedSunday(referenceDate: Date): Date {
  return previousSunday(addDays(referenceDate, -1));
}

export function getCompleteWeekRange(
  startDate: string,
  endDate: string,
  referenceDate = new Date(),
): { startDate: string; endDate: string } | null {
  const requestedStart = parseLocalIsoDate(startDate);
  const requestedEnd = parseLocalIsoDate(endDate);
  const alignedStart = nextMonday(requestedStart);
  const alignedEndCandidate = previousSunday(requestedEnd);
  const maxCompletedEnd = lastCompletedSunday(referenceDate);
  const alignedEnd = alignedEndCandidate <= maxCompletedEnd ? alignedEndCandidate : maxCompletedEnd;

  if (alignedStart > alignedEnd) return null;

  return {
    startDate: formatDateLocal(alignedStart),
    endDate: formatDateLocal(alignedEnd),
  };
}

export function today(): string {
  return formatDateLocal(new Date());
}

export function nWeeksAgo(weeks: number): string {
  const date = new Date();
  date.setDate(date.getDate() - weeks * 7);
  return formatDateLocal(date);
}
