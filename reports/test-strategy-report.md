# Consolidated test-strategy report

Profile: `main`
qualityGateStatus: `compliant`
strategyEvidenceStatus: `incomplete`

## Global reference

Known logical cases: 1122

## Profile execution

Selected logical cases: 1119
Collected instances: 1235
Executed instances: 1235
Attempts: 1235
Retries: 0

## Evidence manifest

| Evidence | Scope | Required | Status | Path |
| --- | --- | :---: | --- | --- |
| `classification-catalog` | `globalReference` | yes | `valid` | `config/test-classification.json` |
| `classification-inventory` | `globalReference` | yes | `valid` | `reports/test-classification-inventory.json` |
| `classification-overrides` | `globalReference` | yes | `valid` | `config/test-classification-overrides.json` |
| `coverage-e2e` | `profileExecution` | yes | `valid` | `frontend/coverage/e2e-coverage-summary.json` |
| `coverage-python` | `profileExecution` | yes | `valid` | `.coverage.python.json` |
| `coverage-vitals` | `profileExecution` | yes | `valid` | `frontend/coverage/vitals-coverage-report.json` |
| `coverage-vitest` | `profileExecution` | yes | `valid` | `frontend/coverage/coverage-final.json` |
| `execution-counts` | `globalReference` | yes | `valid` | `reports/test-execution-counts.json` |
| `execution-plan` | `globalReference` | yes | `valid` | `reports/test-execution-plan.json` |
| `execution-profiles` | `globalReference` | yes | `valid` | `config/test-execution-profiles.json` |
| `governance` | `profileExecution` | yes | `valid` | `reports/test-governance-report.json` |
| `node-backend-static` | `profileExecution` | yes | `valid` | `reports/test-execution-artifacts/main/backend-static/result.json` |
| `node-backend-tests` | `profileExecution` | yes | `valid` | `reports/test-execution-artifacts/main/backend-tests/result.json` |
| `node-e2e` | `profileExecution` | yes | `valid` | `reports/test-execution-artifacts/main/e2e/result.json` |
| `node-frontend-static` | `profileExecution` | yes | `valid` | `reports/test-execution-artifacts/main/frontend-static/result.json` |
| `node-frontend-tests` | `profileExecution` | yes | `valid` | `reports/test-execution-artifacts/main/frontend-tests/result.json` |
| `node-preflight` | `profileExecution` | yes | `valid` | `reports/test-execution-artifacts/main/preflight/result.json` |
| `node-release-or-container-checks` | `profileExecution` | yes | `valid` | `reports/test-execution-artifacts/main/release-or-container-checks/result.json` |
| `runtime-playwright` | `profileExecution` | yes | `valid` | `reports/test-execution-artifacts/main/e2e/playwright.json` |
| `runtime-pytest` | `profileExecution` | yes | `valid` | `reports/test-execution-artifacts/main/backend-tests/pytest.json` |
| `runtime-vitest` | `profileExecution` | yes | `valid` | `reports/test-execution-artifacts/main/frontend-tests/vitest.json` |

## Strategic coverage

| Dimension | Status |
| --- | --- |
| `classification` | `valid` |
| `execution` | `valid` |
| `profiles` | `valid` |
| `governance` | `valid` |
| `coverage` | `valid` |
| `vitals` | `valid` |
| `durations` | `valid` |
| `trends` | `not_measured` |
| `mutation_testing` | `not_measured` |
| `critical_risk_demonstration` | `not_measured` |

## Evidence identity limit

This identifier names the exact evidence bundle; it does not prove that every source came from the same physical execution.

The running `aggregate` node does not require its own final `result.json`; its final success is attested by the quality-gate exit code and CI.
