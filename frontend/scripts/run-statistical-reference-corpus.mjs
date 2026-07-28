import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.resolve(frontendRoot, "..");
const corpusPath = path.resolve(process.argv[2] ?? path.join(
  repositoryRoot,
  "contracts/statistical-reference-corpus-v1.0.json",
));
const repositoryPython = process.platform === "win32"
  ? path.join(repositoryRoot, ".venv", "Scripts", "python.exe")
  : path.join(repositoryRoot, ".venv", "bin", "python");
const pythonExecutable = process.env.MCA_CORPUS_PYTHON
  ?? (existsSync(repositoryPython) ? repositoryPython : "python");
const validation = spawnSync(
  pythonExecutable,
  ["Scripts/validate_statistical_reference_corpus.py", corpusPath],
  {
    cwd: repositoryRoot,
    encoding: "utf-8",
    windowsHide: true,
  },
);

if (validation.error) {
  process.stderr.write(`Unable to validate the corpus: ${validation.error.message}\n`);
  process.exit(1);
}
if (validation.status !== 0) {
  process.stderr.write(validation.stderr || "Statistical corpus validation failed.\n");
  process.exit(1);
}

const corpus = JSON.parse(await readFile(corpusPath, "utf-8"));
const server = await createServer({
  root: frontendRoot,
  configFile: false,
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});

try {
  const runner = await server.ssrLoadModule("/src/statisticalCorpusRunner.ts");
  const report = runner.runTypeScriptCorpus(corpus, []);
  process.stdout.write(`${JSON.stringify(report)}\n`);
} finally {
  await server.close();
}
