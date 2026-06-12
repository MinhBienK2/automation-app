# Docs Freshness Checklist

Use when docs look stale or after a period of rapid code changes.

## Quick Checks

For each doc in the touched area:

1. Do file paths listed in the doc still exist?
2. Do command names/payloads match current `electron/backend/commands.ts`?
3. Do TypeScript type names match current `src/types/workflow.ts` and `src/types/electron.ts`?
4. Do described defaults match current code defaults?
5. Do described validation rules match current `electron/backend/actions/validation.ts` and `electron/backend/graph/validateGraph.ts`?

## Route-Level Checks

1. Do the source files listed in `task-routes.md` still exist at those paths?
2. Do the test commands in `task-routes.md` still match actual test file locations?
3. Are new modules or features missing a route entry?

## When To Trigger

- A bug-fix route says "docs look stale."
- A refactor moved files or renamed modules.
- Multiple rapid PRs landed without doc updates.
- An agent encounters a doc/code disagreement.

## Resolution

- Fix docs for the touched area in the same task.
- If a route's file list is wrong, update `task-routes.md`.
- If a domain/architecture/contract doc is wrong, update the specific doc.
- Do not rewrite docs outside the touched area; flag them for a future pass.
