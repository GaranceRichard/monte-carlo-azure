import { describe, expect, it } from "vitest";
import {
  formatDateLocal,
  getCompleteWeekRange,
  nextMonday,
  parseLocalIsoDate,
  previousSunday,
  startOfIsoWeek,
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

  it("returns the monday of the ISO week", () => {
    expect(formatDateLocal(startOfIsoWeek(parseLocalIsoDate("2026-01-07")))).toBe("2026-01-05");
    expect(formatDateLocal(startOfIsoWeek(parseLocalIsoDate("2026-01-05")))).toBe("2026-01-05");
  });

  it("finds the first complete monday included or after the start date", () => {
    expect(formatDateLocal(nextMonday(parseLocalIsoDate("2026-01-05")))).toBe("2026-01-05");
    expect(formatDateLocal(nextMonday(parseLocalIsoDate("2026-01-07")))).toBe("2026-01-12");
  });

  it("finds the last sunday included or before the end date", () => {
    expect(formatDateLocal(previousSunday(parseLocalIsoDate("2026-01-11")))).toBe("2026-01-11");
    expect(formatDateLocal(previousSunday(parseLocalIsoDate("2026-01-09")))).toBe("2026-01-04");
  });

  it("keeps a full monday-sunday week when the requested range already matches it", () => {
    expect(getCompleteWeekRange("2026-01-05", "2026-01-11", parseLocalIsoDate("2026-01-19"))).toEqual({
      startDate: "2026-01-05",
      endDate: "2026-01-11",
    });
  });

  it("excludes the partial week at the start when startDate is midweek", () => {
    expect(getCompleteWeekRange("2026-01-07", "2026-01-25", parseLocalIsoDate("2026-01-26"))).toEqual({
      startDate: "2026-01-12",
      endDate: "2026-01-25",
    });
  });

  it("excludes the partial week at the end when endDate is midweek", () => {
    expect(getCompleteWeekRange("2026-01-05", "2026-01-23", parseLocalIsoDate("2026-01-26"))).toEqual({
      startDate: "2026-01-05",
      endDate: "2026-01-18",
    });
  });

  it("excludes the current week until it is fully elapsed", () => {
    expect(getCompleteWeekRange("2026-01-05", "2026-01-30", parseLocalIsoDate("2026-01-30"))).toEqual({
      startDate: "2026-01-05",
      endDate: "2026-01-25",
    });
  });

  it("returns null when no complete week is available", () => {
    expect(getCompleteWeekRange("2026-01-07", "2026-01-09", parseLocalIsoDate("2026-01-10"))).toBeNull();
  });

  it("excludes a sunday still in progress from the current week", () => {
    expect(getCompleteWeekRange("2026-01-05", "2026-01-18", parseLocalIsoDate("2026-01-18"))).toEqual({
      startDate: "2026-01-05",
      endDate: "2026-01-11",
    });
  });

  it("uses the UTC calendar when the reference instant carries another offset", () => {
    expect(
      getCompleteWeekRange(
        "2025-12-29",
        "2026-01-11",
        new Date("2026-01-05T00:30:00+02:00"),
      ),
    ).toBeNull();
  });
});
