import type { SimulationViewModel } from "../../hooks/useSimulation";
import ProgressBar from "../ui/progress";

type SimulationResultsPanelProps = {
  simulation: Pick<
    SimulationViewModel,
    | "loading"
    | "loadingStageMessage"
    | "sampleStats"
    | "includeZeroWeeks"
    | "result"
    | "displayPercentiles"
    | "simulationHistory"
    | "applyHistoryEntry"
    | "clearSimulationHistory"
  >;
};

export default function SimulationResultsPanel({ simulation }: SimulationResultsPanelProps) {
  const {
    loading,
    loadingStageMessage,
    sampleStats,
    includeZeroWeeks,
    result,
    displayPercentiles,
    simulationHistory,
    applyHistoryEntry,
    clearSimulationHistory,
  } = simulation;

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

  return (
    <div className="min-h-0 space-y-4">
      {loading && (
        <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
          <div className="text-xs font-semibold text-[var(--muted)]">{loadingStageMessage}</div>
          <div aria-hidden="true">
            <ProgressBar value={65} />
          </div>
        </div>
      )}

      {sampleStats && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3 text-xs text-[var(--muted)]">
          Semaines utilisees: {sampleStats.usedWeeks}/{sampleStats.totalWeeks}
          {" - "}
          Semaines a 0: {sampleStats.zeroWeeks}
          {" - "}
          Mode: {includeZeroWeeks ? "incluses" : "exclues"}
        </div>
      )}

      {result && (
        <div className="space-y-2">
          <div className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Percentiles</div>
          <div className="grid grid-cols-3 gap-2">
            {["P50", "P70", "P90"].map((k, index) => (
              <div
                key={k}
                className={`rounded-xl border p-2 opacity-0 [animation:flowFadeIn_300ms_ease-out_forwards] ${kpiToneByLabel[k]}`}
                style={{ animationDelay: `${index * 90}ms` }}
                title={kpiHintByLabel[k]}
              >
                <span className="block text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted)]">{k}</span>
                <span className="mt-1 block whitespace-nowrap text-sm font-extrabold leading-tight text-[var(--text)]">
                  {displayPercentiles?.[k]} {result?.result_kind === "items" ? "items" : "semaines"}
                </span>
              </div>
            ))}
          </div>
          <div className="text-xs text-[var(--muted)]">Mediane, prudent et conservateur.</div>
        </div>
      )}

      {simulationHistory.length > 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="m-0 text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Historique local</h3>
            <button type="button" className="sim-advanced-toggle" onClick={clearSimulationHistory}>
              Vider
            </button>
          </div>
          <div className="max-h-56 space-y-2 overflow-auto">
            {simulationHistory.map((entry) => (
              <div key={entry.id} className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-2">
                <div className="text-xs text-[var(--muted)]">
                  {new Date(entry.createdAt).toLocaleString("fr-CA")} - {entry.selectedTeam}
                </div>
                <div className="text-xs text-[var(--muted)]">
                  {entry.simulationMode === "backlog_to_weeks"
                    ? `Backlog ${entry.backlogSize}`
                    : `${entry.targetWeeks} semaines`}{" "}
                  - {entry.capacityPercent}%/{entry.reducedCapacityWeeks} sem.
                </div>
                <button type="button" className="sim-advanced-toggle" onClick={() => applyHistoryEntry(entry)}>
                  Charger
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
