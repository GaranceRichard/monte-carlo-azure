import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchTeamThroughput, runSimulationForecast, simulateForecastFromSamples } from "./simulationForecastService";
import { getTeamDeliveryDataDirect } from "../adoClient";
import { postSimulate } from "../api";
import {
  SIMULATION_HORIZON_WEEKS_MAX,
  SIMULATION_THROUGHPUT_SAMPLES_MAX,
} from "../simulationLimits";
import { DeterministicFrontendClock } from "../test/deterministicFrontendClock";

vi.mock("../adoClient", () => ({
  getTeamDeliveryDataDirect: vi.fn(),
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
  seed: 111,
  result_percentiles: { P50: 8, P70: 10, P90: 13 }, risk_score: 0.625,
  completion_summary: { completed_count: 20000, censored_count: 0, censored_rate: 0, horizon_weeks: 521 },
  throughput_reliability: { cv: 0.22, iqr_ratio: 0.3, slope_norm: -0.02, label: "fiable" as const, samples_count: 6 },
  result_distribution: [
    { x: 6, count: 4000 },
    { x: 8, count: 10000 },
    { x: 10, count: 4000 },
    { x: 13, count: 2000 },
  ],
};

const API_RESPONSE_ITEMS = {
  result_kind: "items" as const,
  samples_count: 6,
  seed: 222,
  result_percentiles: { P50: 40, P70: 35, P90: 30 }, risk_score: 0.25,
  throughput_reliability: { cv: 0.65, iqr_ratio: 0.7, slope_norm: -0.08, label: "incertain" as const, samples_count: 6 },
  result_distribution: [
    { x: 25, count: 5000 },
    { x: 30, count: 10000 },
    { x: 35, count: 5000 },
  ],
};

const CONTROLLED_INSTANT = "2026-08-26T14:30:45.123Z";

function baseParams(overrides: Partial<Parameters<typeof runSimulationForecast>[0]> = {}) {
  return {
    clock: new DeterministicFrontendClock(CONTROLLED_INSTANT),
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

const SAMPLE_PARAMS = {
  throughputSamples: [5, 7, 4, 6, 8, 5],
  simulationMode: "backlog_to_weeks" as const,
  backlogSize: 80, targetWeeks: 12,
  nSims: 20000,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getTeamDeliveryDataDirect).mockResolvedValue({ weeklyThroughput: WEEKLY_6, cycleTimeDaysData: [] });
  vi.mocked(postSimulate).mockResolvedValue(API_RESPONSE_WEEKS);
});

describe("demo mode et normalisation", () => {
  it("uses the demo throughput source without network calls", async () => {
    const result = await fetchTeamThroughput({
      demoMode: true,
      selectedOrg: "Acme Corp",
      selectedProject: "Programme Titan",
      selectedTeam: "Alpha",
      pat: "",
      serverUrl: "",
      startDate: "2025-11-24",
      endDate: "2026-03-09",
      doneStates: ["Done"],
      types: ["Bug"],
      includeZeroWeeks: true,
    });

    expect(result.weeklyThroughput.length).toBeGreaterThan(0);
    expect(result.cycleTimeDaysData.length).toBeGreaterThan(0);
    expect(result.sampleStats.totalWeeks).toBe(result.weeklyThroughput.length);
    expect(result.sampleStats.zeroWeeks).toBe(0);
    expect(vi.mocked(getTeamDeliveryDataDirect)).not.toHaveBeenCalled();
  });

  it("filters out zero weeks in demo mode when includeZeroWeeks is false", async () => {
    const result = await fetchTeamThroughput({
      demoMode: true,
      selectedOrg: "Acme Corp",
      selectedProject: "Programme Titan",
      selectedTeam: "Alpha",
      pat: "",
      serverUrl: "",
      startDate: "2025-11-24",
      endDate: "2026-03-09",
      doneStates: ["Done"],
      types: ["Bug"],
      includeZeroWeeks: false,
    });

    expect(result.sampleStats.usedWeeks).toBe(result.throughputSamples.length);
    expect(result.throughputSamples.every((value) => value > 0)).toBe(true);
  });

  it("uses local simulation in demo mode without API calls", async () => {
    const result = await simulateForecastFromSamples({
      demoMode: true,
      throughputSamples: [3, 4, 5, 6, 7, 8],
      includeZeroWeeks: true,
      simulationMode: "weeks_to_items",
      backlogSize: 120,
      targetWeeks: 6,
      nSims: 1000,
    });

    expect(result.resultKind).toBe("items");
    expect(result.resultPercentiles.P50).toBeGreaterThan(0);
    expect(vi.mocked(postSimulate)).not.toHaveBeenCalled();
  });

  it("uses local simulation in demo backlog mode without API calls", async () => {
    const result = await simulateForecastFromSamples({
      demoMode: true,
      throughputSamples: [3, 4, 5, 6, 7, 8],
      includeZeroWeeks: true,
      simulationMode: "backlog_to_weeks",
      backlogSize: 120,
      targetWeeks: 6,
      nSims: 1000,
    });

    expect(result.resultKind).toBe("weeks");
    expect(result.resultPercentiles.P50).toBeGreaterThan(0);
    expect(vi.mocked(postSimulate)).not.toHaveBeenCalled();
  });

  it("rejette une reponse calculable dont le backend omet risk_score", async () => {
    const { risk_score: _riskScore, ...responseWithoutRiskScore } = API_RESPONSE_WEEKS;
    vi.mocked(postSimulate).mockResolvedValue(responseWithoutRiskScore);

    await expect(simulateForecastFromSamples(SAMPLE_PARAMS)).rejects.toThrow("risk_score calculable est requis");
  });

  it("laisse risk_score absent si le backend ne le renvoie pas et que P50/P90 manquent", async () => {
    const { risk_score: _riskScore, ...responseWithoutRiskScore } = API_RESPONSE_WEEKS;
    vi.mocked(postSimulate).mockResolvedValue({
      ...responseWithoutRiskScore,
      result_percentiles: { P70: 10 },
    } as never);

    expect((await simulateForecastFromSamples(SAMPLE_PARAMS)).riskScore).toBeUndefined();
  });

  it("resout les memes valeurs par defaut que la frontiere Python", async () => {
    await simulateForecastFromSamples({
      ...SAMPLE_PARAMS,
      throughputSamples: [0, 1, 2, 3, 4, 5, 6],
      nSims: undefined,
    });

    expect(postSimulate).toHaveBeenCalledWith(
      expect.objectContaining({
        include_zero_weeks: false,
        n_sims: 20000,
      }),
    );
  });
});

describe("appels réseau", () => {
  it("utilise la forme objet weeklyThroughput + warning quand ADO renvoie un warning", async () => {
    vi.mocked(getTeamDeliveryDataDirect).mockResolvedValue({
      weeklyThroughput: WEEKLY_6,
      cycleTimeDaysData: [],
      warning: "lots partiellement ignores",
    });

    const result = await runSimulationForecast(baseParams());

    expect(result.warning).toBe("lots partiellement ignores");
    expect(result.weeklyThroughput).toEqual(WEEKLY_6);
    expect(result.sampleStats.usedWeeks).toBe(6);
  });

  it("appelle getTeamDeliveryDataDirect avec les bons parametres", async () => {
    await runSimulationForecast(baseParams());

    expect(getTeamDeliveryDataDirect).toHaveBeenCalledOnce();
    expect(getTeamDeliveryDataDirect).toHaveBeenCalledWith(
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
        n_sims: 20000,
      }),
    );
    expect(vi.mocked(postSimulate).mock.calls[0]?.[0]).not.toHaveProperty("target_weeks");
    expect(vi.mocked(postSimulate).mock.calls[0]?.[0]).not.toHaveProperty("client_context");
    expect(vi.mocked(postSimulate).mock.calls[0]?.[0]).not.toHaveProperty("selected_team");
    expect(vi.mocked(postSimulate).mock.calls[0]?.[0]).not.toHaveProperty("pat");
    expect(vi.mocked(postSimulate).mock.calls[0]?.[0]).not.toHaveProperty("server_url");
  });

  it("appelle postSimulate en mode weeks_to_items avec target_weeks", async () => {
    vi.mocked(postSimulate).mockResolvedValue(API_RESPONSE_ITEMS);

    await runSimulationForecast(baseParams({ simulationMode: "weeks_to_items", targetWeeks: 12 }));

    expect(postSimulate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "weeks_to_items",
        target_weeks: 12,
      }),
    );
    expect(vi.mocked(postSimulate).mock.calls[0]?.[0]).not.toHaveProperty("backlog_size");
  });

  it("couvre directement backlog_size pour simulateForecastFromSamples", async () => {
    await simulateForecastFromSamples({
      throughputSamples: [5, 7, 4, 6, 8, 5],
      simulationMode: "backlog_to_weeks",
      backlogSize: 80,
      targetWeeks: 12,
      nSims: 20000,
    });

    expect(postSimulate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "backlog_to_weeks",
        backlog_size: 80,
      }),
    );
    expect(vi.mocked(postSimulate).mock.calls[0]?.[0]).not.toHaveProperty("target_weeks");
  });

  it("couvre directement target_weeks pour simulateForecastFromSamples", async () => {
    vi.mocked(postSimulate).mockResolvedValue(API_RESPONSE_ITEMS);

    await simulateForecastFromSamples({
      throughputSamples: [5, 7, 4, 6, 8, 5],
      simulationMode: "weeks_to_items",
      backlogSize: 80,
      targetWeeks: 12,
      nSims: 20000,
    });

    expect(postSimulate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "weeks_to_items",
        target_weeks: 12,
      }),
    );
    expect(vi.mocked(postSimulate).mock.calls[0]?.[0]).not.toHaveProperty("backlog_size");
  });

  it("rejette une distribution absente qui ne conserve pas la masse", async () => {
    vi.mocked(postSimulate).mockResolvedValue({
      result_kind: "weeks",
      samples_count: 6,
      seed: 333,
      result_percentiles: { P50: 8, P70: 10, P90: 13 },
      risk_score: 0.25,
      throughput_reliability: { cv: 0.22, iqr_ratio: 0.3, slope_norm: -0.02, label: "fiable", samples_count: 6 },
    } as never);

    await expect(runSimulationForecast(baseParams())).rejects.toThrow("collection");
  });

  it("propage throughput_reliability tel quel", async () => {
    const result = await runSimulationForecast(baseParams());

    expect(result.result.throughputReliability).toEqual({ cv: 0.22, iqrRatio: 0.3, slopeNorm: -0.02, label: "fiable", samplesCount: 6 });
  });
});

describe("filtrage des throughput samples", () => {
  it("exclut les semaines à 0 quand includeZeroWeeks = false", async () => {
    vi.mocked(getTeamDeliveryDataDirect).mockResolvedValue({ weeklyThroughput: [
      { week: "2025-01-06", throughput: 0 },
      { week: "2025-01-13", throughput: 5 },
      { week: "2025-01-20", throughput: 7 },
      { week: "2025-01-27", throughput: 4 },
      { week: "2025-02-03", throughput: 6 },
      { week: "2025-02-10", throughput: 8 },
      { week: "2025-02-17", throughput: 5 },
    ], cycleTimeDaysData: [] });

    const result = await runSimulationForecast(baseParams({ includeZeroWeeks: false }));

    expect(result.sampleStats.zeroWeeks).toBe(1);
    expect(result.sampleStats.usedWeeks).toBe(6);
    expect(postSimulate).toHaveBeenCalledWith(
      expect.objectContaining({
        throughput_samples: [0, 5, 7, 4, 6, 8, 5],
        include_zero_weeks: false,
      }),
    );
  });

  it("inclut les semaines à 0 quand includeZeroWeeks = true", async () => {
    vi.mocked(getTeamDeliveryDataDirect).mockResolvedValue({ weeklyThroughput: [
      { week: "2025-01-06", throughput: 0 },
      { week: "2025-01-13", throughput: 5 },
      { week: "2025-01-20", throughput: 7 },
      { week: "2025-01-27", throughput: 4 },
      { week: "2025-02-03", throughput: 6 },
      { week: "2025-02-10", throughput: 8 },
    ], cycleTimeDaysData: [] });

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
    vi.mocked(getTeamDeliveryDataDirect).mockResolvedValue({ weeklyThroughput: [
      { week: "2025-01-06", throughput: 0 },
      { week: "2025-01-13", throughput: 5 },
      { week: "2025-01-20", throughput: 7 },
      { week: "2025-01-27", throughput: 4 },
      { week: "2025-02-03", throughput: 6 },
    ], cycleTimeDaysData: [] });

    await expect(runSimulationForecast(baseParams({ includeZeroWeeks: false }))).rejects.toThrow("Historique insuffisant");
    expect(postSimulate).not.toHaveBeenCalled();
  });

  it("lève une erreur si moins de 6 semaines au total", async () => {
    vi.mocked(getTeamDeliveryDataDirect).mockResolvedValue({ weeklyThroughput: [
      { week: "2025-01-06", throughput: 3 },
      { week: "2025-01-13", throughput: 5 },
      { week: "2025-01-20", throughput: 4 },
    ], cycleTimeDaysData: [] });

    await expect(runSimulationForecast(baseParams({ includeZeroWeeks: true }))).rejects.toThrow("Historique insuffisant");
    expect(postSimulate).not.toHaveBeenCalled();
  });

  it("renvoie un message lisible", async () => {
    vi.mocked(getTeamDeliveryDataDirect).mockResolvedValue({ weeklyThroughput: [{ week: "2025-01-06", throughput: 3 }], cycleTimeDaysData: [] });

    await expect(runSimulationForecast(baseParams())).rejects.toThrow("Elargissez la periode");
  });

  it("accepte exactement 6 semaines valides", async () => {
    await expect(runSimulationForecast(baseParams())).resolves.toBeDefined();
  });

  it("rejette un contrôle vide avant l'appel API", async () => {
    await expect(
      simulateForecastFromSamples({
        throughputSamples: [5, 7, 4, 6, 8, 5],
        simulationMode: "backlog_to_weeks",
        backlogSize: "",
        targetWeeks: 12,
        nSims: 20_000,
      }),
    ).rejects.toThrow("backlog_size requis");

    expect(postSimulate).not.toHaveBeenCalled();
  });

  it("accepte les bornes d'horizon et d'historique et les transmet telles quelles", async () => {
    vi.mocked(postSimulate).mockResolvedValue(API_RESPONSE_ITEMS);

    await simulateForecastFromSamples({
      throughputSamples: Array.from({ length: SIMULATION_THROUGHPUT_SAMPLES_MAX }, () => 1),
      simulationMode: "weeks_to_items",
      backlogSize: 80,
      targetWeeks: SIMULATION_HORIZON_WEEKS_MAX,
      nSims: 20_000,
    });

    expect(postSimulate).toHaveBeenCalledWith(
      expect.objectContaining({
        target_weeks: SIMULATION_HORIZON_WEEKS_MAX,
        n_sims: 20_000,
      }),
    );
  });
});

describe("sampleStats", () => {
  it("calcule correctement totalWeeks, zeroWeeks et usedWeeks", async () => {
    vi.mocked(getTeamDeliveryDataDirect).mockResolvedValue({ weeklyThroughput: [
      { week: "2025-01-06", throughput: 0 },
      { week: "2025-01-13", throughput: 0 },
      { week: "2025-01-20", throughput: 5 },
      { week: "2025-01-27", throughput: 7 },
      { week: "2025-02-03", throughput: 4 },
      { week: "2025-02-10", throughput: 6 },
      { week: "2025-02-17", throughput: 8 },
      { week: "2025-02-24", throughput: 5 },
    ], cycleTimeDaysData: [] });

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
    const clock = new DeterministicFrontendClock(CONTROLLED_INSTANT);
    const { historyEntry: e1 } = await runSimulationForecast(baseParams({ clock }));
    const { historyEntry: e2 } = await runSimulationForecast(baseParams({ clock }));

    expect(e1.id).not.toBe(e2.id);
    expect(e1.createdAt).toBe(CONTROLLED_INSTANT);
    expect(e2.createdAt).toBe(CONTROLLED_INSTANT);
    expect(clock.calls).toBe(2);
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

  it("retombe sur un id date-seed quand crypto.randomUUID est indisponible", async () => {
    const originalCrypto = globalThis.crypto;
    const clock = new DeterministicFrontendClock(CONTROLLED_INSTANT);
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: undefined,
    });
    try {
      const { historyEntry } = await runSimulationForecast(baseParams({ seed: 111, clock }));
      expect(historyEntry.id).toBe(`${CONTROLLED_INSTANT}-111`);
      expect(clock.calls).toBe(1);
    } finally {
      Object.defineProperty(globalThis, "crypto", {
        configurable: true,
        value: originalCrypto,
      });
    }
  });

  it("copie défensivement les tableaux", async () => {
    const types = ["Bug"];
    const doneStates = ["Done"];
    const { historyEntry } = await runSimulationForecast(baseParams({ types, doneStates }));

    types.push("Story");
    doneStates.push("Closed");

    expect(historyEntry.types).toEqual(["Bug"]);
    expect(historyEntry.doneStates).toEqual(["Done"]);
    expect(historyEntry.cycleTimeDaysData).toEqual([]);
  });
});

describe("propagation des erreurs réseau", () => {
  it("propage l'erreur si getTeamDeliveryDataDirect echoue", async () => {
    vi.mocked(getTeamDeliveryDataDirect).mockRejectedValue(new Error("Erreur réseau ADO"));

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
    vi.mocked(getTeamDeliveryDataDirect).mockResolvedValue({
      weeklyThroughput: WEEKLY_6,
      cycleTimeDaysData: [],
      warning: "1/3 lot(s) de work items n'ont pas pu etre charges.",
    });

    const { warning, historyEntry } = await runSimulationForecast(baseParams());

    expect(warning).toContain("1/3");
    expect(historyEntry.warning).toContain("1/3");
  });
});
