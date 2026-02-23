import SimulationChartTabs from "./SimulationChartTabs";
import SimulationControlPanel from "./SimulationControlPanel";
import SimulationResultsPanel from "./SimulationResultsPanel";
import type { SimulationViewModel } from "../../hooks/useSimulation";

type SimulationStepProps = {
  selectedTeam: string;
  simulation: SimulationViewModel;
};

export default function SimulationStep({ selectedTeam, simulation }: SimulationStepProps) {
  const { err } = simulation;

  return (
    <>
      <div className="sim-title">Equipe: {selectedTeam}</div>

      {err && (
        <div className="sim-error">
          <b>Erreur :</b> {err}
        </div>
      )}

      <div className="sim-layout">
        <div className="sim-controls">
          <SimulationControlPanel selectedTeam={selectedTeam} simulation={simulation} />
          <SimulationResultsPanel simulation={simulation} />
        </div>
        <SimulationChartTabs simulation={simulation} />
      </div>
    </>
  );
}
