import { useEffect, useRef } from "react";
import type { AdoDeploymentTarget } from "../../adoPlatform";
import type { NamedEntity } from "../../types";
import { keepSelectDropdownAtTop } from "../../utils/selectTopStart";

type OrgStepProps = {
  err: string;
  userName: string;
  orgs: NamedEntity[];
  orgHint: string;
  selectedOrg: string;
  deploymentTarget: AdoDeploymentTarget;
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
  deploymentTarget,
  setSelectedOrg,
  loading,
  onContinue,
}: OrgStepProps) {
  const welcomeTitle = userName && userName !== "Utilisateur" ? `Bienvenue ${userName}` : "Bienvenue";
  const manualOrgInputRef = useRef<HTMLInputElement | null>(null);
  const orgSelectRef = useRef<HTMLSelectElement | null>(null);
  const entityLabel = deploymentTarget === "onprem" ? "collection" : "organisation";
  const entityLabelTitle = deploymentTarget === "onprem" ? "Collection Azure DevOps Server" : "Organisation Azure DevOps";
  const entityPlaceholder = deploymentTarget === "onprem" ? "Nom de la collection" : "Nom de l'organisation";
  const buttonLabel = deploymentTarget === "onprem" ? "Choisir cette collection" : "Choisir cette organisation";
  const introText = deploymentTarget === "onprem"
    ? "Sélectionnez la collection Azure DevOps Server à utiliser."
    : "Sélectionnez l'organisation Azure DevOps à utiliser.";

  useEffect(() => {
    const focusTarget = orgs.length ? orgSelectRef.current : manualOrgInputRef.current;
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
      <p className="flow-text">{introText}</p>
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
          <label className="flow-label">{deploymentTarget === "onprem" ? "Collections accessibles" : "Organisations accessibles"}</label>
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
          <label className="flow-label">{entityLabelTitle}</label>
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
            placeholder={entityPlaceholder}
            className="flow-input"
          />
        </>
      )}
      <button
        onClick={() => void onContinue()}
        disabled={loading || !selectedOrg.trim()}
        className="ui-primary-btn"
      >
        {loading ? "Chargement..." : buttonLabel}
      </button>
    </>
  );
}
