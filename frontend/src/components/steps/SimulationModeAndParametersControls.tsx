import { useSimulationContext } from "../../hooks/SimulationContext";
import {
  SIMULATION_BACKLOG_SIZE_MAX,
  SIMULATION_BACKLOG_SIZE_MIN,
  SIMULATION_HORIZON_WEEKS_MAX,
  SIMULATION_N_SIMS_MAX,
  SIMULATION_N_SIMS_MIN,
  SIMULATION_TARGET_WEEKS_MIN,
} from "../../simulationLimits";
import { keepSelectDropdownAtTop } from "../../utils/selectTopStart";

export default function SimulationModeAndParametersControls() {
  const { simulation: s } = useSimulationContext();

  return (
    <>
      <div className="sim-mode-row sim-mode-row--compact sim-mt-10">
        <div className="sim-mode-select-wrap">
          <label className="sim-label sim-label--compact">Type de simulation</label>
          <select
            value={s.simulationMode}
            onFocus={keepSelectDropdownAtTop}
            onMouseDown={keepSelectDropdownAtTop}
            onChange={(e) => {
              s.setSimulationMode(e.target.value as "backlog_to_weeks" | "weeks_to_items");
              s.setActiveChartTab("cycle_time");
            }}
            className="sim-input sim-input--compact"
          >
            <option value="backlog_to_weeks">Prévoir le délai pour vider un backlog</option>
            <option value="weeks_to_items">Prévoir le volume livré en N semaines</option>
          </select>
        </div>
        <label className="sim-check-row sim-mode-zero-toggle sim-mode-zero-toggle--compact">
          <input
            type="checkbox"
            checked={s.includeZeroWeeks}
            onChange={(e) => s.setIncludeZeroWeeks(e.target.checked)}
          />
          <span title="Inclure les semaines sans ticket fermé rend la prévision plus prudente.">
            Inclure les semaines à 0
          </span>
        </label>
      </div>

      <div className="sim-grid-2 sim-grid-2--compact sim-mt-10">
        <div>
          <label className="sim-label sim-label--compact">
            {s.simulationMode === "backlog_to_weeks" ? "Backlog (items)" : "Semaines ciblées"}
          </label>
          {s.simulationMode === "backlog_to_weeks" ? (
            <input
              type="number"
              min={SIMULATION_BACKLOG_SIZE_MIN}
              max={SIMULATION_BACKLOG_SIZE_MAX}
              value={s.backlogSize}
              onChange={(e) => s.setBacklogSize(e.target.value)}
              className="sim-input sim-input--compact"
            />
          ) : (
            <input
              type="number"
              min={SIMULATION_TARGET_WEEKS_MIN}
              max={SIMULATION_HORIZON_WEEKS_MAX}
              value={s.targetWeeks}
              onChange={(e) => s.setTargetWeeks(e.target.value)}
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
            min={SIMULATION_N_SIMS_MIN}
            max={SIMULATION_N_SIMS_MAX}
            step="1000"
            value={s.nSims}
            onChange={(e) => s.setNSims(e.target.value)}
            className="sim-input sim-input--compact"
          />
        </div>
      </div>
    </>
  );
}

