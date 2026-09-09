import type {
  CycleTimePoint,
  DeliveryChronologyDiagnostic,
  DeliveryHistoryCompletenessDiagnostic,
  DeliveryHistoryContinuityDiagnostic,
  DeliveryHistoryPeriodDiagnostic,
} from "../../domain/delivery";

export type TeamHistoryThroughput = Readonly<{
  week: string;
  throughput: number;
}>;

export type TeamHistoryDiagnostics = Readonly<{
  periods: readonly DeliveryHistoryPeriodDiagnostic[];
  completeness: DeliveryHistoryCompletenessDiagnostic;
  continuity: readonly DeliveryHistoryContinuityDiagnostic[];
  chronology: readonly DeliveryChronologyDiagnostic[];
}>;

export type TeamHistoryResult = Readonly<{
  weeklyThroughput: readonly TeamHistoryThroughput[];
  cycleTimeDaysData: readonly CycleTimePoint[];
  diagnostics: TeamHistoryDiagnostics;
  warning?: string;
}>;
