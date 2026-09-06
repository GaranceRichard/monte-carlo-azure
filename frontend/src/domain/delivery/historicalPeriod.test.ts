import { describe, expect, it } from "vitest";
import {
  createDeliveryHistoryPeriods,
  createDeliveryHistoryWindow,
} from ".";

function periods(
  startInclusive: string,
  endExclusive: string,
  referenceInstant = "2026-01-26T00:00:00Z",
) {
  return createDeliveryHistoryPeriods({
    window: createDeliveryHistoryWindow({ startInclusive, endExclusive }),
    referenceInstant,
  });
}

describe("DeliveryHistoryPeriod", () => {
  it("marks initial, complete and final periods without an implicit default", () => {
    const result = periods(
      "2026-01-07T00:00:00Z",
      "2026-01-24T00:00:00Z",
    );

    expect(result.periods).toEqual([
      {
        status: "partial_initial",
        startInclusive: "2026-01-07T00:00:00.000Z",
        endExclusive: "2026-01-12T00:00:00.000Z",
      },
      {
        status: "complete",
        startInclusive: "2026-01-12T00:00:00.000Z",
        endExclusive: "2026-01-19T00:00:00.000Z",
      },
      {
        status: "partial_final",
        startInclusive: "2026-01-19T00:00:00.000Z",
        endExclusive: "2026-01-24T00:00:00.000Z",
      },
    ]);
    expect(result.completePeriod).toBe(result.periods[1]);
    expect(result.diagnostics).toEqual([
      { code: "partial_initial_period", periodStatus: "partial_initial" },
      { code: "partial_final_period", periodStatus: "partial_final" },
    ]);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.periods)).toBe(true);
    expect(Object.isFrozen(result.diagnostics)).toBe(true);
  });

  it("represents a range contained by one week as partial on both bounds", () => {
    const result = periods(
      "2026-01-07T00:00:00Z",
      "2026-01-10T00:00:00Z",
    );

    expect(result.periods).toEqual([{
      status: "partial_initial_and_final",
      startInclusive: "2026-01-07T00:00:00.000Z",
      endExclusive: "2026-01-10T00:00:00.000Z",
    }]);
    expect(result.completePeriod).toBeNull();
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "partial_initial_period",
      "partial_final_period",
    ]);
  });

  it("keeps an aligned and elapsed range explicitly complete", () => {
    const result = periods(
      "2026-01-05T00:00:00Z",
      "2026-01-12T00:00:00Z",
      "2026-01-19T00:00:00Z",
    );

    expect(result.periods).toEqual([{
      status: "complete",
      startInclusive: "2026-01-05T00:00:00.000Z",
      endExclusive: "2026-01-12T00:00:00.000Z",
    }]);
    expect(result.completePeriod?.status).toBe("complete");
    expect(result.diagnostics).toEqual([]);
  });

  it("marks the current week as final partial even on aligned bounds", () => {
    const result = periods(
      "2026-01-05T00:00:00Z",
      "2026-02-02T00:00:00Z",
      "2026-01-30T12:00:00-05:00",
    );

    expect(result.completePeriod).toEqual({
      status: "complete",
      startInclusive: "2026-01-05T00:00:00.000Z",
      endExclusive: "2026-01-26T00:00:00.000Z",
    });
    expect(result.periods.at(-1)).toEqual({
      status: "partial_final",
      startInclusive: "2026-01-26T00:00:00.000Z",
      endExclusive: "2026-02-02T00:00:00.000Z",
    });
    expect(result.diagnostics).toEqual([
      { code: "partial_final_period", periodStatus: "partial_final" },
    ]);
  });

  it("returns an explicit empty classification for an empty window", () => {
    const result = periods(
      "2026-01-12T00:00:00Z",
      "2026-01-12T00:00:00Z",
    );

    expect(result).toEqual({ periods: [], completePeriod: null, diagnostics: [] });
  });
});
