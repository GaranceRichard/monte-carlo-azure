import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { getTeamOptionsDirect } from "../adoClient";
import { nWeeksAgo, today } from "../date";
import { runSimulationForecast } from "./simulationForecastService";
import type { ForecastMode, NamedEntity } from "../types";
import { sortTeams } from "../utils/teamSort";
import { formatAdoHttpErrorMessage, type AdoErrorContext } from "../adoErrors";

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

type TeamOptionsCacheEntry = {
  workItemTypes: string[];
  statesByType: Record<string, string[]>;
};

type TeamReportError = {
  teamName: string;
  message: string;
};

function getPortfolioErrorMessage(error: unknown, context: AdoErrorContext): string {
  if (error instanceof Error) return error.message;

  if (error && typeof error === "object") {
    const statusValue = (error as { status?: unknown }).status;
    const statusTextValue = (error as { statusText?: unknown }).statusText;
    const status = typeof statusValue === "number" ? statusValue : NaN;
    const statusText = typeof statusTextValue === "string" ? statusTextValue : "";
    if (Number.isFinite(status) && status >= 100 && status <= 599) {
      return formatAdoHttpErrorMessage(status, context, statusText);
    }
  }

  return `Erreur inattendue pendant "${context.operation}".`;
}

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
  const [reportProgressLabel, setReportProgressLabel] = useState<string>("");
  const [reportErrors, setReportErrors] = useState<TeamReportError[]>([]);
  const [teamConfigs, setTeamConfigs] = useState<TeamPortfolioConfig[]>([]);

  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [modalLoading, setModalLoading] = useState<boolean>(false);
  const [modalTeamName, setModalTeamName] = useState<string>("");
  const [modalTypeOptions, setModalTypeOptions] = useState<string[]>([]);
  const [modalStatesByType, setModalStatesByType] = useState<Record<string, string[]>>({});
  const [modalTypes, setModalTypes] = useState<string[]>([]);
  const [modalDoneStates, setModalDoneStates] = useState<string[]>([]);
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

  const canGenerate = teamConfigs.length > 0 && !loadingReport;

  useEffect(() => {
    teamOptionsCacheRef.current.clear();
  }, [selectedOrg, selectedProject]);

  function getTeamCacheKey(teamName: string): string {
    return `${selectedOrg}::${selectedProject}::${teamName}`;
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
      return;
    }
    const cachedOptions = teamOptionsCacheRef.current.get(getTeamCacheKey(teamName));
    if (cachedOptions) {
      setModalTypeOptions(cachedOptions.workItemTypes);
      setModalStatesByType(cachedOptions.statesByType);
      setModalTypes([]);
      setModalDoneStates([]);
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
    setReportErrors([]);
    setLoadingReport(true);
    const totalTeams = teamConfigs.length;
    setReportProgressLabel(`0/${String(totalTeams)} equipes simulees`);
    try {
      let completedTeams = 0;
      const settledSections = await Promise.allSettled(
        teamConfigs.map(async (cfg) => {
          try {
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
            return {
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
            };
          } catch (error: unknown) {
            throw { teamName: cfg.teamName, error };
          } finally {
            completedTeams += 1;
            setReportProgressLabel(`${String(completedTeams)}/${String(totalTeams)} equipes simulees`);
          }
        }),
      );

      const sections = [];
      const teamErrors: TeamReportError[] = [];
      for (const result of settledSections) {
        if (result.status === "fulfilled") {
          sections.push(result.value);
          continue;
        }
        const reason = result.reason as { teamName?: unknown; error?: unknown };
        const failedTeamName = typeof reason?.teamName === "string" ? reason.teamName : "Equipe inconnue";
        teamErrors.push({
          teamName: failedTeamName,
          message: getPortfolioErrorMessage(reason?.error, {
            operation: "generation du rapport portefeuille",
            org: selectedOrg,
            project: selectedProject,
            team: failedTeamName,
            requiredScopes: ["Work Items (Read)"],
          }),
        });
      }
      setReportErrors(teamErrors);

      if (!sections.length) {
        setErr("Aucune equipe n'a pu etre simulee.");
        return;
      }

      const { exportPortfolioPrintReport } = await import("../components/steps/portfolioPrintReport");
      exportPortfolioPrintReport({
        selectedProject,
        startDate,
        endDate,
        sections,
      });
    } catch (e: unknown) {
      handlePortfolioError(setErr, e, {
        operation: "generation du rapport portefeuille",
        org: selectedOrg,
        project: selectedProject,
        requiredScopes: ["Work Items (Read)"],
      });
    } finally {
      setLoadingReport(false);
    }
  }

  function clearReportErrors(): void {
    setReportErrors([]);
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
    clearReportErrors,
  };
}
