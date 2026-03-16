import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppFlowContent } from "./AppFlowContent";

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
  default: () => <div>TeamStep</div>,
}));
vi.mock("./components/steps/SimulationStep", () => ({
  default: () => <div>SimulationStep</div>,
}));
vi.mock("./components/steps/PortfolioStep", () => ({
  default: () => <div>PortfolioStep</div>,
}));

function buildProps() {
  return {
    onboardingState: {
      step: "unexpected",
      err: "",
      patInput: "",
      serverUrlInput: "",
      loading: false,
      userName: "User",
      orgs: [],
      orgHint: "",
      selectedOrg: "",
      deploymentTarget: "cloud",
      projects: [],
      selectedProject: "",
      teams: [],
      selectedTeam: "",
      sessionPat: "",
      sessionServerUrl: "",
    },
    onboardingActions: {
      setPatInput: vi.fn(),
      setServerUrlInput: vi.fn(),
      submitPat: vi.fn(),
      setSelectedOrg: vi.fn(),
      goToProjects: vi.fn(),
      setSelectedProject: vi.fn(),
      goToTeams: vi.fn(),
      setSelectedTeam: vi.fn(),
    },
    simulation: {},
    runtime: { isDemoMode: false },
    onGoToSimulation: vi.fn(),
    onGoToPortfolio: vi.fn(),
  };
}

describe("AppFlowContent", () => {
  it("returns null for an unknown onboarding step", () => {
    const { container } = render(<AppFlowContent {...(buildProps() as never)} />);

    expect(container.firstChild).toBeNull();
  });
});
