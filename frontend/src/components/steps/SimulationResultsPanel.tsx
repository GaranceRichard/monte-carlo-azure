import { useEffect, useMemo, useState } from "react";
import ProgressBar from "../ui/progress";
import { useSimulationContext } from "../../hooks/SimulationContext";
import { keepSelectDropdownAtTop } from "../../utils/selectTopStart";
import { computeRiskScoreFromPercentiles } from "../../utils/simulation";

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

  useEffect(() => {
    if (!teamHistory.length || !teamHistory.some((item) => item.id === selectedHistoryId)) {
      setSelectedHistoryId("");
    }
  }, [teamHistory, selectedHistoryId]);

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
    return computeRiskScoreFromPercentiles(s.displayPercentiles ?? {});
  }, [s.result, s.displayPercentiles]);

  const riskLegend = useMemo(() => {
    if (riskScoreValue == null) return "";
    if (riskScoreValue <= 0.2) return "fiable";
    if (riskScoreValue <= 0.5) return "incertain";
    if (riskScoreValue <= 0.8) return "fragile";
    return "non fiable";
  }, [riskScoreValue]);

  const riskColorClass = useMemo(() => {
    if (riskLegend === "fiable") return "border-emerald-600 text-emerald-700";
    if (riskLegend === "incertain") return "border-amber-500 text-amber-600";
    if (riskLegend === "fragile") return "border-red-600 text-red-700";
    if (riskLegend === "non fiable") return "border-black text-black";
    return "border-[var(--border)] text-[var(--text)]";
  }, [riskLegend]);

  return (
    <div className="min-h-0 space-y-4">
      {s.loading && (
        <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
          <div className="text-xs font-semibold text-[var(--muted)]">{s.loadingStageMessage}</div>
          <div aria-hidden="true">
            <ProgressBar value={65} />
          </div>
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

      {s.result && (
        <div className="space-y-2">
          <div className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Percentiles</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {["P50", "P70", "P90"].map((k, index) => (
              <div
                key={k}
                className={`rounded-xl border p-2 opacity-0 [animation:flowFadeIn_300ms_ease-out_forwards] ${kpiToneByLabel[k]}`}
                style={{ animationDelay: `${index * 90}ms` }}
                title={kpiHintByLabel[k]}
              >
                <span className="block text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted)]">{k}</span>
                <span className="mt-1 block whitespace-nowrap text-sm font-extrabold leading-tight text-[var(--text)]">
                  {s.displayPercentiles?.[k]} {s.result?.result_kind === "items" ? "items" : "sem"}
                </span>
              </div>
            ))}
            {riskScoreValue != null && (
              <div
                className={`group relative rounded-xl border bg-[var(--surface-2)] p-2 opacity-0 [animation:flowFadeIn_300ms_ease-out_forwards] ${riskColorClass}`}
                style={{ animationDelay: `${3 * 90}ms` }}
                tabIndex={0}
              >
                <div className="flex min-h-[3.2rem] flex-col items-center justify-center text-center">
                  <span className="block text-xs font-bold uppercase tracking-[0.08em]">Risk</span>
                  <span className="mt-1 whitespace-nowrap text-sm font-extrabold leading-tight">
                    <span className="group-hover:hidden group-focus-visible:hidden">{riskScoreValue.toFixed(2)}</span>
                    <span className="hidden group-hover:inline group-focus-visible:inline">{riskLegend}</span>
                  </span>
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
                value={selectedHistoryId}
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

