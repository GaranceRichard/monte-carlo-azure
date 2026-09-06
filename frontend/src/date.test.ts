import { describe, expect, it } from "vitest";
import {
  formatDateLocal,
  getDeliveryHistoryPeriods,
  parseLocalIsoDate,
} from "./date";

describe("date helpers", () => {
  it("parses YYYY-MM-DD as a UTC calendar date", () => {
    const parsed = parseLocalIsoDate("2026-01-05");

    expect(formatDateLocal(parsed)).toBe("2026-01-05");
    expect(parsed.toISOString()).toBe("2026-01-05T00:00:00.000Z");
    expect(parsed.getUTCFullYear()).toBe(2026);
    expect(parsed.getUTCMonth()).toBe(0);
    expect(parsed.getUTCDate()).toBe(5);
  });

  it("rejects invalid local ISO dates", () => {
    expect(() => parseLocalIsoDate("2026-02-30")).toThrow("Invalid ISO local date");
    expect(() => parseLocalIsoDate("2026/02/03")).toThrow("Invalid ISO local date");
  });

  it("maps inclusive calendar dates to the domain period authority", () => {
    const result = getDeliveryHistoryPeriods(
      "2026-01-07",
      "2026-01-23",
      parseLocalIsoDate("2026-01-26"),
    );

    expect(result.periods.map((period) => period.status)).toEqual([
      "partial_initial",
      "complete",
      "partial_final",
    ]);
    expect(result.completePeriod).toEqual({
      status: "complete",
      startInclusive: "2026-01-12T00:00:00.000Z",
      endExclusive: "2026-01-19T00:00:00.000Z",
    });
  });

  it("keeps a Sunday in progress explicit as a final partial period", () => {
    const result = getDeliveryHistoryPeriods(
      "2026-01-05",
      "2026-01-18",
      parseLocalIsoDate("2026-01-18"),
    );

    expect(result.periods).toEqual([
      {
        status: "complete",
        startInclusive: "2026-01-05T00:00:00.000Z",
        endExclusive: "2026-01-12T00:00:00.000Z",
      },
      {
        status: "partial_final",
        startInclusive: "2026-01-12T00:00:00.000Z",
        endExclusive: "2026-01-19T00:00:00.000Z",
      },
    ]);
  });

  it("uses the UTC reference instant when classifying completion", () => {
    const result = getDeliveryHistoryPeriods(
      "2025-12-29",
      "2026-01-11",
      new Date("2026-01-05T00:30:00+02:00"),
    );

    expect(result.completePeriod).toBeNull();
    expect(result.periods[0]?.status).toBe("partial_final");
  });
});
