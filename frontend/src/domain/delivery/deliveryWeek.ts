import { createDeliveryInstant, type DeliveryInstant } from "./deliveryEvent";

export const DELIVERY_CALENDAR_POLICY = Object.freeze({
  calendar: "iso-8601",
  timeZone: "UTC",
  weekStartsOn: "monday",
  weekIdentity: "monday-date",
} as const);

declare const deliveryWeekBrand: unique symbol;

export type DeliveryWeek = string & {
  readonly [deliveryWeekBrand]: true;
};

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function formatUtcDate(date: Date): DeliveryWeek {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}` as DeliveryWeek;
}

export function createDeliveryWeek(value: unknown): DeliveryWeek {
  if (typeof value !== "string") {
    throw new Error("delivery.week doit identifier un lundi ISO en UTC.");
  }

  const normalized = value.trim();
  const match = ISO_DATE.exec(normalized);
  if (!match) {
    return deliveryWeekOf(createDeliveryInstant(normalized));
  }

  const [, yearRaw, monthRaw, dayRaw] = match;
  const date = new Date(Date.UTC(
    Number(yearRaw),
    Number(monthRaw) - 1,
    Number(dayRaw),
  ));
  if (formatUtcDate(date) !== normalized || date.getUTCDay() !== 1) {
    throw new Error("delivery.week doit identifier un lundi ISO en UTC.");
  }
  return normalized as DeliveryWeek;
}

export function deliveryWeekOf(instant: DeliveryInstant): DeliveryWeek {
  const occurredAt = new Date(instant);
  const daysSinceMonday = (occurredAt.getUTCDay() + 6) % 7;
  const monday = new Date(Date.UTC(
    occurredAt.getUTCFullYear(),
    occurredAt.getUTCMonth(),
    occurredAt.getUTCDate() - daysSinceMonday,
  ));
  return createDeliveryWeek(formatUtcDate(monday));
}

export function nextDeliveryWeek(week: DeliveryWeek): DeliveryWeek {
  const monday = new Date(`${week}T00:00:00.000Z`);
  monday.setUTCDate(monday.getUTCDate() + 7);
  return createDeliveryWeek(formatUtcDate(monday));
}
