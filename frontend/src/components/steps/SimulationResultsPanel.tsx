import type { SimulationViewModel } from "../../hooks/useSimulation";

type SimulationResultsPanelProps = {
  simulation: Pick<
    SimulationViewModel,
    "loading" | "loadingStageMessage" | "sampleStats" | "includeZeroWeeks" | "result" | "displayPercentiles"
  >;
};

export default function SimulationResultsPanel({ simulation }: SimulationResultsPanelProps) {
  const { loading, loadingStageMessage, sampleStats, includeZeroWeeks, result, displayPercentiles } = simulation;

  return (
    <>
      {loading && <div className="sim-loading-stage">{loadingStageMessage}</div>}
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
            <div key={k} className="sim-kpi-card">
              <span className="sim-kpi-label">{k}</span>
              <span className="sim-kpi-value">
                {displayPercentiles?.[k]} {result?.result_kind === "items" ? "items (au moins)" : "semaines (au plus)"}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
