import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PortfolioStep from "./PortfolioStep";
import { usePortfolio } from "../../hooks/usePortfolio";

vi.mock("../../hooks/usePortfolio", () => ({
  usePortfolio: vi.fn(),
}));

function basePortfolioMock() {
  return {
    err: "",
    reportErrors: [],
    clearReportErrors: vi.fn(),
    startDate: "2026-01-01",
    setStartDate: vi.fn(),
    endDate: "2026-02-01",
    setEndDate: vi.fn(),
    simulationMode: "backlog_to_weeks" as const,
    setSimulationMode: vi.fn(),
    backlogSize: 120,
    setBacklogSize: vi.fn(),
    targetWeeks: 12,
    setTargetWeeks: vi.fn(),
    nSims: 20000,
    setNSims: vi.fn(),
    includeZeroWeeks: true,
    setIncludeZeroWeeks: vi.fn(),
    arrimageRate: 100,
    setArrimageRate: vi.fn(),
    teamConfigs: [],
    availableTeamNames: [],
    openAddModal: vi.fn(),
    loadingReport: false,
    canGenerate: false,
    handleGenerateReport: vi.fn(),
    reportProgressLabel: "",
    generationProgress: { done: 0, total: 0 },
    showAddModal: false,
    modalErr: "",
    modalLoading: false,
    modalTeamName: "",
    modalTypeOptions: [],
    modalTypes: [],
    modalDoneStates: [],
    modalHasQuickFilterConfig: false,
    modalAvailableStates: [],
    closeAddModal: vi.fn(),
    onModalTeamNameChange: vi.fn(),
    applyModalQuickFilterConfig: vi.fn(),
    toggleModalType: vi.fn(),
    toggleModalState: vi.fn(),
    validateAddModal: vi.fn(),
    removeTeam: vi.fn(),
  };
}

describe("PortfolioStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows arrimage input for both one-team and multi-team portfolios", () => {
    vi.mocked(usePortfolio).mockReturnValue({
      ...basePortfolioMock(),
      teamConfigs: [{ teamName: "Team A", workItemTypeOptions: [], statesByType: {}, types: [], doneStates: [] }],
    });

    const { rerender } = render(
      <PortfolioStep selectedOrg="Org A" selectedProject="Project A" teams={[{ name: "Team A" }]} pat="pat" />,
    );

    expect(screen.getByLabelText("Taux d'arrimage")).toBeTruthy();

    vi.mocked(usePortfolio).mockReturnValue({
      ...basePortfolioMock(),
      teamConfigs: [
        { teamName: "Team A", workItemTypeOptions: [], statesByType: {}, types: [], doneStates: [] },
        { teamName: "Team B", workItemTypeOptions: [], statesByType: {}, types: [], doneStates: [] },
      ],
    });
    rerender(<PortfolioStep selectedOrg="Org A" selectedProject="Project A" teams={[{ name: "Team A" }]} pat="pat" />);

    expect(screen.getByLabelText("Taux d'arrimage")).toBeTruthy();
  });

  it("updates arrimage rate through input", () => {
    const setArrimageRate = vi.fn();
    vi.mocked(usePortfolio).mockReturnValue({
      ...basePortfolioMock(),
      arrimageRate: 80,
      setArrimageRate,
      teamConfigs: [
        { teamName: "Team A", workItemTypeOptions: [], statesByType: {}, types: [], doneStates: [] },
        { teamName: "Team B", workItemTypeOptions: [], statesByType: {}, types: [], doneStates: [] },
      ],
    });

    render(<PortfolioStep selectedOrg="Org A" selectedProject="Project A" teams={[{ name: "Team A" }]} pat="pat" />);

    fireEvent.change(screen.getByLabelText("Taux d'arrimage"), { target: { value: "75" } });
    expect(setArrimageRate).toHaveBeenCalledWith(75);
  });
});
