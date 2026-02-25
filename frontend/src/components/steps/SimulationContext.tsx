import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { SimulationViewModel } from "../../hooks/useSimulation";
import type {
  SimulationDateRange,
  SimulationForecastControls,
  SimulationResult,
  TooltipBaseProps,
  ChartTab,
  SimulationHistoryEntry,
} from "../../hooks/simulationTypes";

type SimulationContextValue = {
  selectedTeam: string;
  simulation: SimulationViewModel;
};

type SimulationMetaContextValue = {
  selectedTeam: string;
  err: string;
};

type SimulationFiltersContextValue = Pick<
  SimulationViewModel,
  "workItemTypeOptions" | "types" | "setTypes" | "filteredDoneStateOptions" | "doneStates" | "setDoneStates" | "loadingTeamOptions"
>;

type SimulationRunContextValue = Pick<SimulationViewModel, "loading" | "hasLaunchedOnce" | "loadingStageMessage" | "runForecast">;

type SimulationHistoryContextValue = {
  simulationHistory: SimulationHistoryEntry[];
  applyHistoryEntry: (entry: SimulationHistoryEntry) => void;
  clearSimulationHistory: () => void;
};

type SimulationChartsContextValue = {
  activeChartTab: ChartTab;
  setActiveChartTab: (value: ChartTab) => void;
  throughputData: SimulationResult["throughputData"];
  mcHistData: SimulationResult["mcHistData"];
  probabilityCurveData: SimulationResult["probabilityCurveData"];
  tooltipBaseProps: TooltipBaseProps;
  exportThroughputCsv: () => void;
  resetForTeamSelection: () => void;
};

const SimulationMetaContext = createContext<SimulationMetaContextValue | null>(null);
const SimulationDateRangeContext = createContext<SimulationDateRange | null>(null);
const SimulationForecastControlsContext = createContext<SimulationForecastControls | null>(null);
const SimulationFiltersContext = createContext<SimulationFiltersContextValue | null>(null);
const SimulationRunContext = createContext<SimulationRunContextValue | null>(null);
const SimulationResultContext = createContext<SimulationResult | null>(null);
const SimulationHistoryContext = createContext<SimulationHistoryContextValue | null>(null);
const SimulationChartsContext = createContext<SimulationChartsContextValue | null>(null);

type SimulationProviderProps = {
  value: SimulationContextValue;
  children: ReactNode;
};

export function SimulationProvider({ value, children }: SimulationProviderProps) {
  const { selectedTeam, simulation } = value;

  const metaValue: SimulationMetaContextValue = {
    selectedTeam,
    err: simulation.err,
  };
  const dateRangeValue: SimulationDateRange = {
    startDate: simulation.startDate,
    setStartDate: simulation.setStartDate,
    endDate: simulation.endDate,
    setEndDate: simulation.setEndDate,
  };
  const forecastControlsValue: SimulationForecastControls = {
    backlogSize: simulation.backlogSize,
    setBacklogSize: simulation.setBacklogSize,
    targetWeeks: simulation.targetWeeks,
    setTargetWeeks: simulation.setTargetWeeks,
    nSims: simulation.nSims,
    setNSims: simulation.setNSims,
    simulationMode: simulation.simulationMode,
    setSimulationMode: simulation.setSimulationMode,
    includeZeroWeeks: simulation.includeZeroWeeks,
    setIncludeZeroWeeks: simulation.setIncludeZeroWeeks,
    capacityPercent: simulation.capacityPercent,
    setCapacityPercent: simulation.setCapacityPercent,
    reducedCapacityWeeks: simulation.reducedCapacityWeeks,
    setReducedCapacityWeeks: simulation.setReducedCapacityWeeks,
  };
  const filtersValue: SimulationFiltersContextValue = {
    workItemTypeOptions: simulation.workItemTypeOptions,
    types: simulation.types,
    setTypes: simulation.setTypes,
    filteredDoneStateOptions: simulation.filteredDoneStateOptions,
    doneStates: simulation.doneStates,
    setDoneStates: simulation.setDoneStates,
    loadingTeamOptions: simulation.loadingTeamOptions,
  };
  const runValue: SimulationRunContextValue = {
    loading: simulation.loading,
    hasLaunchedOnce: simulation.hasLaunchedOnce,
    loadingStageMessage: simulation.loadingStageMessage,
    runForecast: simulation.runForecast,
  };
  const resultValue: SimulationResult = {
    result: simulation.result,
    displayPercentiles: simulation.displayPercentiles,
    throughputData: simulation.throughputData,
    mcHistData: simulation.mcHistData,
    probabilityCurveData: simulation.probabilityCurveData,
    sampleStats: simulation.sampleStats,
  };
  const historyValue: SimulationHistoryContextValue = {
    simulationHistory: simulation.simulationHistory,
    applyHistoryEntry: simulation.applyHistoryEntry,
    clearSimulationHistory: simulation.clearSimulationHistory,
  };
  const chartsValue: SimulationChartsContextValue = {
    activeChartTab: simulation.activeChartTab,
    setActiveChartTab: simulation.setActiveChartTab,
    throughputData: simulation.throughputData,
    mcHistData: simulation.mcHistData,
    probabilityCurveData: simulation.probabilityCurveData,
    tooltipBaseProps: simulation.tooltipBaseProps,
    exportThroughputCsv: simulation.exportThroughputCsv,
    resetForTeamSelection: simulation.resetForTeamSelection,
  };

  return (
    <SimulationMetaContext.Provider value={metaValue}>
      <SimulationDateRangeContext.Provider value={dateRangeValue}>
        <SimulationForecastControlsContext.Provider value={forecastControlsValue}>
          <SimulationFiltersContext.Provider value={filtersValue}>
            <SimulationRunContext.Provider value={runValue}>
              <SimulationResultContext.Provider value={resultValue}>
                <SimulationHistoryContext.Provider value={historyValue}>
                  <SimulationChartsContext.Provider value={chartsValue}>{children}</SimulationChartsContext.Provider>
                </SimulationHistoryContext.Provider>
              </SimulationResultContext.Provider>
            </SimulationRunContext.Provider>
          </SimulationFiltersContext.Provider>
        </SimulationForecastControlsContext.Provider>
      </SimulationDateRangeContext.Provider>
    </SimulationMetaContext.Provider>
  );
}

function useRequiredContext<T>(context: T | null, hookName: string): T {
  if (!context) {
    throw new Error(`${hookName} must be used within a SimulationProvider.`);
  }
  return context;
}

export function useSimulationMetaContext(): SimulationMetaContextValue {
  return useRequiredContext(useContext(SimulationMetaContext), "useSimulationMetaContext");
}

export function useSimulationDateRangeContext(): SimulationDateRange {
  return useRequiredContext(useContext(SimulationDateRangeContext), "useSimulationDateRangeContext");
}

export function useSimulationForecastControlsContext(): SimulationForecastControls {
  return useRequiredContext(useContext(SimulationForecastControlsContext), "useSimulationForecastControlsContext");
}

export function useSimulationFiltersContext(): SimulationFiltersContextValue {
  return useRequiredContext(useContext(SimulationFiltersContext), "useSimulationFiltersContext");
}

export function useSimulationRunContext(): SimulationRunContextValue {
  return useRequiredContext(useContext(SimulationRunContext), "useSimulationRunContext");
}

export function useSimulationResultContext(): SimulationResult {
  return useRequiredContext(useContext(SimulationResultContext), "useSimulationResultContext");
}

export function useSimulationHistoryContext(): SimulationHistoryContextValue {
  return useRequiredContext(useContext(SimulationHistoryContext), "useSimulationHistoryContext");
}

export function useSimulationChartsContext(): SimulationChartsContextValue {
  return useRequiredContext(useContext(SimulationChartsContext), "useSimulationChartsContext");
}
