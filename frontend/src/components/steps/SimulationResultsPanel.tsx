import type { SimulationViewModel } from "../../hooks/useSimulation";

type SimulationResultsPanelProps = {
  simulation: Pick<
    SimulationViewModel,
    "loading" | "loadingStageMessage" | "sampleStats" | "includeZeroWeeks" | "result" | "displayPercentiles"
  >;
};

export default function SimulationResultsPanel({ simulation }: SimulationResultsPanelProps) {
  const { loading, loadingStageMessage, sampleStats, includeZeroWeeks, result, displayPercentiles } = simulation;
  const kpiToneByLabel: Record<string, string> = {
    P50: "sim-kpi-card--p50",
    P70: "sim-kpi-card--p70",
    P90: "sim-kpi-card--p90",
  };
  const kpiHintByLabel: Record<string, string> = {
    P50: "50% de probabilite",
    P70: "70% de probabilite",
    P90: "90% de probabilite",
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
          Semaines utilisees: {sampleStats.usedWeeks}/{sampleStats.totalWeeks}
          {" - "}
          Semaines a 0: {sampleStats.zeroWeeks}
          {" - "}
          Mode: {includeZeroWeeks ? "inclues" : "exclues"}
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
            Mediane, prudent et conservateur.
          </div>
        </div>
      )}
    </>
  );
}
