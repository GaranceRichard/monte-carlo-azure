import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchTeamThroughput, simulateForecastFromSamples } from "./simulationForecastService";
import { exportPortfolioPrintReport } from "../components/steps/portfolioPrintReport";
import { getPortfolioErrorMessage, usePortfolioReport } from "./usePortfolioReport";
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
  cycleTimeDaysData: [{ week: "2026-01-05", cycleTimeDays: 1.5, count: 3 }],
  throughputSamples: [2, 3, 5, 8, 13, 21],
  sampleStats: { totalWeeks: 10, zeroWeeks: 1, usedWeeks: 9 },
};

const simulationResult = {
  result_kind: "weeks" as const,
  samples_count: 100,
  seed: 123456,
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
    expect(vi.mocked(exportPortfolioPrintReport).mock.calls[0]?.[0].scenarios.map((scenario) => scenario.label)).toContain(
      "Historique corr\u00E9l\u00E9",
    );
    const exportArgs = vi.mocked(exportPortfolioPrintReport).mock.calls[0]?.[0];
    expect(exportArgs.scenarios.every((scenario) => scenario.decisionDiagnostic === undefined)).toBe(true);
    expect(exportArgs.scenarios.every((scenario) => scenario.throughputReliability === undefined)).toBe(true);
    expect(result.current.portfolioComparisonDiagnostic).toMatchObject({
      preferredScenario: null,
      comparisonConfidence: { level: "insufficient" },
    });
    expect(result.current.portfolioComparisonDiagnostic?.hypothesisCredibility.map((item) => item.evidenceType)).toEqual([
      "unsupported",
      "user_input",
      "calculated",
      "observed",
    ]);
    expect(exportArgs.portfolioComparisonDiagnostic).toBe(result.current.portfolioComparisonDiagnostic);
    expect(exportArgs.pilotReference).toBeNull();
    for (const call of vi.mocked(simulateForecastFromSamples).mock.calls) {
      expect(call[0]).not.toHaveProperty("selectedTeam");
      expect(call[0]).not.toHaveProperty("selectedOrg");
      expect(call[0]).not.toHaveProperty("types");
      expect(call[0]).not.toHaveProperty("doneStates");
    }
  });

  it.each(["independent", "aligned", "friction", "correlated"] as const)(
    "forwards the explicit %s pilot reference without changing the domain recommendation",
    async (pilotReference) => {
      vi.mocked(fetchTeamThroughput).mockResolvedValue(throughputData);
      vi.mocked(simulateForecastFromSamples).mockResolvedValue(simulationResult);
      const { result } = setupReportHook({ pilotReference });

      await act(async () => {
        await result.current.handleGenerateReport();
      });

      const exportArgs = vi.mocked(exportPortfolioPrintReport).mock.calls[0]?.[0];
      expect(exportArgs.pilotReference).toBe(pilotReference);
      expect(exportArgs.portfolioComparisonDiagnostic?.preferredScenario).toBeNull();
      expect(result.current.portfolioComparisonDiagnostic?.preferredScenario).toBeNull();
    },
  );

  it("keeps existing Monte Carlo scenario results invariant while adding the comparison diagnostic", async () => {
    vi.mocked(fetchTeamThroughput).mockResolvedValue(throughputData);
    const monteCarloResult = {
      ...simulationResult,
      seed: 24680,
      risk_score: 0.42,
      result_percentiles: { P50: 11, P70: 13, P90: 17 },
      result_distribution: [
        { x: 11, count: 40 },
        { x: 17, count: 60 },
      ],
    };
    vi.mocked(simulateForecastFromSamples).mockResolvedValue(monteCarloResult);
    const { result } = setupReportHook();

    await act(async () => {
      await result.current.handleGenerateReport();
    });

    const exportArgs = vi.mocked(exportPortfolioPrintReport).mock.calls[0]?.[0];
    expect(exportArgs.scenarios).toHaveLength(4);
    for (const scenario of exportArgs.scenarios) {
      expect(scenario.seed).toBe(monteCarloResult.seed);
      expect(scenario.percentiles).toEqual(monteCarloResult.result_percentiles);
      expect(scenario.distribution).toEqual(monteCarloResult.result_distribution);
      expect(scenario.riskScore).toBe(computeRiskScoreFromPercentiles(
        "backlog_to_weeks",
        monteCarloResult.result_percentiles,
      ));
    }
    expect(result.current.portfolioComparisonDiagnostic).not.toBeNull();
  });

  it("keeps four portfolio scenarios and no artificial recommendation in demo mode", async () => {
    vi.mocked(fetchTeamThroughput).mockResolvedValue(throughputData);
    vi.mocked(simulateForecastFromSamples).mockResolvedValue(simulationResult);
    const { result } = setupReportHook({ demoMode: true });

    await act(async () => {
      await result.current.handleGenerateReport();
    });

    const exportArgs = vi.mocked(exportPortfolioPrintReport).mock.calls[0]?.[0];
    expect(exportArgs.isDemo).toBe(true);
    expect(exportArgs.scenarios.map((scenario) => scenario.label)).toEqual([
      "Optimiste",
      "Arrime (80%)",
      "Friction (80%)",
      "Historique corrélé",
    ]);
    expect(exportArgs.portfolioComparisonDiagnostic?.preferredScenario).toBeNull();
    expect(vi.mocked(fetchTeamThroughput).mock.calls.every(([input]) => input.demoMode === true)).toBe(true);
    expect(vi.mocked(simulateForecastFromSamples).mock.calls.every(([input]) => input.demoMode === true)).toBe(true);
  });

  it("uses local calendar dates for synthetic scenario weeks", async () => {
    vi.mocked(fetchTeamThroughput).mockResolvedValue(throughputData);
    vi.mocked(simulateForecastFromSamples).mockResolvedValue(simulationResult);
    const { result } = setupReportHook({ startDate: "2026-01-01" });

    await act(async () => {
      await result.current.handleGenerateReport();
    });

    const exportArgs = vi.mocked(exportPortfolioPrintReport).mock.calls[0]?.[0];
    const syntheticScenarios = exportArgs.scenarios.filter((scenario) => scenario.label !== "Historique corr\u00E9l\u00E9");
    expect(syntheticScenarios).toHaveLength(3);
    expect(syntheticScenarios.every((scenario) => scenario.weeklyData[0]?.week === "2026-01-01")).toBe(true);
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

  it("computes section riskScore from business percentiles when result_kind is items", async () => {
    vi.mocked(fetchTeamThroughput).mockResolvedValue(throughputData);
    vi.mocked(simulateForecastFromSamples).mockResolvedValue({
      result_kind: "items",
      samples_count: 100,
      seed: 98765,
      risk_score: 0,
      result_percentiles: { P50: 24, P70: 22, P90: 18 },
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
    const expectedRisk = computeRiskScoreFromPercentiles("weeks_to_items", { P50: 24, P70: 22, P90: 18 });

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

  it("returns immediately when no team is configured", async () => {
    const { result } = setupReportHook({ teamConfigs: [] });

    await act(async () => {
      await result.current.handleGenerateReport();
    });

    expect(vi.mocked(fetchTeamThroughput)).not.toHaveBeenCalled();
    expect(result.current.reportErr).toBe("");
    expect(result.current.generationProgress).toEqual({ done: 0, total: 0 });
  });

  it("falls back to effective scenario risk_score when scenario result omits it", async () => {
    vi.mocked(fetchTeamThroughput).mockResolvedValue(throughputData);
    vi.mocked(simulateForecastFromSamples).mockResolvedValue({
      ...simulationResult,
      risk_score: undefined,
      result_kind: "items",
      seed: 54321,
      result_percentiles: { P50: 24, P70: 22, P90: 18 },
      result_distribution: [
        { x: 10, count: 10 },
        { x: 20, count: 80 },
        { x: 30, count: 10 },
      ],
    } as never);

    const { result } = setupReportHook({ simulationMode: "weeks_to_items" });

    await act(async () => {
      await result.current.handleGenerateReport();
    });

    const exportArgs = vi.mocked(exportPortfolioPrintReport).mock.calls[0]?.[0];
    expect(exportArgs.scenarios[0].riskScore).toBe(
      computeRiskScoreFromPercentiles("weeks_to_items", { P50: 24, P70: 22, P90: 18 }),
    );
  });

  it("reports an explicit correlated-history error when teams share no complete week", async () => {
    vi.mocked(fetchTeamThroughput)
      .mockResolvedValueOnce({
        ...throughputData,
        weeklyThroughput: [{ week: "2026-01-05", throughput: 3 }],
      })
      .mockResolvedValueOnce({
        ...throughputData,
        weeklyThroughput: [{ week: "2026-01-12", throughput: 5 }],
      });

    const { result } = setupReportHook();

    await act(async () => {
      await result.current.handleGenerateReport();
    });

    expect(result.current.reportErr).toBe("Historique corr\u00E9l\u00E9 indisponible: aucune semaine commune complete n'est disponible pour toutes les equipes.");
    expect(vi.mocked(exportPortfolioPrintReport)).not.toHaveBeenCalled();
  });

  it("falls back to 'Equipe inconnue' when a throughput rejection has no teamName", async () => {
    const originalAllSettled = Promise.allSettled.bind(Promise);
    vi.spyOn(Promise, "allSettled")
      .mockImplementationOnce(async () => ([
        {
          status: "rejected",
          reason: { error: new Error("collect-failure") },
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
        teamName: "Equipe inconnue",
      }),
    ]);
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

