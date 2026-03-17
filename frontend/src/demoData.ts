import { formatDateLocal } from "./date";
import type { CycleTimePoint, NamedEntity } from "./types";
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

function buildDemoCycleTimeRows(
  weeklyRows: { week: string; throughput: number }[],
  profile: {
    base: number;
    spread: number;
    throughputWeight: number;
  },
): CycleTimePoint[] {
  return weeklyRows.flatMap((row, index) => {
    if (row.throughput <= 0) return [];
    const baseCycleTime = Math.max(0.4, profile.base - row.throughput * profile.throughputWeight);
    const lowCycleTime = Number(Math.max(0.2, baseCycleTime - profile.spread + ((index % 3) - 1) * 0.12).toFixed(2));
    const highCycleTime = Number((baseCycleTime + profile.spread + ((index % 2) * 0.14)).toFixed(2));
    const primaryCount = Math.max(1, Math.round(row.throughput * 0.65));
    const secondaryCount = row.throughput - primaryCount;

    return [
      { week: row.week, cycleTime: lowCycleTime, count: primaryCount },
      ...(secondaryCount > 0 ? [{ week: row.week, cycleTime: highCycleTime, count: secondaryCount }] : []),
    ];
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
export const DEMO_TEAM_CYCLE_TIME: Record<string, CycleTimePoint[]> = {
  Alpha: buildDemoCycleTimeRows(DEMO_TEAM_WEEKLY.Alpha, { base: 2.1, spread: 0.35, throughputWeight: 0.08 }),
  Beta: buildDemoCycleTimeRows(DEMO_TEAM_WEEKLY.Beta, { base: 3.4, spread: 0.95, throughputWeight: 0.06 }),
  Gamma: buildDemoCycleTimeRows(DEMO_TEAM_WEEKLY.Gamma, { base: 3.9, spread: 0.7, throughputWeight: 0.05 }),
};

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

export function getDemoCycleTime(teamName: string): CycleTimePoint[] {
  return (DEMO_TEAM_CYCLE_TIME[teamName] ?? []).map((row) => ({ ...row }));
}
