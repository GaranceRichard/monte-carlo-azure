import { afterEach, describe, expect, it, vi } from "vitest";
import domainSource from "../domain/simulation.ts?raw";
import engineSource from "../utils/simulation.ts?raw";
import resolverSource from "./simulationSeedResolver.ts?raw";
import {
  SIMULATION_SEED_MAX,
} from "../domain/simulationValueObjects";
import { resolveSimulationSeed } from "./simulationSeedResolver";

const originalCrypto = globalThis.crypto;

function setCrypto(value: Crypto | undefined): void {
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value,
  });
}

afterEach(() => {
  setCrypto(originalCrypto);
  vi.restoreAllMocks();
});

describe("resolveSimulationSeed", () => {
  it.each([0, SIMULATION_SEED_MAX])(
    "preserves the explicit uint32 boundary %s without generation",
    (seed) => {
      const getRandomValues = vi.fn();
      setCrypto({ getRandomValues } as unknown as Crypto);

      expect(resolveSimulationSeed(seed)).toBe(seed);
      expect(getRandomValues).not.toHaveBeenCalled();
    },
  );

  it("uses crypto.getRandomValues exactly once and validates the generated value", () => {
    const getRandomValues = vi.fn((values: Uint32Array) => {
      values[0] = SIMULATION_SEED_MAX;
      return values;
    });
    setCrypto({ getRandomValues } as unknown as Crypto);

    const seed = resolveSimulationSeed();

    expect(seed).toBe(SIMULATION_SEED_MAX);
    expect(getRandomValues).toHaveBeenCalledOnce();
    expect(getRandomValues.mock.calls[0]?.[0]).toBeInstanceOf(Uint32Array);
  });

  it("fails explicitly when the cryptographic API is unavailable", () => {
    setCrypto(undefined);

    expect(() => resolveSimulationSeed()).toThrow(
      "crypto.getRandomValues est indisponible",
    );
  });

  it("rejects an invalid explicit seed without consulting crypto", () => {
    const getRandomValues = vi.fn();
    setCrypto({ getRandomValues } as unknown as Crypto);

    expect(() => resolveSimulationSeed(1.5)).toThrow("entier strict");
    expect(getRandomValues).not.toHaveBeenCalled();
  });

  it("keeps generation and normalization out of commands and statistical engines", () => {
    expect(domainSource).not.toContain("createSimulationSeed");
    expect(engineSource).not.toContain("generateSimulationSeed");
    expect(engineSource).not.toContain("getRandomValues");
    expect(engineSource).not.toContain("Date.now");
    expect(resolverSource).not.toContain("Date.now");
    expect(resolverSource).not.toContain(">>>");
    expect(resolverSource).not.toContain("Math.floor");
    expect(resolverSource).not.toContain("Math.trunc");
    expect(resolverSource).not.toMatch(/%\s*(?:4294967296|0x100000000)/);
  });
});
