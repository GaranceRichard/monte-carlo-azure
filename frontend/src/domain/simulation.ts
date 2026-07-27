import {
  createBacklogSize,
  createSimulationCount,
  createSimulationHorizon,
  createThroughputSamples,
} from "./simulationValueObjects";
import type {
  BacklogSize,
  CompletionSummary,
  HistogramBucket,
  SimulationCount,
  SimulationHistogram,
  SimulationHorizon,
  SimulationMode,
  SimulationPercentiles,
  SimulationSeed,
  ThroughputReliability,
  ThroughputReliabilityLabel,
  ThroughputSamples,
} from "./simulationValueObjects";

export type {
  CompletionSummary,
  HistogramBucket,
  SimulationMode,
  SimulationPercentiles,
  ThroughputReliability,
  ThroughputReliabilityLabel,
} from "./simulationValueObjects";

export type SimulationResultKind = "weeks" | "items";

export type SimulationCommand = Readonly<{
  throughputSamples: ThroughputSamples;
  mode: SimulationMode;
  backlogSize?: BacklogSize;
  targetWeeks?: SimulationHorizon;
  nSims: SimulationCount;
  seed: SimulationSeed;
}>;

export type SimulationCommandInput = {
  throughputSamples: readonly unknown[];
  includeZeroWeeks: unknown;
  mode: SimulationMode;
  backlogSize?: unknown;
  targetWeeks?: unknown;
  nSims: unknown;
  seed: SimulationSeed;
};

export function createSimulationCommand(input: SimulationCommandInput): SimulationCommand {
  if (input.mode !== "backlog_to_weeks" && input.mode !== "weeks_to_items") {
    throw new Error("mode de simulation invalide.");
  }
  const throughputSamples = createThroughputSamples(
    input.throughputSamples,
    input.includeZeroWeeks,
  );
  const common = {
    throughputSamples,
    mode: input.mode,
    nSims: createSimulationCount(input.nSims),
    seed: input.seed,
  };
  if (input.mode === "backlog_to_weeks") {
    if (input.backlogSize === undefined || input.backlogSize === null) {
      throw new Error("backlog_size requis pour le mode backlog_to_weeks.");
    }
    return Object.freeze({
      ...common,
      backlogSize: createBacklogSize(input.backlogSize),
    });
  }
  if (input.targetWeeks === undefined || input.targetWeeks === null) {
    throw new Error("target_weeks requis pour le mode weeks_to_items.");
  }
  return Object.freeze({
    ...common,
    targetWeeks: createSimulationHorizon(input.targetWeeks),
  });
}

export type SimulationResult = Readonly<{
  resultKind: SimulationResultKind;
  samplesCount: number;
  seed: SimulationSeed;
  resultPercentiles: SimulationPercentiles;
  riskScore?: number;
  resultDistribution: SimulationHistogram;
  completionSummary?: CompletionSummary;
  throughputReliability?: ThroughputReliability;
}>;

export type ServerSimulationHistoryItem = {
  createdAt: string;
  lastSeen: string;
  mode: SimulationMode;
  seed?: SimulationSeed | null;
  backlogSize?: BacklogSize | null;
  targetWeeks?: SimulationHorizon | null;
  nSims: SimulationCount;
  samplesCount: number;
  percentiles: SimulationPercentiles;
  distribution: SimulationHistogram;
  completionSummary?: CompletionSummary;
  includeZeroWeeks?: boolean;
  throughputReliability?: ThroughputReliability;
};
