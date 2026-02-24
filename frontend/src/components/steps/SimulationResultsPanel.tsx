import type { SimulationViewModel } from "../../hooks/useSimulation";

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
    P50: "sim-kpi-card--p50",
    P70: "sim-kpi-card--p70",
    P90: "sim-kpi-card--p90",
  };
  const kpiHintByLabel: Record<string, string> = {
    P50: "50% de probabilité",
    P70: "70% de probabilité",
    P90: "90% de probabilité",
  };

  return (
    <>
      {loading && (
        <>
          <div className="sim-loading-stage">{loadingStageMessage}</div>
          <div className="sim-loading-bar" aria-hidden="true">
            <span />
          </div>
        </>
      )}
      {sampleStats && (
        <div className="sim-sample-info">
          Semaines utilisées: {sampleStats.usedWeeks}/{sampleStats.totalWeeks}
          {" - "}
          Semaines à 0: {sampleStats.zeroWeeks}
          {" - "}
          Mode: {includeZeroWeeks ? "incluses" : "exclues"}
        </div>
      )}

      {result && (
        <div className="sim-kpis">
          {["P50", "P70", "P90"].map((k) => (
            <div key={k} className={`sim-kpi-card ${kpiToneByLabel[k]}`} title={kpiHintByLabel[k]}>
              <span className="sim-kpi-label">{k}</span>
              <span className="sim-kpi-value">
                {displayPercentiles?.[k]} {result?.result_kind === "items" ? "items (au moins)" : "semaines (au plus)"}
              </span>
            </div>
          ))}
          <div className="sim-kpi-hint">
            Médiane, prudent et conservateur.
          </div>
        </div>
      )}

      {simulationHistory.length > 0 && (
        <div className="sim-control-section sim-control-section--compact">
          <div className="sim-advanced-header">
            <h3 className="sim-control-heading">Historique local</h3>
            <button type="button" className="sim-advanced-toggle" onClick={clearSimulationHistory}>
              Vider
            </button>
          </div>
          <div className="sim-checklist sim-checklist--states">
            {simulationHistory.map((entry) => (
              <div key={entry.id} className="sim-history-row">
                <div className="sim-history-meta">
                  {new Date(entry.createdAt).toLocaleString("fr-CA")} - {entry.selectedTeam}
                </div>
                <div className="sim-history-meta">
                  {entry.simulationMode === "backlog_to_weeks"
                    ? `Backlog ${entry.backlogSize}`
                    : `${entry.targetWeeks} semaines`}{" "}
                  - {entry.capacityPercent}%/{entry.reducedCapacityWeeks} sem.
                </div>
                <button
                  type="button"
                  className="sim-advanced-toggle"
                  onClick={() => applyHistoryEntry(entry)}
                >
                  Charger
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
