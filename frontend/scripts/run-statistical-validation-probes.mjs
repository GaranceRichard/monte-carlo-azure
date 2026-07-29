import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.resolve(frontendRoot, "..");
const probesPath = path.resolve(process.argv[2] ?? path.join(
  repositoryRoot,
  "contracts/statistical-validation-probes-v1.0.json",
));
const probes = JSON.parse(await readFile(probesPath, "utf-8"));
const server = await createServer({
  root: frontendRoot,
  configFile: false,
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});

try {
  const runner = await server.ssrLoadModule("/src/statisticalCorpusRunner.ts");
  const report = runner.runTypeScriptValidationProbes(probes);
  process.stdout.write(`${JSON.stringify(report)}\n`);
} finally {
  await server.close();
}
