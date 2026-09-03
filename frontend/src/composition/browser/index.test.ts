import { afterEach, describe, expect, it, vi } from "vitest";
import { BrowserClock } from "../../adapters/browser/clock";
import { DeterministicFrontendClock } from "../../test/deterministicFrontendClock";
import { createBrowserComposition } from ".";

const CONTROLLED_INSTANT = "2026-08-26T14:30:45.123Z";

afterEach(() => {
  vi.useRealTimers();
});

describe("frontend clock composition", () => {
  it("returns the controlled timestamp and records each deterministic read", () => {
    const clock = new DeterministicFrontendClock(CONTROLLED_INSTANT);

    expect(clock.now()).toBe(CONTROLLED_INSTANT);
    expect(clock.now()).toBe(CONTROLLED_INSTANT);
    expect(clock.calls).toBe(2);
  });

  it("reads the current browser instant as UTC ISO", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(CONTROLLED_INSTANT));

    expect(new BrowserClock().now()).toBe(CONTROLLED_INSTANT);
  });

  it("composes the real browser clock for the React bootstrap", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(CONTROLLED_INSTANT));

    const composition = createBrowserComposition();

    expect(composition.clock).toBeInstanceOf(BrowserClock);
    expect(composition.clock.now()).toBe(CONTROLLED_INSTANT);
  });
});
