import {
  createDeliveryEvent,
  createDeliveryInstant,
  createDeliveryItemId,
  type DeliveryEvent,
  type DeliveryEventKind,
  type DeliveryInstant,
  type DeliveryItemId,
} from "../../domain/delivery";

const CLOSED_DATE_FIELD = "Microsoft.VSTS.Common.ClosedDate";
const RESOLVED_DATE_FIELD = "Microsoft.VSTS.Common.ResolvedDate";
const CHANGED_DATE_FIELD = "System.ChangedDate";
const STATE_FIELD = "System.State";

type NormalizedRevision = Readonly<{
  state: string;
  changedDate: DeliveryInstant;
}>;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function toAzureItemId(value: unknown): DeliveryItemId | null {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    return null;
  }
  return createDeliveryItemId(String(value));
}

function toEvent(
  itemId: DeliveryItemId,
  kind: DeliveryEventKind,
  occurredAt: unknown,
): DeliveryEvent | null {
  try {
    return createDeliveryEvent({ itemId, kind, occurredAt });
  } catch {
    return null;
  }
}

function normalizedState(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function toDeliveryInstant(value: unknown): DeliveryInstant | null {
  try {
    return createDeliveryInstant(value);
  } catch {
    return null;
  }
}

function toNormalizedRevision(value: unknown): NormalizedRevision | null {
  const fields = asRecord(asRecord(value)?.fields);
  const state = normalizedState(fields?.[STATE_FIELD]);
  const changedDate = toDeliveryInstant(fields?.[CHANGED_DATE_FIELD]);
  return state && changedDate ? { state, changedDate } : null;
}

function normalizedRevisions(value: unknown): NormalizedRevision[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(toNormalizedRevision)
    .filter((revision): revision is NormalizedRevision => revision !== null)
    .sort((left, right) => left.changedDate.localeCompare(right.changedDate));
}

function isStartTransition(previous: NormalizedRevision, current: NormalizedRevision): boolean {
  return previous.state === "new" && current.state !== "new";
}

function isCompletionTransition(
  previous: NormalizedRevision,
  current: NormalizedRevision,
  doneStates: ReadonlySet<string>,
): boolean {
  return doneStates.has(current.state) && current.state !== previous.state;
}

function revisionEvents(
  itemId: DeliveryItemId,
  revisions: readonly NormalizedRevision[],
  doneStates: readonly string[],
): DeliveryEvent[] {
  const doneStateSet = new Set(doneStates.map(normalizedState).filter(Boolean));
  const events: DeliveryEvent[] = [];
  let hasStarted = false;
  let hasCompleted = false;

  for (let index = 1; index < revisions.length; index += 1) {
    const previous = revisions[index - 1];
    const current = revisions[index];
    if (!previous || !current) continue;

    if (!hasStarted && isStartTransition(previous, current)) {
      const started = toEvent(itemId, "work_started", current.changedDate);
      if (started) {
        events.push(started);
        hasStarted = true;
      }
    }

    if (!hasCompleted && isCompletionTransition(previous, current, doneStateSet)) {
      const completed = toEvent(itemId, "work_completed", current.changedDate);
      if (completed) {
        events.push(completed);
        hasCompleted = true;
      }
    }

    if (hasStarted && hasCompleted) break;
  }

  return events.sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
}

export function azureWorkItemDtoToDeliveryEvent(value: unknown): DeliveryEvent | null {
  const dto = asRecord(value);
  const itemId = toAzureItemId(dto?.id);
  const fields = asRecord(dto?.fields);
  if (!itemId || !fields) return null;

  const occurredAt = fields[CLOSED_DATE_FIELD] || fields[RESOLVED_DATE_FIELD];
  return toEvent(itemId, "item_delivered", occurredAt);
}

export function azureRevisionDtosToDeliveryEvents(
  itemIdValue: unknown,
  value: unknown,
  doneStates: readonly string[],
): DeliveryEvent[] {
  const itemId = toAzureItemId(itemIdValue);
  const revisions = normalizedRevisions(value);
  if (revisions.length < 2) return [];
  return itemId ? revisionEvents(itemId, revisions, doneStates) : [];
}
