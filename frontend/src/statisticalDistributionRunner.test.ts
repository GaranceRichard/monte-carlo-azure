import { describe, expect, it } from "vitest";

import {
  runTypeScriptDistributionPlan,
  type DistributionExecutionPlan,
} from "./statisticalDistributionRunner";

const plan: DistributionExecutionPlan = {
  proof_kind: "distributional_parity",
  protocol_version: "1.0",
  cohort_id: "cohort-b",
  corpus_id: "mca-statistical-reference-corpus",
  schema_version: "1.0",
  normative_contract: { id: "STD-STAT-001", version: "1.0" },
  prng_contract: { id: "mca-prng-v1" },
  cases: [
    {
      id: "items-discrete-exact:0",
      input: {
        throughput_samples: [1, 1, 1, 1, 1, 1],
        include_zero_weeks: false,
        mode: "weeks_to_items",
        target_weeks: 1,
        n_sims: 1000,
      },
      seed: 123,
    },
  ],
};

describe("distributional TypeScript runner", () => {
  it("executes a validated multi-seed plan without using expected corpus results", () => {
    const report = runTypeScriptDistributionPlan(plan);

    expect(report).toMatchObject({
      engine: "typescript",
      proof_kind: "distributional_parity",
      protocol_version: "1.0",
      cohort_id: "cohort-b",
      status: "completed",
    });
    expect((report.cases as { id: string }[]).map((entry) => entry.id)).toEqual([
      "items-discrete-exact:0",
    ]);
  });

  it("rejects an incompatible plan before engine execution", () => {
    expect(() => runTypeScriptDistributionPlan({
      ...plan,
      protocol_version: "2.0",
    } as unknown as DistributionExecutionPlan)).toThrow("plan distributionnel est incompatible");
  });
});
