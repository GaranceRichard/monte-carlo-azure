import { useEffect, useRef } from "react";
import type { NamedEntity } from "../../types";
import { keepSelectDropdownAtTop } from "../../utils/selectTopStart";

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
  const manualOrgInputRef = useRef<HTMLInputElement | null>(null);
  const orgSelectRef = useRef<HTMLSelectElement | null>(null);

  useEffect(() => {
    const focusTarget = orgs.length ? orgSelectRef.current : manualOrgInputRef.current;
    // Delay focus to next paint to avoid losing focus during animated step transitions.
    const rafId = window.requestAnimationFrame(() => {
      focusTarget?.focus();
      if (!orgs.length && err) {
        manualOrgInputRef.current?.select();
      }
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [orgs.length, err]);

  return (
    <>
      <h2 className="flow-title">{welcomeTitle}</h2>
      <p className="flow-text">Sélectionnez l&apos;organisation Azure DevOps à utiliser.</p>
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
          <select
            ref={orgSelectRef}
            value={selectedOrg}
            onChange={(e) => setSelectedOrg(e.target.value)}
            onFocus={keepSelectDropdownAtTop}
            onMouseDown={keepSelectDropdownAtTop}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !loading && selectedOrg.trim()) {
                e.preventDefault();
                void onContinue();
              }
            }}
            className="flow-input"
          >
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
            ref={manualOrgInputRef}
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
