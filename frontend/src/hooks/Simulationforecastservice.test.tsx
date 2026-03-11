import { beforeEach, describe, expect, it, vi } from "vitest";
import { runSimulationForecast } from "./simulationForecastService";
import { getWeeklyThroughputDirect } from "../adoClient";
import { postSimulate } from "../api";

vi.mock("../adoClient", () => ({
  getWeeklyThroughputDirect: vi.fn(),
}));

vi.mock("../api", () => ({
  postSimulate: vi.fn(),
}));

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
  throughput_reliability: { cv: 0.22, iqr_ratio: 0.3, slope_norm: -0.02, label: "fiable" as const, samples_count: 6 },
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
  throughput_reliability: { cv: 0.65, iqr_ratio: 0.7, slope_norm: -0.08, label: "incertain" as const, samples_count: 6 },
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
    serverUrl: "",
    startDate: "2025-01-01",
    endDate: "2025-02-28",
    doneStates: ["Done", "Closed"],
    types: ["User Story", "Bug"],
    includeZeroWeeks: false,
    simulationMode: "backlog_to_weeks" as const,
    backlogSize: 80,
    targetWeeks: 12,
    nSims: 20000,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getWeeklyThroughputDirect).mockResolvedValue(WEEKLY_6);
  vi.mocked(postSimulate).mockResolvedValue(API_RESPONSE_WEEKS);
});

describe("appels réseau", () => {
  it("appelle getWeeklyThroughputDirect avec les bons paramètres", async () => {
    await runSimulationForecast(baseParams());

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
      "",
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

    await runSimulationForecast(baseParams({ simulationMode: "weeks_to_items", targetWeeks: 12 }));

    expect(postSimulate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "weeks_to_items",
        target_weeks: 12,
        backlog_size: undefined,
      }),
    );
  });

  it("normalise une distribution absente en tableau vide", async () => {
    vi.mocked(postSimulate).mockResolvedValue({
      result_kind: "weeks",
      samples_count: 6,
      result_percentiles: { P50: 8, P70: 10, P90: 13 },
      risk_score: 0.25,
      throughput_reliability: { cv: 0.22, iqr_ratio: 0.3, slope_norm: -0.02, label: "fiable", samples_count: 6 },
    } as never);

    const result = await runSimulationForecast(baseParams());

    expect(result.result.result_distribution).toEqual([]);
  });

  it("propage throughput_reliability tel quel", async () => {
    const result = await runSimulationForecast(baseParams());

    expect(result.result.throughput_reliability).toEqual(API_RESPONSE_WEEKS.throughput_reliability);
  });
});

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
    expect(result.sampleStats.usedWeeks).toBe(6);
    expect(postSimulate).toHaveBeenCalledWith(
      expect.objectContaining({
        throughput_samples: [5, 7, 4, 6, 8, 5],
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

    const result = await runSimulationForecast(baseParams({ includeZeroWeeks: true }));

    expect(result.sampleStats.usedWeeks).toBe(6);
    expect(postSimulate).toHaveBeenCalledWith(
      expect.objectContaining({
        throughput_samples: [0, 5, 7, 4, 6, 8],
        include_zero_weeks: true,
      }),
    );
  });
});

describe("seuil d'historique insuffisant", () => {
  it("lève une erreur si moins de 6 semaines non nulles", async () => {
    vi.mocked(getWeeklyThroughputDirect).mockResolvedValue([
      { week: "2025-01-06", throughput: 0 },
      { week: "2025-01-13", throughput: 5 },
      { week: "2025-01-20", throughput: 7 },
      { week: "2025-01-27", throughput: 4 },
      { week: "2025-02-03", throughput: 6 },
    ]);

    await expect(runSimulationForecast(baseParams({ includeZeroWeeks: false }))).rejects.toThrow("Historique insuffisant");
    expect(postSimulate).not.toHaveBeenCalled();
  });

  it("lève une erreur si moins de 6 semaines au total", async () => {
    vi.mocked(getWeeklyThroughputDirect).mockResolvedValue([
      { week: "2025-01-06", throughput: 3 },
      { week: "2025-01-13", throughput: 5 },
      { week: "2025-01-20", throughput: 4 },
    ]);

    await expect(runSimulationForecast(baseParams({ includeZeroWeeks: true }))).rejects.toThrow("Historique insuffisant");
    expect(postSimulate).not.toHaveBeenCalled();
  });

  it("renvoie un message lisible", async () => {
    vi.mocked(getWeeklyThroughputDirect).mockResolvedValue([{ week: "2025-01-06", throughput: 3 }]);

    await expect(runSimulationForecast(baseParams())).rejects.toThrow("Elargissez la periode");
  });

  it("accepte exactement 6 semaines valides", async () => {
    await expect(runSimulationForecast(baseParams())).resolves.toBeDefined();
  });
});

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

    const { sampleStats } = await runSimulationForecast(baseParams({ includeZeroWeeks: false }));

    expect(sampleStats.totalWeeks).toBe(8);
    expect(sampleStats.zeroWeeks).toBe(2);
    expect(sampleStats.usedWeeks).toBe(6);
  });
});

describe("historyEntry", () => {
  it("contient les métadonnées de session correctes", async () => {
    const { historyEntry } = await runSimulationForecast(
      baseParams({
        selectedOrg: "org-x",
        selectedProject: "Projet X",
        selectedTeam: "Team X",
        startDate: "2025-01-01",
        endDate: "2025-03-01",
        types: ["Bug"],
        doneStates: ["Done"],
      }),
    );

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

  it("copie défensivement les tableaux", async () => {
    const types = ["Bug"];
    const doneStates = ["Done"];
    const { historyEntry } = await runSimulationForecast(baseParams({ types, doneStates }));

    types.push("Story");
    doneStates.push("Closed");

    expect(historyEntry.types).toEqual(["Bug"]);
    expect(historyEntry.doneStates).toEqual(["Done"]);
  });
});

describe("propagation des erreurs réseau", () => {
  it("propage l'erreur si getWeeklyThroughputDirect échoue", async () => {
    vi.mocked(getWeeklyThroughputDirect).mockRejectedValue(new Error("Erreur réseau ADO"));

    await expect(runSimulationForecast(baseParams())).rejects.toThrow("Erreur réseau ADO");
    expect(postSimulate).not.toHaveBeenCalled();
  });

  it("propage l'erreur si postSimulate échoue", async () => {
    vi.mocked(postSimulate).mockRejectedValue(new Error("HTTP 429"));

    await expect(runSimulationForecast(baseParams())).rejects.toThrow("HTTP 429");
  });

  it("propage une erreur 422 backend", async () => {
    vi.mocked(postSimulate).mockRejectedValue(new Error("Historique insuffisant (moins de 6 semaines non nulles)."));

    await expect(runSimulationForecast(baseParams())).rejects.toThrow("Historique insuffisant");
  });
});

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

  it("propage un warning de données partielles", async () => {
    vi.mocked(getWeeklyThroughputDirect).mockResolvedValue({
      weeklyThroughput: WEEKLY_6,
      warning: "1/3 lot(s) de work items n'ont pas pu etre charges.",
    });

    const { warning, historyEntry } = await runSimulationForecast(baseParams());

    expect(warning).toContain("1/3");
    expect(historyEntry.warning).toContain("1/3");
  });
});
