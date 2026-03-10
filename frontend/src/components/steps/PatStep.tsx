import { useEffect, useRef } from "react";

type PatStepProps = {
  err: string;
  patInput: string;
  serverUrlInput: string;
  setPatInput: (value: string) => void;
  setServerUrlInput: (value: string) => void;
  loading: boolean;
  onSubmit: () => void | Promise<void>;
};

export default function PatStep({
  err,
  patInput,
  serverUrlInput,
  setPatInput,
  setServerUrlInput,
  loading,
  onSubmit,
}: PatStepProps) {
  const patInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const rafId = window.requestAnimationFrame(() => {
      patInputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [err]);

  return (
    <>
      <h2 className="flow-title">Connexion Azure DevOps</h2>
      <p className="flow-text">
        Votre PAT Azure DevOps reste dans votre navigateur. Pour Azure DevOps Cloud, laissez l&apos;URL serveur vide.
        Pour Azure DevOps Server on-premise, saisissez l&apos;URL du serveur ou de la collection avant de continuer.
      </p>
      {err && (
        <div className="ui-alert ui-alert--danger">
          <b>Erreur :</b> {err}
        </div>
      )}
      <label className="flow-label">URL Azure (obligatoire si on-premise avec serveur et collection)</label>
      <input
        type="url"
        value={serverUrlInput}
        onChange={(e) => setServerUrlInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !loading) void onSubmit();
        }}
        placeholder="https://ado.monentreprise.local/tfs/DefaultCollection"
        className="flow-input"
      />
      <label className="flow-label">PAT</label>
      <input
        ref={patInputRef}
        type="password"
        value={patInput}
        onChange={(e) => setPatInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !loading) void onSubmit();
        }}
        className="flow-input"
      />
      <button
        onClick={() => void onSubmit()}
        disabled={loading}
        className="ui-primary-btn"
      >
        {loading ? "Validation..." : "Se connecter"}
      </button>
    </>
  );
}
