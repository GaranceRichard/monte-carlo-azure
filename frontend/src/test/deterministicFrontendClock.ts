import type { FrontendClock } from "../ports/clock";

/** Return one controlled timestamp and record every clock read. */
export class DeterministicFrontendClock implements FrontendClock {
  calls = 0;

  constructor(private readonly instant: string) {}

  now(): string {
    this.calls += 1;
    return this.instant;
  }
}
