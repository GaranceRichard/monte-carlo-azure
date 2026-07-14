import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PortfolioStep from "./PortfolioStep";
import { usePortfolio } from "../../hooks/usePortfolio";
import type { PortfolioComparisonDiagnostic } from "../../utils/portfolioComparisonDiagnostic";

vi.mock("../../hooks/usePortfolio", () => ({
  usePortfolio: vi.fn(),
}));

function basePortfolioMock() {
  return {
    demoMode: false,
    err: "",
    reportErrors: [],
    portfolioComparisonDiagnostic: null,
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
    alignmentRate: 100,
    setAlignmentRate: vi.fn(),
    pilotReference: null,
    setPilotReference: vi.fn(),
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
      <PortfolioStep selectedOrg="Org A" selectedProject="Project A" teams={[{ name: "Team A" }]} pat="pat" serverUrl="" />,
    );

    expect(screen.getByLabelText("Taux d'arrimage")).toBeTruthy();

    vi.mocked(usePortfolio).mockReturnValue({
      ...basePortfolioMock(),
      teamConfigs: [
        { teamName: "Team A", workItemTypeOptions: [], statesByType: {}, types: [], doneStates: [] },
        { teamName: "Team B", workItemTypeOptions: [], statesByType: {}, types: [], doneStates: [] },
      ],
    });
    rerender(<PortfolioStep selectedOrg="Org A" selectedProject="Project A" teams={[{ name: "Team A" }]} pat="pat" serverUrl="" />);

    expect(screen.getByLabelText("Taux d'arrimage")).toBeTruthy();
  });

  it("updates arrimage rate through input", () => {
    const setAlignmentRate = vi.fn();
    vi.mocked(usePortfolio).mockReturnValue({
      ...basePortfolioMock(),
      alignmentRate: 80,
      setAlignmentRate,
      teamConfigs: [
        { teamName: "Team A", workItemTypeOptions: [], statesByType: {}, types: [], doneStates: [] },
        { teamName: "Team B", workItemTypeOptions: [], statesByType: {}, types: [], doneStates: [] },
      ],
    });

    render(<PortfolioStep selectedOrg="Org A" selectedProject="Project A" teams={[{ name: "Team A" }]} pat="pat" serverUrl="" />);

    fireEvent.change(screen.getByLabelText("Taux d'arrimage"), { target: { value: "75" } });
    expect(setAlignmentRate).toHaveBeenCalledWith(75);
  });

  it("offers no default pilot reference and forwards every explicit user choice", () => {
    const setPilotReference = vi.fn();
    vi.mocked(usePortfolio).mockReturnValue({
      ...basePortfolioMock(),
      setPilotReference,
    });

    render(<PortfolioStep selectedOrg="Org A" selectedProject="Project A" teams={[]} pat="pat" serverUrl="" />);

    const select = screen.getByLabelText("Scénario de référence de pilotage — facultatif") as HTMLSelectElement;
    expect(select.value).toBe("");
    expect(Array.from(select.options).map((option) => option.textContent)).toEqual([
      "Aucun",
      "Indépendant",
      "Arrimé",
      "Friction",
      "Historique corrélé",
    ]);
    ["independent", "aligned", "friction", "correlated", ""].forEach((value) => {
      fireEvent.change(select, { target: { value } });
    });
    expect(setPilotReference.mock.calls.map(([value]) => value)).toEqual([
      "independent",
      "aligned",
      "friction",
      "correlated",
      null,
    ]);
  });

  it("passes the raw simulations input value without forcing 20000", () => {
    const setNSims = vi.fn();
    vi.mocked(usePortfolio).mockReturnValue({
      ...basePortfolioMock(),
      nSims: 20000,
      setNSims,
      teamConfigs: [{ teamName: "Team A", workItemTypeOptions: [], statesByType: {}, types: [], doneStates: [] }],
      canGenerate: true,
    });

    render(<PortfolioStep selectedOrg="Org A" selectedProject="Project A" teams={[{ name: "Team A" }]} pat="pat" serverUrl="" />);

    const input = screen.getByLabelText("Nombre de simulations") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "30000" } });

    expect(setNSims).toHaveBeenCalledWith("30000");
  });

  it("disables report generation when simulations count is not valid", () => {
    vi.mocked(usePortfolio).mockReturnValue({
      ...basePortfolioMock(),
      nSims: "",
      teamConfigs: [{ teamName: "Team A", workItemTypeOptions: [], statesByType: {}, types: [], doneStates: [] }],
      canGenerate: false,
    });

    render(<PortfolioStep selectedOrg="Org A" selectedProject="Project A" teams={[{ name: "Team A" }]} pat="pat" serverUrl="" />);

    expect((screen.getByRole("button", { name: /G.n.rer rapport portefeuille/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("hides the add-team action in demo mode", () => {
    vi.mocked(usePortfolio).mockReturnValue({
      ...basePortfolioMock(),
      demoMode: true,
      teamConfigs: [{ teamName: "Alpha", workItemTypeOptions: [], statesByType: {}, types: ["Bug"], doneStates: ["Done"] }],
    });

    render(<PortfolioStep demoMode selectedOrg="Org A" selectedProject="Project A" teams={[{ name: "Alpha" }]} pat="pat" serverUrl="" />);

    expect(screen.queryByRole("button", { name: /Ajouter équipe/i })).toBeNull();
  });
  it("renders degraded report state and delegates its user actions", () => {
    const clearReportErrors = vi.fn();
    const removeTeam = vi.fn();
    const handleGenerateReport = vi.fn();
    vi.mocked(usePortfolio).mockReturnValue({
      ...basePortfolioMock(),
      err: "Echec du chargement",
      reportErrors: [{ teamName: "Alpha", message: "Indisponible" }],
      clearReportErrors,
      removeTeam,
      handleGenerateReport,
      canGenerate: true,
      teamConfigs: [{ teamName: "Alpha", workItemTypeOptions: [], statesByType: {}, types: ["Bug"], doneStates: ["Done"] }],
    });
    render(<PortfolioStep selectedOrg="Org A" selectedProject="Project A" teams={[{ name: "Alpha" }]} pat="pat" serverUrl="" />);
    expect(screen.getByText("Echec du chargement")).toBeTruthy();
    expect(screen.getByRole("listitem")).toHaveTextContent("Alpha: Indisponible");
    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));
    fireEvent.click(screen.getByRole("button", { name: "Retirer" }));
    fireEvent.click(screen.getByRole("button", { name: /G.n.rer rapport portefeuille/i }));
    expect(clearReportErrors).toHaveBeenCalledOnce();
    expect(removeTeam).toHaveBeenCalledWith("Alpha");
    expect(handleGenerateReport).toHaveBeenCalledOnce();
  });

  it("supports adding a team through its accessible modal controls", () => {
    const onModalTeamNameChange = vi.fn();
    const toggleModalType = vi.fn();
    const toggleModalState = vi.fn();
    const validateAddModal = vi.fn();
    vi.mocked(usePortfolio).mockReturnValue({
      ...basePortfolioMock(),
      showAddModal: true,
      availableTeamNames: ["Beta"],
      modalTeamName: "Beta",
      modalTypeOptions: ["Bug"],
      modalTypes: ["Bug"],
      modalDoneStates: ["Done"],
      modalAvailableStates: ["Done"],
      onModalTeamNameChange,
      toggleModalType,
      toggleModalState,
      validateAddModal,
    });
    render(<PortfolioStep selectedOrg="Org A" selectedProject="Project A" teams={[{ name: "Beta" }]} pat="pat" serverUrl="" />);
    fireEvent.change(screen.getByLabelText("Équipe"), { target: { value: "Beta" } });
    fireEvent.click(screen.getByLabelText("Bug"));
    fireEvent.click(screen.getByLabelText("Done"));
    fireEvent.click(screen.getByRole("button", { name: "Valider" }));
    expect(onModalTeamNameChange).toHaveBeenCalledWith("Beta");
    expect(toggleModalType).toHaveBeenCalledWith("Bug", false);
    expect(toggleModalState).toHaveBeenCalledWith("Done", false);
    expect(validateAddModal).toHaveBeenCalledOnce();
  });

  it("updates every general criterion and shows the volume horizon when that scenario is selected", () => {
    const setStartDate = vi.fn();
    const setEndDate = vi.fn();
    const setIncludeZeroWeeks = vi.fn();
    const setSimulationMode = vi.fn();
    const setBacklogSize = vi.fn();
    const setTargetWeeks = vi.fn();
    vi.mocked(usePortfolio).mockReturnValue({
      ...basePortfolioMock(),
      setStartDate,
      setEndDate,
      setIncludeZeroWeeks,
      setSimulationMode,
      setBacklogSize,
      setTargetWeeks,
      simulationMode: "weeks_to_items",
    });

    render(<PortfolioStep selectedOrg="Org A" selectedProject="Project A" teams={[]} pat="pat" serverUrl="" />);

    fireEvent.change(screen.getByLabelText("Date de début"), { target: { value: "2026-02-02" } });
    fireEvent.change(screen.getByLabelText("Date de fin"), { target: { value: "2026-03-01" } });
    fireEvent.change(screen.getByLabelText("Semaines à 0"), { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText("Mode"), { target: { value: "backlog_to_weeks" } });
    fireEvent.change(screen.getByLabelText("Semaines"), { target: { value: "6" } });

    expect(setStartDate).toHaveBeenCalledWith("2026-02-02");
    expect(setEndDate).toHaveBeenCalledWith("2026-03-01");
    expect(setIncludeZeroWeeks).toHaveBeenCalledWith(false);
    expect(setSimulationMode).toHaveBeenCalledWith("backlog_to_weeks");
    expect(setTargetWeeks).toHaveBeenCalledWith(6);
    expect(screen.queryByLabelText("Items")).toBeNull();
  });

  it("opens the enabled add-team action and renders loading, quick filter and disabled state feedback", () => {
    const openAddModal = vi.fn();
    const closeAddModal = vi.fn();
    const applyModalQuickFilterConfig = vi.fn();
    vi.mocked(usePortfolio).mockReturnValue({
      ...basePortfolioMock(),
      availableTeamNames: ["Beta"],
      openAddModal,
      showAddModal: true,
      modalLoading: true,
      modalHasQuickFilterConfig: true,
      modalTypes: [],
      modalAvailableStates: ["Done"],
      closeAddModal,
      applyModalQuickFilterConfig,
      reportProgressLabel: "Equipe Alpha",
      generationProgress: { done: 1, total: 2 },
    });

    const { rerender } = render(<PortfolioStep selectedOrg="Org A" selectedProject="Project A" teams={[]} pat="pat" serverUrl="" />);

    fireEvent.click(screen.getByRole("button", { name: /Ajouter équipe/i }));
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(openAddModal).toHaveBeenCalledOnce();
    expect(closeAddModal).toHaveBeenCalledOnce();
    expect(screen.getByText("Chargement...")).toBeTruthy();
    expect(screen.getByText(/Sélectionnez d'abord/i)).toBeTruthy();
    expect((screen.getByLabelText("Done") as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText("Equipe Alpha (1/2)")).toBeTruthy();

    vi.mocked(usePortfolio).mockReturnValue({
      ...basePortfolioMock(),
      availableTeamNames: ["Beta"],
      showAddModal: true,
      modalHasQuickFilterConfig: true,
      modalTypes: ["Bug"],
      modalAvailableStates: ["Done"],
      applyModalQuickFilterConfig,
    });
    rerender(<PortfolioStep selectedOrg="Org A" selectedProject="Project A" teams={[]} pat="pat" serverUrl="" />);
    fireEvent.click(screen.getByRole("button", { name: "Configuration rapide" }));
    expect(applyModalQuickFilterConfig).toHaveBeenCalledOnce();
  });

  it("normalizes empty numeric controls and renders report and modal error states", () => {
    const setIncludeZeroWeeks = vi.fn();
    const setBacklogSize = vi.fn();
    const setAlignmentRate = vi.fn();
    vi.mocked(usePortfolio).mockReturnValue({
      ...basePortfolioMock(),
      setIncludeZeroWeeks,
      setBacklogSize,
      setAlignmentRate,
      loadingReport: true,
      showAddModal: true,
      modalErr: "Filtres indisponibles",
      availableTeamNames: [],
    });
    render(<PortfolioStep selectedOrg="Org A" selectedProject="Project A" teams={[]} pat="pat" serverUrl="" />);

    fireEvent.change(screen.getByLabelText("Semaines à 0"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Items"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Taux d'arrimage"), { target: { value: "" } });
    expect(setIncludeZeroWeeks).toHaveBeenCalledWith(true);
    expect(setBacklogSize).toHaveBeenCalledWith(1);
    expect(setAlignmentRate).toHaveBeenCalledWith(0);
    expect(screen.getByRole("button", { name: /Génération du rapport/i })).toBeTruthy();
    expect(screen.getByText("Filtres indisponibles")).toBeTruthy();
    expect(screen.getByRole("option", { name: /Toutes les équipes/i })).toBeTruthy();
  });

  it("keeps the comparative diagnostic in the report model without rendering it in the UI", () => {
    const portfolioComparisonDiagnostic: PortfolioComparisonDiagnostic = {
      historicalData: { quality: "insufficient", observedFacts: [], teamFindings: [] },
      simulationStability: [],
      hypothesisCredibility: [],
      significantRisks: [],
      comparisonConfidence: { level: "insufficient", statement: "Confiance comparative insuffisante." },
      preferredScenario: null,
      conclusion: "Preuves insuffisantes pour privilégier une hypothèse.",
    };
    vi.mocked(usePortfolio).mockReturnValue({ ...basePortfolioMock(), portfolioComparisonDiagnostic });

    render(<PortfolioStep selectedOrg="Org A" selectedProject="Project A" teams={[]} pat="pat" serverUrl="" />);

    expect(screen.queryByRole("heading", { name: "Comparaison des hypothèses" })).toBeNull();
    expect(screen.queryByText("Confiance comparative insuffisante.")).toBeNull();
  });

});
