import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTeamDeliveryDataDirect } from "../../adoClient";
import { postSimulate } from "../../api";
import { createDeliveryItemId } from "../../domain/delivery";
import { DeterministicFrontendClock } from "../../test/deterministicFrontendClock";
import { localTeamForecast } from ".";

vi.mock("../../adoClient", () => ({
  getTeamDeliveryDataDirect: vi.fn(),
}));

vi.mock("../../api", () => ({
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

function forecastParameters() {
  return {
    clock: new DeterministicFrontendClock("2026-09-07T12:00:00.000Z"),
    selectedOrg: "org-a",
    selectedProject: "Project",
    selectedTeam: "Team",
    pat: "pat",
    serverUrl: "",
    startDate: "2025-01-01",
    endDate: "2025-02-28",
    doneStates: ["Done"],
    types: ["Bug"],
    includeZeroWeeks: false,
    simulationMode: "backlog_to_weeks" as const,
    backlogSize: 80,
    targetWeeks: 12,
    nSims: 20000,
  };
}

describe("localTeamForecast delivery-history completeness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refuses an incomplete history before calling the forecast engine", async () => {
    vi.mocked(getTeamDeliveryDataDirect).mockResolvedValue({
      weeklyThroughput: WEEKLY_THROUGHPUT,
      cycleTimeDaysData: [],
      historyCompleteness: {
        status: "incomplete",
        code: "delivery_history_incomplete",
        requiredItemCount: 7,
        observedItemCount: 6,
        missingItemIds: [createDeliveryItemId("7")],
      },
    });

    await expect(
      localTeamForecast.runSimulationForecast(forecastParameters()),
    ).rejects.toThrow("Historique insuffisant");
    expect(postSimulate).not.toHaveBeenCalled();
  });

  it("preserves an ADO warning carried by a complete history", async () => {
    vi.mocked(getTeamDeliveryDataDirect).mockResolvedValue({
      weeklyThroughput: WEEKLY_THROUGHPUT,
      cycleTimeDaysData: [],
      historyCompleteness: {
        status: "complete",
        code: "delivery_history_complete",
        requiredItemCount: 6,
        observedItemCount: 6,
        missingItemIds: [],
      },
      warning: "lots partiellement ignores",
    });
    vi.mocked(postSimulate).mockResolvedValue({
      result_kind: "weeks",
      samples_count: 6,
      seed: 111,
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
        label: "fiable",
        samples_count: 6,
      },
      result_distribution: [{ x: 8, count: 20000 }],
    });

    const result = await localTeamForecast.runSimulationForecast(forecastParameters());

    expect(result.warning).toBe("lots partiellement ignores");
    expect(result.weeklyThroughput).toEqual(WEEKLY_THROUGHPUT);
  });
});
