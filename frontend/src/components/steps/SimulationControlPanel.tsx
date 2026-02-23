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
    | "loading"
    | "runForecast"
    | "setActiveChartTab"
  >;
};

export default function SimulationControlPanel({ selectedTeam, simulation }: SimulationControlPanelProps) {
  const { loading, runForecast } = simulation;

  return (
    <>
      <SimulationHistoryRangeControls simulation={simulation} />
      <SimulationModeAndParametersControls simulation={simulation} />
      <SimulationFilterControls simulation={simulation} />

      <button
        onClick={() => void runForecast()}
        disabled={loading || !selectedTeam}
        className={`sim-primary-btn ${loading || !selectedTeam ? "sim-primary-btn--disabled" : ""}`}
      >
        {loading ? "Calcul..." : "Lancer la simulation"}
      </button>
    </>
  );
}
