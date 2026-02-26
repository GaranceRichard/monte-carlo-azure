import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ProgressBar from "./progress";

describe("ProgressBar", () => {
  it("renders indicator transform from value", () => {
    const { container } = render(<ProgressBar value={75} />);
    const indicator = container.querySelector("[style*='translateX']");
    expect(indicator).not.toBeNull();
    expect(indicator?.getAttribute("style")).toContain("translateX(-25%)");
  });
});
