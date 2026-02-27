import { beforeEach, describe, expect, it, vi } from "vitest";
import { runSimulationForecast } from "./simulationForecastService";
import { getWeeklyThroughputDirect } from "../adoClient";
import { postSimulate } from "../api";

// ─── Mocks des deux seules dépendances réseau ────────────────────────────────
// Le service ne fait que deux appels externes : ADO et le backend /simulate.
// Tout le reste (applyCapacityReduction, clamp, toSafeNumber) est de la logique
// pure déjà couverte dans leurs propres modules — pas besoin de les mocker.

vi.mock("../adoClient", () => ({
  getWeeklyThroughputDirect: vi.fn(),
}));

vi.mock("../api", () => ({
  postSimulate: vi.fn(),
}));

// ─── Fixtures réutilisables ───────────────────────────────────────────────────

const WEEKLY_6 = [
  { week: "2025-01-06", throughput: 5 },
  { week: "2025-01-13", throughput: 7 },
  { week: "2025-01-20", throughput: 4 },
  { week: "2025-01-27", throughput: 6 },
  { week: "2025-02-03", throughput: 8 },
  { week: "2025-02-10", throughput: 5 },
];

const API_RESPONSE_WEEKS = {
  result_kind: "weeks" as const,
  samples_count: 6,
  result_percentiles: { P50: 8, P70: 10, P90: 13 },
  result_distribution: [
    { x: 6, count: 400 },
    { x: 8, count: 3000 },
    { x: 10, count: 2000 },
    { x: 13, count: 1000 },
  ],
};

const API_RESPONSE_ITEMS = {
  result_kind: "items" as const,
  samples_count: 6,
  result_percentiles: { P50: 30, P70: 35, P90: 40 },
  result_distribution: [
    { x: 25, count: 1000 },
    { x: 30, count: 5000 },
    { x: 35, count: 3000 },
  ],
};

function baseParams(overrides: Partial<Parameters<typeof runSimulationForecast>[0]> = {}) {
  return {
    selectedOrg: "org-a",
    selectedProject: "Projet A",
    selectedTeam: "Equipe Alpha",
    pat: "pat-token-abcdefghijklmnopqrstuvwxyz",
    startDate: "2025-01-01",
    endDate: "2025-02-28",
    doneStates: ["Done", "Closed"],
    types: ["User Story", "Bug"],
    includeZeroWeeks: false,
    simulationMode: "backlog_to_weeks" as const,
    backlogSize: 80,
    targetWeeks: 12,
    nSims: 20000,
    capacityPercent: 100,
    reducedCapacityWeeks: 0,
    ...overrides,
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getWeeklyThroughputDirect).mockResolvedValue(WEEKLY_6);
  vi.mocked(postSimulate).mockResolvedValue(API_RESPONSE_WEEKS);
});

// ─── 1. Appels réseau ─────────────────────────────────────────────────────────
// Vérifie que le service transmet exactement les bons paramètres à chaque
// dépendance externe — c'est le contrat le plus important à protéger.

describe("appels réseau", () => {
  it("appelle getWeeklyThroughputDirect avec les bons paramètres", async () => {
    const params = baseParams();
    await runSimulationForecast(params);

    expect(getWeeklyThroughputDirect).toHaveBeenCalledOnce();
    expect(getWeeklyThroughputDirect).toHaveBeenCalledWith(
      "org-a",
      "Projet A",
      "Equipe Alpha",
      "pat-token-abcdefghijklmnopqrstuvwxyz",
      "2025-01-01",
      "2025-02-28",
      ["Done", "Closed"],
      ["User Story", "Bug"],
    );
  });

  it("appelle postSimulate en mode backlog_to_weeks avec backlog_size", async () => {
    await runSimulationForecast(baseParams({ backlogSize: 80 }));

    expect(postSimulate).toHaveBeenCalledOnce();
    expect(postSimulate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "backlog_to_weeks",
        backlog_size: 80,
        target_weeks: undefined,
        n_sims: 20000,
      }),
    );
  });

  it("appelle postSimulate en mode weeks_to_items avec target_weeks", async () => {
    vi.mocked(postSimulate).mockResolvedValue(API_RESPONSE_ITEMS);
    await runSimulationForecast(
      baseParams({ simulationMode: "weeks_to_items", targetWeeks: 12 }),
    );

    expect(postSimulate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "weeks_to_items",
        target_weeks: 12,
        backlog_size: undefined,
      }),
    );
  });
});

// ─── 2. Filtrage des samples ──────────────────────────────────────────────────
// Le filtrage des semaines à zéro est une règle métier critique :
// une semaine à 0 fausse la simulation si elle représente des congés/arrêts.

describe("filtrage des throughput samples", () => {
  it("exclut les semaines à 0 quand includeZeroWeeks = false", async () => {
    vi.mocked(getWeeklyThroughputDirect).mockResolvedValue([
      { week: "2025-01-06", throughput: 0 },
      { week: "2025-01-13", throughput: 5 },
      { week: "2025-01-20", throughput: 7 },
      { week: "2025-01-27", throughput: 4 },
      { week: "2025-02-03", throughput: 6 },
      { week: "2025-02-10", throughput: 8 },
      { week: "2025-02-17", throughput: 5 },
    ]);

    const result = await runSimulationForecast(baseParams({ includeZeroWeeks: false }));

    expect(result.sampleStats.zeroWeeks).toBe(1);
    expect(result.sampleStats.usedWeeks).toBe(6); // 7 total - 1 zéro
    expect(postSimulate).toHaveBeenCalledWith(
      expect.objectContaining({
        throughput_samples: [5, 7, 4, 6, 8, 5], // pas de 0
        include_zero_weeks: false,
      }),
    );
  });

  it("inclut les semaines à 0 quand includeZeroWeeks = true", async () => {
    vi.mocked(getWeeklyThroughputDirect).mockResolvedValue([
      { week: "2025-01-06", throughput: 0 },
      { week: "2025-01-13", throughput: 5 },
      { week: "2025-01-20", throughput: 7 },
      { week: "2025-01-27", throughput: 4 },
      { week: "2025-02-03", throughput: 6 },
      { week: "2025-02-10", throughput: 8 },
    ]);

    const result = await runSimulationForecast(
      baseParams({ includeZeroWeeks: true }),
    );

    expect(result.sampleStats.usedWeeks).toBe(6); // le 0 est compté
    expect(postSimulate).toHaveBeenCalledWith(
      expect.objectContaining({
        throughput_samples: [0, 5, 7, 4, 6, 8],
        include_zero_weeks: true,
      }),
    );
  });
});

// ─── 3. Seuil d'historique insuffisant ───────────────────────────────────────
// C'était le bug d'encodage corrigé en V5 — s'assurer que le message
// est lisible et que l'erreur est bien levée au bon moment.

describe("seuil d'historique insuffisant", () => {
  it("lève une erreur si moins de 6 semaines non-nulles (includeZeroWeeks = false)", async () => {
    vi.mocked(getWeeklyThroughputDirect).mockResolvedValue([
      { week: "2025-01-06", throughput: 0 },
      { week: "2025-01-13", throughput: 5 },
      { week: "2025-01-20", throughput: 7 },
      { week: "2025-01-27", throughput: 4 },
      { week: "2025-02-03", throughput: 6 }, // 4 non-nulles seulement
    ]);

    await expect(
      runSimulationForecast(baseParams({ includeZeroWeeks: false })),
    ).rejects.toThrow("Historique insuffisant");

    expect(postSimulate).not.toHaveBeenCalled();
  });

  it("lève une erreur si moins de 6 semaines au total (includeZeroWeeks = true)", async () => {
    vi.mocked(getWeeklyThroughputDirect).mockResolvedValue([
      { week: "2025-01-06", throughput: 3 },
      { week: "2025-01-13", throughput: 5 },
      { week: "2025-01-20", throughput: 4 },
    ]);

    await expect(
      runSimulationForecast(baseParams({ includeZeroWeeks: true })),
    ).rejects.toThrow("Historique insuffisant");

    expect(postSimulate).not.toHaveBeenCalled();
  });

  it("le message d'erreur est lisible (pas de double-encodage UTF-8)", async () => {
    vi.mocked(getWeeklyThroughputDirect).mockResolvedValue([
      { week: "2025-01-06", throughput: 3 },
    ]);

    await expect(
      runSimulationForecast(baseParams()),
    ).rejects.toThrow("Elargissez la periode");
  });

  it("ne lève pas d'erreur avec exactement 6 semaines valides", async () => {
    await expect(runSimulationForecast(baseParams())).resolves.toBeDefined();
  });
});

// ─── 4. sampleStats retournés ─────────────────────────────────────────────────
// Le panneau de résultats affiche totalWeeks / zeroWeeks / usedWeeks —
// ces valeurs doivent être calculées indépendamment du filtrage des samples.

describe("sampleStats", () => {
  it("calcule correctement totalWeeks, zeroWeeks et usedWeeks", async () => {
    vi.mocked(getWeeklyThroughputDirect).mockResolvedValue([
      { week: "2025-01-06", throughput: 0 },
      { week: "2025-01-13", throughput: 0 },
      { week: "2025-01-20", throughput: 5 },
      { week: "2025-01-27", throughput: 7 },
      { week: "2025-02-03", throughput: 4 },
      { week: "2025-02-10", throughput: 6 },
      { week: "2025-02-17", throughput: 8 },
      { week: "2025-02-24", throughput: 5 },
    ]);

    const { sampleStats } = await runSimulationForecast(
      baseParams({ includeZeroWeeks: false }),
    );

    expect(sampleStats.totalWeeks).toBe(8);
    expect(sampleStats.zeroWeeks).toBe(2);
    expect(sampleStats.usedWeeks).toBe(6);
  });
});

// ─── 5. Construction de l'entrée historique ───────────────────────────────────
// historyEntry est persisté dans le localStorage et rechargé entre sessions.
// Ses champs doivent être exactement conformes à SimulationHistoryEntry.

describe("historyEntry", () => {
  it("contient les métadonnées de session correctes", async () => {
    const params = baseParams({
      selectedOrg: "org-x",
      selectedProject: "Projet X",
      selectedTeam: "Team X",
      startDate: "2025-01-01",
      endDate: "2025-03-01",
      types: ["Bug"],
      doneStates: ["Done"],
    });

    const { historyEntry } = await runSimulationForecast(params);

    expect(historyEntry.selectedOrg).toBe("org-x");
    expect(historyEntry.selectedProject).toBe("Projet X");
    expect(historyEntry.selectedTeam).toBe("Team X");
    expect(historyEntry.startDate).toBe("2025-01-01");
    expect(historyEntry.endDate).toBe("2025-03-01");
    expect(historyEntry.types).toEqual(["Bug"]);
    expect(historyEntry.doneStates).toEqual(["Done"]);
  });

  it("génère un id unique et une date ISO valide", async () => {
    const { historyEntry: e1 } = await runSimulationForecast(baseParams());
    const { historyEntry: e2 } = await runSimulationForecast(baseParams());

    expect(e1.id).not.toBe(e2.id);
    expect(() => new Date(e1.createdAt)).not.toThrow();
    expect(new Date(e1.createdAt).toISOString()).toBe(e1.createdAt);
  });

  it("applique toSafeNumber sur backlogSize, targetWeeks et nSims", async () => {
    const { historyEntry } = await runSimulationForecast(
      baseParams({ backlogSize: "120", targetWeeks: "12", nSims: "20000" }),
    );

    expect(historyEntry.backlogSize).toBe(120);
    expect(historyEntry.targetWeeks).toBe(12);
    expect(historyEntry.nSims).toBe(20000);
    expect(typeof historyEntry.backlogSize).toBe("number");
  });

  it("clamp capacityPercent entre 1 et 100", async () => {
    const { historyEntry: e1 } = await runSimulationForecast(
      baseParams({ capacityPercent: 150 }),
    );
    const { historyEntry: e2 } = await runSimulationForecast(
      baseParams({ capacityPercent: -10 }),
    );

    expect(e1.capacityPercent).toBe(100);
    expect(e2.capacityPercent).toBe(1);
  });

  it("clamp reducedCapacityWeeks entre 0 et 260", async () => {
    const { historyEntry: over } = await runSimulationForecast(
      baseParams({ reducedCapacityWeeks: 999 }),
    );
    const { historyEntry: under } = await runSimulationForecast(
      baseParams({ reducedCapacityWeeks: -5 }),
    );

    expect(over.reducedCapacityWeeks).toBe(260);
    expect(under.reducedCapacityWeeks).toBe(0);
  });

  it("les tableaux types et doneStates sont des copies défensives", async () => {
    const types = ["Bug"];
    const doneStates = ["Done"];
    const { historyEntry } = await runSimulationForecast(
      baseParams({ types, doneStates }),
    );

    types.push("Story");
    doneStates.push("Closed");

    expect(historyEntry.types).toEqual(["Bug"]);
    expect(historyEntry.doneStates).toEqual(["Done"]);
  });
});

// ─── 6. Application de la réduction de capacité ───────────────────────────────
// applyCapacityReductionToResult est testé dans utils/simulation.test.ts,
// mais ici on vérifie que le service l'applique bien sur le résultat final
// avant de le stocker dans historyEntry.

describe("réduction de capacité", () => {
  it("n'applique pas de réduction quand capacityPercent = 100", async () => {
    const { result } = await runSimulationForecast(
      baseParams({ capacityPercent: 100, reducedCapacityWeeks: 4 }),
    );

    // Identique à la réponse brute de l'API
    expect(result.result_percentiles).toEqual(API_RESPONSE_WEEKS.result_percentiles);
  });

  it("décale les percentiles en semaines quand la capacité est réduite", async () => {
    // 50% de capacité pendant 4 semaines = 2 semaines perdues (4 * 0.5)
    const { result } = await runSimulationForecast(
      baseParams({ capacityPercent: 50, reducedCapacityWeeks: 4 }),
    );

    expect(result.result_percentiles["P50"]).toBeCloseTo(
      API_RESPONSE_WEEKS.result_percentiles["P50"] + 2,
      5,
    );
    expect(result.result_percentiles["P90"]).toBeCloseTo(
      API_RESPONSE_WEEKS.result_percentiles["P90"] + 2,
      5,
    );
  });

  it("réduit les items en mode weeks_to_items avec capacité réduite", async () => {
    vi.mocked(postSimulate).mockResolvedValue(API_RESPONSE_ITEMS);

    // 80% capacité pendant 12 semaines sur un horizon de 12 semaines
    // lostWeeks = 12 * 0.2 = 2.4 → itemFactor = (12 - 2.4) / 12 = 0.8
    const { result } = await runSimulationForecast(
      baseParams({
        simulationMode: "weeks_to_items",
        targetWeeks: 12,
        capacityPercent: 80,
        reducedCapacityWeeks: 12,
      }),
    );

    const expectedP50 = Math.round(API_RESPONSE_ITEMS.result_percentiles["P50"] * 0.8);
    expect(result.result_percentiles["P50"]).toBeCloseTo(expectedP50, 0);
  });
});

// ─── 7. Propagation des erreurs réseau ────────────────────────────────────────
// Si ADO ou le backend échoue, l'erreur doit remonter sans être avalée.
// useSimulation.ts l'attrape avec try/catch et affiche setErr().

describe("propagation des erreurs réseau", () => {
  it("propage l'erreur si getWeeklyThroughputDirect échoue", async () => {
    vi.mocked(getWeeklyThroughputDirect).mockRejectedValue(
      new Error("Erreur réseau ADO"),
    );

    await expect(runSimulationForecast(baseParams())).rejects.toThrow(
      "Erreur réseau ADO",
    );
    expect(postSimulate).not.toHaveBeenCalled();
  });

  it("propage l'erreur si postSimulate échoue", async () => {
    vi.mocked(postSimulate).mockRejectedValue(
      new Error("HTTP 429"),
    );

    await expect(runSimulationForecast(baseParams())).rejects.toThrow("HTTP 429");
  });

  it("ne swallow pas une erreur 422 de validation backend", async () => {
    vi.mocked(postSimulate).mockRejectedValue(
      new Error("Historique insuffisant (moins de 6 semaines non nulles)."),
    );

    await expect(runSimulationForecast(baseParams())).rejects.toThrow(
      "Historique insuffisant",
    );
  });
});

// ─── 8. Cohérence du résultat retourné ───────────────────────────────────────
// weeklyThroughput dans le retour doit être identique à ce que l'entrée
// historique contient — pas deux copies divergentes.

describe("cohérence du résultat retourné", () => {
  it("weeklyThroughput est identique dans le retour et dans historyEntry", async () => {
    const { weeklyThroughput, historyEntry } = await runSimulationForecast(baseParams());

    expect(weeklyThroughput).toBe(historyEntry.weeklyThroughput);
  });

  it("result est identique dans le retour et dans historyEntry", async () => {
    const { result, historyEntry } = await runSimulationForecast(baseParams());

    expect(result).toEqual(historyEntry.result);
  });

  it("sampleStats est identique dans le retour et dans historyEntry", async () => {
    const { sampleStats, historyEntry } = await runSimulationForecast(baseParams());

    expect(sampleStats).toEqual(historyEntry.sampleStats);
  });

  it("propage un warning de donnees partielles", async () => {
    vi.mocked(getWeeklyThroughputDirect).mockResolvedValue({
      weeklyThroughput: WEEKLY_6,
      warning: "1/3 lot(s) de work items n'ont pas pu etre charges.",
    });

    const { warning, historyEntry } = await runSimulationForecast(baseParams());

    expect(warning).toContain("1/3");
    expect(historyEntry.warning).toContain("1/3");
  });
});
