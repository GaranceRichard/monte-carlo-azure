import { afterEach, describe, expect, it } from "vitest";

type MutableImportMetaEnv = {
  VITE_GITHUB_PAGES?: string | boolean;
};

describe("resolveAppRuntime", () => {
  const env = import.meta.env as MutableImportMetaEnv;
  const originalGithubPages = env.VITE_GITHUB_PAGES;

  afterEach(() => {
    env.VITE_GITHUB_PAGES = originalGithubPages;
  });

  it("defaults to standard mode when pages flag is disabled", async () => {
    env.VITE_GITHUB_PAGES = false;
    const { resolveAppRuntime } = await import("./runtime");

    expect(resolveAppRuntime("")).toEqual({
      isPagesBuild: false,
      mode: "standard",
      isDemoMode: false,
      isConnectInfoMode: false,
    });
  });

  it("resolves demo mode ahead of pages landing/connect modes", async () => {
    env.VITE_GITHUB_PAGES = "true";
    const { resolveAppRuntime } = await import("./runtime");

    expect(resolveAppRuntime("?demo=true&connect=true")).toEqual({
      isPagesBuild: true,
      mode: "demo",
      isDemoMode: true,
      isConnectInfoMode: false,
    });
  });

  it("resolves connect mode on pages builds", async () => {
    env.VITE_GITHUB_PAGES = true;
    const { resolveAppRuntime } = await import("./runtime");

    expect(resolveAppRuntime("?connect=true")).toEqual({
      isPagesBuild: true,
      mode: "connect",
      isDemoMode: false,
      isConnectInfoMode: true,
    });
  });

  it("resolves demo mode on pages builds without query flags", async () => {
    env.VITE_GITHUB_PAGES = "true";
    const { resolveAppRuntime } = await import("./runtime");

    expect(resolveAppRuntime("")).toEqual({
      isPagesBuild: true,
      mode: "demo",
      isDemoMode: true,
      isConnectInfoMode: false,
    });
  });
});
