import { useEffect, useState } from "react";
import SimulationFilterControls from "./SimulationFilterControls";
import SimulationHistoryRangeControls from "./SimulationHistoryRangeControls";
import SimulationModeAndParametersControls from "./SimulationModeAndParametersControls";
import { useSimulationContext } from "../../hooks/SimulationContext";

type SimulationControlPanelProps = {
  onExpansionChange?: (isExpanded: boolean) => void;
};

export default function SimulationControlPanel({ onExpansionChange }: SimulationControlPanelProps) {
  const { selectedTeam, simulation } = useSimulationContext();
  const s = simulation;
  const [openSection, setOpenSection] = useState<"period" | "mode" | "filters" | null>(null);
  const [validationMessage, setValidationMessage] = useState("");

  const modeZeroText = s.includeZeroWeeks ? "incluses" : "non incluses";
  const modeSummary =
    s.simulationMode === "backlog_to_weeks"
      ? `Objectif backlog: ${String(s.backlogSize)} items, semaines a 0 ${modeZeroText}, ${String(s.nSims)} simulations`
      : `Objectif livraison: ${String(s.targetWeeks)} semaines, semaines a 0 ${modeZeroText}, ${String(s.nSims)} simulations`;
  const typeListText = s.types.length ? s.types.join(", ") : "aucun";
  const stateListText = s.doneStates.length ? s.doneStates.join(", ") : "aucun";
  const hasRequiredFilters = s.types.length > 0 && s.doneStates.length > 0;
  const canRunSimulation = !s.loading && !!selectedTeam && hasRequiredFilters;
  const showPeriod = openSection === "period";
  const showMode = openSection === "mode";
  const showFilters = openSection === "filters";

  function toggleSection(section: "period" | "mode" | "filters"): void {
    setOpenSection((current) => {
      const next = current === section ? null : section;
      if (next === "filters" && s.hasLaunchedOnce) {
        s.resetSimulationResults();
      }
      return next;
    });
  }

  async function handleRunForecast(): Promise<void> {
    if (!hasRequiredFilters) {
      setValidationMessage("Ticket et Etat obligatoires.");
      return;
    }
    setValidationMessage("");
    setOpenSection(null);
    await s.runForecast();
  }

  useEffect(() => {
    if (hasRequiredFilters && validationMessage) {
      setValidationMessage("");
    }
  }, [hasRequiredFilters, validationMessage]);

  useEffect(() => {
    onExpansionChange?.(openSection !== null);
  }, [openSection, onExpansionChange]);

  return (
    <>
      <section className="sim-control-section sim-control-section--compact">
        <div className="sim-advanced-header">
          <h3 className="sim-control-heading">Periode historique</h3>
          <button
            type="button"
            className="sim-advanced-toggle"
            onClick={() => toggleSection("period")}
            aria-expanded={showPeriod}
          >
            {showPeriod ? "Reduire" : "Developper"}
          </button>
        </div>
        {!showPeriod && <div className="sim-advanced-summary">du {s.startDate} au {s.endDate}</div>}
        {showPeriod && <SimulationHistoryRangeControls />}
      </section>
      <section className="sim-control-section sim-control-section--compact">
        <div className="sim-advanced-header">
          <h3 className="sim-control-heading">Mode de simulation</h3>
          <button
            type="button"
            className="sim-advanced-toggle"
            onClick={() => toggleSection("mode")}
            aria-expanded={showMode}
          >
            {showMode ? "Reduire" : "Developper"}
          </button>
        </div>
        {!showMode && (
          <div className="sim-advanced-summary">
            {modeSummary}
          </div>
        )}
        {showMode && <SimulationModeAndParametersControls />}
      </section>
      <section className="sim-control-section">
        <div className="sim-advanced-header">
          <h3 className="sim-control-heading">Filtres de tickets</h3>
          <button
            type="button"
            className="sim-advanced-toggle"
            onClick={() => toggleSection("filters")}
            aria-expanded={showFilters}
          >
            {showFilters ? "Reduire" : "Developper"}
          </button>
        </div>
        {!showFilters && <div className="sim-advanced-summary">type {typeListText} ; etats {stateListText}</div>}
        {showFilters && <SimulationFilterControls />}
      </section>

      {!s.hasLaunchedOnce && (
        <button
          onClick={() => void handleRunForecast()}
          disabled={s.loading || !selectedTeam}
          className={`ui-primary-btn ${!canRunSimulation ? "ui-primary-btn--disabled" : ""}`}
        >
          {s.loading ? "Calcul..." : "Lancer la simulation"}
        </button>
      )}
      {validationMessage && <div className="sim-validation-error">{validationMessage}</div>}
    </>
  );
}

