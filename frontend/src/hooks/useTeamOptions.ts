import { useCallback, useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { getTeamOptionsDirect } from "../adoClient";
import type { AppStep } from "../types";
import { readStoredQuickFilters } from "../storage";

const DEFAULT_WORK_ITEM_TYPE_OPTIONS = ["User Story", "Product Backlog Item", "Bug"];
const DEFAULT_STATES_BY_TYPE: Record<string, string[]> = {
  "User Story": ["Done", "Closed", "Resolved"],
  "Product Backlog Item": ["Done", "Closed", "Resolved"],
  Bug: ["Done", "Closed", "Resolved"],
};

type UseTeamOptionsParams = {
  step: AppStep;
  selectedOrg: string;
  selectedProject: string;
  selectedTeam: string;
  pat: string;
  quickFiltersScopeKey: string;
  setTypes: Dispatch<SetStateAction<string[]>>;
  setDoneStates: Dispatch<SetStateAction<string[]>>;
  onTeamOptionsReset: () => void;
};

type UseTeamOptionsResult = {
  loadingTeamOptions: boolean;
  workItemTypeOptions: string[];
  statesByType: Record<string, string[]>;
  hasQuickFilterConfig: boolean;
  applyQuickFilterConfig: () => void;
  resetTeamOptions: () => void;
};

type QuickFilterSelection = {
  types: string[];
  doneStates: string[];
};

function getValidQuickFilterSelection(
  workItemTypeOptions: string[],
  statesByType: Record<string, string[]>,
  quickFilters: QuickFilterSelection,
): QuickFilterSelection {
  const allowedTypes = new Set(workItemTypeOptions);
  const types = quickFilters.types.filter((type, idx, arr) => allowedTypes.has(type) && arr.indexOf(type) === idx);
  const allowedStates = new Set(types.flatMap((type) => statesByType[type] || []));
  const doneStates = quickFilters.doneStates.filter(
    (state, idx, arr) => allowedStates.has(state) && arr.indexOf(state) === idx,
  );
  return { types, doneStates };
}

export function useTeamOptions({
  step,
  selectedOrg,
  selectedProject,
  selectedTeam,
  pat,
  quickFiltersScopeKey,
  setTypes,
  setDoneStates,
  onTeamOptionsReset,
}: UseTeamOptionsParams): UseTeamOptionsResult {
  const [loadingTeamOptions, setLoadingTeamOptions] = useState(false);
  const [workItemTypeOptions, setWorkItemTypeOptions] = useState<string[]>(DEFAULT_WORK_ITEM_TYPE_OPTIONS);
  const [statesByType, setStatesByType] = useState<Record<string, string[]>>({});
  const [hasQuickFilterConfig, setHasQuickFilterConfig] = useState(false);

  const applyQuickFilterConfig = useCallback((): void => {
    const storedQuickFilters = readStoredQuickFilters(quickFiltersScopeKey);
    setHasQuickFilterConfig(Boolean(storedQuickFilters));
    if (!storedQuickFilters) return;

    const nextSelection = getValidQuickFilterSelection(workItemTypeOptions, statesByType, storedQuickFilters);
    if (!nextSelection.types.length || !nextSelection.doneStates.length) return;

    setTypes(nextSelection.types);
    setDoneStates(nextSelection.doneStates);
  }, [quickFiltersScopeKey, setDoneStates, setTypes, statesByType, workItemTypeOptions]);

  const resetTeamOptions = useCallback((): void => {
    setLoadingTeamOptions(false);
    setWorkItemTypeOptions(DEFAULT_WORK_ITEM_TYPE_OPTIONS);
    setStatesByType({});
    onTeamOptionsReset();
  }, [onTeamOptionsReset]);

  useEffect(() => {
    setHasQuickFilterConfig(Boolean(readStoredQuickFilters(quickFiltersScopeKey)));
  }, [quickFiltersScopeKey]);

  useEffect(() => {
    if (step !== "simulation" || !selectedOrg || !selectedProject || !selectedTeam || !pat) return;
    let active = true;

    (async () => {
      try {
        setLoadingTeamOptions(true);
        const options = await getTeamOptionsDirect(selectedOrg, selectedProject, selectedTeam, pat);
        if (!active) return;
        const nextTypes = (options.workItemTypes?.length ? options.workItemTypes : DEFAULT_WORK_ITEM_TYPE_OPTIONS)
          .slice()
          .sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
        const nextStatesByType = options.statesByType || {};
        setWorkItemTypeOptions(nextTypes);
        setStatesByType(nextStatesByType);
        onTeamOptionsReset();
        const storedQuickFilters = readStoredQuickFilters(quickFiltersScopeKey);
        setHasQuickFilterConfig(Boolean(storedQuickFilters));
        if (!storedQuickFilters) return;

        const nextSelection = getValidQuickFilterSelection(nextTypes, nextStatesByType, storedQuickFilters);
        if (!nextSelection.types.length || !nextSelection.doneStates.length) return;
        setTypes(nextSelection.types);
        setDoneStates(nextSelection.doneStates);
      } catch {
        if (!active) return;
        setWorkItemTypeOptions(DEFAULT_WORK_ITEM_TYPE_OPTIONS);
        setStatesByType(DEFAULT_STATES_BY_TYPE);
        onTeamOptionsReset();
        const storedQuickFilters = readStoredQuickFilters(quickFiltersScopeKey);
        setHasQuickFilterConfig(Boolean(storedQuickFilters));
        if (!storedQuickFilters) return;

        const nextSelection = getValidQuickFilterSelection(
          DEFAULT_WORK_ITEM_TYPE_OPTIONS,
          DEFAULT_STATES_BY_TYPE,
          storedQuickFilters,
        );
        if (!nextSelection.types.length || !nextSelection.doneStates.length) return;
        setTypes(nextSelection.types);
        setDoneStates(nextSelection.doneStates);
      } finally {
        if (active) setLoadingTeamOptions(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [
    onTeamOptionsReset,
    pat,
    quickFiltersScopeKey,
    selectedOrg,
    selectedProject,
    selectedTeam,
    setDoneStates,
    setTypes,
    step,
  ]);

  return {
    loadingTeamOptions,
    workItemTypeOptions,
    statesByType,
    hasQuickFilterConfig,
    applyQuickFilterConfig,
    resetTeamOptions,
  };
}
