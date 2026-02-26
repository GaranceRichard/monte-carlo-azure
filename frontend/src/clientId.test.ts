import { afterEach, describe, expect, it, vi } from "vitest";
import { ensureMontecarloClientCookie } from "./clientId";

describe("ensureMontecarloClientCookie", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a UUID cookie on first call", () => {
    document.cookie = "IDMontecarlo=; Max-Age=0; Path=/";
    const id = ensureMontecarloClientCookie();
    expect(id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(document.cookie).toContain("IDMontecarlo=");
  });

  it("keeps existing valid UUID cookie", () => {
    document.cookie = "IDMontecarlo=123e4567-e89b-42d3-a456-426614174000; Path=/";
    const id = ensureMontecarloClientCookie();
    expect(id).toBe("123e4567-e89b-42d3-a456-426614174000");
  });

  it("falls back to Math.random when crypto.randomUUID is unavailable", () => {
    document.cookie = "IDMontecarlo=; Max-Age=0; Path=/";
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    const originalCrypto = globalThis.crypto;
    Object.defineProperty(globalThis, "crypto", {
      value: undefined,
      configurable: true,
    });
    try {
      const id = ensureMontecarloClientCookie();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/i);
    } finally {
      Object.defineProperty(globalThis, "crypto", {
        value: originalCrypto,
        configurable: true,
      });
    }
  });
});
