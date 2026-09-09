import type {
  CycleTimePoint,
  DeliveryChronologyResult,
  DeliveryHistory,
  DeliveryHistoryPeriods,
  DeliveryHistoryResult,
  DeliveryThroughput,
} from "../../domain/delivery";
import type { TeamHistoryResult } from "./contract";

export type TeamHistoryResultInput = Readonly<{
  weeklyThroughput: readonly DeliveryThroughput[];
  cycleTimeDaysData: readonly CycleTimePoint[];
  periods: DeliveryHistoryPeriods;
  completeness: DeliveryHistoryResult;
  continuity: DeliveryHistory;
  chronology: DeliveryChronologyResult;
  warning?: string;
}>;

export function createTeamHistoryResult(
  input: TeamHistoryResultInput,
): TeamHistoryResult {
  return Object.freeze({
    weeklyThroughput: input.weeklyThroughput,
    cycleTimeDaysData: input.cycleTimeDaysData,
    diagnostics: Object.freeze({
      periods: input.periods.diagnostics,
      completeness: input.completeness.completeness,
      continuity: input.continuity.diagnostics,
      chronology: input.chronology.diagnostics,
    }),
    warning: input.warning,
  });
}
