import type { SimulationViewModel } from "../../hooks/useSimulation";

type SimulationHistoryRangeControlsProps = {
  simulation: Pick<SimulationViewModel, "startDate" | "setStartDate" | "endDate" | "setEndDate">;
};

export default function SimulationHistoryRangeControls({ simulation }: SimulationHistoryRangeControlsProps) {
  const { startDate, setStartDate, endDate, setEndDate } = simulation;

  return (
    <div className="sim-grid-2 sim-grid-2--compact">
      <div>
        <label className="sim-label sim-label--compact">Debut historique</label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="sim-input sim-input--compact"
        />
      </div>
      <div>
        <label className="sim-label sim-label--compact">Fin historique</label>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="sim-input sim-input--compact"
        />
      </div>
    </div>
  );
}
