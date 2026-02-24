import type { NamedEntity } from "../../types";

type TeamStepProps = {
  err: string;
  selectedProject: string;
  teams: NamedEntity[];
  selectedTeam: string;
  setSelectedTeam: (value: string) => void;
  loading: boolean;
  onContinue: () => void | Promise<void>;
};

export default function TeamStep({
  err,
  selectedProject,
  teams,
  selectedTeam,
  setSelectedTeam,
  loading,
  onContinue,
}: TeamStepProps) {
  return (
    <>
      <h2 className="flow-title">Choix de l&apos;équipe</h2>
      <p className="flow-text">
        Projet sélectionné: <b>{selectedProject}</b>
      </p>
      {err && (
        <div className="ui-alert ui-alert--danger">
          <b>Erreur :</b> {err}
        </div>
      )}
      <label className="flow-label">Équipes disponibles</label>
      <select
        value={selectedTeam}
        onChange={(e) => setSelectedTeam(e.target.value)}
        className="flow-input flow-input--team-compact"
      >
        {teams.length === 0 && <option value="">Aucune équipe disponible</option>}
        {teams.map((team) => (
          <option key={team.id || team.name} value={team.name || ""}>
            {team.name}
          </option>
        ))}
      </select>
      <button
        onClick={() => void onContinue()}
        disabled={loading || !selectedTeam}
        className="ui-primary-btn"
      >
        Choisir cette équipe
      </button>
    </>
  );
}
