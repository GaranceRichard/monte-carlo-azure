import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTeamOptionsDirect } from "../adoClient";
import { buildQuickFiltersScopeKey, writeStoredQuickFilters } from "../storage";
import { useTeamOptions } from "./useTeamOptions";

vi.mock("../adoClient", () => ({
  getTeamOptionsDirect: vi.fn(),
}));

describe("useTeamOptions quick filters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("auto applies stored quick filters when they are valid for the loaded team options", async () => {
    vi.mocked(getTeamOptionsDirect).mockResolvedValue({
      workItemTypes: ["Bug", "Task"],
      statesByType: { Bug: ["Done", "Closed"], Task: ["Done"] },
    });
    const scopeKey = buildQuickFiltersScopeKey("Org", "Projet", "Team A");
    writeStoredQuickFilters(scopeKey, { types: ["Bug"], doneStates: ["Done"] });

    const setTypes = vi.fn();
    const setDoneStates = vi.fn();
    const onTeamOptionsReset = vi.fn();

    const { result } = renderHook(() =>
      useTeamOptions({
        step: "simulation",
        selectedOrg: "Org",
        selectedProject: "Projet",
        selectedTeam: "Team A",
        pat: "pat",
        quickFiltersScopeKey: scopeKey,
        setTypes,
        setDoneStates,
        onTeamOptionsReset,
      }),
    );

    await waitFor(() => {
      expect(result.current.loadingTeamOptions).toBe(false);
    });

    expect(onTeamOptionsReset).toHaveBeenCalledTimes(1);
    expect(setTypes).toHaveBeenCalledWith(["Bug"]);
    expect(setDoneStates).toHaveBeenCalledWith(["Done"]);
    expect(result.current.hasQuickFilterConfig).toBe(true);
  });

  it("manually reapplies a valid quick config", async () => {
    vi.mocked(getTeamOptionsDirect).mockResolvedValue({
      workItemTypes: ["Bug"],
      statesByType: { Bug: ["Done", "Closed"] },
    });
    const scopeKey = buildQuickFiltersScopeKey("Org", "Projet", "Team A");
    writeStoredQuickFilters(scopeKey, { types: ["Bug"], doneStates: ["Done"] });
    const setTypes = vi.fn();
    const setDoneStates = vi.fn();
    const onTeamOptionsReset = vi.fn();

    const { result } = renderHook(() =>
      useTeamOptions({
        step: "simulation",
        selectedOrg: "Org",
        selectedProject: "Projet",
        selectedTeam: "Team A",
        pat: "pat",
        quickFiltersScopeKey: scopeKey,
        setTypes,
        setDoneStates,
        onTeamOptionsReset,
      }),
    );
    await waitFor(() => {
      expect(result.current.loadingTeamOptions).toBe(false);
    });

    setTypes.mockClear();
    setDoneStates.mockClear();
    act(() => {
      result.current.applyQuickFilterConfig();
    });
    expect(setTypes).toHaveBeenCalledWith(["Bug"]);
    expect(setDoneStates).toHaveBeenCalledWith(["Done"]);
  });

  it("exposes manual quick config action but does not apply invalid stored filters", async () => {
    vi.mocked(getTeamOptionsDirect).mockResolvedValue({
      workItemTypes: ["Bug"],
      statesByType: { Bug: ["Done"] },
    });
    const scopeKey = buildQuickFiltersScopeKey("Org", "Projet", "Team A");
    writeStoredQuickFilters(scopeKey, { types: ["Task"], doneStates: ["Closed"] });

    const setTypes = vi.fn();
    const setDoneStates = vi.fn();
    const onTeamOptionsReset = vi.fn();

    const { result } = renderHook(() =>
      useTeamOptions({
        step: "simulation",
        selectedOrg: "Org",
        selectedProject: "Projet",
        selectedTeam: "Team A",
        pat: "pat",
        quickFiltersScopeKey: scopeKey,
        setTypes,
        setDoneStates,
        onTeamOptionsReset,
      }),
    );

    await waitFor(() => {
      expect(result.current.loadingTeamOptions).toBe(false);
    });
    expect(result.current.hasQuickFilterConfig).toBe(true);
    expect(setTypes).not.toHaveBeenCalled();
    expect(setDoneStates).not.toHaveBeenCalled();

    act(() => {
      result.current.applyQuickFilterConfig();
    });
    expect(setTypes).not.toHaveBeenCalled();
    expect(setDoneStates).not.toHaveBeenCalled();
  });

  it("resets team options and delegates reset callback", async () => {
    vi.mocked(getTeamOptionsDirect).mockResolvedValue({
      workItemTypes: ["Bug"],
      statesByType: { Bug: ["Done"] },
    });
    const onTeamOptionsReset = vi.fn();
    const setTypes = vi.fn();
    const setDoneStates = vi.fn();

    const { result } = renderHook(() =>
      useTeamOptions({
        step: "simulation",
        selectedOrg: "Org",
        selectedProject: "Projet",
        selectedTeam: "Team A",
        pat: "pat",
        quickFiltersScopeKey: buildQuickFiltersScopeKey("Org", "Projet", "Team A"),
        setTypes,
        setDoneStates,
        onTeamOptionsReset,
      }),
    );
    await waitFor(() => {
      expect(result.current.loadingTeamOptions).toBe(false);
    });

    act(() => {
      result.current.resetTeamOptions();
    });
    expect(result.current.workItemTypeOptions).toEqual(["User Story", "Product Backlog Item", "Bug"]);
    expect(result.current.statesByType).toEqual({});
    expect(onTeamOptionsReset).toHaveBeenCalledTimes(2);
  });

  it("uses default fallback and applies matching quick filters when team options fetch fails", async () => {
    vi.mocked(getTeamOptionsDirect).mockRejectedValue(new Error("ADO down"));
    const scopeKey = buildQuickFiltersScopeKey("Org", "Projet", "Team A");
    writeStoredQuickFilters(scopeKey, { types: ["Bug"], doneStates: ["Done"] });
    const setTypes = vi.fn();
    const setDoneStates = vi.fn();
    const onTeamOptionsReset = vi.fn();

    const { result } = renderHook(() =>
      useTeamOptions({
        step: "simulation",
        selectedOrg: "Org",
        selectedProject: "Projet",
        selectedTeam: "Team A",
        pat: "pat",
        quickFiltersScopeKey: scopeKey,
        setTypes,
        setDoneStates,
        onTeamOptionsReset,
      }),
    );
    await waitFor(() => {
      expect(result.current.loadingTeamOptions).toBe(false);
    });

    expect(result.current.workItemTypeOptions).toEqual(["User Story", "Product Backlog Item", "Bug"]);
    expect(result.current.statesByType["Bug"]).toEqual(["Done", "Closed", "Resolved"]);
    expect(result.current.hasQuickFilterConfig).toBe(true);
    expect(setTypes).toHaveBeenCalledWith(["Bug"]);
    expect(setDoneStates).toHaveBeenCalledWith(["Done"]);
    expect(onTeamOptionsReset).toHaveBeenCalledTimes(1);
  });

  it("falls back to defaults without applying filters when fetch fails and no quick config exists", async () => {
    vi.mocked(getTeamOptionsDirect).mockRejectedValue(new Error("ADO down"));
    const setTypes = vi.fn();
    const setDoneStates = vi.fn();

    const { result } = renderHook(() =>
      useTeamOptions({
        step: "simulation",
        selectedOrg: "Org",
        selectedProject: "Projet",
        selectedTeam: "Team A",
        pat: "pat",
        quickFiltersScopeKey: buildQuickFiltersScopeKey("Org", "Projet", "Team A"),
        setTypes,
        setDoneStates,
        onTeamOptionsReset: vi.fn(),
      }),
    );
    await waitFor(() => {
      expect(result.current.loadingTeamOptions).toBe(false);
    });

    expect(result.current.workItemTypeOptions).toEqual(["User Story", "Product Backlog Item", "Bug"]);
    expect(result.current.hasQuickFilterConfig).toBe(false);
    expect(setTypes).not.toHaveBeenCalled();
    expect(setDoneStates).not.toHaveBeenCalled();
  });

  it("does not auto-apply invalid stored quick config after fetch failure", async () => {
    vi.mocked(getTeamOptionsDirect).mockRejectedValue(new Error("ADO down"));
    const scopeKey = buildQuickFiltersScopeKey("Org", "Projet", "Team A");
    writeStoredQuickFilters(scopeKey, { types: ["Task"], doneStates: ["Closed"] });
    const setTypes = vi.fn();
    const setDoneStates = vi.fn();

    const { result } = renderHook(() =>
      useTeamOptions({
        step: "simulation",
        selectedOrg: "Org",
        selectedProject: "Projet",
        selectedTeam: "Team A",
        pat: "pat",
        quickFiltersScopeKey: scopeKey,
        setTypes,
        setDoneStates,
        onTeamOptionsReset: vi.fn(),
      }),
    );
    await waitFor(() => {
      expect(result.current.loadingTeamOptions).toBe(false);
    });

    expect(result.current.hasQuickFilterConfig).toBe(true);
    expect(setTypes).not.toHaveBeenCalled();
    expect(setDoneStates).not.toHaveBeenCalled();
  });

  it("does not fetch team options outside simulation step", async () => {
    const { result } = renderHook(() =>
      useTeamOptions({
        step: "teams",
        selectedOrg: "Org",
        selectedProject: "Projet",
        selectedTeam: "Team A",
        pat: "pat",
        quickFiltersScopeKey: buildQuickFiltersScopeKey("Org", "Projet", "Team A"),
        setTypes: vi.fn(),
        setDoneStates: vi.fn(),
        onTeamOptionsReset: vi.fn(),
      }),
    );

    expect(vi.mocked(getTeamOptionsDirect)).not.toHaveBeenCalled();
    expect(result.current.loadingTeamOptions).toBe(false);
  });
});
