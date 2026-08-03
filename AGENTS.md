# AGENTS.md

## Hard rules

1. A task is never done until the canonical **Validation : profil main** is green.
2. **DoD compliance is mandatory.**
3. Never modify quality controls without explicit written justification.
4. Never weaken tests, coverage, lint, CI, hooks, gates, or thresholds to force a green result.
5. Never claim success from partial validation.
6. A task is not publishable until:

   * the worktree is valid;
   * the current branch is identified;
   * `git remote -v` confirms the GitHub remote is present.

## Validation environments

### HOST_ONLY validation

The canonical **Validation : profil main** is `HOST_ONLY`.

It must be executed directly outside the Codex sandbox because it may use:

* full Pytest and coverage;
* full Vitest and coverage;
* Playwright;
* Docker;
* ports and services;
* detached worktrees;
* generated inventories and reports;
* filesystem operations restricted by the sandbox.

For `HOST_ONLY` validation:

1. Never attempt it in the sandbox first.
2. Request host execution immediately.
3. Run the canonical validation command exactly as defined by the repository.
4. Preserve its working directory, environment variables, virtual environment, temporary directories, and command order.
5. Never replace it with a manually reconstructed sequence of Pytest, Vitest, Playwright, reporting, or Docker commands.
6. Never combine results produced by different runs or environments into one verdict.
7. Never rerun an isolated suite merely to erase a failure stored by a previous partial run.
8. If host execution is unavailable, report the canonical command to run and mark the task `Not validated`.

### Sandbox-compatible validation

The sandbox may be used only for small, targeted checks known to work there, such as:

* focused unit tests that require no browser, service, port, Docker, or full coverage;
* lint;
* type checking;
* static checks;
* backlog and documentation consistency checks.

A targeted check does not replace the canonical `HOST_ONLY` validation.

If a targeted command encounters a sandbox permission or infrastructure restriction:

* stop it immediately;
* do not retry an equivalent command in the sandbox;
* do not diagnose it as a product regression;
* do not modify the product or tests to accommodate the sandbox;
* wait for the canonical host validation instead of improvising an external partial test chain.

## Canonical validation

For the final verdict, execute only the repository’s canonical **Validation : profil main** workflow.

Do not directly orchestrate a replacement sequence such as:

```powershell
python -m pytest
npm run test
npm run test:e2e
python Scripts/report_test_execution_counts.py
python Scripts/check_test_classification.py
```

Those commands may be internal steps of the canonical workflow, but Codex must not assemble or reorder them manually.

Before execution:

1. resolve the repository root;
2. run from that root;
3. use the repository virtual environment;
4. preserve the environment and temporary-directory configuration defined by the canonical workflow.

If the canonical workflow fails:

1. identify the first real failure;
2. distinguish a product failure from an infrastructure failure;
3. correct only the demonstrated cause;
4. rerun the complete canonical workflow;
5. never manufacture a green verdict from several partial runs.

## Mandatory workflow

For every task:

1. Read the impacted files.
2. Implement the smallest coherent change.
3. Run any useful targeted sandbox-compatible checks.
4. Run **Validation : profil main** directly outside the sandbox.
5. Fix real failures and rerun the canonical validation until green.
6. Check publication safety:

   * valid Git worktree;
   * current branch identified;
   * GitHub remote present.
7. Report explicit final status.

## Known validation memory

* A red uncovered line is invalid even when global coverage thresholds remain green.
* Frontend Vitest coverage may fail inside the sandbox with errors such as:

  * `Cannot read directory "../../../..": Access is denied.`
  * `Could not resolve ... vitest.config.js`.
* These failures confirm that full frontend validation is `HOST_ONLY`; they must not trigger another sandbox attempt.
* On Windows, an `ENOENT` affecting `frontend\coverage\.tmp\coverage-*.json` after successful Vitest tests is a coverage aggregation instability, not automatically a test regression.
* Preserve the stable repository configuration:

  * `pool: "forks"`;
  * `coverage.processingConcurrency: 1`.
* Do not use the system Pytest temporary directory when the canonical workflow provides or requires a repository-local temporary directory.
* Never launch a standalone host Pytest run without the same context used by the canonical validation.

## Execution discipline

* Do not leave a known sandbox-incompatible command running.
* Do not repeatedly announce that a test run is still active.
* Do not infer success from the absence of error output.
* Do not start another validation while one is still running.
* Do not execute the same suite repeatedly in different environments.
* Do not create a new test orchestration when a canonical one already exists.
* Preserve one run, one environment, one report, and one verdict.

## Forbidden behaviors

* No sandbox attempt for `HOST_ONLY` validation.
* No skipped validation presented as complete.
* No silent quality degradation.
* No lowering thresholds.
* No disabling tests.
* No retries or exemptions added to force success.
* No manual consolidation of unrelated partial runs.
* No `done` while any required terminal is red.
* No `publishable` when the GitHub remote is missing.

## Final reporting format

Always state:

* what changed;
* which targeted checks were executed;
* the exact canonical validation executed;
* whether it ran outside the sandbox;
* whether the full gate is green;
* whether DoD is met;
* whether the task is publishable;
* any remaining blockers.

Use these exact statuses:

```text
Implemented: yes / no
Validated: yes / no
Full main gate: green / red / not executed
Execution environment: host / sandbox / mixed-invalid
DoD compliant: yes / no
Publishable: yes / no
```

A validation using a mixture of partial sandbox and host results must be reported as:

```text
Validated: no
Execution environment: mixed-invalid
```
