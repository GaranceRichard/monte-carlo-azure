import { describe, expect, it } from "vitest";
import contractSource from "./contract.ts?raw";
import publicApiSource from "./index.ts?raw";
import type { TeamPortfolioConfig } from ".";

describe("portfolio configuration application contract", () => {
  it("exposes the team configuration through its public entrypoint", () => {
    const configuration: TeamPortfolioConfig = {
      teamName: "Alpha",
      workItemTypeOptions: ["User Story"],
      statesByType: { "User Story": ["Done"] },
      types: ["User Story"],
      doneStates: ["Done"],
    };

    expect(configuration).toEqual({
      teamName: "Alpha",
      workItemTypeOptions: ["User Story"],
      statesByType: { "User Story": ["Done"] },
      types: ["User Story"],
      doneStates: ["Done"],
    });
    expect(publicApiSource).toContain('from "./contract"');
  });

  it("keeps the contract independent from React and hooks", () => {
    const applicationSource = `${contractSource}\n${publicApiSource}`;

    expect(applicationSource).not.toMatch(/from\s+["']react(?:-dom)?["']/);
    expect(applicationSource).not.toContain("/hooks/");
  });
});
