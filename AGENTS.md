# AGENTS.md

## Hard rules

1. A task is never done until the full **Coverage 8 terminaux** task is green.
2. **DoD compliance is mandatory**.
3. **No modification of quality controls** without explicit written justification.
4. A task is never considered **publishable** until `git remote -v` confirms the GitHub remote is present.
5. Never claim success on partial validation.
6. Never weaken tests, coverage, lint, CI, hooks, or gates to force green status.

## Mandatory workflow

For every task:
1. Read impacted files first.
2. Implement the smallest coherent change.
3. Run the full **Coverage 8 terminaux** task.
4. Fix failures and rerun until fully green.
5. Check publication safety:
   - valid git worktree
   - current branch identified
   - `git remote -v` shows the GitHub remote
6. Report with explicit status:
   - Implemented / Not implemented
   - Validated / Not validated
   - DoD compliant / Not DoD compliant
   - Publishable / Not publishable

## Known validation memory

- In this repo, a red uncovered line in a coverage report is considered invalid and must be covered before the task is acceptable, even if global thresholds are green.
- In this local Codex environment, frontend Vitest coverage can fail inside the sandbox with `esbuild` errors like `Cannot read directory "../../../..": Access is denied.` or `Could not resolve ... vitest.config.js`.
- When that exact sandbox-only failure appears, do not re-diagnose the frontend code or relax the gate: rerun the same validation outside the sandbox and continue from the real result.
- Frontend Vitest coverage on Windows must stay on a stable execution path. If `vitest run --coverage` passes all tests and then crashes with `ENOENT ... frontend\\coverage\\.tmp\\coverage-*.json`, treat it as a coverage aggregation instability, not a test failure regression.
- Preserve the stable fix for this repo: `frontend/vitest.config.js` uses `pool: "forks"` and `coverage.processingConcurrency: 1` to avoid losing temporary V8 coverage files during report generation.

## Forbidden behaviors

- No skipped validation presented as complete.
- No silent quality degradation.
- No lowering thresholds to avoid fixing code.
- No disabling tests to pass CI.
- No “done” if one terminal is red.
- No “publishable” if GitHub remote is missing.

## Final reporting format

Always state:
- what changed,
- what was tested,
- whether full gate is green,
- whether DoD is met,
- whether the task is publishable,
- remaining blockers if any.
