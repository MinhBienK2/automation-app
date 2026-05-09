# Agent Docs

This directory is for coding agents working in this repository.

## Source Of Truth

- Current code and `docs/` must agree for every touched area.
- `AGENTS.md` defines mandatory agent workflow.
- `DESIGN.md` is mandatory for layout, styling, and user-facing UI changes.
- `docs/superpowers/` is a historical planning archive. Do not use it as current truth.

## Required Reading Path

1. Read this file.
2. Read `docs/task-routes.md`.
3. Select the route or routes matching the task.
4. Read only the domain, architecture, contract, and maintenance docs named by the route.
5. Inspect the listed source files before editing.

For broad, ambiguous, or planning tasks, use the "Understand Product Or Plan Broad Work" route first. Do not read every file in `docs/`.

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

If docs and code disagree, verify current code, fix the docs for the touched area, then continue.

## Token Budget

Do not read all docs by default. `task-routes.md` is the router. Read only the files named by the route, then verify focused code.
