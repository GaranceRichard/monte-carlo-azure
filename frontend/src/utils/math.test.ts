import { describe, expect, it } from "vitest";
import { clamp, toSafeNumber } from "./math";

describe("math utils", () => {
  it("toSafeNumber returns numeric value when finite", () => {
    expect(toSafeNumber("12", 0)).toBe(12);
    expect(toSafeNumber(3.5, 0)).toBe(3.5);
  });

  it("toSafeNumber returns fallback when not finite", () => {
    expect(toSafeNumber("abc", 42)).toBe(42);
    expect(toSafeNumber("Infinity", 7)).toBe(7);
  });

  it("clamp bounds value between min and max", () => {
    expect(clamp(5, 1, 10)).toBe(5);
    expect(clamp(-1, 1, 10)).toBe(1);
    expect(clamp(99, 1, 10)).toBe(10);
  });
});
