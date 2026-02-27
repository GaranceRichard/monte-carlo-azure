import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { buildQuickFiltersScopeKey, readStoredQuickFilters } from "../storage";
import { useSimulationQuickFilters } from "./useSimulationQuickFilters";

describe("useSimulationQuickFilters", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("persists valid quick filters with deduplicated values", () => {
    const scopeKey = buildQuickFiltersScopeKey("Org", "Projet", "Team A");

    renderHook(() =>
      useSimulationQuickFilters({
        step: "simulation",
        selectedOrg: "Org",
        selectedProject: "Projet",
        selectedTeam: "Team A",
        workItemTypeOptions: ["Bug", "Task"],
        statesByType: { Bug: ["Done", "Closed"], Task: ["Done"] },
        types: ["Bug", "Bug", "Task"],
        doneStates: ["Done", "Done", "Closed", "Blocked"],
      }),
    );

    expect(readStoredQuickFilters(scopeKey)).toEqual({
      types: ["Bug", "Task"],
      doneStates: ["Done", "Closed"],
    });
  });

  it("does not persist filters outside simulation step", () => {
    const scopeKey = buildQuickFiltersScopeKey("Org", "Projet", "Team A");

    renderHook(() =>
      useSimulationQuickFilters({
        step: "teams",
        selectedOrg: "Org",
        selectedProject: "Projet",
        selectedTeam: "Team A",
        workItemTypeOptions: ["Bug"],
        statesByType: { Bug: ["Done"] },
        types: ["Bug"],
        doneStates: ["Done"],
      }),
    );

    expect(readStoredQuickFilters(scopeKey)).toBeNull();
  });

  it("does not persist when validated selection is incomplete", () => {
    const scopeKey = buildQuickFiltersScopeKey("Org", "Projet", "Team A");

    renderHook(() =>
      useSimulationQuickFilters({
        step: "simulation",
        selectedOrg: "Org",
        selectedProject: "Projet",
        selectedTeam: "Team A",
        workItemTypeOptions: ["Bug"],
        statesByType: { Bug: ["Done"] },
        types: ["Unknown"],
        doneStates: ["Done"],
      }),
    );
    expect(readStoredQuickFilters(scopeKey)).toBeNull();

    renderHook(() =>
      useSimulationQuickFilters({
        step: "simulation",
        selectedOrg: "Org",
        selectedProject: "Projet",
        selectedTeam: "Team A",
        workItemTypeOptions: ["Bug"],
        statesByType: { Bug: ["Done"] },
        types: ["Bug"],
        doneStates: ["Closed"],
      }),
    );
    expect(readStoredQuickFilters(scopeKey)).toBeNull();
  });
});
