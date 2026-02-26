import { useEffect, useRef } from "react";

type PatStepProps = {
  err: string;
  patInput: string;
  setPatInput: (value: string) => void;
  loading: boolean;
  onSubmit: () => void | Promise<void>;
};

export default function PatStep({ err, patInput, setPatInput, loading, onSubmit }: PatStepProps) {
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
        Votre PAT Azure DevOps est utilisé uniquement dans votre navigateur pour interroger directement Microsoft. Il ne transite jamais par nos serveurs. Nous ne recevons que des chiffres anonymes (throughput hebdomadaire) pour calculer la simulation.
      </p>
      {err && (
        <div className="ui-alert ui-alert--danger">
          <b>Erreur :</b> {err}
        </div>
      )}
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
