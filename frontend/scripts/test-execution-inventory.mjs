import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

export const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const repositoryRoot = path.resolve(frontendRoot, "..");

function normalizedRelative(absolute) {
  return path.relative(repositoryRoot, path.resolve(absolute)).replaceAll(path.sep, "/");
}

export function loadPositionInventory(framework) {
  const inventoryPath = path.join(repositoryRoot, "reports", "test-classification-inventory.json");
  const inventory = JSON.parse(fs.readFileSync(inventoryPath, "utf8"));
  const profile = process.env.TEST_EXECUTION_PROFILE;
  let includedProfiles = null;
  if (profile) {
    const contractPath = path.join(repositoryRoot, "config", "test-execution-profiles.json");
    const contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));
    const entry = contract.profiles.find((item) => item.id === profile);
    if (!entry) throw new Error(`Unknown execution profile: ${profile}`);
    includedProfiles = new Set(entry.includes);
  }
  const ids = new Set();
  const positions = new Map();
  for (const record of inventory) {
    if (record.framework !== framework) continue;
    if (includedProfiles && !includedProfiles.has(record.executionProfile)) continue;
    ids.add(record.logicalCaseId);
    const match = record.selector.match(/ \[(\d+):(\d+)\]$/);
    if (!match) throw new Error(`Missing declaration position for ${record.logicalCaseId}`);
    const key = `${record.sourcePath}\0${match[1]}\0${match[2]}`;
    const matches = positions.get(key) ?? [];
    matches.push(record.logicalCaseId);
    positions.set(key, matches);
  }
  return { ids, positions };
}

export function matchPosition(inventory, sourcePath, location, instanceId, framework) {
  if (!location || !Number.isInteger(location.line) || !Number.isInteger(location.column)) {
    return { anomaly: `${framework} instance has no declaration position: ${instanceId}` };
  }
  const key = `${sourcePath}\0${location.line}\0${location.column}`;
  const matches = inventory.positions.get(key) ?? [];
  if (matches.length !== 1) {
    const state = matches.length === 0 ? "orphan" : "ambiguous";
    return {
      anomaly: `${state} ${framework} instance ${instanceId} at ${sourcePath}:${location.line}:${location.column}`,
    };
  }
  return { logicalCaseId: matches[0] };
}

export function repositoryPath(absolute) {
  const relative = normalizedRelative(absolute);
  if (relative === ".." || relative.startsWith("../")) {
    throw new Error(`Path is outside repository: ${absolute}`);
  }
  return relative;
}

export function writeNative(framework, payload) {
  const reportRoot = process.env.TEST_EXECUTION_NATIVE_DIR
    ? path.resolve(process.env.TEST_EXECUTION_NATIVE_DIR)
    : path.join(repositoryRoot, "reports", "test-execution-native");
  const destination = path.join(reportRoot, `${framework}.json`);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}
