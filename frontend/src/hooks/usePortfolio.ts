import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { getTeamOptionsDirect } from "../adoClient";
import { nWeeksAgo, today } from "../date";
import type { ForecastMode, NamedEntity } from "../types";
import { sortTeams } from "../utils/teamSort";
import { buildQuickFiltersScopeKey, readStoredQuickFilters, writeStoredQuickFilters } from "../storage";
import { getPortfolioErrorMessage, usePortfolioReport, type TeamPortfolioConfig } from "./usePortfolioReport";
import type { AdoErrorContext } from "../adoErrors";

export type { TeamPortfolioConfig } from "./usePortfolioReport";

type UsePortfolioParams = {
  selectedOrg: string;
  selectedProject: string;
  teams: NamedEntity[];
  pat: string;
};

type TeamOptionsCacheEntry = {
  workItemTypes: string[];
  statesByType: Record<string, string[]>;
};

type QuickFilterSelection = {
  types: string[];
  doneStates: string[];
};

function getValidQuickFilterSelection(
  workItemTypeOptions: string[],
  statesByType: Record<string, string[]>,
  quickFilters: QuickFilterSelection,
): QuickFilterSelection {
  const allowedTypes = new Set(workItemTypeOptions);
  const types = quickFilters.types.filter((type, idx, arr) => allowedTypes.has(type) && arr.indexOf(type) === idx);
  const allowedStates = new Set(types.flatMap((type) => statesByType[type] || []));
  const doneStates = quickFilters.doneStates.filter(
    (state, idx, arr) => allowedStates.has(state) && arr.indexOf(state) === idx,
  );
  return { types, doneStates };
}

export function usePortfolio({ selectedOrg, selectedProject, teams, pat }: UsePortfolioParams) {
  const [startDate, setStartDate] = useState<string>(nWeeksAgo(26));
  const [endDate, setEndDate] = useState<string>(today());
  const [simulationMode, setSimulationMode] = useState<ForecastMode>("backlog_to_weeks");
  const [includeZeroWeeks, setIncludeZeroWeeks] = useState<boolean>(true);
  const [backlogSize, setBacklogSize] = useState<number>(120);
  const [targetWeeks, setTargetWeeks] = useState<number>(12);
  const [nSims, setNSims] = useState<number>(20000);

  const [modalErr, setModalErr] = useState<string>("");
  const [teamConfigs, setTeamConfigs] = useState<TeamPortfolioConfig[]>([]);

  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [modalLoading, setModalLoading] = useState<boolean>(false);
  const [modalTeamName, setModalTeamName] = useState<string>("");
  const [modalTypeOptions, setModalTypeOptions] = useState<string[]>([]);
  const [modalStatesByType, setModalStatesByType] = useState<Record<string, string[]>>({});
  const [modalTypes, setModalTypes] = useState<string[]>([]);
  const [modalDoneStates, setModalDoneStates] = useState<string[]>([]);
  const [modalHasQuickFilterConfig, setModalHasQuickFilterConfig] = useState<boolean>(false);
  const teamOptionsCacheRef = useRef<Map<string, TeamOptionsCacheEntry>>(new Map());

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

  const {
    loadingReport,
    reportErr,
    reportProgressLabel,
    reportErrors,
    handleGenerateReport,
    clearReportErrors,
    clearReportErr,
  } = usePortfolioReport({
    selectedOrg,
    selectedProject,
    pat,
    startDate,
    endDate,
    includeZeroWeeks,
    simulationMode,
    backlogSize,
    targetWeeks,
    nSims,
    teamConfigs,
  });

  const canGenerate = teamConfigs.length > 0 && !loadingReport;

  useEffect(() => {
    teamOptionsCacheRef.current.clear();
  }, [selectedOrg, selectedProject]);

  function getTeamCacheKey(teamName: string): string {
    return `${selectedOrg}::${selectedProject}::${teamName}`;
  }

  function getQuickFiltersScopeKey(teamName: string): string {
    if (!teamName) return "";
    return buildQuickFiltersScopeKey(selectedOrg, selectedProject, teamName);
  }

  function refreshModalQuickFilterAvailability(teamName: string): void {
    setModalHasQuickFilterConfig(Boolean(readStoredQuickFilters(getQuickFiltersScopeKey(teamName))));
  }

  function handlePortfolioError(
    setMessage: Dispatch<SetStateAction<string>>,
    error: unknown,
    context: AdoErrorContext,
  ): void {
    setMessage(getPortfolioErrorMessage(error, context));
  }

  async function loadTeamOptions(teamName: string): Promise<void> {
    if (!teamName) {
      setModalTypeOptions([]);
      setModalStatesByType({});
      setModalTypes([]);
      setModalDoneStates([]);
      setModalHasQuickFilterConfig(false);
      return;
    }
    const cachedOptions = teamOptionsCacheRef.current.get(getTeamCacheKey(teamName));
    if (cachedOptions) {
      setModalTypeOptions(cachedOptions.workItemTypes);
      setModalStatesByType(cachedOptions.statesByType);
      setModalTypes([]);
      setModalDoneStates([]);
      refreshModalQuickFilterAvailability(teamName);
      return;
    }

    setModalLoading(true);
    try {
      const options = await getTeamOptionsDirect(selectedOrg, selectedProject, teamName, pat);
      const nextCacheEntry = {
        workItemTypes: options.workItemTypes || [],
        statesByType: options.statesByType || {},
      };
      teamOptionsCacheRef.current.set(getTeamCacheKey(teamName), nextCacheEntry);
      setModalTypeOptions(nextCacheEntry.workItemTypes);
      setModalStatesByType(nextCacheEntry.statesByType);
      setModalTypes([]);
      setModalDoneStates([]);
      refreshModalQuickFilterAvailability(teamName);
    } catch (e: unknown) {
      handlePortfolioError(setModalErr, e, {
        operation: "chargement des types de tickets",
        org: selectedOrg,
        project: selectedProject,
        team: teamName,
        requiredScopes: ["Work Items (Read)"],
      });
    } finally {
      setModalLoading(false);
    }
  }

  function openAddModal(): void {
    clearReportErr();
    setModalErr("");
    const initialTeam = availableTeamNames[0] ?? "";
    setModalTeamName(initialTeam);
    setModalTypeOptions([]);
    setModalStatesByType({});
    setModalTypes([]);
    setModalDoneStates([]);
    setModalHasQuickFilterConfig(false);
    setShowAddModal(true);
    void loadTeamOptions(initialTeam);
  }

  function closeAddModal(): void {
    setShowAddModal(false);
    setModalErr("");
    setModalHasQuickFilterConfig(false);
  }

  function onModalTeamNameChange(teamName: string): void {
    setModalErr("");
    setModalTeamName(teamName);
    void loadTeamOptions(teamName);
  }

  function applyModalQuickFilterConfig(): void {
    const storedQuickFilters = readStoredQuickFilters(getQuickFiltersScopeKey(modalTeamName));
    setModalHasQuickFilterConfig(Boolean(storedQuickFilters));
    if (!storedQuickFilters) return;

    const nextSelection = getValidQuickFilterSelection(modalTypeOptions, modalStatesByType, storedQuickFilters);
    if (!nextSelection.types.length || !nextSelection.doneStates.length) return;

    setModalTypes(nextSelection.types);
    setModalDoneStates(nextSelection.doneStates);
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

    writeStoredQuickFilters(getQuickFiltersScopeKey(modalTeamName), {
      types: modalTypes,
      doneStates: modalDoneStates,
    });

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
    reportProgressLabel,
    reportErrors,
    err: reportErr,
    modalErr,
    teamConfigs,
    showAddModal,
    modalLoading,
    modalTeamName,
    modalTypeOptions,
    modalTypes,
    modalDoneStates,
    modalHasQuickFilterConfig,
    availableTeamNames,
    modalAvailableStates,
    canGenerate,
    openAddModal,
    closeAddModal,
    onModalTeamNameChange,
    applyModalQuickFilterConfig,
    toggleModalType,
    toggleModalState,
    validateAddModal,
    removeTeam,
    handleGenerateReport,
    clearReportErrors,
  };
}
