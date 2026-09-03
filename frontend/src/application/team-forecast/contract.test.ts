import { describe, expect, it } from "vitest";
import contractSource from "./contract.ts?raw";
import implementationSource from "./localTeamForecast.ts?raw";
import publicApiSource from "./index.ts?raw";
import { localTeamForecast } from ".";
import type { TeamForecast } from ".";

describe("TeamForecast application contract", () => {
  it("exposes the stable forecast operations through its public entrypoint", () => {
    const forecast: TeamForecast = localTeamForecast;

    expect(Object.keys(forecast).sort()).toEqual([
      "fetchTeamThroughput",
      "runSimulationForecast",
      "simulateForecastFromSamples",
    ]);
    expect(Object.isFrozen(forecast)).toBe(true);
  });

  it("keeps the contract and implementation independent from React hooks", () => {
    const applicationSource = `${contractSource}\n${implementationSource}\n${publicApiSource}`;

    expect(applicationSource).not.toMatch(/from\s+["']react(?:-dom)?["']/);
    expect(applicationSource).not.toContain("/hooks/");
    expect(applicationSource).not.toContain("simulationForecastService");
    expect(applicationSource).not.toContain("simulationForecastCore");
    expect(implementationSource).not.toContain("Date.now");
    expect(implementationSource).not.toContain("new Date(");
  });
});
