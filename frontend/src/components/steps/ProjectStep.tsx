import { useEffect, useRef } from "react";
import type { NamedEntity } from "../../types";

type ProjectStepProps = {
  err: string;
  selectedOrg: string;
  projects: NamedEntity[];
  selectedProject: string;
  setSelectedProject: (value: string) => void;
  loading: boolean;
  onContinue: () => void | Promise<boolean>;
};

export default function ProjectStep({
  err,
  selectedOrg,
  projects,
  selectedProject,
  setSelectedProject,
  loading,
  onContinue,
}: ProjectStepProps) {
  const projectsSelectRef = useRef<HTMLSelectElement | null>(null);

  useEffect(() => {
    const rafId = window.requestAnimationFrame(() => {
      projectsSelectRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(rafId);
  }, []);

  return (
    <>
      <h2 className="flow-title">Choix du projet</h2>
      <p className="flow-text">
        Organisation sélectionnée: <b>{selectedOrg}</b>
      </p>
      {err && (
        <div className="ui-alert ui-alert--danger">
          <b>Erreur :</b> {err}
        </div>
      )}
      <label className="flow-label">Projets accessibles</label>
      <select
        ref={projectsSelectRef}
        value={selectedProject}
        onChange={(e) => setSelectedProject(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !loading && !!selectedProject) {
            e.preventDefault();
            void onContinue();
          }
        }}
        className="flow-input"
      >
        {projects.length === 0 && <option value="">Aucun projet accessible</option>}
        {projects.map((project) => (
          <option key={project.id || project.name} value={project.name || ""}>
            {project.name}
          </option>
        ))}
      </select>
      <button
        onClick={() => void onContinue()}
        disabled={loading || !selectedProject}
        className="ui-primary-btn"
      >
        {loading ? "Chargement..." : "Choisir ce Projet"}
      </button>
    </>
  );
}
