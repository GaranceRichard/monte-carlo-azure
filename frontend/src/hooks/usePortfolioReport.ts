import { useMemo, useState } from "react";
import { formatDateLocal } from "../date";
import type { ForecastMode, WeeklyThroughputRow } from "../types";
import { formatAdoHttpErrorMessage, type AdoErrorContext } from "../adoErrors";
import {
  fetchTeamThroughput,
  simulateForecastFromSamples,
} from "./simulationForecastService";
import type { PortfolioScenarioResult } from "./simulationTypes";
import { buildAtLeastPercentiles } from "./probability";
import {
  buildScenarioSamples,
  computeRiskLegend,
  computeRiskScoreFromPercentiles,
  computeThroughputReliability,
} from "../utils/simulation";

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
  types: string[];
  doneStates: string[];
  resultKind: "items" | "weeks";
  riskScore?: number;
  throughputReliability?: ReturnType<typeof computeThroughputReliability>;
  distribution: { x: number; count: number }[];
  weeklyThroughput: { week: string; throughput: number }[];
  displayPercentiles: Record<string, number>;
};

type UsePortfolioReportParams = {
  selectedOrg: string;
  selectedProject: string;
  pat: string;
  serverUrl: string;
  startDate: string;
  endDate: string;
  includeZeroWeeks: boolean;
  simulationMode: ForecastMode;
  backlogSize: number;
  targetWeeks: number;
  nSims: number;
  alignmentRate: number;
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

const SCENARIO_HYPOTHESIS_TEXT = {
  optimistic:
    "Somme des debits de toutes les equipes. Hypothese : livraison independante, aucun cout de synchronisation inter-equipes.",
  aligned:
    "N% de la capacite combinee. Hypothese : couts de synchronisation (ceremonies, dependances, alignement) absorbes sur le debit global.",
  friction:
    "X% de la capacite combinee. Hypothese : chaque equipe supplementaire absorbe un cout d'alignement identique.",
  conservative:
    "Debit median des equipes x nb equipes. Hypothese : le portefeuille est contraint par l'equipe mediane, pas par la pire.",
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
  hypothesis: string,
  samples: number[],
  simulationMode: ForecastMode,
  result: Awaited<ReturnType<typeof simulateForecastFromSamples>>,
  startDate: string,
): PortfolioScenarioResult {
  const percentiles = result.result_percentiles;
  const effectivePercentiles =
    result.result_kind === "items"
      ? buildAtLeastPercentiles(result.result_distribution, [50, 70, 90])
      : percentiles;
  const riskScore = Number(
    result.risk_score ?? computeRiskScoreFromPercentiles(simulationMode, effectivePercentiles),
  );
  return {
    label,
    hypothesis,
    samples,
    weeklyData: buildSyntheticWeeklyData(samples, startDate),
    percentiles,
    riskScore,
    riskLegend: computeRiskLegend(riskScore),
    distribution: result.result_distribution,
    throughputReliability: computeThroughputReliability(samples),
  };
}

export function usePortfolioReport({
  selectedOrg,
  selectedProject,
  pat,
  serverUrl,
  startDate,
  endDate,
  includeZeroWeeks,
  simulationMode,
  backlogSize,
  targetWeeks,
  nSims,
  alignmentRate,
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
              serverUrl,
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
        alignmentRate,
      );
      const effectiveFrictionRate = Math.round((Math.max(0, Math.min(100, alignmentRate)) / 100) ** successfulTeams.length * 100);

      const totalSimulations = successfulTeams.length + 4;
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
                types: [...cfg.types],
                doneStates: [...cfg.doneStates],
                resultKind: result.result_kind,
                riskScore:
                  result.result_kind === "items"
                    ? computeRiskScoreFromPercentiles(
                        simulationMode,
                        buildAtLeastPercentiles(result.result_distribution, [50, 70, 90]),
                      )
                    : result.risk_score,
                throughputReliability: computeThroughputReliability(data.throughputSamples),
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
              throughputSamples: scenarioSamples.optimistic,
              includeZeroWeeks: true,
              simulationMode,
              backlogSize,
              targetWeeks,
              nSims,
              selectedOrg,
              selectedProject,
              selectedTeam: "Optimiste",
              startDate,
              endDate,
            });
            return {
              kind: "scenario" as const,
              scenario: toScenarioResult(
                "Optimiste",
                SCENARIO_HYPOTHESIS_TEXT.optimistic,
                scenarioSamples.optimistic,
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
              throughputSamples: scenarioSamples.aligned,
              includeZeroWeeks: true,
              simulationMode,
              backlogSize,
              targetWeeks,
              nSims,
              selectedOrg,
              selectedProject,
              selectedTeam: `Arrime (${String(alignmentRate)}%)`,
              startDate,
              endDate,
            });
            return {
              kind: "scenario" as const,
              scenario: toScenarioResult(
                `Arrime (${Number(alignmentRate)}%)`,
                SCENARIO_HYPOTHESIS_TEXT.aligned.replace("N%", `${String(alignmentRate)}%`),
                scenarioSamples.aligned,
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
              throughputSamples: scenarioSamples.friction,
              includeZeroWeeks: true,
              simulationMode,
              backlogSize,
              targetWeeks,
              nSims,
              selectedOrg,
              selectedProject,
              selectedTeam: `Friction (${String(effectiveFrictionRate)}%)`,
              startDate,
              endDate,
            });
            return {
              kind: "scenario" as const,
              scenario: toScenarioResult(
                `Friction (${effectiveFrictionRate}%)`,
                SCENARIO_HYPOTHESIS_TEXT.friction.replace("X%", `${String(effectiveFrictionRate)}%`),
                scenarioSamples.friction,
                simulationMode,
                result,
                startDate,
              ),
            };
          } catch (error: unknown) {
            throw { kind: "scenario", teamName: "Friction", error };
          } finally {
            markSimulationDone();
          }
        })(),
        (async () => {
          try {
            const result = await simulateForecastFromSamples({
              throughputSamples: scenarioSamples.conservative,
              includeZeroWeeks: true,
              simulationMode,
              backlogSize,
              targetWeeks,
              nSims,
              selectedOrg,
              selectedProject,
              selectedTeam: "Conservateur",
              startDate,
              endDate,
            });
            return {
              kind: "scenario" as const,
              scenario: toScenarioResult(
                "Conservateur",
                SCENARIO_HYPOTHESIS_TEXT.conservative,
                scenarioSamples.conservative,
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
        alignmentRate,
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
