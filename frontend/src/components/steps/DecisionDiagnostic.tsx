import { useEffect, useRef, useState } from "react";
import type { DecisionLanguage, DecisionLanguageDimension } from "../../utils/decisionLanguage";

type DecisionDiagnosticProps = {
  diagnostic: DecisionLanguage;
};

const TECHNICAL_FACTOR_CODES = new Set([
  "forecast_percentile_spread",
  "coefficient_of_variation",
  "iqr_ratio",
  "normalized_slope",
]);

function isTechnicalFactor(factor: DecisionLanguageDimension["factors"][number]): boolean {
  return TECHNICAL_FACTOR_CODES.has(factor.code);
}

function FactorsList({ factors }: { factors: DecisionLanguageDimension["factors"] }) {
  if (factors.length === 0) return null;

  return (
    <ul className="mt-2 space-y-1 text-xs text-[var(--muted)]">
      {factors.map((factor, index) => (
        <li key={`${factor.code}-${index}`}>
          {factor.description}
          {factor.value !== undefined ? ` : ${String(factor.value)}` : ""}
        </li>
      ))}
    </ul>
  );
}

function DiagnosticDimension({
  dimension,
  id,
}: {
  dimension: DecisionLanguageDimension;
  id: string;
}) {
  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3" aria-labelledby={id}>
      <h3 id={id} className="m-0 text-sm font-extrabold text-[var(--text)]">{dimension.title}</h3>
      <p className="mt-2 text-sm font-bold text-[var(--text)]">Statut : {dimension.status}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">{dimension.explanation}</p>
      <FactorsList factors={dimension.factors.filter((factor) => !isTechnicalFactor(factor))} />
      <p className="mt-2 text-xs font-semibold text-[var(--text)]">
        Action recommandée : {dimension.action}
      </p>
    </section>
  );
}

export default function DecisionDiagnostic({ diagnostic }: DecisionDiagnosticProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const technicalFactors = diagnostic.forecastUncertainty.factors.filter(isTechnicalFactor);

  function closeDialog(): void {
    setIsOpen(false);
  }

  useEffect(() => {
    if (!isOpen) return;

    const triggerElement = triggerRef.current;
    dialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      triggerElement?.focus();
    };
  }, [isOpen]);

  return (
    <section
      className="rounded-xl border-2 border-[var(--text)] bg-[var(--surface-2)] p-3"
      aria-labelledby="decision-summary-title"
    >
      <h2 id="decision-summary-title" className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted)]">
        Diagnostic décisionnel
      </h2>
      <p className="mt-2 text-sm font-extrabold text-[var(--text)]">{diagnostic.decisionRecommendation.status}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">{diagnostic.decisionRecommendation.explanation}</p>
      <button
        ref={triggerRef}
        type="button"
        className="sim-advanced-toggle mt-3"
        onClick={() => setIsOpen(true)}
      >
        Voir le diagnostic décisionnel
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={closeDialog}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="decision-diagnostic-dialog-title"
            tabIndex={-1}
            className="max-h-[calc(100vh-2rem)] w-full max-w-[1160px] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 z-10 -mx-4 -mt-4 mb-4 flex items-start justify-between gap-3 bg-[var(--panel)] px-4 pb-2 pt-4">
              <h2 id="decision-diagnostic-dialog-title" className="m-0 text-base font-extrabold text-[var(--text)]">
                Diagnostic décisionnel
              </h2>
              <button
                type="button"
                className="sim-advanced-toggle"
                aria-label="Fermer le diagnostic décisionnel"
                onClick={closeDialog}
              >
                ×
              </button>
            </div>

            <div className="grid gap-3 min-[960px]:grid-cols-[minmax(0,3fr)_minmax(19rem,2fr)]">
              <div className="space-y-3" role="group" aria-label="Analyse décisionnelle">
                <section className="rounded-xl border-2 border-[var(--text)] bg-[var(--surface-2)] p-3" aria-labelledby="decision-recommended-title">
                <h3 id="decision-recommended-title" className="m-0 text-sm font-extrabold text-[var(--text)]">Décision recommandée</h3>
                <p className="mt-2 text-sm font-bold text-[var(--text)]">Statut : {diagnostic.decisionRecommendation.status}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">{diagnostic.decisionRecommendation.explanation}</p>
                <p className="mt-2 text-xs font-semibold text-[var(--text)]">
                  Action conseillée : {diagnostic.decisionRecommendation.action}
                </p>
                </section>

                {diagnostic.historicalSensitivity && (
                  <section className="rounded-xl border-2 border-[var(--text)] bg-[var(--surface-2)] p-3" aria-labelledby="historical-sensitivity-title">
                  <h3 id="historical-sensitivity-title" className="m-0 text-sm font-extrabold text-[var(--text)]">
                    {diagnostic.historicalSensitivity.title}
                  </h3>
                  <p className="mt-2 text-sm font-bold text-[var(--text)]">
                    Statut : {diagnostic.historicalSensitivity.status}
                  </p>
                  <div className="mt-2 space-y-1 text-xs text-[var(--text)]">
                    <p>{diagnostic.historicalSensitivity.recentP90}</p>
                    <p>{diagnostic.historicalSensitivity.longP90}</p>
                    <p className="font-bold">{diagnostic.historicalSensitivity.gap}</p>
                  </div>
                  <p className="mt-2 text-xs text-[var(--muted)]">
                    {diagnostic.historicalSensitivity.evolution}
                  </p>
                  <h4 className="mt-3 text-xs font-extrabold text-[var(--text)]">Quel scénario retenir ?</h4>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {diagnostic.historicalSensitivity.action}
                  </p>
                  </section>
                )}

                <section className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3" aria-labelledby="decision-why-title">
                  <h3 id="decision-why-title" className="m-0 text-sm font-extrabold text-[var(--text)]">Pourquoi ?</h3>
                  <FactorsList factors={diagnostic.decisionRecommendation.factors.filter((factor) => !isTechnicalFactor(factor))} />
                </section>
              </div>

              <aside className="space-y-3" aria-labelledby="complementary-factors-title">
                <h3 id="complementary-factors-title" className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted)]">
                  Facteurs complémentaires
                </h3>
                <DiagnosticDimension dimension={diagnostic.dataQuality} id="data-quality-title" />
                <DiagnosticDimension dimension={diagnostic.forecastUncertainty} id="forecast-uncertainty-title" />

                {technicalFactors.length > 0 && (
                  <details className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
                    <summary className="cursor-pointer text-sm font-extrabold text-[var(--text)]">
                      Détails techniques
                    </summary>
                    <FactorsList factors={technicalFactors} />
                  </details>
                )}
              </aside>
            </div>

            <div className="mt-4 flex justify-end">
              <button type="button" className="sim-advanced-toggle" onClick={closeDialog}>Fermer</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
