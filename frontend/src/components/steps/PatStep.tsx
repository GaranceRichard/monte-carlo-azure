type PatStepProps = {
  err: string;
  patInput: string;
  setPatInput: (value: string) => void;
  loading: boolean;
  onSubmit: () => void | Promise<void>;
};

export default function PatStep({ err, patInput, setPatInput, loading, onSubmit }: PatStepProps) {
  return (
    <>
      <h2 style={{ marginTop: 0 }}>Connexion Azure DevOps</h2>
      <p style={{ color: "var(--muted)" }}>
        Votre PAT Azure DevOps est utilise uniquement dans votre navigateur pour interroger directement Microsoft. Il ne transite jamais par nos serveurs. Nous ne recevons que des chiffres anonymes (throughput hebdomadaire) pour calculer la simulation.
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
          if (e.key === "Enter" && !loading) void onSubmit();
        }}
        style={{ width: "100%", padding: 10, marginTop: 6 }}
      />
      <button
        onClick={() => void onSubmit()}
        disabled={loading}
        style={{ width: "100%", marginTop: 16, padding: 12, borderRadius: 12, border: "1px solid var(--border)", background: loading ? "var(--softBorder)" : "var(--btnBg)", color: loading ? "var(--text)" : "var(--btnText)", cursor: loading ? "not-allowed" : "pointer", fontWeight: 700 }}
      >
        {loading ? "Validation..." : "Se connecter"}
      </button>
    </>
  );
}
