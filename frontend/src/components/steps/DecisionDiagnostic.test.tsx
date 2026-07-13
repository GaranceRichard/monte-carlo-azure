import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { DecisionLanguage } from "../../utils/decisionLanguage";
import DecisionDiagnostic from "./DecisionDiagnostic";

const diagnostic: DecisionLanguage = {
  decisionRecommendation: {
    title: "Recommandation de décision",
    status: "Décision possible avec prudence",
    explanation: "Un signal de qualité doit être pris en compte.",
    factors: [{ code: "partial_data", description: "Collecte de données partielle", value: "Un lot est incomplet", source: "dataQuality" }],
    action: "Décider avec une marge et documenter la limite identifiée.",
  },
  dataQuality: {
    title: "Qualité des données",
    status: "Données à surveiller",
    explanation: "L'historique est exploitable, avec une limite de complétude.",
    factors: [{ code: "history", description: "Semaines historiques exploitables", value: 6 }],
    action: "Compléter ou surveiller l'historique avant un engagement important.",
  },
  forecastUncertainty: {
    title: "Incertitude de prévision",
    status: "Incertitude modérée",
    explanation: "La dispersion disponible appelle à la prudence.",
    factors: [
      { code: "censored_simulations", description: "Simulations non terminées à l'horizon", value: 2 },
      { code: "coefficient_of_variation", description: "Coefficient de variation du throughput", value: 0.6 },
    ],
    action: "Conserver une marge de prudence.",
  },
};

const diagnosticWithSensitivity: DecisionLanguage = {
  ...diagnostic,
  historicalSensitivity: {
    title: "Sensibilité à la période historique",
    status: "Forte sensibilité à la période choisie",
    explanation: "La prévision varie fortement selon la période historique choisie.",
    factors: [{ code: "historical_window_sensitivity", description: "Prévision sensible à la période historique choisie", value: "50 % d'écart entre les P90" }],
    action: "Utiliser la période récente si le changement est durable et la période longue comme scénario prudent.",
    recentP90: "P90 période récente : 18 items — 9 semaines",
    longP90: "P90 période longue : 12 items — 17 semaines",
    gap: "Écart : +50 %",
    evolution: "La période récente indique une capacité plus élevée.",
  },
};

describe("DecisionDiagnostic", () => {
  it("shows a compact summary before the dialog is opened", () => {
    render(<DecisionDiagnostic diagnostic={diagnostic} />);

    expect(screen.getByText("Décision possible avec prudence")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Voir le diagnostic décisionnel" })).not.toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Décision recommandée" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Sensibilité à la période historique" })).toBeNull();
  });

  it("opens an accessible dialog with sensitivity and business sections in order", () => {
    render(<DecisionDiagnostic diagnostic={diagnosticWithSensitivity} />);
    fireEvent.click(screen.getByRole("button", { name: "Voir le diagnostic décisionnel" }));

    const dialog = screen.getByRole("dialog", { name: "Diagnostic décisionnel" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog).toHaveFocus();
    const decisionColumn = within(dialog).getByRole("group", { name: "Analyse décisionnelle" });
    const complementaryColumn = within(dialog).getByRole("complementary", { name: "Facteurs complémentaires" });
    expect(within(decisionColumn).getByRole("heading", { name: "Décision recommandée" })).not.toBeNull();
    expect(within(decisionColumn).getByRole("heading", { name: "Pourquoi ?" })).not.toBeNull();
    expect(within(complementaryColumn).getByRole("heading", { name: "Qualité des données" })).not.toBeNull();
    expect(within(complementaryColumn).getByRole("heading", { name: "Incertitude de prévision" })).not.toBeNull();
    expect(within(complementaryColumn).getByText("Détails techniques")).not.toBeNull();
    expect(dialog.querySelectorAll("#decision-recommended-title")).toHaveLength(1);
    expect(dialog.querySelectorAll("#data-quality-title")).toHaveLength(1);
    const orderedSectionTitles = [
      "Décision recommandée",
      "Sensibilité à la période historique",
      "Pourquoi ?",
      "Qualité des données",
      "Incertitude de prévision",
    ];
    expect(within(dialog).getAllByRole("heading")
      .map((heading) => heading.textContent)
      .filter((title): title is string => Boolean(title && orderedSectionTitles.includes(title))))
      .toEqual(orderedSectionTitles);
    expect(within(dialog).getByText(/Action conseillée : Décider avec une marge/i)).not.toBeNull();
    expect(within(dialog).getByText(/Collecte de données partielle : Un lot est incomplet/i)).not.toBeNull();
    expect(within(dialog).getByText("P90 période récente : 18 items — 9 semaines")).not.toBeNull();
    expect(within(dialog).getByText("P90 période longue : 12 items — 17 semaines")).not.toBeNull();
    expect(within(dialog).getByText("Écart : +50 %")).not.toBeNull();
    expect(within(dialog).getByRole("heading", { name: "Quel scénario retenir ?" })).not.toBeNull();

    const whySection = within(dialog).getByRole("heading", { name: "Pourquoi ?" }).closest("section") as HTMLElement;
    expect(within(whySection).queryByText(/Coefficient de variation/i)).toBeNull();
    const technicalDetails = within(dialog).getByText("Détails techniques").closest("details");
    expect(technicalDetails?.hasAttribute("open")).toBe(false);
    expect(within(technicalDetails as HTMLElement).getByText(/Coefficient de variation/i)).not.toBeNull();
  });

  it("keeps the historical-sensitivity section absent without a comparison", () => {
    render(<DecisionDiagnostic diagnostic={diagnostic} />);
    fireEvent.click(screen.getByRole("button", { name: "Voir le diagnostic décisionnel" }));

    expect(screen.queryByRole("heading", { name: "Sensibilité à la période historique" })).toBeNull();
  });

  it("closes with the footer button, cross, outside click and Escape while restoring trigger focus", () => {
    render(<DecisionDiagnostic diagnostic={diagnostic} />);
    const trigger = screen.getByRole("button", { name: "Voir le diagnostic décisionnel" });

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toHaveFocus();

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "Fermer le diagnostic décisionnel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toHaveFocus();

    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog");
    fireEvent.click(dialog);
    expect(screen.getByRole("dialog")).not.toBeNull();
    fireEvent.click(dialog.parentElement as HTMLElement);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toHaveFocus();

    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toHaveFocus();
  });
});
