import type { SimulationViewModel } from "../../hooks/useSimulation";

type SimulationModeAndParametersControlsProps = {
  simulation: Pick<
    SimulationViewModel,
    | "simulationMode"
    | "setSimulationMode"
    | "includeZeroWeeks"
    | "setIncludeZeroWeeks"
    | "backlogSize"
    | "setBacklogSize"
    | "targetWeeks"
    | "setTargetWeeks"
    | "nSims"
    | "setNSims"
    | "setActiveChartTab"
  >;
};

export default function SimulationModeAndParametersControls({ simulation }: SimulationModeAndParametersControlsProps) {
  const {
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
    setActiveChartTab,
  } = simulation;

  return (
    <>
      <div className="sim-mode-row sim-mt-10">
        <div className="sim-mode-select-wrap">
          <label className="sim-label">Type de simulation</label>
          <select
            value={simulationMode}
            onChange={(e) => {
              setSimulationMode(e.target.value as "backlog_to_weeks" | "weeks_to_items");
              setActiveChartTab("throughput");
            }}
            className="sim-input"
          >
            <option value="backlog_to_weeks">Nombre d&apos;items de backlog vers semaines</option>
            <option value="weeks_to_items">Nombre de semaines vers items livres</option>
          </select>
        </div>
        <label className="sim-check-row sim-mode-zero-toggle">
          <input
            type="checkbox"
            checked={includeZeroWeeks}
            onChange={(e) => setIncludeZeroWeeks(e.target.checked)}
          />
          <span>Inclure les semaines a 0</span>
        </label>
      </div>

      <div className="sim-grid-2 sim-mt-10">
        <div>
          <label className="sim-label">
            {simulationMode === "backlog_to_weeks" ? "Backlog (items)" : "Semaines ciblees"}
          </label>
          {simulationMode === "backlog_to_weeks" ? (
            <input
              type="number"
              min="1"
              value={backlogSize}
              onChange={(e) => setBacklogSize(e.target.value)}
              className="sim-input"
            />
          ) : (
            <input
              type="number"
              min="1"
              value={targetWeeks}
              onChange={(e) => setTargetWeeks(e.target.value)}
              className="sim-input"
            />
          )}
        </div>
        <div>
          <label className="sim-label">Simulations</label>
          <input
            type="number"
            min="1000"
            step="1000"
            value={nSims}
            onChange={(e) => setNSims(e.target.value)}
            className="sim-input"
          />
        </div>
      </div>
    </>
  );
}
