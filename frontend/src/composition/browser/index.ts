import { BrowserClock } from "../../adapters/browser/clock";
import type { FrontendClock } from "../../ports/clock";

export type BrowserComposition = Readonly<{
  clock: FrontendClock;
}>;

/** Compose the real browser adapters consumed by the React shell. */
export function createBrowserComposition(): BrowserComposition {
  return {
    clock: new BrowserClock(),
  };
}
