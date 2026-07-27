import type { SimulationMode } from "./domain/simulation";
import {
  createBacklogSize,
  createSimulationCount,
  createSimulationHorizon,
  createThroughputSamples,
} from "./domain/simulationValueObjects";

export {
  SIMULATION_BACKLOG_SIZE_MAX,
  SIMULATION_BACKLOG_SIZE_MIN,
  SIMULATION_HORIZON_WEEKS_MAX,
  SIMULATION_N_SIMS_MAX,
  SIMULATION_N_SIMS_MIN,
  SIMULATION_TARGET_WEEKS_MIN,
  SIMULATION_THROUGHPUT_SAMPLES_MAX,
  SIMULATION_THROUGHPUT_SAMPLES_MIN,
} from "./domain/simulationValueObjects";

export function isBoundedIntegerValue(
  value: number | string,
  minimum: number,
  maximum: number,
): boolean {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue >= minimum && numericValue <= maximum;
}

export function validateSimulationInputContract(input: {
  throughputSamples: number[];
  includeZeroWeeks?: boolean;
  mode: SimulationMode;
  backlogSize?: number | string;
  targetWeeks?: number | string;
  nSims: number | string;
}): {
  backlogSize?: number;
  targetWeeks?: number;
  nSims: number;
} {
  createThroughputSamples(
    input.throughputSamples,
    input.includeZeroWeeks ?? false,
  );
  const nSims = createSimulationCount(Number(input.nSims));
  if (input.mode !== "backlog_to_weeks" && input.mode !== "weeks_to_items") {
    throw new Error("mode de simulation invalide.");
  }
  if (input.mode === "backlog_to_weeks") {
    if (input.backlogSize === undefined) {
      throw new Error("backlog_size requis pour le mode backlog_to_weeks.");
    }
    return {
      backlogSize: createBacklogSize(Number(input.backlogSize)),
      nSims,
    };
  }
  if (input.targetWeeks === undefined) {
    throw new Error("target_weeks requis pour le mode weeks_to_items.");
  }
  return {
    targetWeeks: createSimulationHorizon(Number(input.targetWeeks)),
    nSims,
  };
}
