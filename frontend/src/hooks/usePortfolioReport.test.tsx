import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchTeamThroughput, simulateForecastFromSamples } from "./simulationForecastService";
import { exportPortfolioPrintReport } from "../components/steps/portfolioPrintReport";
import { getPortfolioErrorMessage, usePortfolioReport } from "./usePortfolioReport";
import { buildAtLeastPercentiles } from "./probability";
import { computeRiskScoreFromPercentiles } from "../utils/simulation";

vi.mock("./simulationForecastService", () => ({
  fetchTeamThroughput: vi.fn(),
  simulateForecastFromSamples: vi.fn(),
}));

vi.mock("../components/steps/portfolioPrintReport", () => ({
  exportPortfolioPrintReport: vi.fn(),
}));

const throughputData = {
  weeklyThroughput: [{ week: "2026-01-05", throughput: 3 }],
  throughputSamples: [2, 3, 5, 8, 13, 21],
  sampleStats: { totalWeeks: 10, zeroWeeks: 1, usedWeeks: 9 },
};

const simulationResult = {
  result_kind: "weeks" as const,
  samples_count: 100,
  risk_score: 0.3,
  result_percentiles: { P50: 10, P70: 12, P90: 15 },
  result_distribution: [{ x: 10, count: 25 }],
};

function setupReportHook(overrides: Partial<Parameters<typeof usePortfolioReport>[0]> = {}) {
  return renderHook(() =>
    usePortfolioReport({
      selectedOrg: "Org A",
      selectedProject: "Project A",
      pat: "pat",
      startDate: "2026-01-01",
      endDate: "2026-02-01",
      includeZeroWeeks: true,
      simulationMode: "backlog_to_weeks",
      backlogSize: 120,
      targetWeeks: 12,
      nSims: 20000,
      arrimageRate: 80,
      teamConfigs: [
        {
          teamName: "Team A",
          workItemTypeOptions: ["Bug"],
          statesByType: { Bug: ["Done"] },
          types: ["Bug"],
          doneStates: ["Done"],
        },
        {
          teamName: "Team B",
          workItemTypeOptions: ["Bug"],
          statesByType: { Bug: ["Done"] },
          types: ["Bug"],
          doneStates: ["Done"],
        },
      ],
      ...overrides,
    }),
  );
}

describe("usePortfolioReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports report when collect + simulations succeed", async () => {
    vi.mocked(fetchTeamThroughput).mockResolvedValue(throughputData);
    vi.mocked(simulateForecastFromSamples).mockResolvedValue(simulationResult);
    const { result } = setupReportHook();

    await act(async () => {
      await result.current.handleGenerateReport();
    });

    expect(vi.mocked(fetchTeamThroughput)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(simulateForecastFromSamples)).toHaveBeenCalledTimes(6);
    expect(result.current.reportErrors).toEqual([]);
    expect(result.current.reportErr).toBe("");
    expect(result.current.generationProgress).toEqual({ done: 6, total: 6 });
    expect(vi.mocked(exportPortfolioPrintReport)).toHaveBeenCalledTimes(1);
  });

  it("excludes failed teams from phase 1 and still exports", async () => {
    vi.mocked(fetchTeamThroughput).mockImplementation(async ({ selectedTeam }) => {
      if (selectedTeam === "Team B") throw new Error("collect-failure");
      return throughputData;
    });
    vi.mocked(simulateForecastFromSamples).mockResolvedValue(simulationResult);

    const { result } = setupReportHook();
    await act(async () => {
      await result.current.handleGenerateReport();
    });

    expect(result.current.reportErrors).toEqual([expect.objectContaining({ teamName: "Team B" })]);
    expect(vi.mocked(simulateForecastFromSamples)).toHaveBeenCalledTimes(5);
    expect(vi.mocked(exportPortfolioPrintReport)).toHaveBeenCalledTimes(1);
  });

  it("updates generationProgress as simulations settle", async () => {
    vi.mocked(fetchTeamThroughput).mockResolvedValue(throughputData);

    type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void };
    function deferred<T>(): Deferred<T> {
      let resolve!: (value: T) => void;
      const promise = new Promise<T>((res) => {
        resolve = res;
      });
      return { promise, resolve };
    }

    const jobs = [
      deferred<typeof simulationResult>(),
      deferred<typeof simulationResult>(),
      deferred<typeof simulationResult>(),
      deferred<typeof simulationResult>(),
      deferred<typeof simulationResult>(),
      deferred<typeof simulationResult>(),
    ];
    let idx = 0;
    vi.mocked(simulateForecastFromSamples).mockImplementation(() => jobs[idx++].promise);

    const { result } = setupReportHook();

    await act(async () => {
      void result.current.handleGenerateReport();
    });

    expect(result.current.generationProgress).toEqual({ done: 0, total: 6 });

    await act(async () => {
      jobs[0].resolve(simulationResult);
    });
    await waitFor(() => {
      expect(result.current.generationProgress.done).toBe(1);
    });

    await act(async () => {
      jobs[1].resolve(simulationResult);
      jobs[2].resolve(simulationResult);
      jobs[3].resolve(simulationResult);
      jobs[4].resolve(simulationResult);
      jobs[5].resolve(simulationResult);
    });
    await waitFor(() => {
      expect(result.current.generationProgress).toEqual({ done: 6, total: 6 });
    });
  });

  it("reports a global error and skips export when all teams fail phase 1", async () => {
    vi.mocked(fetchTeamThroughput).mockRejectedValue(new Error("collect-failure"));

    const { result } = setupReportHook();

    await act(async () => {
      await result.current.handleGenerateReport();
    });

    expect(result.current.reportErr).toBe("Aucune equipe n'a pu etre simulee.");
    expect(result.current.reportErrors).toHaveLength(2);
    expect(vi.mocked(exportPortfolioPrintReport)).not.toHaveBeenCalled();
  });

  it("reports global simulation error when all phase-2 simulations fail", async () => {
    vi.mocked(fetchTeamThroughput).mockResolvedValue(throughputData);
    vi.mocked(simulateForecastFromSamples).mockRejectedValue(new Error("sim-failure"));

    const { result } = setupReportHook();

    await act(async () => {
      await result.current.handleGenerateReport();
    });

    expect(result.current.reportErr).toBe("Aucune simulation n'a pu etre finalisee.");
    expect(result.current.reportErrors.length).toBeGreaterThan(0);
    expect(vi.mocked(exportPortfolioPrintReport)).not.toHaveBeenCalled();
  });

  it("captures export exceptions in reportErr", async () => {
    vi.mocked(fetchTeamThroughput).mockResolvedValue(throughputData);
    vi.mocked(simulateForecastFromSamples).mockResolvedValue(simulationResult);
    vi.mocked(exportPortfolioPrintReport).mockImplementation(() => {
      throw new Error("export-failure");
    });

    const { result } = setupReportHook();

    await act(async () => {
      await result.current.handleGenerateReport();
    });

    expect(result.current.reportErr).toBe("export-failure");
  });

  it("computes section riskScore from effective percentiles when result_kind is items", async () => {
    vi.mocked(fetchTeamThroughput).mockResolvedValue(throughputData);
    vi.mocked(simulateForecastFromSamples).mockResolvedValue({
      result_kind: "items",
      samples_count: 100,
      risk_score: 0,
      result_percentiles: { P50: 100, P70: 110, P90: 120 },
      result_distribution: [
        { x: 10, count: 10 },
        { x: 20, count: 80 },
        { x: 30, count: 10 },
      ],
    });

    const { result } = setupReportHook({
      simulationMode: "weeks_to_items",
      targetWeeks: 12,
    });

    await act(async () => {
      await result.current.handleGenerateReport();
    });

    expect(vi.mocked(exportPortfolioPrintReport)).toHaveBeenCalledTimes(1);
    const exportArgs = vi.mocked(exportPortfolioPrintReport).mock.calls[0]?.[0];
    const expectedPercentiles = buildAtLeastPercentiles(
      [
        { x: 10, count: 10 },
        { x: 20, count: 80 },
        { x: 30, count: 10 },
      ],
      [50, 70, 90],
    );
    const expectedRisk = computeRiskScoreFromPercentiles("weeks_to_items", expectedPercentiles);

    expect(exportArgs.sections[0].resultKind).toBe("items");
    expect(exportArgs.sections[0].riskScore).toBe(expectedRisk);
  });

  it("uses the wrapped throughput rejection payload when the original error is undefined", async () => {
    vi.mocked(fetchTeamThroughput).mockImplementation(async ({ selectedTeam }) => {
      if (selectedTeam === "Team B") throw undefined;
      return throughputData;
    });
    vi.mocked(simulateForecastFromSamples).mockResolvedValue(simulationResult);

    const { result } = setupReportHook();

    await act(async () => {
      await result.current.handleGenerateReport();
    });

    expect(result.current.reportErrors).toEqual([
      expect.objectContaining({
        teamName: "Team B",
        message: 'Erreur inattendue pendant "collecte throughput portefeuille".',
      }),
    ]);
  });

  it("falls back to 'Simulation inconnue' when a settled simulation rejection has no teamName", async () => {
    vi.mocked(fetchTeamThroughput).mockResolvedValue(throughputData);
    vi.mocked(simulateForecastFromSamples).mockResolvedValue(simulationResult);

    const originalAllSettled = Promise.allSettled.bind(Promise);
    vi.spyOn(Promise, "allSettled")
      .mockImplementationOnce(async () => ([
        {
          status: "fulfilled",
          value: {
            cfg: {
              teamName: "Team A",
              workItemTypeOptions: ["Bug"],
              statesByType: { Bug: ["Done"] },
              types: ["Bug"],
              doneStates: ["Done"],
            },
            data: throughputData,
          },
        },
      ] as PromiseSettledResult<unknown>[]))
      .mockImplementationOnce(async () => ([
        {
          status: "fulfilled",
          value: {
            kind: "team",
            section: {
              selectedTeam: "Team A",
              simulationMode: "backlog_to_weeks",
              includeZeroWeeks: true,
              backlogSize: 120,
              targetWeeks: 12,
              nSims: 20000,
              resultKind: "weeks",
              riskScore: 0.3,
              distribution: [{ x: 10, count: 25 }],
              weeklyThroughput: throughputData.weeklyThroughput,
              displayPercentiles: { P50: 10, P70: 12, P90: 15 },
            },
          },
        },
        {
          status: "rejected",
          reason: { error: new Error("sim-failure") },
        },
      ] as PromiseSettledResult<unknown>[]))
      .mockImplementation(originalAllSettled);

    const { result } = setupReportHook({
      teamConfigs: [
        {
          teamName: "Team A",
          workItemTypeOptions: ["Bug"],
          statesByType: { Bug: ["Done"] },
          types: ["Bug"],
          doneStates: ["Done"],
        },
      ],
    });

    await act(async () => {
      await result.current.handleGenerateReport();
    });

    expect(result.current.reportErrors).toEqual([
      expect.objectContaining({
        teamName: "Simulation inconnue",
      }),
    ]);
  });

  it("clears reportErrors when clearReportErrors is called", async () => {
    vi.mocked(fetchTeamThroughput).mockImplementation(async ({ selectedTeam }) => {
      if (selectedTeam === "Team B") throw new Error("collect-failure");
      return throughputData;
    });
    vi.mocked(simulateForecastFromSamples).mockResolvedValue(simulationResult);

    const { result } = setupReportHook();

    await act(async () => {
      await result.current.handleGenerateReport();
    });
    expect(result.current.reportErrors.length).toBeGreaterThan(0);

    act(() => {
      result.current.clearReportErrors();
    });

    expect(result.current.reportErrors).toEqual([]);
  });

  it("clears reportErr when clearReportErr is called", async () => {
    vi.mocked(fetchTeamThroughput).mockRejectedValue(new Error("collect-failure"));

    const { result } = setupReportHook();

    await act(async () => {
      await result.current.handleGenerateReport();
    });
    expect(result.current.reportErr).toBe("Aucune equipe n'a pu etre simulee.");

    act(() => {
      result.current.clearReportErr();
    });

    expect(result.current.reportErr).toBe("");
  });
});

describe("getPortfolioErrorMessage", () => {
  it("formats object errors carrying an HTTP status", () => {
    const message = getPortfolioErrorMessage(
      { status: 403, statusText: "Forbidden" },
      { operation: "test-op", requiredScopes: ["Work Items (Read)"] },
    );
    expect(message).toContain("[HTTP 403]");
    expect(message).toContain("test-op");
  });

  it("returns fallback message for unknown non-Error values", () => {
    const message = getPortfolioErrorMessage("unexpected", { operation: "fallback-op" });
    expect(message).toBe('Erreur inattendue pendant "fallback-op".');
  });
});
