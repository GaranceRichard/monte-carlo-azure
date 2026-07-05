import type { ForecastMode } from "./types";

export const SIMULATION_N_SIMS_MIN = 1_000;
export const SIMULATION_N_SIMS_MAX = 200_000;
export const SIMULATION_TARGET_WEEKS_MIN = 1;
export const SIMULATION_HORIZON_WEEKS_MAX = 521;
export const SIMULATION_THROUGHPUT_SAMPLES_MIN = 6;
export const SIMULATION_THROUGHPUT_SAMPLES_MAX = 521;
export const SIMULATION_BACKLOG_SIZE_MIN = 1;
export const SIMULATION_BACKLOG_SIZE_MAX = 1_000_000;

function validateBoundedInteger(
  fieldName: "backlog_size" | "target_weeks" | "n_sims",
  value: number | string | undefined,
  minimum: number,
  maximum: number,
): number {
  if (value == null || (typeof value === "string" && value.trim() === "")) {
    throw new Error(`${fieldName} requis.`);
  }

  const numericValue = Number(value);
  if (!Number.isInteger(numericValue) || numericValue < minimum || numericValue > maximum) {
    throw new Error(`${fieldName} doit etre compris entre ${minimum} et ${maximum}.`);
  }
  return numericValue;
}

export function isBoundedIntegerValue(
  value: number | string,
  minimum: number,
  maximum: number,
): boolean {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue >= minimum && numericValue <= maximum;
}

export function validateSimulationInputContract({
  throughputSamples,
  includeZeroWeeks = false,
  mode,
  backlogSize,
  targetWeeks,
  nSims,
}: {
  throughputSamples: number[];
  includeZeroWeeks?: boolean;
  mode: ForecastMode;
  backlogSize?: number | string;
  targetWeeks?: number | string;
  nSims: number | string;
}): {
  backlogSize?: number;
  targetWeeks?: number;
  nSims: number;
} {
  if (
    throughputSamples.length < SIMULATION_THROUGHPUT_SAMPLES_MIN
    || throughputSamples.length > SIMULATION_THROUGHPUT_SAMPLES_MAX
  ) {
    throw new Error(
      `throughput_samples doit contenir entre ${SIMULATION_THROUGHPUT_SAMPLES_MIN} et ${SIMULATION_THROUGHPUT_SAMPLES_MAX} valeurs.`,
    );
  }

  const usableSamples = throughputSamples.filter((value) =>
    Number.isFinite(value) && (includeZeroWeeks ? value >= 0 : value > 0));
  if (usableSamples.length < SIMULATION_THROUGHPUT_SAMPLES_MIN) {
    throw new Error(
      includeZeroWeeks
        ? "Historique insuffisant (moins de 6 semaines)."
        : "Historique insuffisant (moins de 6 semaines non nulles).",
    );
  }

  const resolvedNSims = validateBoundedInteger(
    "n_sims",
    nSims,
    SIMULATION_N_SIMS_MIN,
    SIMULATION_N_SIMS_MAX,
  );

  if (mode === "backlog_to_weeks") {
    return {
      backlogSize: validateBoundedInteger(
        "backlog_size",
        backlogSize,
        SIMULATION_BACKLOG_SIZE_MIN,
        SIMULATION_BACKLOG_SIZE_MAX,
      ),
      nSims: resolvedNSims,
    };
  }

  return {
    targetWeeks: validateBoundedInteger(
      "target_weeks",
      targetWeeks,
      SIMULATION_TARGET_WEEKS_MIN,
      SIMULATION_HORIZON_WEEKS_MAX,
    ),
    nSims: resolvedNSims,
  };
}
