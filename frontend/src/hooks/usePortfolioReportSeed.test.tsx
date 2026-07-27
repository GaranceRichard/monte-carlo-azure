import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSeededSampleIndexDrawPort } from "../adapters/seededSampleIndexDrawPort";
import { exportPortfolioPrintReport } from "../components/steps/portfolioPrintReport";
import { createSimulationSeed } from "../domain/simulationValueObjects";
import {
  fetchTeamThroughput,
  simulateForecastFromSamples,
} from "./simulationForecastService";
import { usePortfolioReport } from "./usePortfolioReport";

vi.mock("./simulationForecastService", () => ({
  fetchTeamThroughput: vi.fn(),
  simulateForecastFromSamples: vi.fn(),
}));

vi.mock("../components/steps/portfolioPrintReport", () => ({
  exportPortfolioPrintReport: vi.fn(),
}));

vi.mock("../adapters/seededSampleIndexDrawPort", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../adapters/seededSampleIndexDrawPort")
  >();
  return {
    ...actual,
    createSeededSampleIndexDrawPort: vi.fn(
      actual.createSeededSampleIndexDrawPort,
    ),
  };
});

const throughputData = {
  weeklyThroughput: [{ week: "2026-01-05", throughput: 3 }],
  cycleTimeDaysData: [{ week: "2026-01-05", cycleTimeDays: 1.5, count: 3 }],
  throughputSamples: [2, 3, 5, 8, 13, 21],
  sampleStats: { totalWeeks: 10, zeroWeeks: 1, usedWeeks: 9 },
};

const simulationResult = {
  resultKind: "weeks" as const,
  samplesCount: 100,
  seed: createSimulationSeed(123456),
  riskScore: 0.3,
  resultPercentiles: { P50: 10, P70: 12, P90: 15 },
  resultDistribution: [{ x: 10, count: 25 }],
};

describe("portfolio seed execution boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves one seed per portfolio simulation before launching any engine", async () => {
    const originalCrypto = globalThis.crypto;
    let nextSeed = 100;
    const getRandomValues = vi.fn((values: Uint32Array) => {
      values[0] = nextSeed;
      nextSeed += 1;
      return values;
    });
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: { getRandomValues },
    });
    vi.mocked(fetchTeamThroughput).mockResolvedValue(throughputData);
    vi.mocked(simulateForecastFromSamples).mockResolvedValue(simulationResult);
    const { result } = renderHook(() =>
      usePortfolioReport({
        selectedOrg: "Org A",
        selectedProject: "Project A",
        pat: "pat",
        serverUrl: "",
        startDate: "2026-01-01",
        endDate: "2026-02-01",
        includeZeroWeeks: true,
        simulationMode: "backlog_to_weeks",
        backlogSize: 120,
        targetWeeks: 12,
        nSims: 20000,
        alignmentRate: 80,
        pilotReference: null,
        teamConfigs: [
          {
            teamName: "Team A",
            workItemTypeOptions: ["Bug"],
            statesByType: { Bug: ["Done"] },
            types: ["Bug"],
            doneStates: ["Done"],
          },
        ],
      }),
    );

    try {
      await act(async () => {
        await result.current.handleGenerateReport();
      });

      expect(getRandomValues).toHaveBeenCalledTimes(5);
      expect(
        vi.mocked(simulateForecastFromSamples).mock.calls.map(
          ([input]) => input.seed,
        ),
      ).toEqual([100, 101, 102, 103, 104]);
      expect(createSeededSampleIndexDrawPort).toHaveBeenCalledOnce();
      expect(createSeededSampleIndexDrawPort).toHaveBeenCalledWith(101);
      const exportInput = vi.mocked(exportPortfolioPrintReport).mock.calls[0]?.[0];
      expect(exportInput.scenarios[0]?.samples).toEqual([2, 13, 8, 8, 5, 13]);
    } finally {
      Object.defineProperty(globalThis, "crypto", {
        configurable: true,
        value: originalCrypto,
      });
    }
  });
});
