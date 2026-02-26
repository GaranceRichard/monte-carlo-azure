import { fireEvent, render, screen } from "@testing-library/react";
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

vi.mock("./components/steps/PatStep", () => ({
  default: () => <div>PatStep</div>,
}));
vi.mock("./components/steps/OrgStep", () => ({
  default: () => <div>OrgStep</div>,
}));
vi.mock("./components/steps/ProjectStep", () => ({
  default: () => <div>ProjectStep</div>,
}));
vi.mock("./components/steps/TeamStep", () => ({
  default: ({ onContinue }: { onContinue: () => void }) => (
    <button type="button" onClick={onContinue}>
      Continue Team
    </button>
  ),
}));
vi.mock("./components/steps/SimulationStep", () => ({
  default: () => <div>SimulationStep</div>,
}));

function buildState(step: "pat" | "org" | "projects" | "teams" | "simulation") {
  return {
    patInput: "",
    sessionPat: "pat-token-abcdefghijklmnopqrstuvwxyz",
    step,
    loading: false,
    err: "",
    userName: "User",
    orgHint: "",
    orgs: [{ id: "1", name: "org-a" }],
    selectedOrg: "org-a",
    projects: [{ id: "p1", name: "Projet A" }],
    selectedProject: "Projet A",
    teams: [{ id: "t1", name: "Equipe A" }],
    selectedTeam: "Equipe A",
    backLabel: "Retour",
  };
}

function buildActions(goToSimulationReturn = true) {
  return {
    setPatInput: vi.fn(),
    setSelectedOrg: vi.fn(),
    setSelectedProject: vi.fn(),
    setSelectedTeam: vi.fn(),
    submitPat: vi.fn(async () => {}),
    goToProjects: vi.fn(async () => true),
    goToTeams: vi.fn(async () => true),
    goToSimulation: vi.fn(() => goToSimulationReturn),
    goToStep: vi.fn(),
    goBack: vi.fn(),
    disconnect: vi.fn(),
    setErr: vi.fn(),
  };
}

describe("App", () => {
  it("calls resetForTeamSelection only when goToSimulation succeeds", () => {
    const actionsOk = buildActions(true);
    const resetForTeamSelection = vi.fn();
    vi.mocked(useOnboarding).mockReturnValue({
      state: buildState("teams"),
      actions: actionsOk,
    } as never);
    vi.mocked(useSimulation).mockReturnValue({
      resetForTeamSelection,
      resetAll: vi.fn(),
    } as never);

    const { rerender } = render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Continue Team" }));
    expect(actionsOk.goToSimulation).toHaveBeenCalledTimes(1);
    expect(resetForTeamSelection).toHaveBeenCalledTimes(1);

    const actionsKo = buildActions(false);
    vi.mocked(useOnboarding).mockReturnValue({
      state: buildState("teams"),
      actions: actionsKo,
    } as never);
    rerender(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Continue Team" }));
    expect(actionsKo.goToSimulation).toHaveBeenCalledTimes(1);
    expect(resetForTeamSelection).toHaveBeenCalledTimes(1);
  });

  it("handles stepper navigation actions", () => {
    const actions = buildActions();
    const resetAll = vi.fn();
    vi.mocked(useOnboarding).mockReturnValue({
      state: { ...buildState("projects"), orgs: [] },
      actions,
    } as never);
    vi.mocked(useSimulation).mockReturnValue({
      resetForTeamSelection: vi.fn(),
      resetAll,
    } as never);

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /1\.\s*Connexion/i }));
    expect(actions.disconnect).toHaveBeenCalledTimes(1);
    expect(resetAll).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /2\.\s*Organisation/i }));
    expect(actions.goToStep).toHaveBeenCalledWith("org");
  });

  it("toggles theme and updates document attribute", () => {
    vi.mocked(useOnboarding).mockReturnValue({
      state: buildState("pat"),
      actions: buildActions(),
    } as never);
    vi.mocked(useSimulation).mockReturnValue({
      resetForTeamSelection: vi.fn(),
      resetAll: vi.fn(),
    } as never);

    render(<App />);
    const toggle = screen.getByRole("button", { name: /Nuit|Jour/i });
    const initialTheme = document.documentElement.getAttribute("data-theme");
    fireEvent.click(toggle);
    const nextTheme = document.documentElement.getAttribute("data-theme");
    expect(nextTheme).not.toBe(initialTheme);
  });
});
