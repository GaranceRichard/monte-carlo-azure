import { describe, expect, it } from "vitest";
import {
  DEMO_CONFIG,
  DEMO_PORTFOLIO_TEAM_CONFIGS,
  DEMO_TEAM_WEEKLY,
  getDemoThroughputSamples,
  getDemoWeeklyThroughput,
} from "./demoData";

describe("demoData", () => {
  it("returns defensive copies for demo weekly throughput", () => {
    const weekly = getDemoWeeklyThroughput("Alpha");
    expect(weekly).toEqual(DEMO_TEAM_WEEKLY.Alpha);

    weekly[0]!.throughput = 999;

    expect(getDemoWeeklyThroughput("Alpha")[0]?.throughput).not.toBe(999);
  });

  it("returns defensive copies for demo throughput samples and empty arrays for unknown teams", () => {
    const samples = getDemoThroughputSamples("Alpha");
    expect(samples.length).toBeGreaterThan(0);

    samples[0] = 999;

    expect(getDemoThroughputSamples("Alpha")[0]).not.toBe(999);
    expect(getDemoThroughputSamples("Unknown")).toEqual([]);
    expect(getDemoWeeklyThroughput("Unknown")).toEqual([]);
  });

  it("exposes coherent demo portfolio and app defaults", () => {
    expect(DEMO_CONFIG.selectedTeam).toBe("Alpha");
    expect(DEMO_PORTFOLIO_TEAM_CONFIGS.map((team) => team.teamName)).toEqual(
      DEMO_CONFIG.teams.map((team) => team.name),
    );
    expect(DEMO_PORTFOLIO_TEAM_CONFIGS[0]?.types).toEqual(DEMO_CONFIG.defaultTypes);
    expect(DEMO_PORTFOLIO_TEAM_CONFIGS[0]?.doneStates).toEqual(DEMO_CONFIG.defaultDoneStates);
  });
});
