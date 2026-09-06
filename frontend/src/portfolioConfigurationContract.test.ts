import { describe, expect, it } from "vitest";
import demoDataSource from "./demoData.ts?raw";
import usePortfolioSource from "./hooks/usePortfolio.ts?raw";
import usePortfolioReportSource from "./hooks/usePortfolioReport.ts?raw";

describe("portfolio configuration consumers", () => {
  it("use the application contract without the legacy hook authority", () => {
    expect(demoDataSource).toContain('from "./application/portfolio-forecast"');
    expect(usePortfolioSource).toContain('from "../application/portfolio-forecast"');
    expect(usePortfolioReportSource).toContain('from "../application/portfolio-forecast"');

    expect(demoDataSource).not.toContain("hooks/usePortfolioReport");
    expect(usePortfolioSource).not.toMatch(/TeamPortfolioConfig[^\n]+from\s+["']\.\/usePortfolioReport["']/);
    expect(usePortfolioReportSource).not.toMatch(/export\s+type\s+TeamPortfolioConfig\s*=/);
  });
});
