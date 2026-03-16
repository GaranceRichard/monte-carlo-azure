import { afterEach, describe, expect, it } from "vitest";

describe("resolveAppRuntime", () => {
  const originalGithubPages = import.meta.env.GITHUB_PAGES;

  afterEach(() => {
    import.meta.env.GITHUB_PAGES = originalGithubPages;
  });

  it("defaults to standard mode when pages flag is disabled", async () => {
    import.meta.env.GITHUB_PAGES = false;
    const { resolveAppRuntime } = await import("./runtime");

    expect(resolveAppRuntime("")).toEqual({
      isPagesBuild: false,
      mode: "standard",
      isDemoMode: false,
      isConnectInfoMode: false,
    });
  });

  it("resolves demo mode ahead of pages landing/connect modes", async () => {
    import.meta.env.GITHUB_PAGES = "true";
    const { resolveAppRuntime } = await import("./runtime");

    expect(resolveAppRuntime("?demo=true&connect=true")).toEqual({
      isPagesBuild: true,
      mode: "demo",
      isDemoMode: true,
      isConnectInfoMode: false,
    });
  });

  it("resolves connect mode on pages builds", async () => {
    import.meta.env.GITHUB_PAGES = true;
    const { resolveAppRuntime } = await import("./runtime");

    expect(resolveAppRuntime("?connect=true")).toEqual({
      isPagesBuild: true,
      mode: "connect",
      isDemoMode: false,
      isConnectInfoMode: true,
    });
  });

  it("resolves demo mode on pages builds without query flags", async () => {
    import.meta.env.GITHUB_PAGES = "true";
    const { resolveAppRuntime } = await import("./runtime");

    expect(resolveAppRuntime("")).toEqual({
      isPagesBuild: true,
      mode: "demo",
      isDemoMode: true,
      isConnectInfoMode: false,
    });
  });
});
