import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import App from "./App";
import { useOnboarding } from "./hooks/useOnboarding";
import { useSimulation } from "./hooks/useSimulation";

vi.mock("./hooks/useOnboarding", () => ({
  useOnboarding: vi.fn(),
}));

vi.mock("./hooks/useSimulation", () => ({
  useSimulation: vi.fn(),
}));

vi.mock("./components/steps/SimulationStep", () => ({
  default: () => null,
}));

function buildOnboardingState(orgs) {
  return {
    patInput: "",
    sessionPat: "pat",
    step: "org",
    loading: false,
    err: "",
    userName: "User",
    orgHint: "",
    orgs,
    selectedOrg: orgs[0]?.name ?? "",
    projects: [],
    selectedProject: "",
    teams: [],
    selectedTeam: "",
    backLabel: "",
  };
}

function buildOnboardingActions(disconnect) {
  return {
    setPatInput: vi.fn(),
    setSelectedOrg: vi.fn(),
    setSelectedProject: vi.fn(),
    setSelectedTeam: vi.fn(),
    submitPat: vi.fn(async () => {}),
    goToProjects: vi.fn(async () => true),
    goToTeams: vi.fn(async () => true),
    goToSimulation: vi.fn(() => true),
    goToStep: vi.fn(),
    goBack: vi.fn(),
    disconnect,
    setErr: vi.fn(),
  };
}

describe("App backspace disconnect on global org step", () => {
  it("disconnects and returns to login flow when pressing Backspace in global PAT org step", () => {
    const disconnect = vi.fn();
    const resetAll = vi.fn();

    vi.mocked(useOnboarding).mockReturnValue({
      state: buildOnboardingState([{ id: "1", name: "org-a" }]),
      actions: buildOnboardingActions(disconnect),
    });
    vi.mocked(useSimulation).mockReturnValue({
      resetAll,
      resetForTeamSelection: vi.fn(),
    });

    render(<App />);
    fireEvent.keyDown(window, { key: "Backspace" });

    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(resetAll).toHaveBeenCalledTimes(1);
  });

  it("does not disconnect on Backspace when org step is local PAT manual input", () => {
    const disconnect = vi.fn();
    const resetAll = vi.fn();

    vi.mocked(useOnboarding).mockReturnValue({
      state: buildOnboardingState([]),
      actions: buildOnboardingActions(disconnect),
    });
    vi.mocked(useSimulation).mockReturnValue({
      resetAll,
      resetForTeamSelection: vi.fn(),
    });

    render(<App />);
    fireEvent.keyDown(window, { key: "Backspace" });

    expect(disconnect).not.toHaveBeenCalled();
    expect(resetAll).not.toHaveBeenCalled();
  });

  it("goes back to organization step on Backspace in project step", () => {
    const disconnect = vi.fn();
    const goBack = vi.fn();

    vi.mocked(useOnboarding).mockReturnValue({
      state: {
        ...buildOnboardingState([{ id: "1", name: "org-a" }]),
        step: "projects",
        projects: [{ id: "p1", name: "Projet A" }],
        selectedProject: "Projet A",
      },
      actions: {
        ...buildOnboardingActions(disconnect),
        goBack,
      },
    });
    vi.mocked(useSimulation).mockReturnValue({
      resetAll: vi.fn(),
      resetForTeamSelection: vi.fn(),
    });

    render(<App />);
    fireEvent.keyDown(window, { key: "Backspace" });

    expect(goBack).toHaveBeenCalledTimes(1);
    expect(disconnect).not.toHaveBeenCalled();
  });

  it("goes back to project step on Backspace in team step", () => {
    const disconnect = vi.fn();
    const goBack = vi.fn();

    vi.mocked(useOnboarding).mockReturnValue({
      state: {
        ...buildOnboardingState([{ id: "1", name: "org-a" }]),
        step: "teams",
        projects: [{ id: "p1", name: "Projet A" }],
        selectedProject: "Projet A",
        teams: [{ id: "t1", name: "Equipe Alpha" }],
        selectedTeam: "Equipe Alpha",
      },
      actions: {
        ...buildOnboardingActions(disconnect),
        goBack,
      },
    });
    vi.mocked(useSimulation).mockReturnValue({
      resetAll: vi.fn(),
      resetForTeamSelection: vi.fn(),
    });

    render(<App />);
    fireEvent.keyDown(window, { key: "Backspace" });

    expect(goBack).toHaveBeenCalledTimes(1);
    expect(disconnect).not.toHaveBeenCalled();
  });

  it("goes back to team step on Backspace in simulation step", () => {
    const disconnect = vi.fn();
    const goBack = vi.fn();

    vi.mocked(useOnboarding).mockReturnValue({
      state: {
        ...buildOnboardingState([{ id: "1", name: "org-a" }]),
        step: "simulation",
        projects: [{ id: "p1", name: "Projet A" }],
        selectedProject: "Projet A",
        teams: [{ id: "t1", name: "Equipe Alpha" }],
        selectedTeam: "Equipe Alpha",
      },
      actions: {
        ...buildOnboardingActions(disconnect),
        goBack,
      },
    });
    vi.mocked(useSimulation).mockReturnValue({
      resetAll: vi.fn(),
      resetForTeamSelection: vi.fn(),
    });

    render(<App />);
    fireEvent.keyDown(window, { key: "Backspace" });

    expect(goBack).toHaveBeenCalledTimes(1);
    expect(disconnect).not.toHaveBeenCalled();
  });
});
