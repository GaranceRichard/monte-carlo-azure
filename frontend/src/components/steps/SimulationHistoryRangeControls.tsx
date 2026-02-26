import { useSimulationContext } from "../../hooks/SimulationContext";

export default function SimulationHistoryRangeControls() {
  const { simulation: s } = useSimulationContext();

  return (
    <div className="sim-grid-2 sim-grid-2--compact">
      <div>
        <label className="sim-label sim-label--compact">Début historique</label>
        <input
          type="date"
          value={s.startDate}
          onChange={(e) => s.setStartDate(e.target.value)}
          className="sim-input sim-input--compact"
        />
      </div>
      <div>
        <label className="sim-label sim-label--compact">Fin historique</label>
        <input
          type="date"
          value={s.endDate}
          onChange={(e) => s.setEndDate(e.target.value)}
          className="sim-input sim-input--compact"
        />
      </div>
    </div>
  );
}

