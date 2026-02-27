import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useOnboarding } from "./useOnboarding";
import { listProjectsDirect, listTeamsDirect, resolvePatOrganizationScopeDirect } from "../adoClient";

vi.mock("../adoClient", () => ({
  listProjectsDirect: vi.fn(),
  listTeamsDirect: vi.fn(),
  resolvePatOrganizationScopeDirect: vi.fn(),
}));

describe("useOnboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function setPatAndSubmit(result: { current: ReturnType<typeof useOnboarding> }, value = "abcdefghijklmnopqrstuvwxyz123456"): Promise<void> {
    await act(async () => {
      result.current.actions.setPatInput(value);
    });
    await act(async () => {
      await result.current.actions.submitPat();
    });
  }

  it("validates PAT format before network calls", async () => {
    const { result } = renderHook(() => useOnboarding());

    await act(async () => {
      await result.current.actions.submitPat();
    });
    expect(result.current.state.err).toContain("PAT requis");
    expect(result.current.state.patInput).toBe("");

    await act(async () => {
      result.current.actions.setPatInput("abcd efgh");
    });
    await act(async () => {
      await result.current.actions.submitPat();
    });
    expect(result.current.state.err).toContain("Format PAT invalide");
    expect(result.current.state.patInput).toBe("");

    await act(async () => {
      result.current.actions.setPatInput("short-pat");
    });
    await act(async () => {
      await result.current.actions.submitPat();
    });
    expect(result.current.state.err).toContain("PAT invalide");
    expect(result.current.state.patInput).toBe("");
    expect(resolvePatOrganizationScopeDirect).not.toHaveBeenCalled();
  });

  it("resolves global PAT and preselects first accessible organization", async () => {
    vi.mocked(resolvePatOrganizationScopeDirect).mockResolvedValue({
      displayName: "User",
      memberId: "id-1",
      organizations: [
        { id: "1", name: "org-a" },
        { id: "2", name: "org-b" },
      ],
      scope: "global",
    });

    const { result } = renderHook(() => useOnboarding());

    await setPatAndSubmit(result);

    expect(result.current.state.step).toBe("org");
    expect(result.current.state.selectedOrg).toBe("org-a");
    expect(result.current.state.orgs).toHaveLength(2);
    expect(result.current.state.orgHint).toContain("PAT global");
  });

  it("falls back to manual organization input for local PAT", async () => {
    vi.mocked(resolvePatOrganizationScopeDirect).mockResolvedValue({
      displayName: "User",
      memberId: "id-1",
      organizations: [],
      scope: "local",
    });

    const { result } = renderHook(() => useOnboarding());

    await setPatAndSubmit(result);

    expect(result.current.state.step).toBe("org");
    expect(result.current.state.orgs).toEqual([]);
    expect(result.current.state.selectedOrg).toBe("");
    expect(result.current.state.orgHint).toContain("PAT local");
  });

  it("uses fallback hint when scope discovery fails", async () => {
    vi.mocked(resolvePatOrganizationScopeDirect).mockRejectedValue(new Error("profile unavailable"));

    const { result } = renderHook(() => useOnboarding());

    await setPatAndSubmit(result);

    expect(result.current.state.step).toBe("org");
    expect(result.current.state.orgHint).toContain("Verification automatique impossible");
    expect(result.current.state.userName).toBe("Utilisateur");
  });

  it("clears manual org input when local PAT org validation fails", async () => {
    vi.mocked(resolvePatOrganizationScopeDirect).mockResolvedValue({
      displayName: "User",
      memberId: "id-1",
      organizations: [],
      scope: "local",
    });
    vi.mocked(listProjectsDirect).mockRejectedValue(new Error("Organisation inaccessible"));

    const { result } = renderHook(() => useOnboarding());

    await setPatAndSubmit(result);

    await act(async () => {
      result.current.actions.setSelectedOrg("mauvaise-org");
    });
    await act(async () => {
      const moved = await result.current.actions.goToProjects();
      expect(moved).toBe(false);
    });

    expect(result.current.state.selectedOrg).toBe("");
    expect(result.current.state.err).toContain("Organisation inaccessible");
  });

  it("goes to projects and preselects first project on success", async () => {
    vi.mocked(resolvePatOrganizationScopeDirect).mockResolvedValue({
      displayName: "User",
      memberId: "id-1",
      organizations: [{ id: "1", name: "org-a" }],
      scope: "global",
    });
    vi.mocked(listProjectsDirect).mockResolvedValue([
      { id: "p1", name: "Projet A" },
      { id: "p2", name: "Projet B" },
    ]);

    const { result } = renderHook(() => useOnboarding());

    await setPatAndSubmit(result);

    await act(async () => {
      const moved = await result.current.actions.goToProjects();
      expect(moved).toBe(true);
    });

    expect(result.current.state.step).toBe("projects");
    expect(result.current.state.projects).toHaveLength(2);
    expect(result.current.state.selectedProject).toBe("Projet A");
  });

  it("requires org and PAT when going to projects", async () => {
    const { result } = renderHook(() => useOnboarding());

    await act(async () => {
      const moved = await result.current.actions.goToProjects();
      expect(moved).toBe(false);
    });
    expect(result.current.state.err).toContain("organisation");

    await act(async () => {
      result.current.actions.setSelectedOrg("org-a");
    });
    await act(async () => {
      const moved = await result.current.actions.goToProjects();
      expect(moved).toBe(false);
    });
    expect(result.current.state.err).toContain("PAT manquant");
    expect(result.current.state.step).toBe("pat");
  });

  it("goes to teams and preselects first team on success", async () => {
    vi.mocked(resolvePatOrganizationScopeDirect).mockResolvedValue({
      displayName: "User",
      memberId: "id-1",
      organizations: [{ id: "1", name: "org-a" }],
      scope: "global",
    });
    vi.mocked(listProjectsDirect).mockResolvedValue([{ id: "p1", name: "Projet A" }]);
    vi.mocked(listTeamsDirect).mockResolvedValue([
      { id: "t1", name: "Zulu-Team" },
      { id: "t2", name: "Alpha-Core" },
    ]);

    const { result } = renderHook(() => useOnboarding());

    await setPatAndSubmit(result);
    await act(async () => {
      await result.current.actions.goToProjects();
    });

    await act(async () => {
      const moved = await result.current.actions.goToTeams();
      expect(moved).toBe(true);
    });

    expect(result.current.state.step).toBe("teams");
    expect(result.current.state.teams).toHaveLength(2);
    expect(result.current.state.selectedTeam).toBe("Alpha-Core");
  });

  it("preselects the first alphabetic team shown in team step", async () => {
    vi.mocked(resolvePatOrganizationScopeDirect).mockResolvedValue({
      displayName: "User",
      memberId: "id-1",
      organizations: [{ id: "1", name: "org-a" }],
      scope: "global",
    });
    vi.mocked(listProjectsDirect).mockResolvedValue([{ id: "p1", name: "Projet A" }]);
    vi.mocked(listTeamsDirect).mockResolvedValue([
      { id: "t1", name: "Zulu-Team" },
      { id: "t2", name: "Beta-Dev" },
      { id: "t3", name: "Alpha-Core" },
    ]);

    const { result } = renderHook(() => useOnboarding());

    await setPatAndSubmit(result);
    await act(async () => {
      await result.current.actions.goToProjects();
    });
    await act(async () => {
      const moved = await result.current.actions.goToTeams();
      expect(moved).toBe(true);
    });

    expect(result.current.state.step).toBe("teams");
    expect(result.current.state.selectedTeam).toBe("Alpha-Core");
  });

  it("maps non-Error failures in project/team listing to string messages", async () => {
    vi.mocked(resolvePatOrganizationScopeDirect).mockResolvedValue({
      displayName: "User",
      memberId: "id-1",
      organizations: [{ id: "1", name: "org-a" }],
      scope: "global",
    });
    vi.mocked(listProjectsDirect).mockRejectedValue("raw-project-error");

    const { result } = renderHook(() => useOnboarding());
    await setPatAndSubmit(result);
    await act(async () => {
      const moved = await result.current.actions.goToProjects();
      expect(moved).toBe(false);
    });
    expect(result.current.state.err).toContain("raw-project-error");

    vi.mocked(listProjectsDirect).mockResolvedValue([{ id: "p1", name: "Projet A" }]);
    vi.mocked(listTeamsDirect).mockRejectedValue("raw-team-error");
    await act(async () => {
      await result.current.actions.goToProjects();
    });
    await act(async () => {
      result.current.actions.setSelectedProject("Projet A");
    });
    await act(async () => {
      const moved = await result.current.actions.goToTeams();
      expect(moved).toBe(false);
    });
    expect(result.current.state.err).toContain("raw-team-error");
  });

  it("requires organization and project before loading teams", async () => {
    const { result } = renderHook(() => useOnboarding());

    await act(async () => {
      const moved = await result.current.actions.goToTeams();
      expect(moved).toBe(false);
    });
    expect(result.current.state.err).toContain("projet");
  });

  it("requires PAT when org/project are selected before loading teams", async () => {
    const { result } = renderHook(() => useOnboarding());

    await act(async () => {
      result.current.actions.setSelectedOrg("org-a");
      result.current.actions.setSelectedProject("Projet A");
    });

    await act(async () => {
      const moved = await result.current.actions.goToTeams();
      expect(moved).toBe(false);
    });

    expect(result.current.state.err).toContain("PAT manquant");
    expect(result.current.state.step).toBe("pat");
  });

  it("validates selected team before entering simulation", async () => {
    const { result } = renderHook(() => useOnboarding());

    let moved = false;
    act(() => {
      moved = result.current.actions.goToSimulation();
    });
    expect(moved).toBe(false);
    expect(result.current.state.err).toContain("quipe");

    act(() => {
      result.current.actions.setSelectedTeam("Equipe Alpha");
    });
    act(() => {
      moved = result.current.actions.goToSimulation();
    });
    expect(moved).toBe(true);
    expect(result.current.state.step).toBe("simulation");
  });

  it("validates selected team before entering portfolio", async () => {
    const { result } = renderHook(() => useOnboarding());

    let moved = false;
    act(() => {
      moved = result.current.actions.goToPortfolio();
    });
    expect(moved).toBe(false);
    expect(result.current.state.err).toContain("quipe");

    act(() => {
      result.current.actions.setSelectedTeam("Equipe Alpha");
    });
    act(() => {
      moved = result.current.actions.goToPortfolio();
    });
    expect(moved).toBe(true);
    expect(result.current.state.step).toBe("portfolio");
  });

  it("supports step navigation, back behavior and disconnect reset", async () => {
    const { result } = renderHook(() => useOnboarding());

    act(() => {
      result.current.actions.goToStep("org");
    });
    expect(result.current.state.step).toBe("org");
    expect(result.current.state.backLabel).toContain("PAT");

    act(() => result.current.actions.goBack());
    expect(result.current.state.step).toBe("pat");

    act(() => {
      result.current.actions.goToStep("projects");
    });
    act(() => result.current.actions.goBack());
    expect(result.current.state.step).toBe("org");

    act(() => {
      result.current.actions.goToStep("teams");
    });
    act(() => result.current.actions.goBack());
    expect(result.current.state.step).toBe("projects");

    act(() => {
      result.current.actions.goToStep("simulation");
    });
    expect(result.current.state.backLabel).toBe("Changer équipe");
    act(() => result.current.actions.goBack());
    expect(result.current.state.step).toBe("teams");

    act(() => {
      result.current.actions.setSelectedTeam("Equipe Alpha");
    });
    act(() => {
      result.current.actions.goToPortfolio();
    });
    expect(result.current.state.backLabel).toBe("Changer équipe");
    act(() => result.current.actions.goBack());
    expect(result.current.state.step).toBe("teams");

    act(() => {
      result.current.actions.setPatInput("pat");
      result.current.actions.setSelectedOrg("org-a");
      result.current.actions.setSelectedProject("Projet A");
      result.current.actions.setSelectedTeam("Equipe Alpha");
      result.current.actions.disconnect();
    });

    expect(result.current.state.step).toBe("pat");
    expect(result.current.state.patInput).toBe("");
    expect(result.current.state.selectedOrg).toBe("");
    expect(result.current.state.selectedProject).toBe("");
    expect(result.current.state.selectedTeam).toBe("");
    expect(result.current.state.orgs).toEqual([]);
    expect(result.current.state.projects).toEqual([]);
    expect(result.current.state.teams).toEqual([]);
  });
});
