export const SIMULATION_N_SIMS_MIN = 1_000;
export const SIMULATION_N_SIMS_MAX = 200_000;
export const SIMULATION_TARGET_WEEKS_MIN = 1;
export const SIMULATION_HORIZON_WEEKS_MAX = 521;
export const SIMULATION_THROUGHPUT_SAMPLES_MIN = 6;
export const SIMULATION_THROUGHPUT_SAMPLES_MAX = 521;
export const SIMULATION_BACKLOG_SIZE_MIN = 1;
export const SIMULATION_BACKLOG_SIZE_MAX = 1_000_000;
export const SIMULATION_SEED_MIN = 0;
export const SIMULATION_SEED_MAX = 0xffffffff;

export type SimulationMode = "backlog_to_weeks" | "weeks_to_items";
export type PercentileKey = "P50" | "P70" | "P90";
export type ThroughputReliabilityLabel = "fiable" | "incertain" | "fragile" | "non fiable";

declare const simulationSeedBrand: unique symbol;
declare const simulationCountBrand: unique symbol;
declare const backlogSizeBrand: unique symbol;
declare const simulationHorizonBrand: unique symbol;
declare const throughputSamplesBrand: unique symbol;

export type SimulationSeed = number & { readonly [simulationSeedBrand]?: never };
export type SimulationCount = number & { readonly [simulationCountBrand]?: never };
export type BacklogSize = number & { readonly [backlogSizeBrand]?: never };
export type SimulationHorizon = number & { readonly [simulationHorizonBrand]?: never };

export type ThroughputSamples = Readonly<{
  rawValues: readonly number[];
  usableValues: readonly number[];
  includeZeroWeeks: boolean;
  readonly [throughputSamplesBrand]: true;
}>;

export type SimulationPercentiles = Readonly<Partial<Record<PercentileKey, number>>>;

export type HistogramBucket = Readonly<{
  x: number;
  count: number;
}>;

export type SimulationHistogram = readonly HistogramBucket[];

export type CompletionSummary = Readonly<{
  completedCount: number;
  censoredCount: number;
  censoredRate: number;
  horizonWeeks: number;
}>;

export type ThroughputReliability = Readonly<{
  cv: number;
  iqrRatio: number;
  slopeNorm: number;
  label: ThroughputReliabilityLabel;
  samplesCount: number;
}>;

const PERCENTILE_KEYS: readonly PercentileKey[] = ["P50", "P70", "P90"];
const RELIABILITY_LABELS: readonly ThroughputReliabilityLabel[] = [
  "fiable",
  "incertain",
  "fragile",
  "non fiable",
];

function strictInteger(
  value: unknown,
  fieldName: string,
): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new Error(`${fieldName} doit etre un entier strict.`);
  }
  return value;
}

function boundedInteger(
  value: unknown,
  fieldName: string,
  minimum: number,
  maximum: number,
): number {
  const resolved = strictInteger(value, fieldName);
  if (resolved < minimum || resolved > maximum) {
    throw new Error(`${fieldName} doit etre compris entre ${String(minimum)} et ${String(maximum)}.`);
  }
  return resolved;
}

function finiteMetric(value: unknown, fieldName: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${fieldName} doit etre un nombre fini.`);
  }
  return value;
}

export function roundHalfUp(value: number, decimalPlaces = 4): number {
  const resolved = finiteMetric(value, "value");
  if (!Number.isSafeInteger(decimalPlaces) || decimalPlaces < 0) {
    throw new Error("decimalPlaces doit etre un entier strict >= 0.");
  }
  const [coefficient = "0", exponentText = "0"] = Math.abs(resolved)
    .toString()
    .toLowerCase()
    .split("e");
  const [integerPart = "0", fractionPart = ""] = coefficient.split(".");
  const digits = `${integerPart}${fractionPart}`;
  const decimalIndex = integerPart.length + Number(exponentText);
  const targetIndex = decimalIndex + decimalPlaces;
  const retainedDigits = targetIndex <= 0
    ? "0"
    : digits.slice(0, targetIndex).padEnd(targetIndex, "0");
  const firstDiscardedDigit = targetIndex < 0
    ? "0"
    : digits[targetIndex] ?? "0";
  let scaled = BigInt(retainedDigits);
  if (firstDiscardedDigit >= "5") scaled += 1n;
  const sign = resolved < 0 ? "-" : "";
  return Number(`${sign}${String(scaled)}e-${String(decimalPlaces)}`);
}

export function createSimulationSeed(value: unknown): SimulationSeed {
  return boundedInteger(
    value,
    "seed",
    SIMULATION_SEED_MIN,
    SIMULATION_SEED_MAX,
  ) as SimulationSeed;
}

export function createSimulationCount(value: unknown): SimulationCount {
  return boundedInteger(
    value,
    "n_sims",
    SIMULATION_N_SIMS_MIN,
    SIMULATION_N_SIMS_MAX,
  ) as SimulationCount;
}

export function createBacklogSize(value: unknown): BacklogSize {
  return boundedInteger(
    value,
    "backlog_size",
    SIMULATION_BACKLOG_SIZE_MIN,
    SIMULATION_BACKLOG_SIZE_MAX,
  ) as BacklogSize;
}

export function createSimulationHorizon(value: unknown): SimulationHorizon {
  return boundedInteger(
    value,
    "target_weeks",
    SIMULATION_TARGET_WEEKS_MIN,
    SIMULATION_HORIZON_WEEKS_MAX,
  ) as SimulationHorizon;
}

function validateRawThroughput(values: readonly unknown[]): readonly number[] {
  if (
    values.length < SIMULATION_THROUGHPUT_SAMPLES_MIN
    || values.length > SIMULATION_THROUGHPUT_SAMPLES_MAX
  ) {
    throw new Error(
      `throughput_samples doit contenir entre ${String(SIMULATION_THROUGHPUT_SAMPLES_MIN)} et ${String(SIMULATION_THROUGHPUT_SAMPLES_MAX)} valeurs.`,
    );
  }
  return values.map((value) => {
    const resolved = strictInteger(value, "throughput_samples");
    if (resolved < 0) {
      throw new Error("throughput_samples doit contenir uniquement des entiers >= 0.");
    }
    return resolved;
  });
}

export function createThroughputSamples(
  values: readonly unknown[],
  includeZeroWeeks: unknown,
): ThroughputSamples {
  if (typeof includeZeroWeeks !== "boolean") {
    throw new Error("include_zero_weeks doit etre un booleen strict.");
  }
  const rawValues = validateRawThroughput(values);
  const usableValues = includeZeroWeeks
    ? rawValues
    : rawValues.filter((value) => value > 0);
  if (usableValues.length < SIMULATION_THROUGHPUT_SAMPLES_MIN) {
    throw new Error(
      includeZeroWeeks
        ? "Historique insuffisant (moins de 6 semaines)."
        : "Historique insuffisant (moins de 6 semaines non nulles).",
    );
  }
  return Object.freeze({
    rawValues: Object.freeze([...rawValues]),
    usableValues: Object.freeze([...usableValues]),
    includeZeroWeeks,
  }) as ThroughputSamples;
}

function validatePercentileOrder(
  mode: SimulationMode,
  values: SimulationPercentiles,
): void {
  const present = PERCENTILE_KEYS.flatMap((key) => (
    values[key] === undefined ? [] : [values[key]]
  ));
  const isOrdered = present.slice(1).every((value, index) => (
    mode === "backlog_to_weeks"
      ? (present[index] ?? 0) <= value
      : (present[index] ?? 0) >= value
  ));
  if (!isOrdered) {
    const expected = mode === "backlog_to_weeks" ? "croissant" : "decroissant";
    throw new Error(`result_percentiles doit respecter l'ordre ${expected} du mode.`);
  }
}

export function createSimulationPercentiles(
  mode: SimulationMode,
  values: Readonly<Record<string, unknown>>,
): SimulationPercentiles {
  if (mode !== "backlog_to_weeks" && mode !== "weeks_to_items") {
    throw new Error("mode de simulation invalide.");
  }
  const unknownKeys = Object.keys(values).filter(
    (key) => !PERCENTILE_KEYS.includes(key as PercentileKey),
  );
  if (unknownKeys.length > 0) {
    throw new Error("result_percentiles accepte uniquement P50, P70 et P90.");
  }
  const resolved: Partial<Record<PercentileKey, number>> = {};
  PERCENTILE_KEYS.forEach((key) => {
    if (!(key in values)) return;
    const value = strictInteger(values[key], `result_percentiles.${key}`);
    if (value < 0) {
      throw new Error(`result_percentiles.${key} doit etre >= 0.`);
    }
    resolved[key] = value;
  });
  validatePercentileOrder(mode, resolved);
  return Object.freeze(resolved) as SimulationPercentiles;
}

export function riskScoreFromPercentiles(
  mode: SimulationMode,
  percentiles: SimulationPercentiles | null | undefined,
): number | undefined {
  if (!percentiles) return undefined;
  const validated = createSimulationPercentiles(mode, percentiles);
  const p50 = validated.P50;
  const p90 = validated.P90;
  if (p50 === undefined || p90 === undefined || p50 <= 0) return undefined;
  const numerator = mode === "weeks_to_items" ? p50 - p90 : p90 - p50;
  return roundHalfUp(Math.max(0, numerator / p50));
}

function categorizeReliability(
  cv: number,
  iqrRatio: number,
  slopeNorm: number,
  samplesCount: number,
  mean: number,
): ThroughputReliabilityLabel {
  if (samplesCount < 6 || mean <= 0 || cv >= 1.5 || slopeNorm <= -0.15) {
    return "non fiable";
  }
  if (cv >= 1 || iqrRatio >= 1 || Math.abs(slopeNorm) >= 0.1) {
    return "fragile";
  }
  if (cv >= 0.5 || iqrRatio >= 0.5 || Math.abs(slopeNorm) >= 0.05) {
    return "incertain";
  }
  return samplesCount < 8 ? "incertain" : "fiable";
}

type CalculatedReliability = {
  cv: unknown;
  iqrRatio: unknown;
  slopeNorm: unknown;
  samplesCount: unknown;
  mean: unknown;
};

type SerializedReliability = {
  cv: unknown;
  iqrRatio: unknown;
  slopeNorm: unknown;
  samplesCount: unknown;
  label: unknown;
};

export function createThroughputReliability(
  input: CalculatedReliability | SerializedReliability,
): ThroughputReliability {
  const cv = roundHalfUp(finiteMetric(input.cv, "cv"));
  const iqrRatio = roundHalfUp(finiteMetric(input.iqrRatio, "iqrRatio"));
  const slopeNorm = roundHalfUp(finiteMetric(input.slopeNorm, "slopeNorm"));
  if (cv < 0 || iqrRatio < 0) {
    throw new Error("cv et iqrRatio doivent etre >= 0.");
  }
  const samplesCount = strictInteger(input.samplesCount, "samplesCount");
  if (samplesCount < 0) {
    throw new Error("samplesCount doit etre >= 0.");
  }
  let label: ThroughputReliabilityLabel;
  if ("mean" in input) {
    label = categorizeReliability(
      cv,
      iqrRatio,
      slopeNorm,
      samplesCount,
      finiteMetric(input.mean, "mean"),
    );
  } else {
    if (
      typeof input.label !== "string"
      || !RELIABILITY_LABELS.includes(input.label as ThroughputReliabilityLabel)
    ) {
      throw new Error("label de fiabilite invalide.");
    }
    label = input.label as ThroughputReliabilityLabel;
  }
  return Object.freeze({
    cv,
    iqrRatio,
    slopeNorm,
    label,
    samplesCount,
  }) as ThroughputReliability;
}

export function createHistogram(
  buckets: readonly Readonly<{ x: unknown; count: unknown }>[],
  expectedMass: unknown,
): SimulationHistogram {
  const mass = strictInteger(expectedMass, "histogram.expectedMass");
  if (mass < 0) throw new Error("histogram.expectedMass doit etre >= 0.");
  const resolved = buckets.map((bucket) => {
    const x = strictInteger(bucket.x, "histogram.x");
    const count = strictInteger(bucket.count, "histogram.count");
    if (count <= 0) {
      throw new Error("histogram.count doit etre strictement positif.");
    }
    return Object.freeze({ x, count }) as HistogramBucket;
  });
  if (resolved.length > 100) {
    throw new Error("histogram doit contenir au plus 100 buckets.");
  }
  if (resolved.slice(1).some((bucket, index) => (resolved[index]?.x ?? bucket.x) >= bucket.x)) {
    throw new Error("histogram.x doit etre strictement croissant et sans doublon.");
  }
  if (resolved.reduce((sum, bucket) => sum + bucket.count, 0) !== mass) {
    throw new Error("histogram doit conserver sa masse totale.");
  }
  return Object.freeze(resolved) as SimulationHistogram;
}

export function createCompletionSummary(input: {
  completedCount: unknown;
  censoredCount: unknown;
  nSims: SimulationCount;
  horizonWeeks?: unknown;
  censoredRate?: unknown;
}): CompletionSummary {
  const nSims = createSimulationCount(input.nSims);
  const completedCount = strictInteger(input.completedCount, "completedCount");
  const censoredCount = strictInteger(input.censoredCount, "censoredCount");
  if (completedCount < 0 || censoredCount < 0) {
    throw new Error("Les comptes de completion doivent etre >= 0.");
  }
  if (completedCount + censoredCount !== nSims) {
    throw new Error("completedCount + censoredCount doit etre egal a nSims.");
  }
  const horizonWeeks = strictInteger(
    input.horizonWeeks ?? SIMULATION_HORIZON_WEEKS_MAX,
    "horizonWeeks",
  );
  if (horizonWeeks !== SIMULATION_HORIZON_WEEKS_MAX) {
    throw new Error("horizonWeeks doit etre egal a 521 pour le contrat 1.0.");
  }
  const censoredRate = roundHalfUp(censoredCount / nSims);
  if (
    input.censoredRate !== undefined
    && finiteMetric(input.censoredRate, "censoredRate") !== censoredRate
  ) {
    throw new Error("censoredRate doit etre derive des comptes.");
  }
  return Object.freeze({
    completedCount,
    censoredCount,
    censoredRate,
    horizonWeeks,
  }) as CompletionSummary;
}
