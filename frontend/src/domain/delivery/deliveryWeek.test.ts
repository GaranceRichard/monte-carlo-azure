import { describe, expect, it } from "vitest";
import { createDeliveryInstant } from "./deliveryEvent";
import {
  createDeliveryWeek,
  DELIVERY_CALENDAR_POLICY,
  deliveryWeekOf,
  nextDeliveryWeek,
} from "./deliveryWeek";

describe("delivery calendar policy", () => {
  it("publishes the single explicit ISO week and timezone policy", () => {
    expect(DELIVERY_CALENDAR_POLICY).toEqual({
      calendar: "iso-8601",
      timeZone: "UTC",
      weekStartsOn: "monday",
      weekIdentity: "monday-date",
    });
    expect(Object.isFrozen(DELIVERY_CALENDAR_POLICY)).toBe(true);
  });

  it("groups every instant from monday through sunday under its ISO monday", () => {
    expect(deliveryWeekOf(createDeliveryInstant("2026-01-05T00:00:00Z"))).toBe("2026-01-05");
    expect(deliveryWeekOf(createDeliveryInstant("2026-01-11T23:59:59.999Z"))).toBe("2026-01-05");
    expect(deliveryWeekOf(createDeliveryInstant("2026-01-12T00:00:00Z"))).toBe("2026-01-12");
  });

  it("uses the ISO week-year across the civil year boundary", () => {
    expect(deliveryWeekOf(createDeliveryInstant("2021-01-01T12:00:00Z"))).toBe("2020-12-28");
    expect(deliveryWeekOf(createDeliveryInstant("2021-01-03T23:59:59.999Z"))).toBe("2020-12-28");
    expect(deliveryWeekOf(createDeliveryInstant("2021-01-04T00:00:00Z"))).toBe("2021-01-04");
  });

  it("applies UTC rather than the source offset at a week boundary", () => {
    expect(deliveryWeekOf(createDeliveryInstant("2026-01-05T00:30:00+02:00"))).toBe("2025-12-29");
    expect(deliveryWeekOf(createDeliveryInstant("2026-01-04T23:30:00-02:00"))).toBe("2026-01-05");
  });

  it("constructs and advances valid week values without local calendar arithmetic", () => {
    expect(createDeliveryWeek("2020-12-28")).toBe("2020-12-28");
    expect(createDeliveryWeek("2021-01-03T23:30:00-02:00")).toBe("2021-01-04");
    expect(nextDeliveryWeek(createDeliveryWeek("2020-12-28"))).toBe("2021-01-04");
  });

  it("rejects dates that are not valid UTC ISO mondays", () => {
    expect(() => createDeliveryWeek("2026-01-06")).toThrow("lundi ISO en UTC");
    expect(() => createDeliveryWeek("2026-02-30")).toThrow("lundi ISO en UTC");
    expect(() => createDeliveryWeek("2026-01-05T12:00:00")).toThrow("fuseau explicite");
  });
});
