# Agent Docs

This directory is for coding agents working in this repository.

## Source Of Truth

- Current code and `docs/` must agree for every touched area.
- `AGENTS.md` defines mandatory agent rules. This file defines the execution workflow.
- `DESIGN.md` is mandatory for layout, styling, and user-facing UI changes.
- `docs/superpowers/` is a historical planning archive. Do not use it as current truth.

## Task Workflow

Follow this workflow once per task. Do not restart the workflow unless new information changes the task scope.

1. Run `node scripts/agent/agent-router.mjs --diff` (or `--file <path>` / `--query <text>`) to automatically identify the matching route, documentation to read, and unit tests to run.
2. Read only the documentation files output by the router. For broad or unclear work, read the product/planning route first, or refer to `docs/ARCHITECTURE_QUICK_REF.md` for a quick file mapping.
3. Inspect the listed source files before editing.
4. Use `.agents/skills/test-driven-development` to implement.
5. After all the code changes are completed, update `docs/` when behavior, contracts, routes, ownership, or verification changed, ensuring docs and code agree for the touched area.
6. The final checkpoint upon completion of the task. You MUST run `rtk npm run test`, `rtk npm run lint` and `rtk npm run build` to ensure no regressions.

## Final Response Checklist

For code changes, include:

- Tests/checks run.
- Whether `docs/` was updated.
- If `docs/` was not updated, why the touched behavior/contracts did not require it.

For docs-only changes, mention that TDD was skipped because no runtime behavior changed.

## Update Rule

Update `docs/` in the same change when code changes affect:

- User-visible behavior.
- Business rules or workflow semantics.
- TypeScript payload contracts.
- Electron IPC command names, payloads, or errors.
- Action configs, defaults, labels, summaries, validation, or runner execution.
- Persistence schema, ordering, or repository behavior.
- Run state, progress, cancellation, or browser-session behavior.
- File ownership, task routing, or required verification.

## Conflict Rule

If source code and docs disagree:

- Code is the immediate implementation reality.
- Docs must be corrected for the touched area in the same task.
- Do not leave docs known-stale after changing code.

## Token Budget

Do not read all docs by default. `task-routes.md` is the router. Read only the files named by the route, then verify focused code.
