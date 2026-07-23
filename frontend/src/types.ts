export type AppStep = "pat" | "org" | "projects" | "teams" | "simulation" | "portfolio";

export type NamedEntity = {
  id?: string;
  name?: string;
};

export type TeamOptionResponse = {
  doneStates: string[];
  workItemTypes: string[];
  statesByType: Record<string, string[]>;
};

export type WeeklyThroughputRow = {
  week: string;
  throughput: number;
};

export type CycleTimePoint = {
  week: string;
  cycleTimeDays: number;
  count: number;
};
