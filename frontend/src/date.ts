import {
  createDeliveryHistoryPeriods,
  createDeliveryHistoryWindow,
  type DeliveryHistoryPeriods,
} from "./domain/delivery";

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

export function getDeliveryHistoryPeriods(
  startDate: string,
  endDate: string,
  referenceDate = new Date(),
): DeliveryHistoryPeriods {
  const requestedStart = parseLocalIsoDate(startDate);
  const requestedEnd = parseLocalIsoDate(endDate);
  const requestedWindow = createDeliveryHistoryWindow({
    startInclusive: requestedStart.toISOString(),
    endExclusive: addDays(requestedEnd, 1).toISOString(),
  });
  return createDeliveryHistoryPeriods({
    window: requestedWindow,
    referenceInstant: referenceDate.toISOString(),
  });
}

export function today(): string {
  return formatDateLocal(new Date());
}

export function nWeeksAgo(weeks: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - weeks * 7);
  return formatDateLocal(date);
}
