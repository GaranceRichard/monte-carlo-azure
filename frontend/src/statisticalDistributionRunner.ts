import {
  runTypeScriptCorpus,
  type StatisticalCorpus,
} from "./statisticalCorpusRunner";

export type DistributionExecutionPlan = StatisticalCorpus & {
  proof_kind: "distributional_parity";
  protocol_version: "1.0";
  cohort_id: string;
};

export function runTypeScriptDistributionPlan(
  plan: DistributionExecutionPlan,
): Record<string, unknown> {
  if (plan.proof_kind !== "distributional_parity" || plan.protocol_version !== "1.0") {
    throw new Error("Le plan distributionnel est incompatible.");
  }
  return {
    ...runTypeScriptCorpus(plan, []),
    proof_kind: plan.proof_kind,
    protocol_version: plan.protocol_version,
    cohort_id: plan.cohort_id,
  };
}
