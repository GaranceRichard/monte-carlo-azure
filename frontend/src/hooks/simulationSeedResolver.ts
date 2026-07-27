import {
  createSimulationSeed,
} from "../domain/simulationValueObjects";
import type {
  SimulationSeed,
} from "../domain/simulationValueObjects";

const CRYPTO_UNAVAILABLE_MESSAGE =
  "Impossible de generer une seed de simulation: crypto.getRandomValues est indisponible.";

export function resolveSimulationSeed(
  requestedSeed?: unknown,
): SimulationSeed {
  if (requestedSeed !== undefined && requestedSeed !== null) {
    return createSimulationSeed(requestedSeed);
  }

  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.getRandomValues !== "function") {
    throw new Error(CRYPTO_UNAVAILABLE_MESSAGE);
  }

  const values = new Uint32Array(1);
  cryptoApi.getRandomValues(values);
  return createSimulationSeed(values[0]);
}
