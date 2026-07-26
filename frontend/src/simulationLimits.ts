import { createSimulationCommand } from "./domain/simulation";
import type { SimulationMode } from "./domain/simulation";

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
  const command = createSimulationCommand({
    ...input,
    includeZeroWeeks: input.includeZeroWeeks ?? false,
    backlogSize: input.backlogSize === undefined ? undefined : Number(input.backlogSize),
    targetWeeks: input.targetWeeks === undefined ? undefined : Number(input.targetWeeks),
    nSims: Number(input.nSims),
    seed: 0,
  });
  return {
    ...(command.backlogSize === undefined ? {} : { backlogSize: command.backlogSize }),
    ...(command.targetWeeks === undefined ? {} : { targetWeeks: command.targetWeeks }),
    nSims: command.nSims,
  };
}
