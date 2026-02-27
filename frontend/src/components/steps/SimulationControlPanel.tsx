import { useEffect, useState } from "react";
import SimulationFilterControls from "./SimulationFilterControls";
import SimulationHistoryRangeControls from "./SimulationHistoryRangeControls";
import SimulationModeAndParametersControls from "./SimulationModeAndParametersControls";
import { useSimulationContext } from "../../hooks/SimulationContext";

type SimulationControlPanelProps = {
  onExpansionChange?: (isExpanded: boolean) => void;
};

function formatIsoDateToFr(dateIso: string): string {
  const [year, month, day] = dateIso.split("-");
  if (!year || !month || !day) return dateIso;
  return `${day}/${month}/${year}`;
}

function formatFrNumber(value: number | string): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return String(value);
  return new Intl.NumberFormat("fr-CA").format(parsed);
}

export default function SimulationControlPanel({ onExpansionChange }: SimulationControlPanelProps) {
  const { selectedTeam, simulation } = useSimulationContext();
  const s = simulation;
  const [openSection, setOpenSection] = useState<"period" | "mode" | "filters" | null>(null);
  const [validationMessage, setValidationMessage] = useState("");

  const modeZeroText = s.includeZeroWeeks ? "incluses" : "exclues";
  const modeSummary =
    s.simulationMode === "backlog_to_weeks"
      ? `Backlog de ${String(s.backlogSize)} items ? ${formatFrNumber(s.nSims)} simulations ? semaines ? 0 ${modeZeroText}`
      : `Horizon de ${String(s.targetWeeks)} semaines ? ${formatFrNumber(s.nSims)} simulations ? semaines ? 0 ${modeZeroText}`;
  const typeListText = s.types.length ? s.types.join(", ") : "Aucun type";
  const stateListText = s.doneStates.length ? s.doneStates.join(", ") : "Aucun ?tat";
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
      setValidationMessage("Ticket et ?tat obligatoires.");
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
          <h3 className="sim-control-heading">P?riode historique</h3>
          <button
            type="button"
            className="sim-advanced-toggle"
            onClick={() => toggleSection("period")}
            aria-expanded={showPeriod}
          >
            {showPeriod ? "R?duire" : "D?velopper"}
          </button>
        </div>
        {!showPeriod && (
          <div className="sim-advanced-summary">
            du {formatIsoDateToFr(s.startDate)} au {formatIsoDateToFr(s.endDate)}
          </div>
        )}
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
            {showMode ? "R?duire" : "D?velopper"}
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
            {showFilters ? "R?duire" : "D?velopper"}
          </button>
        </div>
        {!showFilters && <div className="sim-advanced-summary">{typeListText} {"→"} {stateListText}</div>}
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
