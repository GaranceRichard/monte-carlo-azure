import { useCallback, useEffect, useState } from "react";
import { getTeamOptionsDirect } from "../adoClient";
import type { AppStep } from "../types";

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
  onTeamOptionsReset: () => void;
};

type UseTeamOptionsResult = {
  loadingTeamOptions: boolean;
  workItemTypeOptions: string[];
  statesByType: Record<string, string[]>;
  resetTeamOptions: () => void;
};

export function useTeamOptions({
  step,
  selectedOrg,
  selectedProject,
  selectedTeam,
  pat,
  onTeamOptionsReset,
}: UseTeamOptionsParams): UseTeamOptionsResult {
  const [loadingTeamOptions, setLoadingTeamOptions] = useState(false);
  const [workItemTypeOptions, setWorkItemTypeOptions] = useState<string[]>(DEFAULT_WORK_ITEM_TYPE_OPTIONS);
  const [statesByType, setStatesByType] = useState<Record<string, string[]>>({});

  const resetTeamOptions = useCallback((): void => {
    setLoadingTeamOptions(false);
    setWorkItemTypeOptions(DEFAULT_WORK_ITEM_TYPE_OPTIONS);
    setStatesByType({});
    onTeamOptionsReset();
  }, [onTeamOptionsReset]);

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
        setWorkItemTypeOptions(nextTypes);
        setStatesByType(options.statesByType || {});
        onTeamOptionsReset();
      } catch {
        if (!active) return;
        setWorkItemTypeOptions(DEFAULT_WORK_ITEM_TYPE_OPTIONS);
        setStatesByType(DEFAULT_STATES_BY_TYPE);
        onTeamOptionsReset();
      } finally {
        if (active) setLoadingTeamOptions(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [onTeamOptionsReset, pat, selectedOrg, selectedProject, selectedTeam, step]);

  return {
    loadingTeamOptions,
    workItemTypeOptions,
    statesByType,
    resetTeamOptions,
  };
}
