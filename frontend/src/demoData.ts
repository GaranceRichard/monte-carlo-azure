import { formatDateLocal } from "./date";
import type { NamedEntity } from "./types";
import type { TeamPortfolioConfig } from "./hooks/usePortfolioReport";

const DEMO_START_DATE = "2025-11-24";
const DEMO_END_DATE = "2026-03-09";
const DEMO_WORK_ITEM_TYPES = ["User Story", "Bug", "Product Backlog Item"];
const DEMO_STATES_BY_TYPE: Record<string, string[]> = {
  "User Story": ["Done", "Closed", "Resolved"],
  Bug: ["Done", "Closed", "Resolved"],
  "Product Backlog Item": ["Done", "Closed", "Resolved"],
};
const DEMO_DONE_STATES = ["Done", "Closed", "Resolved"];

function buildWeeklyThroughputRows(startDate: string, samples: number[]) {
  const cursor = new Date(startDate);
  return samples.map((throughput, index) => {
    if (index > 0) cursor.setDate(cursor.getDate() + 7);
    return {
      week: formatDateLocal(cursor),
      throughput,
    };
  });
}

export const DEMO_ORG = "Acme Corp";
export const DEMO_PROJECT = "Programme Titan";
export const DEMO_TEAM_SAMPLES: Record<string, number[]> = {
  Alpha: [6, 7, 8, 7, 8, 7, 6, 8, 7, 8, 7, 6, 8, 7, 8, 7],
  Beta: [9, 8, 9, 8, 8, 7, 9, 8, 7, 2, 2, 3, 2, 1, 3, 2],
  Gamma: [3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6, 7, 7, 7, 8, 8],
};

export const DEMO_TEAMS: NamedEntity[] = Object.keys(DEMO_TEAM_SAMPLES).map((name) => ({ name }));
export const DEMO_PROJECTS: NamedEntity[] = [{ name: DEMO_PROJECT }];
export const DEMO_ORGS: NamedEntity[] = [{ name: DEMO_ORG }];
export const DEMO_TEAM_WEEKLY: Record<string, { week: string; throughput: number }[]> = Object.fromEntries(
  Object.entries(DEMO_TEAM_SAMPLES).map(([teamName, samples]) => [teamName, buildWeeklyThroughputRows(DEMO_START_DATE, samples)]),
);

export const DEMO_TEAM_OPTIONS = {
  workItemTypes: DEMO_WORK_ITEM_TYPES,
  statesByType: DEMO_STATES_BY_TYPE,
  defaultTypes: [...DEMO_WORK_ITEM_TYPES],
  defaultDoneStates: DEMO_DONE_STATES,
};

export const DEMO_PORTFOLIO_TEAM_CONFIGS: TeamPortfolioConfig[] = DEMO_TEAMS.map((team) => ({
  teamName: team.name || "",
  workItemTypeOptions: [...DEMO_WORK_ITEM_TYPES],
  statesByType: DEMO_STATES_BY_TYPE,
  types: [...DEMO_WORK_ITEM_TYPES],
  doneStates: [...DEMO_DONE_STATES],
}));

export const DEMO_CONFIG = {
  org: DEMO_ORG,
  project: DEMO_PROJECT,
  projects: DEMO_PROJECTS,
  orgs: DEMO_ORGS,
  teams: DEMO_TEAMS,
  selectedTeam: "Alpha",
  selectedProject: DEMO_PROJECT,
  startDate: DEMO_START_DATE,
  endDate: DEMO_END_DATE,
  workItemTypes: DEMO_WORK_ITEM_TYPES,
  statesByType: DEMO_STATES_BY_TYPE,
  defaultTypes: [...DEMO_WORK_ITEM_TYPES],
  defaultDoneStates: [...DEMO_DONE_STATES],
};

export function getDemoWeeklyThroughput(teamName: string): { week: string; throughput: number }[] {
  return (DEMO_TEAM_WEEKLY[teamName] ?? []).map((row) => ({ ...row }));
}

export function getDemoThroughputSamples(teamName: string): number[] {
  return [...(DEMO_TEAM_SAMPLES[teamName] ?? [])];
}
