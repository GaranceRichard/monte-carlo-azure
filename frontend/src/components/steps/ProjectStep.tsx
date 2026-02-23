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
  return (
    <>
      <h2 style={{ marginTop: 0 }}>Choix du projet</h2>
      <p style={{ color: "var(--muted)" }}>
        Organisation selectionnee: <b>{selectedOrg}</b>
      </p>
      {err && (
        <div style={{ background: "var(--dangerBg)", border: "1px solid var(--dangerBorder)", padding: 12, borderRadius: 10, marginTop: 14 }}>
          <b>Erreur :</b> {err}
        </div>
      )}
      <label style={{ display: "block", marginTop: 12, color: "var(--muted)" }}>Projets accessibles</label>
      <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)} style={{ width: "100%", padding: 10, marginTop: 6 }}>
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
        style={{ width: "100%", marginTop: 16, padding: 12, borderRadius: 12, border: "1px solid var(--border)", background: loading ? "var(--softBorder)" : "var(--btnBg)", color: loading ? "var(--text)" : "var(--btnText)", cursor: loading || !selectedProject ? "not-allowed" : "pointer", fontWeight: 700 }}
      >
        {loading ? "Chargement..." : "Choisir ce Projet"}
      </button>
    </>
  );
}
