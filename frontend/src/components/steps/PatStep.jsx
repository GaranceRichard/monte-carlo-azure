export default function PatStep({
  err,
  patInput,
  setPatInput,
  loading,
  onSubmit,
}) {
  return (
    <>
      <h2 style={{ marginTop: 0 }}>Connexion Azure DevOps</h2>
      <p style={{ color: "var(--muted)" }}>
        Entrez votre PAT pour cette session. Il est utilisé uniquement en mémoire et n&apos;est pas sauvegardé.
      </p>
      {err && (
        <div style={{ background: "var(--dangerBg)", border: "1px solid var(--dangerBorder)", padding: 12, borderRadius: 10, marginTop: 14 }}>
          <b>Erreur :</b> {err}
        </div>
      )}
      <label style={{ display: "block", marginTop: 10, color: "var(--muted)" }}>PAT</label>
      <input
        type="password"
        value={patInput}
        onChange={(e) => setPatInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !loading) onSubmit();
        }}
        style={{ width: "100%", padding: 10, marginTop: 6 }}
      />
      <button
        onClick={onSubmit}
        disabled={loading}
        style={{ width: "100%", marginTop: 16, padding: 12, borderRadius: 12, border: "1px solid var(--border)", background: loading ? "var(--softBorder)" : "var(--btnBg)", color: loading ? "var(--text)" : "var(--btnText)", cursor: loading ? "not-allowed" : "pointer", fontWeight: 700 }}
      >
        {loading ? "Validation..." : "Se connecter"}
      </button>
    </>
  );
}
