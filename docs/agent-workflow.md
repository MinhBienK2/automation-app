# Agent Workflow

## Standard Loop

1. Read `docs/README.md`.
2. Read `docs/task-routes.md`.
3. Pick the matching route or routes.
4. For broad or unclear work, read the product/planning route first, then choose the implementation route.
5. Read only the docs listed by the selected routes.
6. Inspect the current source files listed by the route.
7. Use `.agents/skills/test-driven-development` before behavior-changing code.
8. Implement the smallest scoped change.
9. Run focused checks first, then broader checks when the touched area requires it.
10. Update `docs/` when behavior, contracts, routes, ownership, or verification changed.
11. Before final response, confirm docs and code agree for the touched area.

## Final Response Checklist

For code changes, include:

- Tests/checks run.
- Whether `docs/` was updated.
- If `docs/` was not updated, why the touched behavior/contracts did not require it.

For docs-only changes, mention that TDD was skipped because no runtime behavior changed.

## Conflict Rule

If source code and docs disagree:

- Code is the immediate implementation reality.
- Docs must be corrected for the touched area in the same task.
- Do not leave docs known-stale after changing code.
