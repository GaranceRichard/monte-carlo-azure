import SimulationFilterControls from "./SimulationFilterControls";
import SimulationHistoryRangeControls from "./SimulationHistoryRangeControls";
import SimulationModeAndParametersControls from "./SimulationModeAndParametersControls";
import type { SimulationViewModel } from "../../hooks/useSimulation";

type SimulationControlPanelProps = {
  selectedTeam: string;
  simulation: Pick<
    SimulationViewModel,
    | "startDate"
    | "setStartDate"
    | "endDate"
    | "setEndDate"
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
    | "workItemTypeOptions"
    | "types"
    | "setTypes"
    | "filteredDoneStateOptions"
    | "doneStates"
    | "setDoneStates"
    | "loadingTeamOptions"
    | "loading"
    | "runForecast"
    | "setActiveChartTab"
  >;
};

export default function SimulationControlPanel({ selectedTeam, simulation }: SimulationControlPanelProps) {
  const { loading, runForecast } = simulation;

  return (
    <>
      <section className="sim-control-section">
        <h3 className="sim-control-heading">Periode historique</h3>
        <SimulationHistoryRangeControls simulation={simulation} />
      </section>
      <section className="sim-control-section">
        <h3 className="sim-control-heading">Mode de simulation</h3>
        <SimulationModeAndParametersControls simulation={simulation} />
      </section>
      <section className="sim-control-section">
        <h3 className="sim-control-heading">Filtres de tickets</h3>
        <SimulationFilterControls simulation={simulation} />
      </section>

      <button
        onClick={() => void runForecast()}
        disabled={loading || !selectedTeam}
        className={`ui-primary-btn ${loading || !selectedTeam ? "ui-primary-btn--disabled" : ""}`}
      >
        {loading ? "Calcul..." : "Lancer la simulation"}
      </button>
    </>
  );
}
