import { beforeEach, describe, expect, it, vi } from "vitest";

describe("main bootstrap", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("renders the app into #root", async () => {
    document.body.innerHTML = '<div id="root"></div>';
    const render = vi.fn();
    const createRoot = vi.fn(() => ({ render }));

    vi.doMock("react-dom/client", () => ({
      createRoot,
    }));
    vi.doMock("./App", () => ({
      default: () => null,
    }));

    await import("./main");

    expect(createRoot).toHaveBeenCalledWith(document.getElementById("root"));
    expect(render).toHaveBeenCalledTimes(1);
  });

  it("throws when #root is missing", async () => {
    const createRoot = vi.fn();

    vi.doMock("react-dom/client", () => ({
      createRoot,
    }));
    vi.doMock("./App", () => ({
      default: () => null,
    }));

    await expect(import("./main")).rejects.toThrow("Root element #root introuvable.");
    expect(createRoot).not.toHaveBeenCalled();
  });
});
