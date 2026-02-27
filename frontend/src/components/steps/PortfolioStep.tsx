import { keepSelectDropdownAtTop } from "../../utils/selectTopStart";
import type { NamedEntity } from "../../types";
import { usePortfolio } from "../../hooks/usePortfolio";

type PortfolioStepProps = {
  selectedOrg: string;
  selectedProject: string;
  teams: NamedEntity[];
  pat: string;
};

export default function PortfolioStep({ selectedOrg, selectedProject, teams, pat }: PortfolioStepProps) {
  const portfolio = usePortfolio({ selectedOrg, selectedProject, teams, pat });

  return (
    <div className="space-y-4">
      <h2 className="flow-title">Simulation Portefeuille</h2>

      {portfolio.err && (
        <div className="ui-alert ui-alert--danger">
          <b>Erreur :</b> {portfolio.err}
        </div>
      )}
      {portfolio.reportErrors.length > 0 && (
        <div className="ui-alert ui-alert--danger">
          <div className="flex items-center justify-between gap-2">
            <b>Équipes en échec :</b>
            <button type="button" className="sim-advanced-toggle" onClick={portfolio.clearReportErrors}>
              Fermer
            </button>
          </div>
          <ul className="mt-2 list-disc pl-5 text-sm">
            {portfolio.reportErrors.map((teamError) => (
              <li key={teamError.teamName}>
                <b>{teamError.teamName}</b>: {teamError.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <section className="sim-control-section">
        <h3 className="sim-control-heading">Critères généraux</h3>
        <div className="sim-grid-3">
          <label className="sim-label">
            Date de début
            <input
              className="sim-input"
              type="date"
              value={portfolio.startDate}
              onChange={(e) => portfolio.setStartDate(e.target.value)}
            />
          </label>
          <label className="sim-label">
            Date de fin
            <input
              className="sim-input"
              type="date"
              value={portfolio.endDate}
              onChange={(e) => portfolio.setEndDate(e.target.value)}
            />
          </label>
          <label className="sim-label">
            Semaines à 0
            <select
              className="sim-input"
              value={portfolio.includeZeroWeeks ? "1" : "0"}
              onChange={(e) => portfolio.setIncludeZeroWeeks(e.target.value === "1")}
            >
              <option value="1">incluses</option>
              <option value="0">exclues</option>
            </select>
          </label>
        </div>
        <div className="sim-grid-portfolio-line2">
          <label className="sim-label">
            Mode
            <select
              className="sim-input"
              value={portfolio.simulationMode}
              onChange={(e) => portfolio.setSimulationMode(e.target.value as "backlog_to_weeks" | "weeks_to_items")}
            >
              <option value="backlog_to_weeks">Prévoir le délai pour vider un backlog</option>
              <option value="weeks_to_items">Prévoir le volume livré en N semaines</option>
            </select>
          </label>
          {portfolio.simulationMode === "backlog_to_weeks" ? (
            <label className="sim-label">
              Items
              <input
                className="sim-input sim-input--center"
                type="number"
                min={1}
                value={portfolio.backlogSize}
                onChange={(e) => portfolio.setBacklogSize(Number(e.target.value) || 1)}
              />
            </label>
          ) : (
            <label className="sim-label">
              Semaines
              <input
                className="sim-input sim-input--center"
                type="number"
                min={1}
                value={portfolio.targetWeeks}
                onChange={(e) => portfolio.setTargetWeeks(Number(e.target.value) || 1)}
              />
            </label>
          )}
          <label className="sim-label">
            Nombre de simulations
            <input
              className="sim-input sim-input--center"
              type="number"
              min={1000}
              max={200000}
              value={portfolio.nSims}
              onChange={(e) => portfolio.setNSims(Number(e.target.value) || 20000)}
            />
          </label>
          <label
            className="sim-label"
            title="Proportion de la capacité combinée disponible après coûts de synchronisation PI (cérémonies, dépendances, alignement). 100% = équipes totalement indépendantes."
          >
            Taux d'arrimage
            <input
              className="sim-input sim-input--center"
              type="number"
              min={0}
              max={100}
              step={5}
              value={portfolio.arrimageRate}
              onChange={(e) => portfolio.setArrimageRate(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
            />
          </label>
        </div>
      </section>

      <section className="sim-control-section">
        <h3 className="sim-control-heading">Équipes du portefeuille</h3>
        <button
          type="button"
          className="ui-primary-btn"
          disabled={portfolio.availableTeamNames.length === 0}
          onClick={portfolio.openAddModal}
        >
          Ajouter équipe
        </button>

        <div className="space-y-2">
          {portfolio.teamConfigs.map((cfg) => (
            <div key={cfg.teamName} className="sim-history-row">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm">
                  <b>{cfg.teamName}</b> - {cfg.types.join(", ")} - {cfg.doneStates.join(", ")}
                </div>
                <button
                  type="button"
                  className="sim-advanced-toggle"
                  onClick={() => portfolio.removeTeam(cfg.teamName)}
                >
                  Retirer
                </button>
              </div>
            </div>
          ))}
          {portfolio.teamConfigs.length === 0 && <div className="sim-empty-tip">Aucune équipe ajoutée.</div>}
        </div>
      </section>

      <button
        type="button"
        className="ui-primary-btn"
        disabled={!portfolio.canGenerate}
        onClick={() => void portfolio.handleGenerateReport()}
      >
        {portfolio.loadingReport ? "Génération du rapport..." : "Générer rapport portefeuille"}
      </button>
      {portfolio.reportProgressLabel && (
        <div className="sim-advanced-summary">
          {portfolio.reportProgressLabel} ({portfolio.generationProgress.done}/{portfolio.generationProgress.total})
        </div>
      )}

      {portfolio.showAddModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4">
          <div className="w-full max-w-4xl rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4 shadow-2xl">
            <h3 className="sim-control-heading">Ajouter équipe</h3>
            {portfolio.modalErr && (
              <div className="ui-alert ui-alert--danger">
                <b>Erreur :</b> {portfolio.modalErr}
              </div>
            )}
            <label className="sim-label">
              Équipe
              <select
                className="sim-input"
                value={portfolio.modalTeamName}
                onFocus={keepSelectDropdownAtTop}
                onMouseDown={keepSelectDropdownAtTop}
                onChange={(e) => portfolio.onModalTeamNameChange(e.target.value)}
              >
                {portfolio.availableTeamNames.length === 0 && (
                  <option value="">Toutes les équipes sont déjà ajoutées</option>
                )}
                {portfolio.availableTeamNames.map((teamName) => (
                  <option key={teamName} value={teamName}>
                    {teamName}
                  </option>
                ))}
              </select>
            </label>
            {portfolio.modalHasQuickFilterConfig && (
              <button
                type="button"
                className="sim-advanced-toggle"
                disabled={portfolio.modalLoading}
                onClick={portfolio.applyModalQuickFilterConfig}
              >
                Configuration rapide
              </button>
            )}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="sim-label">Type de ticket</label>
                <div className="sim-checklist" style={{ maxHeight: 220 }}>
                  {portfolio.modalLoading && <div className="sim-empty-tip">Chargement...</div>}
                  {!portfolio.modalLoading &&
                    portfolio.modalTypeOptions.map((ticketType) => (
                      <label key={ticketType} className="sim-check-row">
                        <input
                          type="checkbox"
                          checked={portfolio.modalTypes.includes(ticketType)}
                          onChange={(e) => portfolio.toggleModalType(ticketType, e.target.checked)}
                        />
                        <span>{ticketType}</span>
                      </label>
                    ))}
                </div>
              </div>

              <div>
                <label className="sim-label">État</label>
                <div className="sim-checklist sim-checklist--states" style={{ maxHeight: 220 }}>
                  {portfolio.modalAvailableStates.map((state) => (
                    <label key={state} className="sim-check-row">
                      <input
                        type="checkbox"
                        checked={portfolio.modalDoneStates.includes(state)}
                        disabled={portfolio.modalTypes.length === 0}
                        onChange={(e) => portfolio.toggleModalState(state, e.target.checked)}
                      />
                      <span>{state}</span>
                    </label>
                  ))}
                  {portfolio.modalTypes.length === 0 && (
                    <div className="sim-empty-tip">Sélectionnez d&apos;abord un ou plusieurs tickets.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button type="button" className="sim-advanced-toggle" onClick={portfolio.closeAddModal}>
                Annuler
              </button>
              <button type="button" className="ui-primary-btn" onClick={portfolio.validateAddModal}>
                Valider
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
