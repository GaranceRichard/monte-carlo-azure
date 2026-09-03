import { createDeliveryInstant, deliveryWeekOf } from "./domain/delivery";

export function formatDateLocal(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseLocalIsoDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) throw new Error(`Invalid ISO local date: ${value}`);

  const [, yearRaw, monthRaw, dayRaw] = match;
  const year = Number(yearRaw);
  const monthIndex = Number(monthRaw) - 1;
  const day = Number(dayRaw);
  const date = new Date(Date.UTC(year, monthIndex, day));

  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== monthIndex ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`Invalid ISO local date: ${value}`);
  }

  return date;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function startOfIsoWeek(date: Date): Date {
  const week = deliveryWeekOf(createDeliveryInstant(date.toISOString()));
  return new Date(`${week}T00:00:00.000Z`);
}

export function nextMonday(date: Date): Date {
  const monday = startOfIsoWeek(date);
  return date.getUTCDay() === 1 ? monday : addDays(monday, 7);
}

export function previousSunday(date: Date): Date {
  return addDays(date, -(date.getUTCDay() || 0));
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
  date.setUTCDate(date.getUTCDate() - weeks * 7);
  return formatDateLocal(date);
}
