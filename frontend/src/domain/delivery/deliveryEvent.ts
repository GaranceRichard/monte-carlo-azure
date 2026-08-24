export const DELIVERY_EVENT_KINDS = [
  "item_delivered",
  "work_started",
  "work_completed",
] as const;

export type DeliveryEventKind = (typeof DELIVERY_EVENT_KINDS)[number];

declare const deliveryItemIdBrand: unique symbol;
declare const deliveryInstantBrand: unique symbol;

export type DeliveryItemId = string & {
  readonly [deliveryItemIdBrand]: true;
};

export type DeliveryInstant = string & {
  readonly [deliveryInstantBrand]: true;
};

export type DeliveryEvent = Readonly<{
  itemId: DeliveryItemId;
  kind: DeliveryEventKind;
  occurredAt: DeliveryInstant;
}>;

export type DeliveryEventInput = Readonly<{
  itemId: unknown;
  kind: unknown;
  occurredAt: unknown;
}>;

const EXPLICIT_TIMEZONE = /T.+(?:Z|[+-]\d{2}:\d{2})$/i;

export function createDeliveryItemId(value: unknown): DeliveryItemId {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error("delivery.itemId doit etre une chaine non vide.");
  }
  return value.trim() as DeliveryItemId;
}

export function createDeliveryInstant(value: unknown): DeliveryInstant {
  if (typeof value !== "string" || !EXPLICIT_TIMEZONE.test(value.trim())) {
    throw new Error("delivery.occurredAt doit etre un instant avec fuseau explicite.");
  }
  const instant = new Date(value.trim());
  if (Number.isNaN(instant.getTime())) {
    throw new Error("delivery.occurredAt doit etre un instant valide.");
  }
  return instant.toISOString() as DeliveryInstant;
}

function createDeliveryEventKind(value: unknown): DeliveryEventKind {
  if (
    typeof value !== "string"
    || !DELIVERY_EVENT_KINDS.includes(value as DeliveryEventKind)
  ) {
    throw new Error("delivery.kind doit etre un fait metier connu.");
  }
  return value as DeliveryEventKind;
}

export function createDeliveryEvent(input: DeliveryEventInput): DeliveryEvent {
  return Object.freeze({
    itemId: createDeliveryItemId(input.itemId),
    kind: createDeliveryEventKind(input.kind),
    occurredAt: createDeliveryInstant(input.occurredAt),
  });
}
