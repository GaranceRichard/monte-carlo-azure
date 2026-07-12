import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const standardCoverageExclude = [
  "**/*.css",
  "**/*.{test,spec}.{js,jsx,ts,tsx}",
  "tests/**",
  "src/e2e/**",
  "**/*.d.ts",
  "**/generated/**",
  "**/*.generated.{js,jsx,ts,tsx}",
  // Type-only declarations are erased by TypeScript and have no executable coverage.
  "src/types.ts",
  "src/hooks/simulationTypes.ts",
];

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.js",
    pool: "forks",
    fileParallelism: false,
    maxWorkers: 1,
    include: ["src/**/*.{test,spec}.{js,jsx,ts,tsx}"],
    exclude: ["tests/**", "node_modules/**", "dist/**"],
    coverage: {
      include: ["src/**/*.{js,jsx,ts,tsx}"],
      provider: "v8",
      reporter: ["text", "html", "json"],
      reportsDirectory: "./coverage",
      processingConcurrency: 1,
      exclude: standardCoverageExclude,
      thresholds: {
        perFile: true,
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
