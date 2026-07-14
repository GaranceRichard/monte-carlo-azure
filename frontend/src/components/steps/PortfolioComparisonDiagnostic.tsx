import type {
  HistoricalDataQuality,
  PortfolioComparisonDiagnostic,
  PortfolioEvidenceType,
  PortfolioHypothesis,
} from "../../utils/portfolioComparisonDiagnostic";

type PortfolioComparisonDiagnosticProps = {
  diagnostic: PortfolioComparisonDiagnostic;
};

const hypothesisLabels: Record<PortfolioHypothesis, string> = {
  independent: "Indépendant",
  aligned: "Arrimé",
  friction: "Friction",
  correlated: "Historique corrélé",
};

const evidenceLabels: Record<PortfolioEvidenceType, string> = {
  observed: "Fondée sur des observations historiques",
  calculated: "Calculée à partir d’un paramètre",
  user_input: "Paramètre saisi par l’utilisateur",
  unsupported: "Hypothèse non étayée par les données",
};

const historicalQualityLabels: Record<HistoricalDataQuality, string> = {
  reliable: "Historique exploitable",
  mixed: "Historique hétérogène",
  fragile: "Historique fragile",
  insufficient: "Historique insuffisant",
};

function getPreferredScenarioMessage(preferredScenario: PortfolioHypothesis | null): string {
  if (preferredScenario === null) {
    return "Aucune hypothèse ne peut être privilégiée avec les éléments disponibles.";
  }

  return `Hypothèse indiquée par le diagnostic : ${hypothesisLabels[preferredScenario]}.`;
}

export default function PortfolioComparisonDiagnostic({ diagnostic }: PortfolioComparisonDiagnosticProps) {
  const hasSignificantRisks = diagnostic.significantRisks.length > 0;

  return (
    <section className="sim-control-section" aria-labelledby="portfolio-comparison-title">
      <div className="space-y-2">
        <h3 id="portfolio-comparison-title" className="sim-control-heading">Comparaison des hypothèses</h3>
        <p className="text-sm leading-6 text-[var(--muted)]">{diagnostic.conclusion}</p>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3 text-sm">
          <p className="font-semibold text-[var(--text)]">Niveau de confiance comparatif</p>
          <p className="mt-1 leading-6 text-[var(--muted)]">{diagnostic.comparisonConfidence.statement}</p>
        </div>
        <p className="text-sm font-medium leading-6 text-[var(--text)]">
          {getPreferredScenarioMessage(diagnostic.preferredScenario)}
        </p>
      </div>

      <section className="mt-5" aria-labelledby="portfolio-hypotheses-title">
        <h4 id="portfolio-hypotheses-title" className="text-base font-semibold text-[var(--text)]">
          Lecture comparative
        </h4>
        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
          {diagnostic.hypothesisCredibility.map((scenario) => (
            <article key={scenario.hypothesis} className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <h5 className="text-sm font-semibold text-[var(--text)]">{hypothesisLabels[scenario.hypothesis]}</h5>
                <span className="w-fit rounded-full border border-[var(--border)] px-2 py-1 text-xs font-medium leading-4 text-[var(--muted)]">
                  {evidenceLabels[scenario.evidenceType]}
                </span>
              </div>
              <p className="mt-3 break-words text-sm leading-6 text-[var(--muted)]">{scenario.evidence}</p>
              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Limites à garder en tête</p>
                <ul className="mt-2 list-disc space-y-1 break-words pl-5 text-sm leading-6 text-[var(--muted)]">
                  {scenario.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-5" aria-labelledby="portfolio-risks-title">
        <h4 id="portfolio-risks-title" className="text-base font-semibold text-[var(--text)]">Faits à vérifier</h4>
        {hasSignificantRisks ? (
          <ul className="mt-3 space-y-2" aria-label="Risques significatifs remontés par les équipes">
            {diagnostic.significantRisks.map((risk) => (
              <li key={`${risk.kind}-${risk.teamNames.join("-")}`} className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3 text-sm leading-6 text-[var(--muted)]">
                {risk.statement}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Aucun risque significatif d’équipe n’est remonté par le diagnostic.
          </p>
        )}
      </section>

      <section className="mt-5" aria-labelledby="portfolio-reading-guide-title">
        <h4 id="portfolio-reading-guide-title" className="text-base font-semibold text-[var(--text)]">
          Trois lectures distinctes
        </h4>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
            <p className="text-sm font-semibold text-[var(--text)]">Qualité des données historiques</p>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
              {historicalQualityLabels[diagnostic.historicalData.quality]} : ce que les semaines observées permettent d’étayer.
            </p>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
            <p className="text-sm font-semibold text-[var(--text)]">Stabilité des résultats simulés</p>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
              La régularité des résultats simulés ne valide pas une hypothèse de portefeuille.
            </p>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
            <p className="text-sm font-semibold text-[var(--text)]">Crédibilité des hypothèses portefeuille</p>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
              Elle dépend du type de preuve et des limites affichées pour chaque hypothèse.
            </p>
          </div>
        </div>
      </section>
    </section>
  );
}
