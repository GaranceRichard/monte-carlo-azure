import { describe, expect, it } from "vitest";
import { discretePercentiles } from "./simulation";

describe("discrete simulation percentiles", () => {
  it("omits backlog ranks that censorship makes unreachable", () => {
    expect(
      discretePercentiles([521, 521], "backlog_to_weeks", [50, 70, 90], 3),
    ).toEqual({ P50: 521 });
  });

  it("requires the total backlog population and uses exact small-population ranks", () => {
    expect(() =>
      discretePercentiles([3, 4, 6, 8, 10], "backlog_to_weeks", [50, 70, 90])
    ).toThrow("population totale");
    expect(
      discretePercentiles([1, 9], "backlog_to_weeks", [50, 70, 90], 2),
    ).toEqual({ P50: 1, P70: 9, P90: 9 });
  });

  it("rejects modes and population arguments outside their business contract", () => {
    expect(() =>
      discretePercentiles([1, 2, 3], "invalid" as never, [50, 70, 90])
    ).toThrow("mode de simulation invalide");
    expect(() =>
      discretePercentiles([1, 2, 3], "weeks_to_items", [50, 70, 90], 3)
    ).toThrow("totalCount est interdit");
  });
});
