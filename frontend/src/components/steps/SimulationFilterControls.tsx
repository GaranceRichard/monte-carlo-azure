import { useSimulationContext } from "./SimulationContext";

export default function SimulationFilterControls() {
  const { simulation } = useSimulationContext();
  const {
    workItemTypeOptions,
    types,
    setTypes,
    filteredDoneStateOptions,
    doneStates,
    setDoneStates,
    loadingTeamOptions,
  } = simulation;

  return (
    <>
      <label className="sim-label sim-mt-10">Types de tickets pris en compte</label>
      <div className="sim-checklist">
        {loadingTeamOptions && (
          <div className="sim-empty-tip">Chargement des types de tickets...</div>
        )}
        {workItemTypeOptions.map((ticketType) => (
          <label key={ticketType} className="sim-check-row">
            <input
              type="checkbox"
              checked={types.includes(ticketType)}
              onChange={(e) => {
                setTypes((prev) => {
                  const next = e.target.checked ? [...prev, ticketType] : prev.filter((t) => t !== ticketType);
                  return next;
                });
              }}
            />
            <span>{ticketType}</span>
          </label>
        ))}
      </div>

      <label className="sim-label sim-mt-10">États de résolution</label>
      <div className="sim-checklist sim-checklist--states">
        {loadingTeamOptions && (
          <div className="sim-empty-tip">Chargement des états de résolution...</div>
        )}
        {filteredDoneStateOptions.map((state) => (
          <label key={state} className="sim-check-row">
            <input
              type="checkbox"
              checked={doneStates.includes(state)}
              disabled={!types.length}
              onChange={(e) => {
                setDoneStates((prev) => (e.target.checked ? [...prev, state] : prev.filter((s) => s !== state)));
              }}
            />
            <span>{state}</span>
          </label>
        ))}
        {!types.length && (
          <div className="sim-empty-tip">
            Sélectionnez d&apos;abord un ou plusieurs tickets.
          </div>
        )}
      </div>
    </>
  );
}
