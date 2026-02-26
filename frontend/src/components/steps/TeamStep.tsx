import { useEffect, useMemo, useRef } from "react";
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
  const teamSelectRef = useRef<HTMLSelectElement | null>(null);
  const sortedTeams = useMemo(() => {
    const normalize = (value: string) =>
      value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
    const prefix = (value: string) => (value.split("-")[0] || value).trim();
    return [...teams].sort((a, b) => {
      const keyA = normalize(prefix(a.name || ""));
      const keyB = normalize(prefix(b.name || ""));
      if (keyA !== keyB) return keyA.localeCompare(keyB, "fr", { sensitivity: "base" });
      return normalize(a.name || "").localeCompare(normalize(b.name || ""), "fr", { sensitivity: "base" });
    });
  }, [teams]);

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
