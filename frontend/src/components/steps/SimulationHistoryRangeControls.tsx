import { useSimulationContext } from "./SimulationContext";

export default function SimulationHistoryRangeControls() {
  const { simulation } = useSimulationContext();
  const { startDate, setStartDate, endDate, setEndDate } = simulation;

  return (
    <div className="sim-grid-2 sim-grid-2--compact">
      <div>
        <label className="sim-label sim-label--compact">Début historique</label>
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
