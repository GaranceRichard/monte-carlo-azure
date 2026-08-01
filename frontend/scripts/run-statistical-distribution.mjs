import process from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let input = "";
for await (const chunk of process.stdin) {
  input += chunk;
}
const plan = JSON.parse(input);
const server = await createServer({
  root: frontendRoot,
  configFile: false,
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});

try {
  const runner = await server.ssrLoadModule("/src/statisticalDistributionRunner.ts");
  process.stdout.write(`${JSON.stringify(runner.runTypeScriptDistributionPlan(plan))}\n`);
} finally {
  await server.close();
}
