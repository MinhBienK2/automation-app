# Agent Docs

This directory is for coding agents working in this repository.

## Source Of Truth

- Current code and `docs/` must agree for every touched area.
- `AGENTS.md` defines mandatory agent rules. This file defines the execution workflow.
- `DESIGN.md` is mandatory for layout, styling, and user-facing UI changes.
- `docs/superpowers/` is a historical planning archive. Do not use it as current truth.

## Execution Loop

1. Read this file.
2. Run `node scripts/agent/agent-router.mjs --diff` (or `--file <path>` / `--query <text>`) to automatically identify the matching route, documentation to read, and unit tests to run.
3. Read only the documentation files output by the router. For broad or unclear work, read the product/planning route first, or refer to `docs/ARCHITECTURE_QUICK_REF.md` for a quick file mapping.
4. Inspect the listed source files before editing.
5. Use `.agents/skills/test-driven-development` before behavior-changing code.
6. Implement the smallest scoped change.
7. Run focused checks first, then broader checks when the touched area requires it.
8. Update `docs/` when behavior, contracts, routes, ownership, or verification changed.
9. Before final response, confirm docs and code agree for the touched area, and ensure that `npm run lint && npm run test && npm run build` passes successfully.

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
