import { useEffect, useMemo } from "react";
import { buildQuickFiltersScopeKey, writeStoredQuickFilters } from "../storage";
import type { AppStep } from "../types";

type UseSimulationQuickFiltersParams = {
  step: AppStep;
  selectedOrg: string;
  selectedProject: string;
  selectedTeam: string;
  workItemTypeOptions: string[];
  statesByType: Record<string, string[]>;
  types: string[];
  doneStates: string[];
};

type UseSimulationQuickFiltersResult = {
  quickFiltersScopeKey: string;
};

function uniqueByOrder(values: string[]): string[] {
  return values.filter((value, index, array) => array.indexOf(value) === index);
}

export function useSimulationQuickFilters({
  step,
  selectedOrg,
  selectedProject,
  selectedTeam,
  workItemTypeOptions,
  statesByType,
  types,
  doneStates,
}: UseSimulationQuickFiltersParams): UseSimulationQuickFiltersResult {
  const quickFiltersScopeKey = useMemo(() => {
    if (!selectedOrg || !selectedProject || !selectedTeam) return "";
    return buildQuickFiltersScopeKey(selectedOrg, selectedProject, selectedTeam);
  }, [selectedOrg, selectedProject, selectedTeam]);

  useEffect(() => {
    if (step !== "simulation" || !quickFiltersScopeKey) return;

    const allowedTypes = new Set(workItemTypeOptions);
    const persistedTypes = uniqueByOrder(types).filter((type) => allowedTypes.has(type));
    if (!persistedTypes.length) return;

    const allowedStates = new Set(persistedTypes.flatMap((type) => statesByType[type] || []));
    const persistedDoneStates = uniqueByOrder(doneStates).filter((state) => allowedStates.has(state));
    if (!persistedDoneStates.length) return;

    writeStoredQuickFilters(quickFiltersScopeKey, {
      types: persistedTypes,
      doneStates: persistedDoneStates,
    });
  }, [doneStates, quickFiltersScopeKey, statesByType, step, types, workItemTypeOptions]);

  return { quickFiltersScopeKey };
}
