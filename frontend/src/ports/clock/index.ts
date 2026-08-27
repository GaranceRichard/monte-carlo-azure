/** Provide the timestamp attached to one frontend forecast execution. */
export interface FrontendClock {
  now(): string;
}
