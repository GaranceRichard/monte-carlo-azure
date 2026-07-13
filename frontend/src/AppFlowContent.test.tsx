import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppFlowContent } from "./AppFlowContent";
import type { OnboardingActions, OnboardingState } from "./hooks/useOnboarding";
import type { SimulationViewModel } from "./hooks/useSimulation";

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
  default: ({ demoMode }: { demoMode?: boolean }) => <div>{demoMode ? "TeamStep demo" : "TeamStep normal"}</div>,
}));
vi.mock("./components/steps/SimulationStep", () => ({
  default: () => <div>SimulationStep</div>,
}));
vi.mock("./components/steps/PortfolioStep", () => ({
  default: () => <div>PortfolioStep</div>,
}));

function buildProps() {
  const onboardingState: OnboardingState = {
    step: "pat",
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
    backLabel: "",
  };

  const onboardingActions: OnboardingActions = {
    setPatInput: vi.fn(),
    setServerUrlInput: vi.fn(),
    submitPat: vi.fn(),
    setSelectedOrg: vi.fn(),
    goToProjects: vi.fn(),
    setSelectedProject: vi.fn(),
    goToTeams: vi.fn(),
    setSelectedTeam: vi.fn(),
    goToSimulation: vi.fn(),
    goToPortfolio: vi.fn(),
    goToStep: vi.fn(),
    goBack: vi.fn(),
    disconnect: vi.fn(),
    setErr: vi.fn(),
  };

  const simulation: SimulationViewModel = {
    selectedOrg: "",
    selectedProject: "",
    loading: false,
    hasLaunchedOnce: false,
    loadingTeamOptions: false,
    loadingStageMessage: "",
    err: "",
    startDate: "",
    setStartDate: vi.fn(),
    endDate: "",
    setEndDate: vi.fn(),
    simulationMode: "backlog_to_weeks",
    setSimulationMode: vi.fn(),
    includeZeroWeeks: false,
    setIncludeZeroWeeks: vi.fn(),
    sampleStats: null,
    warning: "",
    notice: "",
    backlogSize: 0,
    setBacklogSize: vi.fn(),
    targetWeeks: 0,
    setTargetWeeks: vi.fn(),
    nSims: 0,
    setNSims: vi.fn(),
    workItemTypeOptions: [],
    types: [],
    setTypes: vi.fn(),
    filteredDoneStateOptions: [],
    doneStates: [],
    setDoneStates: vi.fn(),
    hasQuickFilterConfig: false,
    applyQuickFilterConfig: vi.fn(),
    result: null,
    displayPercentiles: {},
    activeChartTab: "cycle_time",
    setActiveChartTab: vi.fn(),
    throughputData: [],
    cycleTimeDaysData: [],
    cycleTimeTrendData: [],
    cycleTimeSummary: {
      itemCount: 0,
      averageDays: null,
      hasSufficientData: false,
    },
    mcHistData: [],
    probabilityCurveData: [],
    tooltipBaseProps: {
      cursor: false,
      contentStyle: {},
      labelStyle: {},
      itemStyle: {},
    },
    simulationHistory: [],
    applyHistoryEntry: vi.fn(),
    clearSimulationHistory: vi.fn(),
    exportThroughputCsv: vi.fn(),
    runForecast: vi.fn(),
    resetSimulationResults: vi.fn(),
    resetForTeamSelection: vi.fn(),
    resetAll: vi.fn(),
  };

  return {
    onboardingState,
    onboardingActions,
    simulation,
    runtime: { isDemoMode: false },
    onGoToSimulation: vi.fn(),
    onGoToPortfolio: vi.fn(),
  };
}

describe("AppFlowContent", () => {
  it("renders the PAT step when onboarding is at the pat stage", () => {
    const { container } = render(<AppFlowContent {...buildProps()} />);

    expect(container).toHaveTextContent("PatStep");
  });

  it("returns null for an unexpected onboarding step at runtime", () => {
    const props = buildProps();
    const { container } = render(
      <AppFlowContent
        {...props}
        onboardingState={{
          ...props.onboardingState,
          step: "unexpected" as never,
        }}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it.each([
    [false, "TeamStep normal"],
    [true, "TeamStep demo"],
  ])("passes demo mode %s to the team step", (isDemoMode, expectedText) => {
    const props = buildProps();
    const { container } = render(
      <AppFlowContent
        {...props}
        runtime={{ isDemoMode }}
        onboardingState={{ ...props.onboardingState, step: "teams" }}
      />,
    );

    expect(container).toHaveTextContent(expectedText);
  });
});
