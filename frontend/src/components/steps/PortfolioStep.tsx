import { useMemo, useState } from "react";
import type { NamedEntity } from "../../types";
import { getTeamOptionsDirect } from "../../adoClient";
import { runSimulationForecast } from "../../hooks/simulationForecastService";
import { nWeeksAgo, today } from "../../date";
import { keepSelectDropdownAtTop } from "../../utils/selectTopStart";
import { sortTeams } from "../../utils/teamSort";

type TeamPortfolioConfig = {
  teamName: string;
  workItemTypeOptions: string[];
  statesByType: Record<string, string[]>;
  types: string[];
  doneStates: string[];
};

type PortfolioStepProps = {
  selectedOrg: string;
  selectedProject: string;
  teams: NamedEntity[];
  pat: string;
};

export default function PortfolioStep({ selectedOrg, selectedProject, teams, pat }: PortfolioStepProps) {
  const [startDate, setStartDate] = useState<string>(nWeeksAgo(26));
  const [endDate, setEndDate] = useState<string>(today());
  const [simulationMode, setSimulationMode] = useState<"backlog_to_weeks" | "weeks_to_items">("backlog_to_weeks");
  const [includeZeroWeeks, setIncludeZeroWeeks] = useState<boolean>(true);
  const [backlogSize, setBacklogSize] = useState<number>(120);
  const [targetWeeks, setTargetWeeks] = useState<number>(12);
  const [nSims, setNSims] = useState<number>(20000);

  const [loadingReport, setLoadingReport] = useState<boolean>(false);
  const [err, setErr] = useState<string>("");
  const [modalErr, setModalErr] = useState<string>("");
  const [teamConfigs, setTeamConfigs] = useState<TeamPortfolioConfig[]>([]);

  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [modalLoading, setModalLoading] = useState<boolean>(false);
  const [modalTeamName, setModalTeamName] = useState<string>("");
  const [modalTypeOptions, setModalTypeOptions] = useState<string[]>([]);
  const [modalStatesByType, setModalStatesByType] = useState<Record<string, string[]>>({});
  const [modalTypes, setModalTypes] = useState<string[]>([]);
  const [modalDoneStates, setModalDoneStates] = useState<string[]>([]);

  const sortedTeams = useMemo(() => sortTeams(teams), [teams]);
  const availableTeamNames = useMemo(() => {
    const selected = new Set(teamConfigs.map((t) => t.teamName));
    return sortedTeams.map((t) => t.name || "").filter((name) => !!name && !selected.has(name));
  }, [sortedTeams, teamConfigs]);

  const modalAvailableStates = useMemo(() => {
    const out = new Set<string>();
    for (const type of modalTypes) {
      for (const state of modalStatesByType[type] || []) out.add(state);
    }
    return Array.from(out).sort();
  }, [modalTypes, modalStatesByType]);

  const canGenerate = teamConfigs.length > 0 && !loadingReport;

  async function loadTeamOptions(teamName: string): Promise<void> {
    if (!teamName) {
      setModalTypeOptions([]);
      setModalStatesByType({});
      setModalTypes([]);
      setModalDoneStates([]);
      return;
    }
    setModalLoading(true);
    try {
      const options = await getTeamOptionsDirect(selectedOrg, selectedProject, teamName, pat);
      setModalTypeOptions(options.workItemTypes);
      setModalStatesByType(options.statesByType || {});
      setModalTypes([]);
      setModalDoneStates([]);
    } catch (e: unknown) {
      setModalErr(e instanceof Error ? e.message : String(e));
    } finally {
      setModalLoading(false);
    }
  }

  function openAddModal(): void {
    setErr("");
    setModalErr("");
    const initialTeam = availableTeamNames[0] ?? "";
    setModalTeamName(initialTeam);
    setModalTypeOptions([]);
    setModalStatesByType({});
    setModalTypes([]);
    setModalDoneStates([]);
    setShowAddModal(true);
    void loadTeamOptions(initialTeam);
  }

  function closeAddModal(): void {
    setShowAddModal(false);
    setModalErr("");
  }

  function toggleModalType(ticketType: string, checked: boolean): void {
    setModalErr("");
    const nextTypes = checked ? [...modalTypes, ticketType] : modalTypes.filter((t) => t !== ticketType);
    setModalTypes(nextTypes);
    const allowed = new Set(nextTypes.flatMap((type) => modalStatesByType[type] || []));
    setModalDoneStates((prev) => prev.filter((state) => allowed.has(state)));
  }

  function toggleModalState(state: string, checked: boolean): void {
    setModalErr("");
    setModalDoneStates((prev) => (checked ? [...prev, state] : prev.filter((s) => s !== state)));
  }

  function validateAddModal(): void {
    if (!modalTeamName) {
      setModalErr("Selectionnez une equipe.");
      return;
    }
    if (modalTypes.length === 0 || modalDoneStates.length === 0) {
      setModalErr("Selectionnez au moins un type et un etat.");
      return;
    }
    if (teamConfigs.some((cfg) => cfg.teamName === modalTeamName)) {
      setModalErr("Cette equipe est deja ajoutee.");
      return;
    }

    setTeamConfigs((prev) => [
      ...prev,
      {
        teamName: modalTeamName,
        workItemTypeOptions: modalTypeOptions,
        statesByType: modalStatesByType,
        types: [...modalTypes],
        doneStates: [...modalDoneStates],
      },
    ]);
    setShowAddModal(false);
    setModalErr("");
  }

  function removeTeam(teamName: string): void {
    setTeamConfigs((prev) => prev.filter((cfg) => cfg.teamName !== teamName));
  }

  async function handleGenerateReport(): Promise<void> {
    if (!teamConfigs.length) return;

    setErr("");
    setLoadingReport(true);
    try {
      const sections = [];
      for (const cfg of teamConfigs) {
        const forecast = await runSimulationForecast({
          selectedOrg,
          selectedProject,
          selectedTeam: cfg.teamName,
          pat,
          startDate,
          endDate,
          doneStates: cfg.doneStates,
          types: cfg.types,
          includeZeroWeeks,
          simulationMode,
          backlogSize,
          targetWeeks,
          nSims,
          capacityPercent: 100,
          reducedCapacityWeeks: 0,
        });
        sections.push({
          selectedTeam: cfg.teamName,
          simulationMode,
          includeZeroWeeks,
          backlogSize: Number(backlogSize),
          targetWeeks: Number(targetWeeks),
          nSims: Number(nSims),
          resultKind: forecast.result.result_kind,
          riskScore: forecast.result.risk_score,
          distribution: forecast.result.result_distribution,
          weeklyThroughput: forecast.weeklyThroughput,
          displayPercentiles: forecast.result.result_percentiles,
        });
      }

      const { exportPortfolioPrintReport } = await import("./portfolioPrintReport");
      exportPortfolioPrintReport({
        selectedProject,
        startDate,
        endDate,
        sections,
      });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingReport(false);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="flow-title">Simulation Portefeuille</h2>
      <p className="flow-text">Projet selectionne: <b>{selectedProject}</b></p>

      {err && (
        <div className="ui-alert ui-alert--danger">
          <b>Erreur :</b> {err}
        </div>
      )}

      <section className="sim-control-section">
        <h3 className="sim-control-heading">Criteres generaux</h3>
        <div className="sim-grid-2">
          <label className="sim-label">
            Date de debut
            <input className="sim-input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label className="sim-label">
            Date de fin
            <input className="sim-input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
        </div>
        <div className="sim-grid-2">
          <label className="sim-label">
            Mode
            <select className="sim-input" value={simulationMode} onChange={(e) => setSimulationMode(e.target.value as "backlog_to_weeks" | "weeks_to_items")}>
              <option value="backlog_to_weeks">backlog_to_weeks</option>
              <option value="weeks_to_items">weeks_to_items</option>
            </select>
          </label>
          {simulationMode === "backlog_to_weeks" ? (
            <label className="sim-label">
              Backlog
              <input className="sim-input" type="number" min={1} value={backlogSize} onChange={(e) => setBacklogSize(Number(e.target.value) || 1)} />
            </label>
          ) : (
            <label className="sim-label">
              Cible (semaines)
              <input className="sim-input" type="number" min={1} value={targetWeeks} onChange={(e) => setTargetWeeks(Number(e.target.value) || 1)} />
            </label>
          )}
        </div>
        <div className="sim-grid-2">
          <label className="sim-label">
            Nombre de simulations
            <input className="sim-input" type="number" min={1000} max={200000} value={nSims} onChange={(e) => setNSims(Number(e.target.value) || 20000)} />
          </label>
          <label className="sim-label">
            Semaines a 0
            <select className="sim-input" value={includeZeroWeeks ? "1" : "0"} onChange={(e) => setIncludeZeroWeeks(e.target.value === "1")}>
              <option value="1">incluses</option>
              <option value="0">exclues</option>
            </select>
          </label>
        </div>
      </section>

      <section className="sim-control-section">
        <h3 className="sim-control-heading">Equipes du portefeuille</h3>
        <button type="button" className="ui-primary-btn" disabled={availableTeamNames.length === 0} onClick={openAddModal}>
          Ajouter equipe
        </button>

        <div className="space-y-2">
          {teamConfigs.map((cfg) => (
            <div key={cfg.teamName} className="sim-history-row">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm">
                  <b>{cfg.teamName}</b> - {cfg.types.join(", ")} - {cfg.doneStates.join(", ")}
                </div>
                <button type="button" className="sim-advanced-toggle" onClick={() => removeTeam(cfg.teamName)}>
                  Retirer
                </button>
              </div>
            </div>
          ))}
          {teamConfigs.length === 0 && <div className="sim-empty-tip">Aucune equipe ajoutee.</div>}
        </div>
      </section>

      <button type="button" className="ui-primary-btn" disabled={!canGenerate} onClick={() => void handleGenerateReport()}>
        {loadingReport ? "Generation du rapport..." : "Generer rapport portefeuille"}
      </button>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4">
          <div className="w-full max-w-4xl rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4 shadow-2xl">
            <h3 className="sim-control-heading">Ajouter equipe</h3>
            {modalErr && (
              <div className="ui-alert ui-alert--danger">
                <b>Erreur :</b> {modalErr}
              </div>
            )}
            <label className="sim-label">
              Equipe
              <select
                className="sim-input"
                value={modalTeamName}
                onFocus={keepSelectDropdownAtTop}
                onMouseDown={keepSelectDropdownAtTop}
                onChange={(e) => {
                  const teamName = e.target.value;
                  setModalErr("");
                  setModalTeamName(teamName);
                  void loadTeamOptions(teamName);
                }}
              >
                {availableTeamNames.length === 0 && <option value="">Toutes les equipes sont deja ajoutees</option>}
                {availableTeamNames.map((teamName) => (
                  <option key={teamName} value={teamName}>
                    {teamName}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="sim-label">Type de ticket</label>
                <div className="sim-checklist" style={{ maxHeight: 220 }}>
                  {modalLoading && <div className="sim-empty-tip">Chargement...</div>}
                  {!modalLoading && modalTypeOptions.map((ticketType) => (
                    <label key={ticketType} className="sim-check-row">
                      <input
                        type="checkbox"
                        checked={modalTypes.includes(ticketType)}
                        onChange={(e) => toggleModalType(ticketType, e.target.checked)}
                      />
                      <span>{ticketType}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="sim-label">Etat</label>
                <div className="sim-checklist sim-checklist--states" style={{ maxHeight: 220 }}>
                  {modalAvailableStates.map((state) => (
                    <label key={state} className="sim-check-row">
                      <input
                        type="checkbox"
                        checked={modalDoneStates.includes(state)}
                        disabled={modalTypes.length === 0}
                        onChange={(e) => toggleModalState(state, e.target.checked)}
                      />
                      <span>{state}</span>
                    </label>
                  ))}
                  {modalTypes.length === 0 && <div className="sim-empty-tip">Selectionnez d'abord un ou plusieurs tickets.</div>}
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button type="button" className="sim-advanced-toggle" onClick={closeAddModal}>Annuler</button>
              <button type="button" className="ui-primary-btn" onClick={validateAddModal}>Valider</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
