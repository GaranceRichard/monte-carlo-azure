import type { NamedEntity } from "../../types";

type OrgStepProps = {
  err: string;
  userName: string;
  orgs: NamedEntity[];
  orgHint: string;
  selectedOrg: string;
  setSelectedOrg: (value: string) => void;
  loading: boolean;
  onContinue: () => void | Promise<boolean>;
};

export default function OrgStep({
  err,
  userName,
  orgs,
  orgHint,
  selectedOrg,
  setSelectedOrg,
  loading,
  onContinue,
}: OrgStepProps) {
  return (
    <>
      <h2 style={{ marginTop: 0 }}>Bienvenue {userName}</h2>
      <p style={{ color: "var(--muted)" }}>Selectionnez l&apos;organisation Azure DevOps a utiliser.</p>
      {err && (
        <div style={{ background: "var(--dangerBg)", border: "1px solid var(--dangerBorder)", padding: 12, borderRadius: 10, marginTop: 14 }}>
          <b>Erreur :</b> {err}
        </div>
      )}
      {orgHint && (
        <div style={{ background: "var(--softBg)", border: "1px solid var(--border)", padding: 12, borderRadius: 10, marginTop: 14 }}>
          {orgHint}
        </div>
      )}
      {orgs.length > 0 ? (
        <>
          <label style={{ display: "block", marginTop: 12, color: "var(--muted)" }}>Organisations accessibles</label>
          <select value={selectedOrg} onChange={(e) => setSelectedOrg(e.target.value)} style={{ width: "100%", padding: 10, marginTop: 6 }}>
            {orgs.map((org) => (
              <option key={org.id || org.name} value={org.name || ""}>
                {org.name}
              </option>
            ))}
          </select>
        </>
      ) : (
        <>
          <label style={{ display: "block", marginTop: 12, color: "var(--muted)" }}>Organisation Azure DevOps</label>
          <input
            type="text"
            value={selectedOrg}
            onChange={(e) => setSelectedOrg(e.target.value)}
            placeholder="Nom de l'organisation"
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />
        </>
      )}
      <button
        onClick={() => void onContinue()}
        disabled={loading || !selectedOrg.trim()}
        style={{ width: "100%", marginTop: 16, padding: 12, borderRadius: 12, border: "1px solid var(--border)", background: loading ? "var(--softBorder)" : "var(--btnBg)", color: loading ? "var(--text)" : "var(--btnText)", cursor: loading || !selectedOrg.trim() ? "not-allowed" : "pointer", fontWeight: 700 }}
      >
        {loading ? "Chargement..." : "Choisir cette organisation"}
      </button>
    </>
  );
}
