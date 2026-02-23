import type { SimulationViewModel } from "../../hooks/useSimulation";

type SimulationFilterControlsProps = {
  simulation: Pick<
    SimulationViewModel,
    | "workItemTypeOptions"
    | "types"
    | "setTypes"
    | "filteredDoneStateOptions"
    | "doneStates"
    | "setDoneStates"
    | "loadingTeamOptions"
  >;
};

export default function SimulationFilterControls({ simulation }: SimulationFilterControlsProps) {
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

      <label className="sim-label sim-mt-10">Etats de resolution</label>
      <div className="sim-checklist sim-checklist--states">
        {loadingTeamOptions && (
          <div className="sim-empty-tip">Chargement des etats de resolution...</div>
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
            Selectionnez d&apos;abord un ou plusieurs tickets.
          </div>
        )}
      </div>
    </>
  );
}
