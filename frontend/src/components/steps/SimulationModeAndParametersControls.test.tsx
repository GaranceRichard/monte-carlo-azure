import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SimulationProvider } from "../../hooks/SimulationContext";
import SimulationModeAndParametersControls from "./SimulationModeAndParametersControls";

const selectTopMocks = vi.hoisted(() => ({
  keepSelectDropdownAtTop: vi.fn(),
}));

vi.mock("../../utils/selectTopStart", () => ({
  keepSelectDropdownAtTop: selectTopMocks.keepSelectDropdownAtTop,
}));

type SpyBag = {
  setSimulationMode: (value: "backlog_to_weeks" | "weeks_to_items") => void;
  setActiveChartTab: (value: string) => void;
  setIncludeZeroWeeks: (value: boolean) => void;
  setBacklogSize: (value: string) => void;
  setTargetWeeks: (value: string) => void;
  setNSims: (value: string) => void;
};

function TestHarness({
  initialMode = "backlog_to_weeks",
  spies,
}: {
  initialMode?: "backlog_to_weeks" | "weeks_to_items";
  spies: SpyBag;
}) {
  const [simulationMode, rawSetSimulationMode] = useState<"backlog_to_weeks" | "weeks_to_items">(initialMode);
  const [includeZeroWeeks, rawSetIncludeZeroWeeks] = useState(false);
  const [backlogSize, rawSetBacklogSize] = useState("120");
  const [targetWeeks, rawSetTargetWeeks] = useState("12");
  const [nSims, rawSetNSims] = useState("20000");

  const simulation = {
    simulationMode,
    includeZeroWeeks,
    backlogSize,
    targetWeeks,
    nSims,
    setSimulationMode: (value: "backlog_to_weeks" | "weeks_to_items") => {
      spies.setSimulationMode(value);
      rawSetSimulationMode(value);
    },
    setActiveChartTab: (value: string) => {
      spies.setActiveChartTab(value);
    },
    setIncludeZeroWeeks: (value: boolean) => {
      spies.setIncludeZeroWeeks(value);
      rawSetIncludeZeroWeeks(value);
    },
    setBacklogSize: (value: string) => {
      spies.setBacklogSize(value);
      rawSetBacklogSize(value);
    },
    setTargetWeeks: (value: string) => {
      spies.setTargetWeeks(value);
      rawSetTargetWeeks(value);
    },
    setNSims: (value: string) => {
      spies.setNSims(value);
      rawSetNSims(value);
    },
  };

  return (
    <SimulationProvider value={{ selectedTeam: "Team A", simulation: simulation as never }}>
      <SimulationModeAndParametersControls />
    </SimulationProvider>
  );
}

function createSpies(): SpyBag {
  return {
    setSimulationMode: vi.fn(),
    setActiveChartTab: vi.fn(),
    setIncludeZeroWeeks: vi.fn(),
    setBacklogSize: vi.fn(),
    setTargetWeeks: vi.fn(),
    setNSims: vi.fn(),
  };
}

describe("SimulationModeAndParametersControls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectTopMocks.keepSelectDropdownAtTop.mockClear();
  });

  it("covers the select handlers and the backlog branch", () => {
    const spies = createSpies();
    const { container } = render(<TestHarness spies={spies} />);

    const select = container.querySelector("select");
    const checkbox = container.querySelector('input[type="checkbox"]');
    const numberInputs = container.querySelectorAll('input[type="number"]');

    if (!select || !checkbox || numberInputs.length !== 2) {
      throw new Error("Expected controls were not rendered");
    }

    expect(screen.getByText("Type de simulation")).not.toBeNull();
    expect(screen.getByText("Prévoir le délai pour vider un backlog")).not.toBeNull();
    expect(screen.getByText("Prévoir le volume livré en N semaines")).not.toBeNull();
    expect(screen.getByText("Backlog (items)")).not.toBeNull();

    fireEvent.focus(select);
    fireEvent.mouseDown(select);
    fireEvent.change(select, { target: { value: "weeks_to_items" } });
    fireEvent.click(checkbox);
    fireEvent.change(numberInputs[1], { target: { value: "30000" } });

    expect(selectTopMocks.keepSelectDropdownAtTop).toHaveBeenCalledTimes(2);
    expect(spies.setSimulationMode).toHaveBeenCalledWith("weeks_to_items");
    expect(spies.setActiveChartTab).toHaveBeenCalledWith("throughput");
    expect(spies.setIncludeZeroWeeks).toHaveBeenCalledWith(true);
    expect(spies.setNSims).toHaveBeenCalledWith("30000");
    expect(screen.getByText("Semaines ciblées")).not.toBeNull();
  });

  it("covers the backlog and target week input handlers across both modes", () => {
    const spies = createSpies();
    const { container } = render(<TestHarness spies={spies} initialMode="weeks_to_items" />);

    let numberInputs = container.querySelectorAll('input[type="number"]');
    if (numberInputs.length !== 2) {
      throw new Error("Expected number inputs were not rendered");
    }

    fireEvent.change(numberInputs[0], { target: { value: "16" } });
    expect(spies.setTargetWeeks).toHaveBeenCalledWith("16");

    const select = container.querySelector("select");
    if (!select) {
      throw new Error("Expected select control was not rendered");
    }

    fireEvent.change(select, { target: { value: "backlog_to_weeks" } });
    expect(spies.setSimulationMode).toHaveBeenCalledWith("backlog_to_weeks");

    numberInputs = container.querySelectorAll('input[type="number"]');
    fireEvent.change(numberInputs[0], { target: { value: "150" } });
    expect(spies.setBacklogSize).toHaveBeenCalledWith("150");
  });
});
