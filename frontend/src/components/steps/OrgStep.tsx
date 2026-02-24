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
  const welcomeTitle = userName && userName !== "Utilisateur" ? `Bienvenue ${userName}` : "Bienvenue";

  return (
    <>
      <h2 className="flow-title">{welcomeTitle}</h2>
      <p className="flow-text">Selectionnez l&apos;organisation Azure DevOps a utiliser.</p>
      {err && (
        <div className="ui-alert ui-alert--danger">
          <b>Erreur :</b> {err}
        </div>
      )}
      {orgHint && (
        <div className="flow-help">
          {orgHint}
        </div>
      )}
      {orgs.length > 0 ? (
        <>
          <label className="flow-label">Organisations accessibles</label>
          <select value={selectedOrg} onChange={(e) => setSelectedOrg(e.target.value)} className="flow-input">
            {orgs.map((org) => (
              <option key={org.id || org.name} value={org.name || ""}>
                {org.name}
              </option>
            ))}
          </select>
        </>
      ) : (
        <>
          <label className="flow-label">Organisation Azure DevOps</label>
          <input
            type="text"
            value={selectedOrg}
            onChange={(e) => setSelectedOrg(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !loading && selectedOrg.trim()) {
                e.preventDefault();
                void onContinue();
              }
            }}
            placeholder="Nom de l'organisation"
            className="flow-input"
          />
        </>
      )}
      <button
        onClick={() => void onContinue()}
        disabled={loading || !selectedOrg.trim()}
        className="ui-primary-btn"
      >
        {loading ? "Chargement..." : "Choisir cette organisation"}
      </button>
    </>
  );
}
