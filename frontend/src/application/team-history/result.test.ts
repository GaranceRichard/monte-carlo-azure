import { describe, expect, it } from "vitest";
import {
  createDeliveryEvent,
  createDeliveryHistory,
  createDeliveryHistoryPeriods,
  createDeliveryHistoryResult,
  createDeliveryHistoryWindow,
  createDeliveryItemId,
  qualifyDeliveryChronology,
} from "../../domain/delivery";
import { createTeamHistoryResult } from ".";
import type { TeamHistoryResult } from ".";

describe("TeamHistory application result", () => {
  it("preserves every delivery diagnostic family without copying or flattening it", () => {
    const periods = createDeliveryHistoryPeriods({
      window: createDeliveryHistoryWindow({
        startInclusive: "2026-01-06T00:00:00.000Z",
        endExclusive: "2026-01-11T00:00:00.000Z",
      }),
      referenceInstant: "2026-02-01T00:00:00.000Z",
    });
    const completeness = createDeliveryHistoryResult({
      period: null,
      requiredItemIds: [createDeliveryItemId("missing")],
      events: [],
    });
    const continuity = createDeliveryHistory({
      expectedDeliveredItemIds: ["first", "missing", "last"],
      events: [
        createDeliveryEvent({
          itemId: "first",
          kind: "item_delivered",
          occurredAt: "2026-01-06T12:00:00.000Z",
        }),
        createDeliveryEvent({
          itemId: "last",
          kind: "item_delivered",
          occurredAt: "2026-01-08T12:00:00.000Z",
        }),
      ],
      unavailableEventHistoryItemIds: ["last"],
    });
    const chronology = qualifyDeliveryChronology([
      createDeliveryEvent({
        itemId: "inverted",
        kind: "work_started",
        occurredAt: "2026-01-08T12:00:00.000Z",
      }),
      createDeliveryEvent({
        itemId: "inverted",
        kind: "work_completed",
        occurredAt: "2026-01-07T12:00:00.000Z",
      }),
    ]);

    const result: TeamHistoryResult = createTeamHistoryResult({
      weeklyThroughput: [],
      cycleTimeDaysData: [],
      periods,
      completeness,
      continuity,
      chronology,
    });

    expect(result.diagnostics.periods).toBe(periods.diagnostics);
    expect(result.diagnostics.completeness).toBe(completeness.completeness);
    expect(result.diagnostics.continuity).toBe(continuity.diagnostics);
    expect(result.diagnostics.chronology).toBe(chronology.diagnostics);
    expect(result.diagnostics).toEqual({
      periods: [
        {
          code: "partial_initial_period",
          periodStatus: "partial_initial_and_final",
        },
        {
          code: "partial_final_period",
          periodStatus: "partial_initial_and_final",
        },
      ],
      completeness: {
        status: "absent",
        code: "delivery_history_absent",
        requiredItemCount: 1,
        observedItemCount: 0,
        missingItemIds: ["missing"],
      },
      continuity: [
        {
          code: "missing_expected_delivery_events",
          firstExpectedPosition: 2,
          lastExpectedPosition: 2,
          itemIds: ["missing"],
        },
        {
          code: "ambiguous_delivery_event_sequence",
          reason: "unavailable_item_event_history",
          itemIds: ["last"],
        },
      ],
      chronology: [
        {
          code: "inverted_delivery_event_order",
          itemId: "inverted",
          predecessorKind: "work_started",
          predecessorOccurredAt: "2026-01-08T12:00:00.000Z",
          successorKind: "work_completed",
          successorOccurredAt: "2026-01-07T12:00:00.000Z",
        },
      ],
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.diagnostics)).toBe(true);
  });
});
