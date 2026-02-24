import type { SimulationViewModel } from "../../hooks/useSimulation";

type SimulationModeAndParametersControlsProps = {
  simulation: Pick<
    SimulationViewModel,
    | "simulationMode"
    | "setSimulationMode"
    | "includeZeroWeeks"
    | "setIncludeZeroWeeks"
    | "capacityPercent"
    | "setCapacityPercent"
    | "reducedCapacityWeeks"
    | "setReducedCapacityWeeks"
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
    capacityPercent,
    setCapacityPercent,
    reducedCapacityWeeks,
    setReducedCapacityWeeks,
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
      <div className="sim-mode-row sim-mode-row--compact sim-mt-10">
        <div className="sim-mode-select-wrap">
          <label className="sim-label sim-label--compact">Type de simulation</label>
          <select
            value={simulationMode}
            onChange={(e) => {
              setSimulationMode(e.target.value as "backlog_to_weeks" | "weeks_to_items");
              setActiveChartTab("throughput");
            }}
            className="sim-input sim-input--compact"
          >
            <option value="backlog_to_weeks">Nombre d&apos;items de backlog vers semaines</option>
            <option value="weeks_to_items">Nombre de semaines vers items livrés</option>
          </select>
        </div>
        <label className="sim-check-row sim-mode-zero-toggle sim-mode-zero-toggle--compact">
          <input
            type="checkbox"
            checked={includeZeroWeeks}
            onChange={(e) => setIncludeZeroWeeks(e.target.checked)}
          />
          <span title="Inclure les semaines sans ticket fermé rend la prévision plus prudente.">
            Inclure les semaines à 0
          </span>
        </label>
      </div>

      <div className="sim-grid-2 sim-grid-2--compact sim-mt-10">
        <div>
          <label className="sim-label sim-label--compact">
            {simulationMode === "backlog_to_weeks" ? "Backlog (items)" : "Semaines ciblées"}
          </label>
          {simulationMode === "backlog_to_weeks" ? (
            <input
              type="number"
              min="1"
              value={backlogSize}
              onChange={(e) => setBacklogSize(e.target.value)}
              className="sim-input sim-input--compact"
            />
          ) : (
            <input
              type="number"
              min="1"
              value={targetWeeks}
              onChange={(e) => setTargetWeeks(e.target.value)}
              className="sim-input sim-input--compact"
            />
          )}
        </div>
        <div>
          <label className="sim-label sim-label--compact">
            Simulations
            <span
              className="sim-help-inline"
              title="Plus de simulations = courbe plus stable, mais calcul un peu plus long."
            >
              (i)
            </span>
          </label>
          <input
            type="number"
            min="1000"
            step="1000"
            value={nSims}
            onChange={(e) => setNSims(e.target.value)}
            className="sim-input sim-input--compact"
          />
        </div>
      </div>

      <div className="sim-grid-2 sim-grid-2--compact sim-mt-10">
        <div>
          <label className="sim-label sim-label--compact">Capacité de l&apos;équipe (%)</label>
          <input
            type="number"
            min="1"
            max="100"
            value={capacityPercent}
            onChange={(e) => setCapacityPercent(e.target.value)}
            className="sim-input sim-input--compact"
          />
        </div>
        <div>
          <label className="sim-label sim-label--compact">Durée réduite (semaines)</label>
          <input
            type="number"
            min="0"
            max="260"
            value={reducedCapacityWeeks}
            onChange={(e) => setReducedCapacityWeeks(e.target.value)}
            className="sim-input sim-input--compact"
          />
        </div>
      </div>
    </>
  );
}
