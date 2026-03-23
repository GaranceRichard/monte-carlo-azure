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
