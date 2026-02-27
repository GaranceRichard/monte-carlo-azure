import { useMemo, useState } from "react";
import { formatDateLocal } from "../date";
import type { ForecastMode, WeeklyThroughputRow } from "../types";
import { formatAdoHttpErrorMessage, type AdoErrorContext } from "../adoErrors";
import {
  fetchTeamThroughput,
  simulateForecastFromSamples,
} from "./simulationForecastService";
import type { PortfolioScenarioResult } from "./simulationTypes";
import { buildScenarioSamples, computeRiskLegend, computeRiskScoreFromPercentiles } from "../utils/simulation";

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

export type PortfolioReportSection = {
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
  arrimageRate: number;
  teamConfigs: TeamPortfolioConfig[];
};

type GenerationProgress = {
  done: number;
  total: number;
};

type UsePortfolioReportResult = {
  loadingReport: boolean;
  reportErr: string;
  reportProgressLabel: string;
  reportErrors: TeamReportError[];
  generationProgress: GenerationProgress;
  handleGenerateReport: () => Promise<void>;
  clearReportErrors: () => void;
  clearReportErr: () => void;
};

const SCENARIO_HYPOTHESES = {
  optimiste:
    "Somme des debits de toutes les equipes. Hypothese : livraison independante, aucun cout de synchronisation inter-equipes.",
  arrime:
    "N% de la capacite combinee. Hypothese : couts PI (ceremonies, dependances, alignement) absorbes sur le debit global.",
  conservateur:
    "Debit de l'equipe la plus lente retenu a chaque semaine simulee. Hypothese : PI contraint par le bottleneck.",
} as const;

export function getPortfolioErrorMessage(error: unknown, context: AdoErrorContext): string {
  if (error instanceof Error) return error.message;

  if (error && typeof error === "object") {
    const statusValue = (error as { status?: unknown }).status;
    const statusTextValue = (error as { statusText?: unknown }).statusText;
    const status = typeof statusValue === "number" ? statusValue : Number.NaN;
    const statusText = typeof statusTextValue === "string" ? statusTextValue : "";
    if (Number.isFinite(status) && status >= 100 && status <= 599) {
      return formatAdoHttpErrorMessage(status, context, statusText);
    }
  }

  return `Erreur inattendue pendant "${context.operation}".`;
}

function buildSyntheticWeeklyData(samples: number[], startDate: string): WeeklyThroughputRow[] {
  const cursor = new Date(startDate);
  return samples.map((value, index) => {
    if (index > 0) cursor.setDate(cursor.getDate() + 7);
    return {
      week: formatDateLocal(cursor),
      throughput: value,
    };
  });
}

function toScenarioResult(
  label: PortfolioScenarioResult["label"],
  hypothese: string,
  samples: number[],
  simulationMode: ForecastMode,
  result: Awaited<ReturnType<typeof simulateForecastFromSamples>>,
  startDate: string,
): PortfolioScenarioResult {
  const percentiles = result.result_percentiles;
  const riskScore = Number(result.risk_score ?? computeRiskScoreFromPercentiles(simulationMode, percentiles));
  return {
    label,
    hypothese,
    samples,
    weeklyData: buildSyntheticWeeklyData(samples, startDate),
    percentiles,
    riskScore,
    riskLegend: computeRiskLegend(riskScore),
    distribution: result.result_distribution,
  };
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
  arrimageRate,
  teamConfigs,
}: UsePortfolioReportParams): UsePortfolioReportResult {
  const [loadingReport, setLoadingReport] = useState<boolean>(false);
  const [reportErr, setReportErr] = useState<string>("");
  const [reportErrors, setReportErrors] = useState<TeamReportError[]>([]);
  const [generationProgress, setGenerationProgress] = useState<GenerationProgress>({ done: 0, total: 0 });

  const reportProgressLabel = useMemo(() => {
    if (generationProgress.total <= 0) return "";
    return `${String(generationProgress.done)}/${String(generationProgress.total)} simulations terminees`;
  }, [generationProgress]);

  async function handleGenerateReport(): Promise<void> {
    if (!teamConfigs.length) return;

    setReportErr("");
    setReportErrors([]);
    setLoadingReport(true);
    setGenerationProgress({ done: 0, total: 0 });

    try {
      const collectedErrors: TeamReportError[] = [];

      // Phase 1: collect throughput in parallel.
      const throughputSettled = await Promise.allSettled(
        teamConfigs.map(async (cfg) => {
          try {
            const data = await fetchTeamThroughput({
              selectedOrg,
              selectedProject,
              selectedTeam: cfg.teamName,
              pat,
              startDate,
              endDate,
              doneStates: cfg.doneStates,
              types: cfg.types,
              includeZeroWeeks,
            });
            return { cfg, data };
          } catch (error: unknown) {
            throw { teamName: cfg.teamName, error };
          }
        }),
      );

      const successfulTeams: Array<{
        cfg: TeamPortfolioConfig;
        data: Awaited<ReturnType<typeof fetchTeamThroughput>>;
      }> = [];

      for (const result of throughputSettled) {
        if (result.status === "fulfilled") {
          successfulTeams.push(result.value);
          continue;
        }
        const reason = result.reason as { teamName?: unknown; error?: unknown };
        const failedTeamName = typeof reason?.teamName === "string" ? reason.teamName : "Equipe inconnue";

        collectedErrors.push({
          teamName: failedTeamName,
          message: getPortfolioErrorMessage(reason?.error ?? reason, {
            operation: "collecte throughput portefeuille",
            org: selectedOrg,
            project: selectedProject,
            team: failedTeamName,
            requiredScopes: ["Work Items (Read)"],
          }),
        });
      }

      if (!successfulTeams.length) {
        setReportErrors(collectedErrors);
        setReportErr("Aucune equipe n'a pu etre simulee.");
        return;
      }

      // Phase 2: run team + portfolio scenario simulations in parallel.
      const scenarioSamples = buildScenarioSamples(
        successfulTeams.map((team) => team.data.throughputSamples),
        arrimageRate,
      );

      const totalSimulations = successfulTeams.length + 3;
      setGenerationProgress({ done: 0, total: totalSimulations });
      let completedSimulations = 0;
      const markSimulationDone = (): void => {
        completedSimulations += 1;
        setGenerationProgress({ done: completedSimulations, total: totalSimulations });
      };

      const simulationSettled = await Promise.allSettled([
        ...successfulTeams.map(async ({ cfg, data }) => {
          try {
            const result = await simulateForecastFromSamples({
              throughputSamples: data.throughputSamples,
              includeZeroWeeks,
              simulationMode,
              backlogSize,
              targetWeeks,
              nSims,
              capacityPercent: 100,
              reducedCapacityWeeks: 0,
              selectedOrg,
              selectedProject,
              selectedTeam: cfg.teamName,
              startDate,
              endDate,
              doneStates: cfg.doneStates,
              types: cfg.types,
            });
            return {
              kind: "team" as const,
              section: {
                selectedTeam: cfg.teamName,
                simulationMode,
                includeZeroWeeks,
                backlogSize: Number(backlogSize),
                targetWeeks: Number(targetWeeks),
                nSims: Number(nSims),
                resultKind: result.result_kind,
                riskScore: result.risk_score,
                distribution: result.result_distribution,
                weeklyThroughput: data.weeklyThroughput,
                displayPercentiles: result.result_percentiles,
              } satisfies PortfolioReportSection,
            };
          } catch (error: unknown) {
            throw { kind: "team", teamName: cfg.teamName, error };
          } finally {
            markSimulationDone();
          }
        }),
        (async () => {
          try {
            const result = await simulateForecastFromSamples({
              throughputSamples: scenarioSamples.optimiste,
              includeZeroWeeks: true,
              simulationMode,
              backlogSize,
              targetWeeks,
              nSims,
              capacityPercent: 100,
              reducedCapacityWeeks: 0,
              selectedOrg,
              selectedProject,
              selectedTeam: "PI Optimiste",
              startDate,
              endDate,
            });
            return {
              kind: "scenario" as const,
              scenario: toScenarioResult(
                "Optimiste",
                SCENARIO_HYPOTHESES.optimiste,
                scenarioSamples.optimiste,
                simulationMode,
                result,
                startDate,
              ),
            };
          } catch (error: unknown) {
            throw { kind: "scenario", teamName: "Optimiste", error };
          } finally {
            markSimulationDone();
          }
        })(),
        (async () => {
          try {
            const result = await simulateForecastFromSamples({
              throughputSamples: scenarioSamples.arrime,
              includeZeroWeeks: true,
              simulationMode,
              backlogSize,
              targetWeeks,
              nSims,
              capacityPercent: 100,
              reducedCapacityWeeks: 0,
              selectedOrg,
              selectedProject,
              selectedTeam: `PI Arrime (${String(arrimageRate)}%)`,
              startDate,
              endDate,
            });
            return {
              kind: "scenario" as const,
              scenario: toScenarioResult(
                `Arrime (${Number(arrimageRate)}%)`,
                SCENARIO_HYPOTHESES.arrime.replace("N%", `${String(arrimageRate)}%`),
                scenarioSamples.arrime,
                simulationMode,
                result,
                startDate,
              ),
            };
          } catch (error: unknown) {
            throw { kind: "scenario", teamName: "Arrime", error };
          } finally {
            markSimulationDone();
          }
        })(),
        (async () => {
          try {
            const result = await simulateForecastFromSamples({
              throughputSamples: scenarioSamples.conservateur,
              includeZeroWeeks: true,
              simulationMode,
              backlogSize,
              targetWeeks,
              nSims,
              capacityPercent: 100,
              reducedCapacityWeeks: 0,
              selectedOrg,
              selectedProject,
              selectedTeam: "PI Conservateur",
              startDate,
              endDate,
            });
            return {
              kind: "scenario" as const,
              scenario: toScenarioResult(
                "Conservateur",
                SCENARIO_HYPOTHESES.conservateur,
                scenarioSamples.conservateur,
                simulationMode,
                result,
                startDate,
              ),
            };
          } catch (error: unknown) {
            throw { kind: "scenario", teamName: "Conservateur", error };
          } finally {
            markSimulationDone();
          }
        })(),
      ]);

      const sections: PortfolioReportSection[] = [];
      const scenarios: PortfolioScenarioResult[] = [];

      for (const result of simulationSettled) {
        if (result.status === "fulfilled") {
          if (result.value.kind === "team") sections.push(result.value.section);
          if (result.value.kind === "scenario") scenarios.push(result.value.scenario);
          continue;
        }

        const reason = result.reason as { kind?: string; teamName?: unknown; error?: unknown };
        const failedName = typeof reason?.teamName === "string" ? reason.teamName : "Simulation inconnue";
        collectedErrors.push({
          teamName: failedName,
          message: getPortfolioErrorMessage(reason?.error, {
            operation: "simulation portefeuille",
            org: selectedOrg,
            project: selectedProject,
            team: failedName,
            requiredScopes: ["Work Items (Read)"],
          }),
        });
      }

      setReportErrors(collectedErrors);

      if (!sections.length && !scenarios.length) {
        setReportErr("Aucune simulation n'a pu etre finalisee.");
        return;
      }

      const { exportPortfolioPrintReport } = await import("../components/steps/portfolioPrintReport");
      exportPortfolioPrintReport({
        selectedProject,
        startDate,
        endDate,
        arrimageRate,
        includedTeams: sections.map((section) => section.selectedTeam),
        sections,
        scenarios,
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
    generationProgress,
    handleGenerateReport,
    clearReportErrors,
    clearReportErr,
  };
}
