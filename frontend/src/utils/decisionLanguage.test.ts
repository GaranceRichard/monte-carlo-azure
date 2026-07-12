import { describe, expect, it } from "vitest";
import { buildDecisionLanguage, getDataQualityAction, getForecastUncertaintyAction } from "./decisionLanguage";

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
      dataQuality: { level: "watch", justification: "Donnees partielles", factors: qualityFactors },
      forecastUncertainty: { level: "high", justification: "Volatilite", factors: uncertaintyFactors },
      decisionRecommendation: { level: "arbitration_required", justification: "Arbitrage", factors: [{ ...qualityFactors[0], source: "dataQuality" }], advisedAction: "Valider" },
    });

    expect(result.dataQuality).toMatchObject({ title: "Qualité des données", status: "Données à surveiller", factors: qualityFactors });
    expect(result.forecastUncertainty).toMatchObject({ title: "Incertitude de prévision", status: "Incertitude élevée", factors: uncertaintyFactors });
    expect(result.decisionRecommendation).toMatchObject({ title: "Recommandation de décision", status: "Arbitrage nécessaire", action: "Valider" });
  });
});
