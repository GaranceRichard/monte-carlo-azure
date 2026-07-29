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

type SimulationCommandCommon = {
  throughputSamples: ThroughputSamples;
  nSims: SimulationCount;
  seed: SimulationSeed;
};

export type SimulationCommand =
  | Readonly<SimulationCommandCommon & {
      mode: "backlog_to_weeks";
      backlogSize: BacklogSize;
      targetWeeks?: never;
    }>
  | Readonly<SimulationCommandCommon & {
      mode: "weeks_to_items";
      backlogSize?: never;
      targetWeeks: SimulationHorizon;
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

const COMMAND_INPUT_KEYS = new Set([
  "throughputSamples",
  "includeZeroWeeks",
  "mode",
  "backlogSize",
  "targetWeeks",
  "nSims",
  "seed",
]);
const NORMALIZED_COMMON_KEYS = new Set([
  "throughput_samples",
  "include_zero_weeks",
  "mode",
  "n_sims",
]);
const NORMALIZED_ALLOWED_KEYS = new Set([
  ...NORMALIZED_COMMON_KEYS,
  "backlog_size",
  "target_weeks",
]);

function strictRecord(value: unknown, fieldName: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${fieldName} doit etre un objet.`);
  }
  return value as Record<string, unknown>;
}

function rejectUnknownKeys(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  fieldName: string,
): void {
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    throw new Error(`${fieldName} contient des champs inconnus.`);
  }
}

export function createSimulationCommand(input: SimulationCommandInput): SimulationCommand {
  rejectUnknownKeys(
    input as unknown as Record<string, unknown>,
    COMMAND_INPUT_KEYS,
    "La commande",
  );
  if (input.mode !== "backlog_to_weeks" && input.mode !== "weeks_to_items") {
    throw new Error("mode de simulation invalide.");
  }
  const throughputSamples = createThroughputSamples(
    input.throughputSamples,
    input.includeZeroWeeks,
  );
  const common = {
    throughputSamples,
    nSims: createSimulationCount(input.nSims),
    seed: input.seed,
  };
  if (input.mode === "backlog_to_weeks") {
    if (input.backlogSize === undefined || input.backlogSize === null) {
      throw new Error("backlog_size requis pour le mode backlog_to_weeks.");
    }
    if (input.targetWeeks !== undefined) {
      throw new Error("target_weeks doit etre absent pour le mode backlog_to_weeks.");
    }
    return Object.freeze({
      ...common,
      mode: input.mode,
      backlogSize: createBacklogSize(input.backlogSize),
    });
  }
  if (input.targetWeeks === undefined || input.targetWeeks === null) {
    throw new Error("target_weeks requis pour le mode weeks_to_items.");
  }
  if (input.backlogSize !== undefined) {
    throw new Error("backlog_size doit etre absent pour le mode weeks_to_items.");
  }
  return Object.freeze({
    ...common,
    mode: input.mode,
    targetWeeks: createSimulationHorizon(input.targetWeeks),
  });
}

export function createSimulationCommandFromNormalizedInput(
  inputValue: unknown,
  seed: SimulationSeed,
): SimulationCommand {
  const input = strictRecord(inputValue, "L'entree normalisee");
  rejectUnknownKeys(input, NORMALIZED_ALLOWED_KEYS, "L'entree normalisee");
  if ([...NORMALIZED_COMMON_KEYS].some((key) => !(key in input))) {
    throw new Error(
      "L'entree normalisee doit resoudre toutes les valeurs par defaut.",
    );
  }
  const mode = input.mode;
  if (mode !== "backlog_to_weeks" && mode !== "weeks_to_items") {
    throw new Error("mode de simulation invalide.");
  }
  const activeKey = mode === "backlog_to_weeks" ? "backlog_size" : "target_weeks";
  const inactiveKey = mode === "backlog_to_weeks" ? "target_weeks" : "backlog_size";
  if (!(activeKey in input)) {
    throw new Error(`${activeKey} requis pour le mode ${mode}.`);
  }
  if (inactiveKey in input) {
    throw new Error(`${inactiveKey} doit etre absent pour le mode ${mode}.`);
  }
  return createSimulationCommand({
    throughputSamples: input.throughput_samples as readonly unknown[],
    includeZeroWeeks: input.include_zero_weeks,
    mode,
    ...(mode === "backlog_to_weeks"
      ? { backlogSize: input.backlog_size }
      : { targetWeeks: input.target_weeks }),
    nSims: input.n_sims,
    seed,
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
  riskScore?: number;
  distribution: SimulationHistogram;
  completionSummary?: CompletionSummary;
  includeZeroWeeks?: boolean;
  throughputReliability?: ThroughputReliability;
};
