import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTeamDeliveryDataDirect } from "../adoClient";
import { postSimulate } from "../api";
import { SIMULATION_SEED_MAX } from "../domain/simulationValueObjects";
import { localTeamForecast } from "../application/team-forecast";
import { DeterministicFrontendClock } from "../test/deterministicFrontendClock";

const {
  runSimulationForecast,
  simulateForecastFromSamples,
} = localTeamForecast;

vi.mock("../adoClient", () => ({
  getTeamDeliveryDataDirect: vi.fn(),
}));

vi.mock("../api", () => ({
  postSimulate: vi.fn(),
}));

const WEEKLY_THROUGHPUT = [
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
  seed: 424242,
  result_percentiles: { P50: 8, P70: 10, P90: 13 },
  risk_score: 0.625,
  completion_summary: {
    completed_count: 20000,
    censored_count: 0,
    censored_rate: 0,
    horizon_weeks: 521,
  },
  throughput_reliability: {
    cv: 0.22,
    iqr_ratio: 0.3,
    slope_norm: -0.02,
    label: "fiable" as const,
    samples_count: 6,
  },
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
  seed: SIMULATION_SEED_MAX,
  result_percentiles: { P50: 40, P70: 35, P90: 30 },
  risk_score: 0.25,
  throughput_reliability: {
    cv: 0.65,
    iqr_ratio: 0.7,
    slope_norm: -0.08,
    label: "incertain" as const,
    samples_count: 6,
  },
  result_distribution: [
    { x: 25, count: 5000 },
    { x: 30, count: 10000 },
    { x: 35, count: 5000 },
  ],
};

function baseParams() {
  return {
    clock: new DeterministicFrontendClock("2026-08-26T14:30:45.123Z"),
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
  };
}

describe("simulation forecast seed execution boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getTeamDeliveryDataDirect).mockResolvedValue({
      weeklyThroughput: WEEKLY_THROUGHPUT,
      cycleTimeDaysData: [],
    });
  });

  it("preserves explicit seed boundaries for the local engine and HTTP request", async () => {
    const originalCrypto = globalThis.crypto;
    const getRandomValues = vi.fn();
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: { getRandomValues },
    });

    try {
      const local = await simulateForecastFromSamples({
        demoMode: true,
        seed: 0,
        throughputSamples: [3, 4, 5, 6, 7, 8],
        includeZeroWeeks: true,
        simulationMode: "weeks_to_items",
        backlogSize: 120,
        targetWeeks: 6,
        nSims: 20000,
      });
      vi.mocked(postSimulate).mockResolvedValue(API_RESPONSE_ITEMS);
      const remote = await simulateForecastFromSamples({
        seed: SIMULATION_SEED_MAX,
        throughputSamples: [3, 4, 5, 6, 7, 8],
        includeZeroWeeks: true,
        simulationMode: "weeks_to_items",
        backlogSize: 120,
        targetWeeks: 6,
        nSims: 20000,
      });

      expect(local.seed).toBe(0);
      expect(remote.seed).toBe(SIMULATION_SEED_MAX);
      expect(postSimulate).toHaveBeenCalledWith(
        expect.objectContaining({ seed: SIMULATION_SEED_MAX }),
      );
      expect(getRandomValues).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(globalThis, "crypto", {
        configurable: true,
        value: originalCrypto,
      });
    }
  });

  it("reuses one generated seed across request, result and history", async () => {
    const originalCrypto = globalThis.crypto;
    const getRandomValues = vi.fn((values: Uint32Array) => {
      values[0] = 424242;
      return values;
    });
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: {
        getRandomValues,
        randomUUID: () => "history-id",
      },
    });
    vi.mocked(postSimulate).mockResolvedValue(API_RESPONSE_WEEKS);

    try {
      const forecast = await runSimulationForecast(baseParams());

      expect(getRandomValues).toHaveBeenCalledOnce();
      expect(postSimulate).toHaveBeenCalledWith(
        expect.objectContaining({ seed: 424242 }),
      );
      expect(forecast.result.seed).toBe(424242);
      expect(forecast.historyEntry.seed).toBe(424242);
      expect(forecast.historyEntry.id).toBe("history-id");
    } finally {
      Object.defineProperty(globalThis, "crypto", {
        configurable: true,
        value: originalCrypto,
      });
    }
  });
});
