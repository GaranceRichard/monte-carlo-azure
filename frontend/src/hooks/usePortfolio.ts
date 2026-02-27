import { useMemo, useState } from "react";
import { getTeamOptionsDirect } from "../adoClient";
import { nWeeksAgo, today } from "../date";
import { runSimulationForecast } from "./simulationForecastService";
import type { ForecastMode, NamedEntity } from "../types";
import { sortTeams } from "../utils/teamSort";

export type TeamPortfolioConfig = {
  teamName: string;
  workItemTypeOptions: string[];
  statesByType: Record<string, string[]>;
  types: string[];
  doneStates: string[];
};

type UsePortfolioParams = {
  selectedOrg: string;
  selectedProject: string;
  teams: NamedEntity[];
  pat: string;
};

export function usePortfolio({ selectedOrg, selectedProject, teams, pat }: UsePortfolioParams) {
  const [startDate, setStartDate] = useState<string>(nWeeksAgo(26));
  const [endDate, setEndDate] = useState<string>(today());
  const [simulationMode, setSimulationMode] = useState<ForecastMode>("backlog_to_weeks");
  const [includeZeroWeeks, setIncludeZeroWeeks] = useState<boolean>(true);
  const [backlogSize, setBacklogSize] = useState<number>(120);
  const [targetWeeks, setTargetWeeks] = useState<number>(12);
  const [nSims, setNSims] = useState<number>(20000);

  const [loadingReport, setLoadingReport] = useState<boolean>(false);
  const [err, setErr] = useState<string>("");
  const [modalErr, setModalErr] = useState<string>("");
  const [teamConfigs, setTeamConfigs] = useState<TeamPortfolioConfig[]>([]);

  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [modalLoading, setModalLoading] = useState<boolean>(false);
  const [modalTeamName, setModalTeamName] = useState<string>("");
  const [modalTypeOptions, setModalTypeOptions] = useState<string[]>([]);
  const [modalStatesByType, setModalStatesByType] = useState<Record<string, string[]>>({});
  const [modalTypes, setModalTypes] = useState<string[]>([]);
  const [modalDoneStates, setModalDoneStates] = useState<string[]>([]);

  const sortedTeams = useMemo(() => sortTeams(teams), [teams]);
  const availableTeamNames = useMemo(() => {
    const selected = new Set(teamConfigs.map((t) => t.teamName));
    return sortedTeams.map((t) => t.name || "").filter((name) => !!name && !selected.has(name));
  }, [sortedTeams, teamConfigs]);

  const modalAvailableStates = useMemo(() => {
    const out = new Set<string>();
    for (const type of modalTypes) {
      for (const state of modalStatesByType[type] || []) out.add(state);
    }
    return Array.from(out).sort();
  }, [modalTypes, modalStatesByType]);

  const canGenerate = teamConfigs.length > 0 && !loadingReport;

  async function loadTeamOptions(teamName: string): Promise<void> {
    if (!teamName) {
      setModalTypeOptions([]);
      setModalStatesByType({});
      setModalTypes([]);
      setModalDoneStates([]);
      return;
    }
    setModalLoading(true);
    try {
      const options = await getTeamOptionsDirect(selectedOrg, selectedProject, teamName, pat);
      setModalTypeOptions(options.workItemTypes);
      setModalStatesByType(options.statesByType || {});
      setModalTypes([]);
      setModalDoneStates([]);
    } catch (e: unknown) {
      setModalErr(e instanceof Error ? e.message : String(e));
    } finally {
      setModalLoading(false);
    }
  }

  function openAddModal(): void {
    setErr("");
    setModalErr("");
    const initialTeam = availableTeamNames[0] ?? "";
    setModalTeamName(initialTeam);
    setModalTypeOptions([]);
    setModalStatesByType({});
    setModalTypes([]);
    setModalDoneStates([]);
    setShowAddModal(true);
    void loadTeamOptions(initialTeam);
  }

  function closeAddModal(): void {
    setShowAddModal(false);
    setModalErr("");
  }

  function onModalTeamNameChange(teamName: string): void {
    setModalErr("");
    setModalTeamName(teamName);
    void loadTeamOptions(teamName);
  }

  function toggleModalType(ticketType: string, checked: boolean): void {
    setModalErr("");
    setModalTypes((prevTypes) => {
      const nextTypes = checked ? [...prevTypes, ticketType] : prevTypes.filter((t) => t !== ticketType);
      const allowed = new Set(nextTypes.flatMap((type) => modalStatesByType[type] || []));
      setModalDoneStates((prevStates) => prevStates.filter((state) => allowed.has(state)));
      return nextTypes;
    });
  }

  function toggleModalState(state: string, checked: boolean): void {
    setModalErr("");
    setModalDoneStates((prev) => (checked ? [...prev, state] : prev.filter((s) => s !== state)));
  }

  function validateAddModal(): void {
    if (!modalTeamName) {
      setModalErr("Selectionnez une equipe.");
      return;
    }
    if (modalTypes.length === 0 || modalDoneStates.length === 0) {
      setModalErr("Selectionnez au moins un type et un etat.");
      return;
    }
    if (teamConfigs.some((cfg) => cfg.teamName === modalTeamName)) {
      setModalErr("Cette equipe est deja ajoutee.");
      return;
    }

    setTeamConfigs((prev) => [
      ...prev,
      {
        teamName: modalTeamName,
        workItemTypeOptions: modalTypeOptions,
        statesByType: modalStatesByType,
        types: [...modalTypes],
        doneStates: [...modalDoneStates],
      },
    ]);
    setShowAddModal(false);
    setModalErr("");
  }

  function removeTeam(teamName: string): void {
    setTeamConfigs((prev) => prev.filter((cfg) => cfg.teamName !== teamName));
  }

  async function handleGenerateReport(): Promise<void> {
    if (!teamConfigs.length) return;

    setErr("");
    setLoadingReport(true);
    try {
      const sections = [];
      for (const cfg of teamConfigs) {
        const forecast = await runSimulationForecast({
          selectedOrg,
          selectedProject,
          selectedTeam: cfg.teamName,
          pat,
          startDate,
          endDate,
          doneStates: cfg.doneStates,
          types: cfg.types,
          includeZeroWeeks,
          simulationMode,
          backlogSize,
          targetWeeks,
          nSims,
          capacityPercent: 100,
          reducedCapacityWeeks: 0,
        });
        sections.push({
          selectedTeam: cfg.teamName,
          simulationMode,
          includeZeroWeeks,
          backlogSize: Number(backlogSize),
          targetWeeks: Number(targetWeeks),
          nSims: Number(nSims),
          resultKind: forecast.result.result_kind,
          riskScore: forecast.result.risk_score,
          distribution: forecast.result.result_distribution,
          weeklyThroughput: forecast.weeklyThroughput,
          displayPercentiles: forecast.result.result_percentiles,
        });
      }

      const { exportPortfolioPrintReport } = await import("../components/steps/portfolioPrintReport");
      exportPortfolioPrintReport({
        selectedProject,
        startDate,
        endDate,
        sections,
      });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingReport(false);
    }
  }

  return {
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    simulationMode,
    setSimulationMode,
    includeZeroWeeks,
    setIncludeZeroWeeks,
    backlogSize,
    setBacklogSize,
    targetWeeks,
    setTargetWeeks,
    nSims,
    setNSims,
    loadingReport,
    err,
    modalErr,
    teamConfigs,
    showAddModal,
    modalLoading,
    modalTeamName,
    modalTypeOptions,
    modalTypes,
    modalDoneStates,
    availableTeamNames,
    modalAvailableStates,
    canGenerate,
    openAddModal,
    closeAddModal,
    onModalTeamNameChange,
    toggleModalType,
    toggleModalState,
    validateAddModal,
    removeTeam,
    handleGenerateReport,
  };
}
