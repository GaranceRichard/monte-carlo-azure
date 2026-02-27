import { useState } from "react";
import { runSimulationForecast } from "./simulationForecastService";
import type { ForecastMode } from "../types";
import { formatAdoHttpErrorMessage, type AdoErrorContext } from "../adoErrors";

export type TeamPortfolioConfig = {
  teamName: string;
  workItemTypeOptions: string[];
  statesByType: Record<string, string[]>;
  types: string[];
  doneStates: string[];
};

export type TeamReportError = {
  teamName: string;
  message: string;
};

type PortfolioReportSection = {
  selectedTeam: string;
  simulationMode: ForecastMode;
  includeZeroWeeks: boolean;
  backlogSize: number;
  targetWeeks: number;
  nSims: number;
  resultKind: "items" | "weeks";
  riskScore?: number;
  distribution: { x: number; count: number }[];
  weeklyThroughput: { week: string; throughput: number }[];
  displayPercentiles: Record<string, number>;
};

type UsePortfolioReportParams = {
  selectedOrg: string;
  selectedProject: string;
  pat: string;
  startDate: string;
  endDate: string;
  includeZeroWeeks: boolean;
  simulationMode: ForecastMode;
  backlogSize: number;
  targetWeeks: number;
  nSims: number;
  teamConfigs: TeamPortfolioConfig[];
};

type UsePortfolioReportResult = {
  loadingReport: boolean;
  reportErr: string;
  reportProgressLabel: string;
  reportErrors: TeamReportError[];
  handleGenerateReport: () => Promise<void>;
  clearReportErrors: () => void;
  clearReportErr: () => void;
};

export function getPortfolioErrorMessage(error: unknown, context: AdoErrorContext): string {
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

export function usePortfolioReport({
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
}: UsePortfolioReportParams): UsePortfolioReportResult {
  const [loadingReport, setLoadingReport] = useState<boolean>(false);
  const [reportErr, setReportErr] = useState<string>("");
  const [reportProgressLabel, setReportProgressLabel] = useState<string>("");
  const [reportErrors, setReportErrors] = useState<TeamReportError[]>([]);

  async function handleGenerateReport(): Promise<void> {
    if (!teamConfigs.length) return;

    setReportErr("");
    setReportErrors([]);
    setLoadingReport(true);
    const totalTeams = teamConfigs.length;
    setReportProgressLabel(`0/${String(totalTeams)} equipes simulees`);

    try {
      let completedTeams = 0;
      const settledSections = await Promise.allSettled(
        teamConfigs.map(async (cfg): Promise<PortfolioReportSection> => {
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

      const sections: PortfolioReportSection[] = [];
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
        setReportErr("Aucune equipe n'a pu etre simulee.");
        return;
      }

      const { exportPortfolioPrintReport } = await import("../components/steps/portfolioPrintReport");
      exportPortfolioPrintReport({
        selectedProject,
        startDate,
        endDate,
        sections,
      });
    } catch (error: unknown) {
      setReportErr(
        getPortfolioErrorMessage(error, {
          operation: "generation du rapport portefeuille",
          org: selectedOrg,
          project: selectedProject,
          requiredScopes: ["Work Items (Read)"],
        }),
      );
    } finally {
      setLoadingReport(false);
    }
  }

  function clearReportErrors(): void {
    setReportErrors([]);
  }

  function clearReportErr(): void {
    setReportErr("");
  }

  return {
    loadingReport,
    reportErr,
    reportProgressLabel,
    reportErrors,
    handleGenerateReport,
    clearReportErrors,
    clearReportErr,
  };
}
