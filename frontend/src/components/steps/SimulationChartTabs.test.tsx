import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SimulationChartTabs, { getCycleTimeYAxisMax, getThroughputYAxisMax } from "./SimulationChartTabs";

const {
  yAxisCalls,
  xAxisCalls,
  tooltipCalls,
  exportSimulationPrintReport,
  computeThroughputReliability,
} = vi.hoisted(() => ({
  yAxisCalls: [] as Array<Record<string, unknown>>,
  xAxisCalls: [] as Array<Record<string, unknown>>,
  tooltipCalls: [] as Array<Record<string, unknown>>,
  exportSimulationPrintReport: vi.fn(),
  computeThroughputReliability: vi.fn(),
}));

let simulationContextValue: {
  selectedTeam: string;
  simulation: Record<string, unknown>;
};

vi.mock("./simulationPrintReport", () => ({
  exportSimulationPrintReport,
}));

vi.mock("../../utils/simulation", () => ({
  computeThroughputReliability,
}));

vi.mock("recharts", () => {
  const React = require("react");

  return {
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    ComposedChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Area: () => <div />,
    CartesianGrid: () => <div />,
    XAxis: (props: Record<string, unknown>) => {
      xAxisCalls.push(props);
      return <div data-testid="x-axis" />;
    },
    YAxis: (props: Record<string, unknown>) => {
      yAxisCalls.push(props);
      return <div data-testid="y-axis" />;
    },
    Tooltip: (props: Record<string, unknown>) => {
      tooltipCalls.push(props);
      return <div data-testid="tooltip" />;
    },
    Legend: ({ content }: { content?: (() => React.ReactNode) | React.ReactNode }) => {
      if (typeof content === "function") return <>{content()}</>;
      return <div>{content}</div>;
    },
    Bar: () => <div />,
    Line: () => <div />,
  };
});

vi.mock("../ui/tabs", () => ({
  TabsRoot: ({ children, onValueChange }: { children: React.ReactNode; onValueChange?: (value: string) => void }) => (
    <div>
      <button type="button" onClick={() => onValueChange?.("distribution")}>
        trigger-tab-change
      </button>
      {children}
    </div>
  ),
  TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children, value }: { children: React.ReactNode; value: string }) => <button data-value={value}>{children}</button>,
  TabsContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../../hooks/SimulationContext", () => ({
  useSimulationContext: vi.fn(() => simulationContextValue),
}));

function buildSimulation(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    result: {
      result_kind: "weeks",
      throughput_reliability: {
        label: "fiable",
        cv: 0.12,
        iqr_ratio: 0.34,
        slope_norm: 0.05,
        samples_count: 12,
      },
    },
    activeChartTab: "cycle_time",
    setActiveChartTab: vi.fn(),
    exportThroughputCsv: vi.fn(),
    resetForTeamSelection: vi.fn(),
    tooltipBaseProps: { cursor: false },
    cycleTimeData: [
      { week: "2026-W01", cycleTime: 1.2, count: 2 },
      { week: "2026-W02", cycleTime: 1.8, count: 1 },
    ],
    cycleTimeTrendData: [
      { week: "2026-W01", average: 1.2, lowerBound: 1.2, upperBound: 1.2, itemCount: 2 },
      { week: "2026-W02", average: 1.4, lowerBound: 1.1, upperBound: 1.7, itemCount: 3 },
    ],
    cycleTimeSummary: { itemCount: 3, average: 1.4, hasSufficientData: true },
    throughputData: [
      { week: "2026-W01", throughput: 1 },
      { week: "2026-W02", throughput: 3 },
      { week: "2026-W03", throughput: 5 },
    ],
    mcHistData: [
      { x: 1, count: 2, gauss: 1.5 },
      { x: 2, count: 4, gauss: 3.2 },
    ],
    probabilityCurveData: [
      { x: 1, probability: 10 },
      { x: 2, probability: 70 },
    ],
    startDate: "2026-01-01",
    endDate: "2026-02-01",
    simulationMode: "backlog_to_weeks",
    includeZeroWeeks: false,
    types: ["Bug"],
    doneStates: ["Done"],
    backlogSize: 10,
    targetWeeks: 4,
    nSims: 1000,
    displayPercentiles: { P50: 2, P70: 3, P90: 4 },
    ...overrides,
  };
}

describe("SimulationChartTabs", () => {
  beforeEach(() => {
    yAxisCalls.length = 0;
    xAxisCalls.length = 0;
    tooltipCalls.length = 0;
    exportSimulationPrintReport.mockReset();
    computeThroughputReliability.mockReset();
    simulationContextValue = {
      selectedTeam: "Team Alpha",
      simulation: buildSimulation(),
    };
  });

  it("renders the empty state when no simulation result is available", () => {
    simulationContextValue = {
      selectedTeam: "Team Alpha",
      simulation: buildSimulation({ result: null }),
    };

    render(<SimulationChartTabs />);

    expect(screen.getByText("Lancez une simulation pour afficher les graphiques.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Rapport" })).toBeNull();
  });

  it("adds headroom to throughput while keeping zero-based Y axes", () => {
    render(<SimulationChartTabs />);

    expect(screen.getAllByTestId("y-axis")).toHaveLength(4);
    expect(screen.getAllByTestId("x-axis")).toHaveLength(4);
    expect(yAxisCalls[0]?.domain?.[0]).toBe(0);
    expect(yAxisCalls[0]?.domain?.[1]).toBe(getCycleTimeYAxisMax);
    expect(yAxisCalls[1]?.domain?.[0]).toBe(0);
    expect(yAxisCalls[1]?.domain?.[1]).toBe(getThroughputYAxisMax);
    expect(yAxisCalls[2]?.domain).toEqual([0, "auto"]);
    expect(yAxisCalls[3]?.domain).toEqual([0, 100]);
    expect(xAxisCalls[0]?.tickMargin).toBe(10);
    expect(xAxisCalls[0]?.minTickGap).toBe(24);
  });

  it("renders reliability from the simulation result without recomputing it", () => {
    render(<SimulationChartTabs />);

    expect(screen.getByText(/Fiabilite fiable · CV 0,12/i)).toBeInTheDocument();
    expect(computeThroughputReliability).not.toHaveBeenCalled();
  });

  it("renders cycle time kpis in the first tab", () => {
    render(<SimulationChartTabs />);

    expect(screen.getByText("Cycle Time")).toBeInTheDocument();
    expect(screen.getByText("Items")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("1,40 sem")).toBeInTheDocument();
  });

  it("renders the cycle time chart inside the shared chart wrapper", () => {
    const { container } = render(<SimulationChartTabs />);

    const cycleTimeWrap = container.querySelector(".sim-chart-wrap");
    expect(cycleTimeWrap).not.toBeNull();
  });

  it("computes reliability from throughput data when missing from the result", () => {
    computeThroughputReliability.mockReturnValue({
      label: "fragile",
      cv: 0.91,
      iqr_ratio: 0.48,
      slope_norm: 0.27,
      samples_count: 8,
    });
    simulationContextValue = {
      selectedTeam: "Team Alpha",
      simulation: buildSimulation({
        result: { result_kind: "weeks" },
      }),
    };

    render(<SimulationChartTabs />);

    expect(computeThroughputReliability).toHaveBeenCalledWith([1, 3, 5]);
    expect(screen.getByText(/Fiabilite fragile · CV 0,91/i)).toBeInTheDocument();
  });

  it("does not render a reliability badge when no metric is available", () => {
    computeThroughputReliability.mockReturnValue(undefined);
    simulationContextValue = {
      selectedTeam: "Team Alpha",
      simulation: buildSimulation({
        result: { result_kind: "weeks" },
      }),
    };

    render(<SimulationChartTabs />);

    expect(screen.queryByText(/Fiabilite/i)).toBeNull();
  });

  it("wires actions for tab changes, CSV export, reset and report export", async () => {
    const simulation = buildSimulation();
    simulationContextValue = {
      selectedTeam: "Team Alpha",
      simulation,
    };

    render(<SimulationChartTabs />);

    fireEvent.click(screen.getByRole("button", { name: "trigger-tab-change" }));
    fireEvent.click(screen.getByRole("button", { name: "CSV" }));
    fireEvent.click(screen.getByRole("button", { name: "Réinitialiser" }));
    fireEvent.click(screen.getByRole("button", { name: "Rapport" }));

    expect(simulation.setActiveChartTab).toHaveBeenCalledWith("distribution");
    expect(simulation.exportThroughputCsv).toHaveBeenCalledTimes(1);
    expect(simulation.resetForTeamSelection).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(exportSimulationPrintReport).toHaveBeenCalledWith(
        expect.objectContaining({
          selectedTeam: "Team Alpha",
          simulationMode: "backlog_to_weeks",
          includeZeroWeeks: false,
          backlogSize: 10,
          targetWeeks: 4,
          nSims: 1000,
          resultKind: "weeks",
          cycleTimePoints: simulation.cycleTimeData,
          cycleTimeTrendPoints: simulation.cycleTimeTrendData,
          throughputPoints: expect.arrayContaining([
            expect.objectContaining({ week: "2026-W03", throughput: 5, movingAverage: 3 }),
          ]),
          distributionPoints: simulation.mcHistData,
          probabilityPoints: simulation.probabilityCurveData,
        }),
      );
    });
  });

  it("provides tooltip callbacks for throughput, distribution and probability charts", () => {
    render(<SimulationChartTabs />);

    const cycleTimeTooltip = tooltipCalls[0];
    const throughputTooltip = tooltipCalls[1];
    const distributionTooltip = tooltipCalls[2];
    const probabilityTooltip = tooltipCalls[3];

    expect(
      cycleTimeTooltip.content({
        active: true,
        label: "2026-W02",
        payload: [
          { dataKey: "average", value: 1.4, payload: { itemCount: 3 } },
          { dataKey: "observedAverage", value: 1.8 },
        ],
      }),
    ).toBeTruthy();
    expect(cycleTimeTooltip.content({ active: false, payload: [] })).toBeNull();

    expect(throughputTooltip.cursor).toBe(false);
    expect(
      throughputTooltip.content({
        active: true,
        label: "2026-W02",
        payload: [
          { dataKey: "throughput", value: 3 },
          { dataKey: "movingAverage", value: 2 },
        ],
      }),
    ).toBeTruthy();
    expect(
      throughputTooltip.content({
        active: false,
        payload: [],
      }),
    ).toBeNull();

    expect(distributionTooltip.formatter(4, "count")).toEqual(["4", "Fréquence"]);
    expect(distributionTooltip.formatter(3.25, "gauss")).toEqual(["3.3", "Courbe lissée"]);
    expect(distributionTooltip.formatter(7.12, "autre")).toEqual(["7.1", "autre"]);

    expect(probabilityTooltip.formatter(82.34)).toEqual(["82.3%", "P(X <= valeur)"]);
  });

  it("uses the items-specific probability label when the result kind is items", () => {
    simulationContextValue = {
      selectedTeam: "Team Alpha",
      simulation: buildSimulation({
        result: {
          result_kind: "items",
          throughput_reliability: {
            label: "incertain",
            cv: 0.42,
            iqr_ratio: 0.3,
            slope_norm: 0.14,
            samples_count: 9,
          },
        },
      }),
    };

    render(<SimulationChartTabs />);

    expect(screen.getByText("Probabilité d'atteindre au moins X items")).toBeInTheDocument();
    expect(tooltipCalls[3].formatter(55.1)).toEqual(["55.1%", "P(X >= valeur)"]);
  });

  it("renders an explicit message when cycle time data is insufficient", () => {
    simulationContextValue = {
      selectedTeam: "Team Alpha",
      simulation: buildSimulation({
        cycleTimeData: [{ week: "2026-W01", cycleTime: 1.2, count: 1 }],
        cycleTimeTrendData: [{ week: "2026-W01", average: 1.2, lowerBound: 1.2, upperBound: 1.2, itemCount: 1 }],
        cycleTimeSummary: { itemCount: 1, average: 1.2, hasSufficientData: false },
      }),
    };

    render(<SimulationChartTabs />);

    expect(screen.getByText(/Donnees insuffisantes pour afficher le cycle time/i)).toBeInTheDocument();
  });

  it("computes a readable upper bound for throughput", () => {
    expect(getThroughputYAxisMax(0)).toBe(1);
    expect(getThroughputYAxisMax(3)).toBe(4);
    expect(getThroughputYAxisMax(10)).toBe(11);
    expect(getThroughputYAxisMax(Number.NaN)).toBe(1);
  });

  it("computes a readable upper bound for cycle time", () => {
    expect(getCycleTimeYAxisMax(0)).toBe(1);
    expect(getCycleTimeYAxisMax(2)).toBe(2.2);
    expect(getCycleTimeYAxisMax(10)).toBe(11);
    expect(getCycleTimeYAxisMax(Number.NaN)).toBe(1);
  });
});
