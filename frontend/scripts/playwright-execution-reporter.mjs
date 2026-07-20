import {
  loadPositionInventory,
  matchPosition,
  repositoryPath,
  writeNative,
} from "./test-execution-inventory.mjs";

export default class PlaywrightExecutionReporter {
  constructor() {
    this.inventory = null;
    this.instances = new Map();
    this.anomalies = [];
  }

  onBegin(_config, suite) {
    try {
      this.inventory = loadPositionInventory("playwright");
    } catch (error) {
      this.anomalies.push(`playwright inventory unavailable: ${error.message}`);
      return;
    }
    for (const testCase of suite.allTests()) {
      let sourcePath;
      try {
        sourcePath = repositoryPath(testCase.location.file);
      } catch (error) {
        this.anomalies.push(error.message);
        continue;
      }
      const project = testCase.parent.project()?.name ?? "";
      const instanceId = `${project || "default"}:${testCase.id}`;
      const matched = matchPosition(
        this.inventory,
        sourcePath,
        testCase.location,
        instanceId,
        "playwright",
      );
      if (matched.anomaly) {
        this.anomalies.push(matched.anomaly);
        continue;
      }
      if (this.instances.has(instanceId)) {
        this.anomalies.push(`duplicate playwright instance: ${instanceId}`);
        continue;
      }
      this.instances.set(instanceId, {
        instanceId,
        logicalCaseId: matched.logicalCaseId,
        sourcePath,
        declaration: {
          line: testCase.location.line,
          column: testCase.location.column,
        },
        results: [],
      });
    }
  }

  onTestEnd(testCase, result) {
    const project = testCase.parent.project()?.name ?? "";
    const instance = this.instances.get(`${project || "default"}:${testCase.id}`);
    if (instance) instance.results.push(result.status);
  }

  onError() {
    this.anomalies.push("playwright reported an unattached infrastructure error");
  }

  onEnd() {
    const instances = [...this.instances.values()]
      .map(({ results, ...identity }) => {
        const normalized = (status) =>
          status === "timedOut" || status === "interrupted" ? "infrastructureError" : status;
        const attemptResults = results
          .filter((status) => status !== "skipped")
          .map(normalized);
        const attempts = attemptResults.length;
        const finalStatus = results.at(-1) ?? "interrupted";
        const observedFinal = normalized(finalStatus);
        const result = attemptResults.at(-1) ?? observedFinal;
        return {
          ...identity,
          executed: attempts > 0,
          attempts,
          attemptResults,
          initialResult: attemptResults.at(0) ?? result,
          finalResult: result,
          result,
        };
      })
      .sort((left, right) => left.instanceId.localeCompare(right.instanceId, "en"));
    const matched = new Set(instances.map((instance) => instance.logicalCaseId));
    const missing = this.inventory ? [...this.inventory.ids].filter((id) => !matched.has(id)) : [];
    writeNative("playwright", {
      schemaVersion: 1,
      framework: "playwright",
      complete: Boolean(this.inventory) && this.anomalies.length === 0 && missing.length === 0,
      instances,
      anomalies: [...new Set(this.anomalies)].sort(),
    });
  }
}
