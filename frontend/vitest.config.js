import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.js",
    include: ["src/**/*.{test,spec}.{js,jsx,ts,tsx}"],
    exclude: ["tests/**", "node_modules/**", "dist/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      reportsDirectory: "./coverage",
      all: false,
      exclude: [
        "**/*.css",
        "src/adoClient.ts",
        "src/api.ts",
        "src/date.ts",
        "src/components/steps/PortfolioStep.tsx",
        "src/components/steps/portfolioPrintReport.ts",
        "src/components/steps/simulationPdfDownload.ts",
        "src/components/steps/simulationPrintReport.tsx",
      ],
      perFile: true,
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
