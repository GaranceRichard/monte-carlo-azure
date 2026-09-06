import {
  createDeliveryInstant,
  type DeliveryInstant,
} from "./deliveryEvent";
import {
  createDeliveryHistoryWindow,
  type DeliveryHistoryWindow,
} from "./historicalWindow";
import { deliveryWeekOf, nextDeliveryWeek } from "./deliveryWeek";

export const DELIVERY_HISTORY_PERIOD_STATUSES = Object.freeze([
  "partial_initial",
  "complete",
  "partial_final",
  "partial_initial_and_final",
] as const);

export type DeliveryHistoryPeriodStatus =
  (typeof DELIVERY_HISTORY_PERIOD_STATUSES)[number];

type PeriodWithStatus<Status extends DeliveryHistoryPeriodStatus> = Readonly<{
  status: Status;
  startInclusive: DeliveryInstant;
  endExclusive: DeliveryInstant;
}>;

export type CompleteDeliveryHistoryPeriod = PeriodWithStatus<"complete">;
export type PartialDeliveryHistoryPeriod = PeriodWithStatus<
  Exclude<DeliveryHistoryPeriodStatus, "complete">
>;
export type DeliveryHistoryPeriod =
  | CompleteDeliveryHistoryPeriod
  | PartialDeliveryHistoryPeriod;

export type DeliveryHistoryPeriodDiagnostic = Readonly<{
  code: "partial_initial_period" | "partial_final_period";
  periodStatus: PartialDeliveryHistoryPeriod["status"];
}>;

export type DeliveryHistoryPeriods = Readonly<{
  periods: readonly DeliveryHistoryPeriod[];
  completePeriod: CompleteDeliveryHistoryPeriod | null;
  diagnostics: readonly DeliveryHistoryPeriodDiagnostic[];
}>;

export type DeliveryHistoryPeriodsInput = Readonly<{
  window: DeliveryHistoryWindow;
  referenceInstant: unknown;
}>;

function weekStart(instant: DeliveryInstant): DeliveryInstant {
  return createDeliveryInstant(`${deliveryWeekOf(instant)}T00:00:00.000Z`);
}

function nextWeekStart(instant: DeliveryInstant): DeliveryInstant {
  const start = weekStart(instant);
  if (start === instant) return start;
  return createDeliveryInstant(`${nextDeliveryWeek(deliveryWeekOf(instant))}T00:00:00.000Z`);
}

function period<Status extends DeliveryHistoryPeriodStatus>(
  status: Status,
  startInclusive: DeliveryInstant,
  endExclusive: DeliveryInstant,
): PeriodWithStatus<Status> {
  return Object.freeze({ status, startInclusive, endExclusive });
}

function partialDiagnostics(
  status: PartialDeliveryHistoryPeriod["status"],
): readonly DeliveryHistoryPeriodDiagnostic[] {
  const diagnostics: DeliveryHistoryPeriodDiagnostic[] = [];
  if (status === "partial_initial" || status === "partial_initial_and_final") {
    diagnostics.push(Object.freeze({ code: "partial_initial_period", periodStatus: status }));
  }
  if (status === "partial_final" || status === "partial_initial_and_final") {
    diagnostics.push(Object.freeze({ code: "partial_final_period", periodStatus: status }));
  }
  return Object.freeze(diagnostics);
}

function onlyPartialPeriod(
  window: DeliveryHistoryWindow,
  historyCutoff: DeliveryInstant,
): DeliveryHistoryPeriods {
  const initial = weekStart(window.startInclusive) !== window.startInclusive;
  const final = weekStart(window.endExclusive) !== window.endExclusive
    || window.endExclusive > historyCutoff;
  const status = initial && final
    ? "partial_initial_and_final"
    : initial
      ? "partial_initial"
      : "partial_final";
  const partial = period(status, window.startInclusive, window.endExclusive);
  return Object.freeze({
    periods: Object.freeze([partial]),
    completePeriod: null,
    diagnostics: partialDiagnostics(status),
  });
}

export function createDeliveryHistoryPeriods(
  input: DeliveryHistoryPeriodsInput,
): DeliveryHistoryPeriods {
  const window = createDeliveryHistoryWindow(input.window);
  const referenceInstant = createDeliveryInstant(input.referenceInstant);
  if (window.startInclusive === window.endExclusive) {
    return Object.freeze({
      periods: Object.freeze([]),
      completePeriod: null,
      diagnostics: Object.freeze([]),
    });
  }

  const completeStart = nextWeekStart(window.startInclusive);
  const requestedCompleteEnd = weekStart(window.endExclusive);
  const historyCutoff = weekStart(referenceInstant);
  const completeEnd = requestedCompleteEnd < historyCutoff
    ? requestedCompleteEnd
    : historyCutoff;
  if (completeStart >= completeEnd) {
    return onlyPartialPeriod(window, historyCutoff);
  }

  const completePeriod = period("complete", completeStart, completeEnd);
  const periods: DeliveryHistoryPeriod[] = [];
  const diagnostics: DeliveryHistoryPeriodDiagnostic[] = [];
  if (window.startInclusive < completeStart) {
    periods.push(period("partial_initial", window.startInclusive, completeStart));
    diagnostics.push(...partialDiagnostics("partial_initial"));
  }
  periods.push(completePeriod);
  if (completeEnd < window.endExclusive) {
    periods.push(period("partial_final", completeEnd, window.endExclusive));
    diagnostics.push(...partialDiagnostics("partial_final"));
  }

  return Object.freeze({
    periods: Object.freeze(periods),
    completePeriod,
    diagnostics: Object.freeze(diagnostics),
  });
}
