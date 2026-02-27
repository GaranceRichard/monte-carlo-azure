import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runSimulationForecast } from "./simulationForecastService";
import { exportPortfolioPrintReport } from "../components/steps/portfolioPrintReport";
import { usePortfolioReport } from "./usePortfolioReport";

vi.mock("./simulationForecastService", () => ({
  runSimulationForecast: vi.fn(),
}));

vi.mock("../components/steps/portfolioPrintReport", () => ({
  exportPortfolioPrintReport: vi.fn(),
}));

const successForecast = {
  weeklyThroughput: [{ week: "2026-01-05", throughput: 3 }],
  sampleStats: { totalWeeks: 10, zeroWeeks: 1, usedWeeks: 9 },
  result: {
    result_kind: "weeks" as const,
    samples_count: 100,
    risk_score: 0.3,
    result_percentiles: { P50: 10, P70: 12, P90: 15 },
    result_distribution: [{ x: 10, count: 25 }],
  },
  historyEntry: {} as never,
};

function setupReportHook() {
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
    }),
  );
}

describe("usePortfolioReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports report when all teams succeed", async () => {
    vi.mocked(runSimulationForecast).mockResolvedValue(successForecast);
    const { result } = setupReportHook();

    await act(async () => {
      await result.current.handleGenerateReport();
    });

    expect(vi.mocked(runSimulationForecast)).toHaveBeenCalledTimes(2);
    expect(result.current.reportErrors).toEqual([]);
    expect(result.current.reportErr).toBe("");
    expect(result.current.reportProgressLabel).toBe("2/2 equipes simulees");
    expect(vi.mocked(exportPortfolioPrintReport)).toHaveBeenCalledTimes(1);
  });

  it("exports partial report and records failed teams", async () => {
    vi.mocked(runSimulationForecast).mockImplementation(async ({ selectedTeam }) => {
      if (selectedTeam === "Team B") throw new Error("team-b-failure");
      return successForecast;
    });
    const { result } = setupReportHook();

    await act(async () => {
      await result.current.handleGenerateReport();
    });

    expect(result.current.reportErrors).toEqual([expect.objectContaining({ teamName: "Team B" })]);
    expect(result.current.reportErr).toBe("");
    expect(vi.mocked(exportPortfolioPrintReport)).toHaveBeenCalledTimes(1);
  });

  it("reports a global error and skips export when all teams fail", async () => {
    vi.mocked(runSimulationForecast).mockRejectedValue(new Error("forecast-failure"));
    const { result } = setupReportHook();

    await act(async () => {
      await result.current.handleGenerateReport();
    });

    expect(result.current.reportErr).toBe("Aucune equipe n'a pu etre simulee.");
    expect(result.current.reportErrors).toHaveLength(2);
    expect(vi.mocked(exportPortfolioPrintReport)).not.toHaveBeenCalled();
  });

  it("surfaces export failure and allows clearing errors", async () => {
    vi.mocked(runSimulationForecast).mockResolvedValue(successForecast);
    vi.mocked(exportPortfolioPrintReport).mockImplementation(() => {
      throw new Error("export-failure");
    });
    const { result } = setupReportHook();

    await act(async () => {
      await result.current.handleGenerateReport();
    });
    await waitFor(() => {
      expect(result.current.loadingReport).toBe(false);
    });

    expect(result.current.reportErr).toContain("export-failure");
    act(() => {
      result.current.clearReportErrors();
      result.current.clearReportErr();
    });
    expect(result.current.reportErrors).toEqual([]);
    expect(result.current.reportErr).toBe("");
  });
});
