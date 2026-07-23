import { useMemo, useState } from "react";
import ProgressBar from "../ui/progress";
import { useSimulationContext } from "../../hooks/SimulationContext";
import { keepSelectDropdownAtTop } from "../../utils/selectTopStart";
import {
  computeRiskScoreFromPercentiles,
  computeThroughputReliability,
  getProjectionReliabilityNotice,
} from "../../utils/simulation";
import {
  buildSimulationDecisionLanguage,
} from "../../utils/simulationDecisionDiagnostic";
import DecisionDiagnostic from "./DecisionDiagnostic";

function formatHistoryEntryLabel(entry: {
  createdAt: string;
  selectedTeam: string;
  simulationMode: "backlog_to_weeks" | "weeks_to_items";
  backlogSize: number;
  targetWeeks: number;
}): string {
  const date = new Date(entry.createdAt);
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const teamPrefixRaw = entry.selectedTeam.split("-")[0]?.trim() || entry.selectedTeam.trim();
  const teamPrefix = (teamPrefixRaw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").match(/[A-Za-z]+/g) || []).join("");
  const teamPart = teamPrefix || "Equipe";
  const modePart =
    entry.simulationMode === "weeks_to_items"
      ? `${entry.targetWeeks} ${entry.targetWeeks > 1 ? "semaines" : "semaine"}`
      : `${entry.backlogSize} items`;

  return `${year}_${month}_${day}_${teamPart}-${modePart}`;
}

type SimulationResultsPanelProps = {
  hideHistory?: boolean;
};

function formatCoefficient(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

const PERCENTILE_KEYS = ["P50", "P70", "P90"] as const;

export default function SimulationResultsPanel({ hideHistory = false }: SimulationResultsPanelProps) {
  const { simulation: s, selectedTeam } = useSimulationContext();
  const [selectedHistoryId, setSelectedHistoryId] = useState("");
  const teamHistory = useMemo(
    () => s.simulationHistory.filter((entry) => entry.selectedTeam === selectedTeam),
    [s.simulationHistory, selectedTeam],
  );
  const historyCount = teamHistory.length;
  const historyLabel =
    historyCount === 0
      ? "pas de simulation pour l'équipe"
      : historyCount === 1
        ? "simulation enregistrée"
        : "simulations enregistrées";

  const effectiveSelectedHistoryId = teamHistory.some((item) => item.id === selectedHistoryId) ? selectedHistoryId : "";

  const visiblePercentiles = PERCENTILE_KEYS.filter((key) => typeof s.displayPercentiles?.[key] === "number");

  const kpiToneByLabel: Record<string, string> = {
    P50: "border-[var(--p50)] bg-[var(--p50-soft)]",
    P70: "border-[var(--p70)] bg-[var(--p70-soft)]",
    P90: "border-[var(--p90)] bg-[var(--p90-soft)]",
  };

  const kpiHintByLabel: Record<string, string> = {
    P50: "50% de probabilite",
    P70: "70% de probabilite",
    P90: "90% de probabilite",
  };

  const riskScoreValue = useMemo(() => {
    if (!s.result) return null;
    if (typeof s.displayPercentiles?.P50 === "number" && typeof s.displayPercentiles?.P90 === "number") {
      return computeRiskScoreFromPercentiles(s.simulationMode, s.displayPercentiles ?? {});
    }
    return null;
  }, [s.result, s.displayPercentiles, s.simulationMode]);

  const riskLegend = useMemo(() => {
    if (riskScoreValue == null) return "";
    if (riskScoreValue <= 0.2) return "fiable";
    if (riskScoreValue <= 0.5) return "incertain";
    if (riskScoreValue <= 0.8) return "fragile";
    return "non fiable";
  }, [riskScoreValue]);

  const reliability =
    s.result?.throughputReliability ??
    computeThroughputReliability((s.throughputData ?? []).map((point) => point.throughput));
  const reliabilityNotice = getProjectionReliabilityNotice(reliability);

  const combinedIndicatorTone = useMemo(() => {
    const labels = [riskLegend, reliability?.label].filter(Boolean);
    if (labels.includes("non fiable")) return "border-black bg-neutral-200 text-black";
    if (labels.includes("fragile")) return "border-red-600 bg-red-50 text-red-700";
    if (labels.includes("incertain")) return "border-amber-500 bg-amber-50 text-amber-700";
    if (labels.includes("fiable")) return "border-emerald-600 bg-emerald-50 text-emerald-700";
    return "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)]";
  }, [riskLegend, reliability?.label]);

  const decisionDiagnostic = useMemo(() => {
    const throughputSamples = (s.throughputData ?? []).map((point) => point.throughput);
    return buildSimulationDecisionLanguage({
      hasResult: Boolean(s.result),
      throughputSamples,
      includeZeroWeeks: s.includeZeroWeeks,
      adoDataWarning: s.warning,
      percentiles: s.displayPercentiles,
      completionSummary: s.result?.completionSummary,
      riskScore: riskScoreValue,
      throughputReliability: reliability,
      selectedOrg: s.selectedOrg,
      selectedProject: s.selectedProject,
      selectedTeam,
      startDate: s.startDate,
      endDate: s.endDate,
      simulationMode: s.simulationMode,
      backlogSize: s.backlogSize,
      targetWeeks: s.targetWeeks,
      types: s.types,
      doneStates: s.doneStates,
      usableWeeks: s.sampleStats?.usedWeeks,
      history: s.simulationHistory,
    });
  }, [
    reliability,
    riskScoreValue,
    s.displayPercentiles,
    s.doneStates,
    s.endDate,
    s.includeZeroWeeks,
    s.backlogSize,
    s.result,
    s.sampleStats,
    s.selectedOrg,
    s.selectedProject,
    s.simulationHistory,
    s.simulationMode,
    s.startDate,
    s.targetWeeks,
    s.throughputData,
    s.types,
    s.warning,
    selectedTeam,
  ]);

  return (
    <div className="min-h-0 space-y-4">
      {s.loading && (
        <div
          className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3"
          role="status"
          aria-live="polite"
        >
          <div className="text-xs font-semibold text-[var(--muted)]">{s.loadingStageMessage}</div>
          <div aria-hidden="true">
            <ProgressBar value={65} />
          </div>
        </div>
      )}

      {s.notice && (
        <div
          className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3 text-xs font-semibold text-[var(--text)]"
          role="status"
          aria-live="polite"
        >
          {s.notice}
        </div>
      )}

      {s.sampleStats && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3 text-xs text-[var(--muted)]">
          Semaines utilisees: {s.sampleStats.usedWeeks}/{s.sampleStats.totalWeeks}
          {" - "}
          Mode: 0 {s.includeZeroWeeks ? "incluses" : "exclues"}
        </div>
      )}

      {s.warning && (
        <div className="rounded-xl border border-[var(--warningBorder)] bg-[var(--warningBg)] p-3 text-xs text-[var(--text)]">
          <b>Avertissement:</b> {s.warning}
        </div>
      )}

      {reliabilityNotice && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-xs text-red-900">
          <b>Projection a cadrer:</b> {reliabilityNotice}
        </div>
      )}

      {s.result && (
        <div className="space-y-2">
          {decisionDiagnostic && <DecisionDiagnostic diagnostic={decisionDiagnostic} />}
          <div className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Percentiles</div>
          {s.result.completionSummary && s.result.completionSummary.censoredCount > 0 && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">
              Horizon de simulation: {s.result.completionSummary.horizonWeeks} semaines.{" "}
              {s.result.completionSummary.censoredCount}/{s.result.completionSummary.completedCount + s.result.completionSummary.censoredCount} simulations
              {" "}n'ont pas termine ({formatCoefficient(s.result.completionSummary.censoredRate)}). La distribution ne montre que les simulations terminees et un percentile absent signifie qu'il n'est pas identifiable avant l'horizon.
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {visiblePercentiles.map((k, index) => (
              <div
                key={k}
                className={`flex min-h-[3.2rem] flex-col items-center justify-center rounded-xl border p-2 text-center opacity-0 [animation:flowFadeIn_300ms_ease-out_forwards] ${kpiToneByLabel[k]}`}
                style={{ animationDelay: `${index * 90}ms` }}
                title={kpiHintByLabel[k]}
              >
                <span className="block text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted)]">{k}</span>
                <span className="mt-1 block whitespace-nowrap text-sm font-extrabold leading-tight text-[var(--text)]">
                  {s.displayPercentiles?.[k]} {s.result?.resultKind === "items" ? "items" : "sem"}
                </span>
              </div>
            ))}
            {riskScoreValue != null && (
              <div
                className={`group relative h-[4.4rem] rounded-xl border p-2 opacity-0 [animation:flowFadeIn_300ms_ease-out_forwards] ${combinedIndicatorTone}`}
                style={{ animationDelay: `${visiblePercentiles.length * 90}ms` }}
                tabIndex={0}
              >
                <div className="relative h-full w-full text-center">
                  <div className="absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-150 group-hover:opacity-0 group-focus-visible:opacity-0">
                    <span className="block text-xs font-bold uppercase tracking-[0.08em]">Risque / Fiabilite</span>
                    <div className="mt-1 whitespace-nowrap text-[13px] font-extrabold leading-tight">
                      {formatCoefficient(riskScoreValue)} / {reliability ? formatCoefficient(reliability.cv) : "-"}
                    </div>
                  </div>
                  <div className="absolute inset-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
                    <div className="flex h-full flex-col items-center justify-evenly text-[10px] font-extrabold leading-[1.05]">
                      <div className="whitespace-nowrap">R : {riskLegend}</div>
                      {reliability && <div className="whitespace-nowrap">F : {reliability.label}</div>}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {!hideHistory && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="m-0 text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Historique local</h3>
            <button type="button" className="sim-advanced-toggle" onClick={s.clearSimulationHistory}>
              Vider
            </button>
          </div>
          {historyCount === 0 ? (
            <div className="text-xs text-[var(--muted)]">{historyLabel}</div>
          ) : (
            <div className="space-y-2">
              <select
                value={effectiveSelectedHistoryId}
                onFocus={keepSelectDropdownAtTop}
                onMouseDown={keepSelectDropdownAtTop}
                onChange={(e) => {
                  const nextId = e.target.value;
                  if (!nextId) {
                    setSelectedHistoryId("");
                    return;
                  }
                  const entry = teamHistory.find((item) => item.id === nextId);
                  if (entry) {
                    s.applyHistoryEntry(entry);
                    setSelectedHistoryId("");
                  }
                }}
                className="flow-input"
              >
                <option value="">{historyLabel}</option>
                {teamHistory.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {formatHistoryEntryLabel(entry)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
