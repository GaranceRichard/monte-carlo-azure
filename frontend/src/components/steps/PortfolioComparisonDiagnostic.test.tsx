import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PortfolioComparisonDiagnostic from "./PortfolioComparisonDiagnostic";
import type { PortfolioComparisonDiagnostic as PortfolioComparisonDiagnosticData } from "../../utils/portfolioComparisonDiagnostic";

function buildDiagnostic(overrides: Partial<PortfolioComparisonDiagnosticData> = {}): PortfolioComparisonDiagnosticData {
  return {
    historicalData: {
      quality: "fragile",
      observedFacts: [],
      teamFindings: [],
    },
    simulationStability: [],
    hypothesisCredibility: [
      {
        hypothesis: "independent",
        evidenceType: "unsupported",
        evidence: "L’indépendance est modélisée, pas observée.",
        limitations: ["Une simulation stable ne valide pas cette hypothèse."],
      },
      {
        hypothesis: "aligned",
        evidenceType: "user_input",
        evidence: "Le taux est fourni pour explorer une hypothèse.",
        limitations: ["Ce paramètre n’est pas un fait démontré."],
      },
      {
        hypothesis: "friction",
        evidenceType: "calculated",
        evidence: "Le coefficient est dérivé du paramètre saisi.",
        limitations: ["Le calcul n’est pas une observation historique."],
      },
      {
        hypothesis: "correlated",
        evidenceType: "observed",
        evidence: "Des semaines historiques communes ont été observées.",
        limitations: ["Ce caractère observé ne recommande pas automatiquement ce scénario."],
      },
    ],
    significantRisks: [
      {
        kind: "team_history",
        teamNames: ["Équipe Atlas"],
        statement: "L’équipe Atlas présente un historique fragile et une tendance en baisse : fait à vérifier au niveau portefeuille.",
      },
    ],
    comparisonConfidence: {
      level: "insufficient",
      statement: "Les éléments disponibles ne suffisent pas à départager la crédibilité future des hypothèses.",
    },
    preferredScenario: null,
    conclusion: "Preuves insuffisantes pour privilégier une hypothèse.",
    ...overrides,
  };
}

describe("PortfolioComparisonDiagnostic", () => {
  it("renders the diagnostic conclusion, all French evidence labels, and no recommended scenario when none is preferred", () => {
    render(<PortfolioComparisonDiagnostic diagnostic={buildDiagnostic()} />);

    expect(screen.getByText("Preuves insuffisantes pour privilégier une hypothèse.")).toBeTruthy();
    expect(screen.getByText("Fondée sur des observations historiques")).toBeTruthy();
    expect(screen.getByText("Calculée à partir d’un paramètre")).toBeTruthy();
    expect(screen.getByText("Paramètre saisi par l’utilisateur")).toBeTruthy();
    expect(screen.getByText("Hypothèse non étayée par les données")).toBeTruthy();
    expect(screen.getByText("Aucune hypothèse ne peut être privilégiée avec les éléments disponibles.")).toBeTruthy();
    expect(screen.getByText("Historique corrélé")).toBeTruthy();
    expect(screen.getByText(/ce caractère observé ne recommande pas automatiquement ce scénario/i)).toBeTruthy();
    expect(screen.queryByText(/scénario recommandé/i)).toBeNull();
  });

  it("reports fragile and declining team facts without asserting compensation, substitutability, or causality", () => {
    const { container } = render(<PortfolioComparisonDiagnostic diagnostic={buildDiagnostic()} />);

    expect(screen.getByRole("heading", { name: "Faits à vérifier" })).toBeTruthy();
    expect(screen.getByText(/équipe atlas présente un historique fragile et une tendance en baisse/i)).toBeTruthy();
    expect(container.textContent).not.toMatch(/se compensent|sont substituables|provoque|cause/i);
  });

  it("renders an explicit empty state when no team risk is returned", () => {
    render(<PortfolioComparisonDiagnostic diagnostic={buildDiagnostic({ significantRisks: [] })} />);

    expect(screen.getByText("Aucun risque significatif d’équipe n’est remonté par le diagnostic.")).toBeTruthy();
  });

  it("keeps a future diagnostic preference informational rather than automatic", () => {
    render(<PortfolioComparisonDiagnostic diagnostic={buildDiagnostic({ preferredScenario: "correlated" })} />);

    expect(screen.getByText("Hypothèse indiquée par le diagnostic : Historique corrélé.")).toBeTruthy();
    expect(screen.queryByText(/scénario recommandé/i)).toBeNull();
  });

  it("uses labelled structural headings for the comparative reading and teaching distinction", () => {
    render(<PortfolioComparisonDiagnostic diagnostic={buildDiagnostic()} />);

    expect(screen.getByRole("heading", { name: "Comparaison des hypothèses" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Lecture comparative" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Trois lectures distinctes" })).toBeTruthy();
    expect(screen.getByText("Qualité des données historiques")).toBeTruthy();
    expect(screen.getByText("Stabilité des résultats simulés")).toBeTruthy();
    expect(screen.getByText("Crédibilité des hypothèses portefeuille")).toBeTruthy();
  });
});
