import { useEffect, useMemo, useRef } from "react";
import type { NamedEntity } from "../../types";
import { keepSelectDropdownAtTop } from "../../utils/selectTopStart";
import { sortTeams } from "../../utils/teamSort";

type TeamStepProps = {
  err: string;
  selectedProject: string;
  teams: NamedEntity[];
  selectedTeam: string;
  setSelectedTeam: (value: string) => void;
  loading: boolean;
  onContinue: () => void | Promise<void>;
  onPortfolio?: () => void | Promise<void>;
};

export default function TeamStep({
  err,
  selectedProject,
  teams,
  selectedTeam,
  setSelectedTeam,
  loading,
  onContinue,
  onPortfolio,
}: TeamStepProps) {
  const teamSelectRef = useRef<HTMLSelectElement | null>(null);
  const sortedTeams = useMemo(() => sortTeams(teams), [teams]);

  useEffect(() => {
    const rafId = window.requestAnimationFrame(() => {
      teamSelectRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(rafId);
  }, []);

  return (
    <>
      <h2 className="flow-title">Choix de l&apos;équipe</h2>
      <p className="flow-text">
        Projet sélectionné: <b>{selectedProject}</b>
      </p>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4 text-sm text-[var(--text)]">
        <p className="m-0">
          Cette démo vous laisse choisir votre point d&apos;entrée. Sélectionnez une équipe puis ouvrez soit la
          simulation détaillée, soit la vue portefeuille.
        </p>
        <p className="mt-3 mb-0">
          <b>Simulation</b> : throughput hebdomadaire, percentiles, distributions, probabilités, export CSV et
          rapport.
        </p>
        <p className="mt-2 mb-0">
          <b>Portefeuille</b> : comparaison multi-équipes, scénarios consolidés et rapport PDF de synthèse.
        </p>
      </div>
      {err && (
        <div className="ui-alert ui-alert--danger">
          <b>Erreur :</b> {err}
        </div>
      )}
      <label className="flow-label">Équipes disponibles</label>
      <select
        ref={teamSelectRef}
        value={selectedTeam}
        onChange={(e) => setSelectedTeam(e.target.value)}
        onFocus={keepSelectDropdownAtTop}
        onMouseDown={keepSelectDropdownAtTop}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !loading && !!selectedTeam) {
            e.preventDefault();
            void onContinue();
          }
        }}
        className="flow-input flow-input--team-compact"
      >
        {sortedTeams.length === 0 && <option value="">Aucune équipe disponible</option>}
        {sortedTeams.map((team) => (
          <option key={team.id || team.name} value={team.name || ""}>
            {team.name}
          </option>
        ))}
      </select>
      <div className="team-step-actions">
        <button
          onClick={() => void onContinue()}
          disabled={loading || !selectedTeam}
          className="ui-primary-btn team-step-actions__primary"
          type="button"
        >
          Choisir cette équipe
        </button>
        <button
          onClick={() => void onPortfolio?.()}
          disabled={loading || !selectedTeam}
          className="ui-primary-btn team-step-actions__secondary"
          type="button"
        >
          Portefeuille
        </button>
      </div>
    </>
  );
}

