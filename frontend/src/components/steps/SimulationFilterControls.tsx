import { useSimulationContext } from "../../hooks/SimulationContext";

export default function SimulationFilterControls() {
  const { simulation: s } = useSimulationContext();

  return (
    <>
      <button
        type="button"
        className="sim-advanced-toggle"
        onClick={s.applyQuickFilterConfig}
        disabled={!s.hasQuickFilterConfig || s.loadingTeamOptions}
      >
        Configuration rapide
      </button>
      <label className="sim-label sim-mt-10">Types de tickets pris en compte</label>
      <div className="sim-checklist">
        {s.loadingTeamOptions && <div className="sim-empty-tip">Chargement des types de tickets...</div>}
        {s.workItemTypeOptions.map((ticketType) => (
          <label key={ticketType} className="sim-check-row">
            <input
              type="checkbox"
              checked={s.types.includes(ticketType)}
              onChange={(e) => {
                s.setTypes((prev) => (e.target.checked ? [...prev, ticketType] : prev.filter((t) => t !== ticketType)));
              }}
            />
            <span>{ticketType}</span>
          </label>
        ))}
      </div>

      <label className="sim-label sim-mt-10">États de résolution</label>
      <div className="sim-checklist sim-checklist--states">
        {s.loadingTeamOptions && <div className="sim-empty-tip">Chargement des états de résolution...</div>}
        {s.filteredDoneStateOptions.map((state) => (
          <label key={state} className="sim-check-row">
            <input
              type="checkbox"
              checked={s.doneStates.includes(state)}
              disabled={!s.types.length}
              onChange={(e) => {
                s.setDoneStates((prev) => (e.target.checked ? [...prev, state] : prev.filter((v) => v !== state)));
              }}
            />
            <span>{state}</span>
          </label>
        ))}
        {!s.types.length && <div className="sim-empty-tip">Sélectionnez d&apos;abord un ou plusieurs tickets.</div>}
      </div>
    </>
  );
}

