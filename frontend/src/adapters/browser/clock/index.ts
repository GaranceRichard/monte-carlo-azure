import type { FrontendClock } from "../../../ports/clock";

/** Read the current instant from the browser JavaScript clock. */
export class BrowserClock implements FrontendClock {
  now(): string {
    return new Date().toISOString();
  }
}
