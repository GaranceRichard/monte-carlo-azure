# Consolidated test-strategy report

Profile: `pr`
qualityGateStatus: `non_compliant`
strategyEvidenceStatus: `incomplete`

## Global reference

Known logical cases: 1144

## Profile execution

Selected logical cases: 938
Collected instances: 1038
Executed instances: 1038
Attempts: 1038
Retries: 0

## Evidence manifest

| Evidence | Scope | Required | Status | Path |
| --- | --- | :---: | --- | --- |
| `classification-catalog` | `globalReference` | yes | `valid` | `config/test-classification.json` |
| `classification-inventory` | `globalReference` | yes | `valid` | `reports/test-classification-inventory.json` |
| `classification-overrides` | `globalReference` | yes | `valid` | `config/test-classification-overrides.json` |
| `execution-counts` | `globalReference` | yes | `valid` | `reports/test-execution-counts.json` |
| `execution-plan` | `globalReference` | yes | `valid` | `reports/test-execution-plan.json` |
| `execution-profiles` | `globalReference` | yes | `valid` | `config/test-execution-profiles.json` |
| `governance` | `profileExecution` | yes | `valid` | `reports/test-governance-report.json` |
| `node-backend-static` | `profileExecution` | yes | `missing` | `reports/test-execution-artifacts/pr/backend-static/result.json` |
| `node-backend-tests` | `profileExecution` | yes | `valid` | `reports/test-execution-artifacts/pr/backend-tests/result.json` |
| `node-frontend-static` | `profileExecution` | yes | `missing` | `reports/test-execution-artifacts/pr/frontend-static/result.json` |
| `node-frontend-tests` | `profileExecution` | yes | `missing` | `reports/test-execution-artifacts/pr/frontend-tests/result.json` |
| `node-preflight` | `profileExecution` | yes | `valid` | `reports/test-execution-artifacts/pr/preflight/result.json` |
| `runtime-playwright` | `profileExecution` | no | `not_applicable` | `reports/test-execution-native/playwright.json` |
| `runtime-pytest` | `profileExecution` | yes | `valid` | `reports/test-execution-artifacts/pr/backend-tests/pytest.json` |
| `runtime-vitest` | `profileExecution` | yes | `valid` | `reports/test-execution-native/vitest.json` |

## Strategic coverage

| Dimension | Status |
| --- | --- |
| `classification` | `valid` |
| `execution` | `valid` |
| `profiles` | `valid` |
| `governance` | `valid` |
| `coverage` | `not_applicable` |
| `vitals` | `not_applicable` |
| `durations` | `missing` |
| `trends` | `not_measured` |
| `mutation_testing` | `not_measured` |
| `critical_risk_demonstration` | `not_measured` |

## Evidence identity limit

This identifier names the exact evidence bundle; it does not prove that every source came from the same physical execution.

The running `aggregate` node does not require its own final `result.json`; its final success is attested by the quality-gate exit code and CI.
