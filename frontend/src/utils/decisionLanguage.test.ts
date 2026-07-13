import { describe, expect, it } from "vitest";
import { buildDecisionLanguage, getDataQualityAction, getForecastUncertaintyAction } from "./decisionLanguage";
import type { HistoricalWindowSensitivityDiagnostic } from "./forecastDiagnostics";

function historicalSensitivity(
  overrides: Partial<HistoricalWindowSensitivityDiagnostic> = {},
): HistoricalWindowSensitivityDiagnostic {
  return {
    level: "high",
    simulationMode: "weeks_to_items",
    comparedSimulations: [],
    p90Minimum: 12,
    p90Maximum: 18,
    absoluteGap: 6,
    relativeGap: 0.5,
    recentChangeRate: 0.5,
    recentWindow: { id: "recent", startDate: "2026-03-01", endDate: "2026-04-30", p90: 18, usableWeeks: 9 },
    longWindow: { id: "long", startDate: "2026-01-01", endDate: "2026-04-30", p90: 12, usableWeeks: 17 },
    recentTrend: "improved",
    justification: "La période récente est différente.",
    advisedAction: "Vérifier la durée du changement.",
    factors: [{ code: "sensitivity", description: "Sensibilité historique" }],
    ...overrides,
  };
}

function decisionLanguageWithSensitivity(
  sensitivity?: HistoricalWindowSensitivityDiagnostic | null,
) {
  return buildDecisionLanguage({
    dataQuality: { level: "sufficient", justification: "Données suffisantes", factors: [] },
    forecastUncertainty: { level: "low", justification: "Incertitude faible", factors: [] },
    decisionRecommendation: { level: "supportable", justification: "Décision possible", factors: [], advisedAction: "Décider" },
    historicalSensitivity: sensitivity,
  });
}

describe("decision language", () => {
  it("maps every quality and uncertainty level to its own action", () => {
    expect(getDataQualityAction("sufficient")).toContain("Poursuivre");
    expect(getDataQualityAction("watch")).toContain("surveiller");
    expect(getDataQualityAction("insufficient")).toContain("Enrichir");
    expect(getForecastUncertaintyAction("low")).toContain("Utiliser");
    expect(getForecastUncertaintyAction("moderate")).toContain("prudence");
    expect(getForecastUncertaintyAction("high")).toContain("réduire");
    expect(getForecastUncertaintyAction("unmeasurable")).toContain("Ne pas utiliser");
  });

  it("keeps quality, uncertainty and decision recommendation separate", () => {
    const qualityFactors = [{ code: "history", description: "Historique" }];
    const uncertaintyFactors = [{ code: "spread", description: "Dispersion" }];
    const result = buildDecisionLanguage({
      dataQuality: { level: "watch", justification: "Données partielles", factors: qualityFactors },
      forecastUncertainty: { level: "high", justification: "Volatilité", factors: uncertaintyFactors },
      decisionRecommendation: { level: "arbitration_required", justification: "Arbitrage", factors: [{ ...qualityFactors[0], source: "dataQuality" }], advisedAction: "Valider" },
    });

    expect(result.dataQuality).toMatchObject({ title: "Qualité des données", status: "Données à surveiller", factors: qualityFactors });
    expect(result.forecastUncertainty).toMatchObject({ title: "Incertitude de prévision", status: "Incertitude élevée", factors: uncertaintyFactors });
    expect(result.decisionRecommendation).toMatchObject({
      title: "Recommandation de décision",
      status: "Arbitrage nécessaire",
      explanation: expect.stringContaining("cause détaillée n'est pas disponible"),
      action: expect.stringContaining("cause détaillée de la prudence n'est pas disponible"),
    });
  });

  it("names incomplete Azure DevOps data and a short history in the recommendation", () => {
    const result = buildDecisionLanguage({
      dataQuality: { level: "watch", justification: "Données partielles", factors: [] },
      forecastUncertainty: { level: "moderate", justification: "Dispersion modérée", factors: [] },
      decisionRecommendation: {
        level: "caution",
        justification: "La décision reste possible, mais un signal dégradé doit être explicite.",
        advisedAction: "Décider avec une marge et documenter la limite identifiée.",
        factors: [
          { source: "dataQuality", code: "partial_ado_data", description: "Données partielles" },
          { source: "dataQuality", code: "limited_recent_history", description: "Historique court", value: "9 semaines exploitables" },
        ],
      },
    });

    expect(result.decisionRecommendation.explanation).toBe(
      "Certaines données Azure DevOps sont incomplètes ; la capacité observée peut être sous-estimée. La période récente repose sur 9 semaines exploitables, ce qui limite le recul disponible.",
    );
    expect(result.decisionRecommendation.action).toBe(
      "Compléter les données Azure DevOps et observer quelques semaines supplémentaires avant un engagement difficilement réversible.",
    );
    expect(result.decisionRecommendation.explanation).not.toContain("signal dégradé");
    expect(result.decisionRecommendation.action).not.toContain("Décider avec une marge");
  });

  it("prioritizes two determining causes and proposes a concrete sensitivity action", () => {
    const sensitivity = historicalSensitivity();
    const result = buildDecisionLanguage({
      dataQuality: { level: "watch", justification: "Données partielles", factors: [] },
      forecastUncertainty: { level: "high", justification: "Dispersion élevée", factors: [] },
      historicalSensitivity: sensitivity,
      decisionRecommendation: {
        level: "arbitration_required",
        justification: "Arbitrage requis",
        advisedAction: "Arbitrer",
        factors: [
          { source: "dataQuality", code: "partial_ado_data", description: "Données partielles" },
          { source: "historicalSensitivity", code: "historical_window_sensitivity", description: "Sensibilité élevée" },
          { source: "forecastUncertainty", code: "forecast_percentile_spread", description: "Dispersion élevée" },
        ],
      },
    });

    expect(result.decisionRecommendation.explanation).toContain("données Azure DevOps sont incomplètes");
    expect(result.decisionRecommendation.explanation).toContain("Le P90 varie fortement");
    expect(result.decisionRecommendation.explanation).not.toContain("scénarios centraux et prudents");
    expect(result.decisionRecommendation.action).toContain("Compléter les données Azure DevOps");
  });

  it("turns forecast dispersion into an applicable P70 and P90 action", () => {
    const result = buildDecisionLanguage({
      dataQuality: { level: "sufficient", justification: "Données suffisantes", factors: [] },
      forecastUncertainty: { level: "high", justification: "Dispersion élevée", factors: [] },
      decisionRecommendation: {
        level: "caution",
        justification: "Prudence",
        advisedAction: "Prévoir une marge",
        factors: [
          { source: "forecastUncertainty", code: "iqr_ratio", description: "Dispersion" },
        ],
      },
    });

    expect(result.decisionRecommendation.explanation).toBe(
      "L'écart entre les scénarios centraux et prudents reste important.",
    );
    expect(result.decisionRecommendation.action).toBe(
      "Planifier sur le P70 et conserver le P90 comme marge de sécurité.",
    );
  });

  it("uses the recent and long periods explicitly when sensitivity drives caution", () => {
    const sensitivity = historicalSensitivity();
    const result = buildDecisionLanguage({
      dataQuality: { level: "sufficient", justification: "Données suffisantes", factors: [] },
      forecastUncertainty: { level: "low", justification: "Incertitude faible", factors: [] },
      historicalSensitivity: sensitivity,
      decisionRecommendation: {
        level: "caution",
        justification: sensitivity.justification,
        advisedAction: sensitivity.advisedAction,
        factors: [
          { source: "historicalSensitivity", code: "historical_window_sensitivity", description: "Sensibilité élevée" },
        ],
      },
    });

    expect(result.decisionRecommendation.explanation).toBe(
      "Le P90 varie fortement selon la période sélectionnée : la capacité récente paraît supérieure à l'historique long.",
    );
    expect(result.decisionRecommendation.action).toBe(
      "Utiliser la période récente pour le pilotage opérationnel et conserver la période longue comme scénario prudent avant un engagement externe.",
    );
  });

  it("uses an explicit fallback when no determining factor is available", () => {
    const result = buildDecisionLanguage({
      dataQuality: { level: "watch", justification: "À surveiller", factors: [] },
      forecastUncertainty: { level: "moderate", justification: "Modérée", factors: [] },
      decisionRecommendation: {
        level: "caution",
        justification: "Un signal dégradé doit être explicite.",
        advisedAction: "Décider avec une marge.",
        factors: [],
      },
    });

    expect(result.decisionRecommendation.explanation).toContain("cause détaillée n'est pas disponible");
    expect(result.decisionRecommendation.action).toContain("cause détaillée de la prudence n'est pas disponible");
    expect(result.decisionRecommendation.explanation).not.toContain("signal dégradé");
    expect(result.decisionRecommendation.action).not.toContain("documenter la limite");
  });

  it("makes missing percentiles the priority and restores them before deciding", () => {
    const result = buildDecisionLanguage({
      dataQuality: { level: "watch", justification: "Données à surveiller", factors: [] },
      forecastUncertainty: { level: "unmeasurable", justification: "Incertitude impossible à mesurer", factors: [] },
      decisionRecommendation: {
        level: "arbitration_required",
        justification: "Arbitrage nécessaire",
        advisedAction: "Arbitrer",
        factors: [
          { source: "forecastUncertainty", code: "missing_required_percentiles", description: "Percentiles manquants" },
          { source: "dataQuality", code: "partial_ado_data", description: "Données partielles" },
          { source: "forecastUncertainty", code: "censored_simulations", description: "Simulations censurées", value: 4 },
        ],
      },
    });

    expect(result.decisionRecommendation).toMatchObject({
      status: "Arbitrage nécessaire",
      explanation: "Les percentiles requis (détail non disponible) ne sont pas tous disponibles. Certaines données Azure DevOps sont incomplètes ; la capacité observée peut être sous-estimée.",
      action: "Rétablir les percentiles requis avant de confirmer la décision.",
    });
    expect(result.decisionRecommendation.explanation).not.toContain("simulations n'aboutissent pas");
  });

  it("explains a generic completeness issue without presenting it as Azure DevOps data", () => {
    const result = buildDecisionLanguage({
      dataQuality: { level: "watch", justification: "Complétude à surveiller", factors: [] },
      forecastUncertainty: { level: "low", justification: "Incertitude faible", factors: [] },
      decisionRecommendation: {
        level: "caution",
        justification: "Prudence",
        advisedAction: "Compléter les données",
        factors: [
          { source: "dataQuality", code: "completeness_issue", description: "Champ incomplet" },
        ],
      },
    });

    expect(result.decisionRecommendation.explanation).toBe(
      "Certaines données nécessaires sont incomplètes ; la capacité observée peut être sous-estimée.",
    );
    expect(result.decisionRecommendation.action).toBe(
      "Compléter les données Azure DevOps avant de confirmer un engagement difficilement réversible.",
    );
  });

  it.each([
    [
      historicalSensitivity(),
      undefined,
      "La prévision repose sur seulement 9 semaines d'historique, ce qui limite le recul disponible.",
    ],
    [
      undefined,
      "7 semaines exploitables",
      "La période récente repose sur 7 semaines exploitables, ce qui limite le recul disponible.",
    ],
    [
      undefined,
      undefined,
      "La période récente offre encore peu de recul historique.",
    ],
  ])("describes short historical depth from available public diagnostics", (sensitivity, value, explanation) => {
    const result = buildDecisionLanguage({
      dataQuality: { level: "watch", justification: "Historique court", factors: [] },
      forecastUncertainty: { level: "low", justification: "Incertitude faible", factors: [] },
      historicalSensitivity: sensitivity,
      decisionRecommendation: {
        level: "caution",
        justification: "Historique court",
        advisedAction: "Observer davantage",
        factors: [
          { source: "dataQuality", code: "limited_recent_history", description: "Historique récent limité", value },
        ],
      },
    });

    expect(result.decisionRecommendation.explanation).toBe(explanation);
    expect(result.decisionRecommendation.action).toBe(
      "Vérifier la stabilité de la capacité récente sur quelques semaines supplémentaires.",
    );
  });

  it.each([
    [3, "3 simulations n'aboutissent pas dans l'horizon prévu."],
    [undefined, "Certaines simulations n'aboutissent pas dans l'horizon prévu."],
  ])("explains censored forecasts and recommends an applicable horizon change", (value, explanation) => {
    const result = buildDecisionLanguage({
      dataQuality: { level: "sufficient", justification: "Données suffisantes", factors: [] },
      forecastUncertainty: { level: "high", justification: "Prévision censurée", factors: [] },
      decisionRecommendation: {
        level: "caution",
        justification: "Prévision censurée",
        advisedAction: "Adapter l'horizon",
        factors: [
          { source: "forecastUncertainty", code: "censored_simulations", description: "Simulations censurées", value },
        ],
      },
    });

    expect(result.decisionRecommendation.explanation).toBe(explanation);
    expect(result.decisionRecommendation.action).toBe(
      "Allonger l'horizon de simulation ou réduire l'engagement avant de confirmer la prévision.",
    );
  });

  it.each([
    [2, "2 valeurs historiques ne sont pas exploitables."],
    [undefined, "Certaines valeurs historiques ne sont pas exploitables."],
  ])("explains discarded history values and recommends correcting them", (value, explanation) => {
    const result = buildDecisionLanguage({
      dataQuality: { level: "watch", justification: "Valeurs écartées", factors: [] },
      forecastUncertainty: { level: "low", justification: "Incertitude faible", factors: [] },
      decisionRecommendation: {
        level: "caution",
        justification: "Valeurs écartées",
        advisedAction: "Corriger l'historique",
        factors: [
          { source: "dataQuality", code: "discarded_history_values", description: "Valeurs écartées", value },
        ],
      },
    });

    expect(result.decisionRecommendation.explanation).toBe(explanation);
    expect(result.decisionRecommendation.action).toBe(
      "Corriger les valeurs historiques non exploitables avant de confirmer l'engagement.",
    );
  });

  it("turns an isolated recent-capacity factor into a verification action", () => {
    const result = buildDecisionLanguage({
      dataQuality: { level: "sufficient", justification: "Données suffisantes", factors: [] },
      forecastUncertainty: { level: "moderate", justification: "Incertitude modérée", factors: [] },
      decisionRecommendation: {
        level: "caution",
        justification: "Capacité en évolution",
        advisedAction: "Vérifier la tendance",
        factors: [
          { source: "historicalSensitivity", code: "recent_capacity_direction", description: "Capacité récente en baisse" },
        ],
      },
    });

    expect(result.decisionRecommendation.explanation).toBe("Capacité récente en baisse.");
    expect(result.decisionRecommendation.action).toBe(
      "Vérifier que l'évolution récente de capacité se maintient avant de confirmer l'engagement.",
    );
  });

  it.each([
    [
      historicalSensitivity({ level: "moderate", simulationMode: "backlog_to_weeks", recentTrend: "declined" }),
      "Le P90 varie selon la période sélectionnée : la capacité récente paraît inférieure à l'historique long.",
      "Utiliser la période récente comme référence prudente et vérifier si la baisse de capacité se confirme.",
    ],
    [
      historicalSensitivity({ level: "stable", recentTrend: "unchanged", recentChangeRate: 0 }),
      "Le P90 varie selon la période sélectionnée : la capacité récente paraît différente à l'historique long.",
      "Comparer la période récente à la période longue avant de retenir une référence d'engagement.",
    ],
  ])("uses the sensitivity trend to select the decision action", (sensitivity, explanation, action) => {
    const result = buildDecisionLanguage({
      dataQuality: { level: "sufficient", justification: "Données suffisantes", factors: [] },
      forecastUncertainty: { level: "moderate", justification: "Incertitude modérée", factors: [] },
      historicalSensitivity: sensitivity,
      decisionRecommendation: {
        level: "caution",
        justification: sensitivity.justification,
        advisedAction: sensitivity.advisedAction,
        factors: [
          { source: "historicalSensitivity", code: "historical_window_sensitivity", description: "Sensibilité historique" },
        ],
      },
    });

    expect(result.decisionRecommendation).toMatchObject({
      status: "Décision possible avec prudence",
      explanation,
      action,
    });
  });

  it.each([
    ["watch", 8, "La prévision repose sur 8 semaines d'historique exploitable."],
    ["watch", undefined, "Le recul historique exploitable est limité."],
  ] as const)("uses optional usable-history values for %s data", (level, value, explanation) => {
    const result = buildDecisionLanguage({
      dataQuality: { level, justification: "Historique à surveiller", factors: [] },
      forecastUncertainty: { level: "low", justification: "Incertitude faible", factors: [] },
      decisionRecommendation: {
        level: "caution",
        justification: "Historique à surveiller",
        advisedAction: "Observer davantage",
        factors: [
          { source: "dataQuality", code: "usable_history_weeks", description: "Semaines exploitables", value },
        ],
      },
    });

    expect(result.decisionRecommendation.explanation).toBe(explanation);
    expect(result.decisionRecommendation.action).toBe(
      "Vérifier la stabilité de la capacité récente sur quelques semaines supplémentaires.",
    );
  });

  it("does not present sufficient historical depth as a cause for caution", () => {
    const result = buildDecisionLanguage({
      dataQuality: { level: "sufficient", justification: "Données suffisantes", factors: [] },
      forecastUncertainty: { level: "low", justification: "Incertitude faible", factors: [] },
      decisionRecommendation: {
        level: "caution",
        justification: "Prudence",
        advisedAction: "Examiner",
        factors: [
          { source: "dataQuality", code: "usable_history_weeks", description: "Semaines exploitables", value: 20 },
        ],
      },
    });

    expect(result.decisionRecommendation.explanation).toContain("cause détaillée n'est pas disponible");
    expect(result.decisionRecommendation.action).toContain("cause détaillée de la prudence n'est pas disponible");
  });

  it("omits historical sensitivity when it is absent, unavailable or incomplete", () => {
    expect(decisionLanguageWithSensitivity().historicalSensitivity).toBeUndefined();
    expect(decisionLanguageWithSensitivity(null).historicalSensitivity).toBeUndefined();
    expect(decisionLanguageWithSensitivity(historicalSensitivity({ level: "unavailable" })).historicalSensitivity).toBeUndefined();
    expect(decisionLanguageWithSensitivity(historicalSensitivity({ recentWindow: null })).historicalSensitivity).toBeUndefined();
    expect(decisionLanguageWithSensitivity(historicalSensitivity({ longWindow: null })).historicalSensitivity).toBeUndefined();
    expect(decisionLanguageWithSensitivity(historicalSensitivity({ recentTrend: null })).historicalSensitivity?.evolution).toBe("");
    expect(decisionLanguageWithSensitivity(historicalSensitivity({ recentChangeRate: null })).historicalSensitivity).toBeUndefined();
  });

  it("keeps optional sensitivity factors and integer P90 values readable", () => {
    const result = decisionLanguageWithSensitivity(historicalSensitivity({
      factors: [{ code: "stable", description: "Résultats stables" }],
      recentTrend: "unchanged",
      recentChangeRate: 0,
    })).historicalSensitivity;

    expect(result?.factors).toEqual([{ code: "stable", description: "Résultats stables" }]);
    expect(result?.recentP90).toContain("18 items");
    expect(result?.longP90).toContain("12 items");
    expect(result?.gap).toBe("Écart : 0 %");
  });

  it.each([
    ["unchanged", "weeks_to_items", 0, "Les résultats restent stables", "items"],
    ["improved", "weeks_to_items", 0.5, "davantage d'items", "items"],
    ["improved", "backlog_to_weeks", 0.5, "le délai prévu au P90 diminue", "semaines"],
    ["declined", "weeks_to_items", -0.1, "moins d'items", "items"],
    ["declined", "backlog_to_weeks", 0, "le délai prévu au P90 augmente", "semaines"],
  ] as const)("formats %s sensitivity for %s", (recentTrend, simulationMode, recentChangeRate, evolution, unit) => {
    const result = decisionLanguageWithSensitivity(historicalSensitivity({
      level: recentTrend === "unchanged" ? "stable" : "moderate",
      simulationMode,
      recentTrend,
      recentChangeRate,
      recentWindow: { id: "recent", startDate: "2026-03-01", endDate: "2026-04-30", p90: 18.25, usableWeeks: 9 },
      longWindow: { id: "long", startDate: "2026-01-01", endDate: "2026-04-30", p90: 12.5, usableWeeks: 17 },
      factors: [],
    })).historicalSensitivity;

    expect(result).toMatchObject({ status: expect.any(String), factors: [] });
    expect(result?.recentP90).toContain(`18,25 ${unit}`);
    expect(result?.longP90).toContain(`12,50 ${unit}`);
    expect(result?.gap).toBe(`Écart : ${recentChangeRate > 0 ? "+" : ""}${Math.round(recentChangeRate * 100)} %`);
    expect(result?.evolution).toContain(evolution);
  });
});
