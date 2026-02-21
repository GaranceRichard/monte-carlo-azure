export default function TeamStep({
  err,
  selectedProject,
  teams,
  selectedTeam,
  setSelectedTeam,
  loading,
  onContinue,
}) {
  return (
    <>
      <h2 style={{ marginTop: 0 }}>Choix de l&apos;équipe</h2>
      <p style={{ color: "var(--muted)" }}>
        Projet sélectionné: <b>{selectedProject}</b>
      </p>
      {err && (
        <div style={{ background: "var(--dangerBg)", border: "1px solid var(--dangerBorder)", padding: 12, borderRadius: 10, marginTop: 14 }}>
          <b>Erreur :</b> {err}
        </div>
      )}
      <label style={{ display: "block", marginTop: 12, color: "var(--muted)" }}>Equipes disponibles</label>
      <select value={selectedTeam} onChange={(e) => setSelectedTeam(e.target.value)} style={{ width: "100%", padding: 10, marginTop: 6 }}>
        {teams.length === 0 && <option value="">Aucune equipe disponible</option>}
        {teams.map((team) => (
          <option key={team.id || team.name} value={team.name || ""}>
            {team.name}
          </option>
        ))}
      </select>
      <button
        onClick={onContinue}
        disabled={loading || !selectedTeam}
        style={{ width: "100%", marginTop: 16, padding: 12, borderRadius: 12, border: "1px solid var(--border)", background: loading ? "var(--softBorder)" : "var(--btnBg)", color: loading ? "var(--text)" : "var(--btnText)", cursor: loading || !selectedTeam ? "not-allowed" : "pointer", fontWeight: 700 }}
      >
        Choisir cette équipe
      </button>
    </>
  );
}
