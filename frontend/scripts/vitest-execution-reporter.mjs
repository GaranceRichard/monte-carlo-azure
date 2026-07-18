import { experimental_getRunnerTask } from "vitest/node";
import {
  loadPositionInventory,
  matchPosition,
  repositoryPath,
  writeNative,
} from "./test-execution-inventory.mjs";

export default class VitestExecutionReporter {
  constructor() {
    this.inventory = null;
    this.instances = new Map();
    this.started = new Set();
    this.anomalies = [];
  }

  onInit() {
    try {
      this.inventory = loadPositionInventory("vitest");
    } catch (error) {
      this.anomalies.push(`vitest inventory unavailable: ${error.message}`);
    }
  }

  onTestModuleCollected(testModule) {
    if (!this.inventory) return;
    let sourcePath;
    try {
      sourcePath = repositoryPath(testModule.moduleId);
    } catch (error) {
      this.anomalies.push(error.message);
      return;
    }
    for (const testCase of testModule.children.allTests()) {
      const instanceId = `${testCase.project.name || "default"}:${testCase.id}`;
      const matched = matchPosition(
        this.inventory,
        sourcePath,
        testCase.location,
        instanceId,
        "vitest",
      );
      if (matched.anomaly) {
        this.anomalies.push(matched.anomaly);
        continue;
      }
      if (this.instances.has(instanceId)) {
        this.anomalies.push(`duplicate vitest instance: ${instanceId}`);
        continue;
      }
      this.instances.set(instanceId, {
        instanceId,
        logicalCaseId: matched.logicalCaseId,
        sourcePath,
        declaration: testCase.location,
        testCase,
      });
    }
  }

  onTestCaseReady(testCase) {
    this.started.add(`${testCase.project.name || "default"}:${testCase.id}`);
  }

  onTestCaseResult(testCase) {
    const instanceId = `${testCase.project.name || "default"}:${testCase.id}`;
    const instance = this.instances.get(instanceId);
    if (instance) instance.testCase = testCase;
  }

  onTestRunEnd(_modules, unhandledErrors) {
    if (unhandledErrors.length) {
      this.anomalies.push(`vitest reported ${unhandledErrors.length} unattached error(s)`);
    }
    const instances = [...this.instances.values()]
      .map(({ testCase, ...identity }) => {
        const result = testCase.result();
        const runnerTask = experimental_getRunnerTask(testCase);
        const executed = this.started.has(identity.instanceId) || result.state !== "skipped";
        const retryCount = runnerTask.result?.retryCount ?? 0;
        const hookFailure = Object.values(runnerTask.result?.hooks ?? {}).includes("fail");
        let outcome = result.state;
        if (result.state === "skipped" && testCase.options.mode === "todo") outcome = "todo";
        else if (result.state === "failed" && hookFailure) outcome = "infrastructureError";
        else if (result.state === "pending") outcome = "infrastructureError";
        return {
          ...identity,
          executed,
          attempts: executed ? 1 + retryCount : 0,
          result: outcome,
        };
      })
      .sort((left, right) => left.instanceId.localeCompare(right.instanceId, "en"));
    const matched = new Set(instances.map((instance) => instance.logicalCaseId));
    const missing = this.inventory ? [...this.inventory.ids].filter((id) => !matched.has(id)) : [];
    writeNative("vitest", {
      schemaVersion: 1,
      framework: "vitest",
      complete: Boolean(this.inventory) && this.anomalies.length === 0 && missing.length === 0,
      instances,
      anomalies: [...new Set(this.anomalies)].sort(),
    });
  }
}
