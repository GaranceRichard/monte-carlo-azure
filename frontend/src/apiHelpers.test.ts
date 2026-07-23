import { describe, expect, it, vi } from "vitest";
import { getApiBase, readJsonOr, toApiErrorMessage } from "./apiHelpers";

describe("api helpers", () => {
  it("uses the configured API base", () => {
    expect(getApiBase()).toBe(import.meta.env.VITE_API_BASE ?? "");
  });

  it("reads JSON and falls back when the response body is invalid", async () => {
    await expect(readJsonOr({ json: vi.fn().mockResolvedValue({ ok: true }) } as unknown as Response, {})).resolves.toEqual({ ok: true });
    await expect(readJsonOr({ json: vi.fn().mockRejectedValue(new Error("invalid JSON")) } as unknown as Response, { fallback: true })).resolves.toEqual({ fallback: true });
  });

  it("prefers the API error detail and otherwise uses the HTTP status", () => {
    expect(toApiErrorMessage(422, { detail: "Parametre invalide" })).toBe("Parametre invalide");
    expect(toApiErrorMessage(503, {})).toBe("HTTP 503");
  });
});
