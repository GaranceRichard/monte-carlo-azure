import { env } from "node:process";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const vitalsCoverage = env.VITALS_FRONTEND_COVERAGE === "1";
const standardCoverageExclude = [
  "**/*.css",
  "src/adoClient.ts",
  "src/api.ts",
  "src/date.ts",
  "src/components/steps/PortfolioStep.tsx",
  "src/components/steps/portfolioPrintReport.ts",
  "src/components/steps/simulationPdfDownload.ts",
  "src/components/steps/simulationPrintReport.tsx",
];
const vitalsCoverageInclude = [
  "src/App.tsx",
  "src/clientId.ts",
  "src/hooks/useOnboarding.ts",
  "src/hooks/simulationForecastService.ts",
  "src/components/steps/portfolioPrintReport.ts",
  "src/components/steps/simulationPdfDownload.ts",
  "src/components/steps/simulationPrintReport.tsx",
];

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.js",
    pool: "threads",
    fileParallelism: false,
    maxWorkers: 1,
    include: ["src/**/*.{test,spec}.{js,jsx,ts,tsx}"],
    exclude: ["tests/**", "node_modules/**", "dist/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json"],
      reportsDirectory: vitalsCoverage ? "./coverage-vitals" : "./coverage",
      all: vitalsCoverage,
      include: vitalsCoverage ? vitalsCoverageInclude : undefined,
      exclude: vitalsCoverage ? ["**/*.css", "src/adoClient.ts", "src/api.ts", "src/date.ts"] : standardCoverageExclude,
      perFile: true,
      thresholds: vitalsCoverage
        ? undefined
        : {
            statements: 80,
            branches: 80,
            functions: 80,
            lines: 80,
          },
    },
  },
});
