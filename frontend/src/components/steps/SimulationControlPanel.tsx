import { useEffect, useState } from "react";
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
    | "capacityPercent"
    | "setCapacityPercent"
    | "reducedCapacityWeeks"
    | "setReducedCapacityWeeks"
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
    | "loadingTeamOptions"
    | "loading"
    | "runForecast"
    | "setActiveChartTab"
  >;
};

export default function SimulationControlPanel({ selectedTeam, simulation }: SimulationControlPanelProps) {
  const {
    loading,
    runForecast,
    types,
    doneStates,
    startDate,
    endDate,
    simulationMode,
    backlogSize,
    targetWeeks,
    includeZeroWeeks,
    capacityPercent,
    reducedCapacityWeeks,
    nSims,
  } = simulation;
  const [showPeriod, setShowPeriod] = useState(false);
  const [showMode, setShowMode] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [validationMessage, setValidationMessage] = useState("");

  const modeKind = simulationMode === "backlog_to_weeks" ? "item" : "semaine";
  const modeValue = simulationMode === "backlog_to_weeks" ? backlogSize : targetWeeks;
  const modeZeroText = includeZeroWeeks ? "incluses" : "non incluses";
  const capacitySummary = `${String(capacityPercent)}% pendant ${String(reducedCapacityWeeks)} sem.`;
  const typeListText = types.length ? types.join(", ") : "aucun";
  const stateListText = doneStates.length ? doneStates.join(", ") : "aucun";
  const hasRequiredFilters = types.length > 0 && doneStates.length > 0;
  const canRunSimulation = !loading && !!selectedTeam && hasRequiredFilters;

  function toggleSection(section: "period" | "mode" | "filters"): void {
    if (section === "period") {
      setShowPeriod((prev) => {
        const next = !prev;
        setShowMode(false);
        setShowFilters(false);
        return next;
      });
      return;
    }
    if (section === "mode") {
      setShowMode((prev) => {
        const next = !prev;
        setShowPeriod(false);
        setShowFilters(false);
        return next;
      });
      return;
    }
    setShowFilters((prev) => {
      const next = !prev;
      setShowPeriod(false);
      setShowMode(false);
      return next;
    });
  }

  async function handleRunForecast(): Promise<void> {
    if (!hasRequiredFilters) {
      setValidationMessage("Ticket et État obligatoires.");
      return;
    }
    setValidationMessage("");
    setShowPeriod(false);
    setShowMode(false);
    setShowFilters(false);
    await runForecast();
  }

  useEffect(() => {
    if (hasRequiredFilters && validationMessage) {
      setValidationMessage("");
    }
  }, [hasRequiredFilters, validationMessage]);

  return (
    <>
      <section className="sim-control-section sim-control-section--compact">
        <div className="sim-advanced-header">
          <h3 className="sim-control-heading">Période historique</h3>
          <button
            type="button"
            className="sim-advanced-toggle"
            onClick={() => toggleSection("period")}
            aria-expanded={showPeriod}
          >
            {showPeriod ? "Réduire" : "Développer"}
          </button>
        </div>
        <div className="sim-advanced-summary">du {startDate} au {endDate}</div>
        {showPeriod && <SimulationHistoryRangeControls simulation={simulation} />}
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
            {showMode ? "Réduire" : "Développer"}
          </button>
        </div>
        <div className="sim-advanced-summary">
          Type {modeKind} : {String(modeValue)} 0 {modeZeroText} sur {String(nSims)} simulations ; capacité {capacitySummary}
        </div>
        {showMode && <SimulationModeAndParametersControls simulation={simulation} />}
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
            {showFilters ? "Réduire" : "Développer"}
          </button>
        </div>
        <div className="sim-advanced-summary">
          type {typeListText} ; états {stateListText}
        </div>
        {showFilters && <SimulationFilterControls simulation={simulation} />}
      </section>

      <button
        onClick={() => void handleRunForecast()}
        disabled={loading || !selectedTeam}
        className={`ui-primary-btn ${!canRunSimulation ? "ui-primary-btn--disabled" : ""}`}
      >
        {loading ? "Calcul..." : "Lancer la simulation"}
      </button>
      {validationMessage && (
        <div className="sim-validation-error">{validationMessage}</div>
      )}
    </>
  );
}
