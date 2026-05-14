# Plan 02 - Node Domain Storage And Command Parity

Date: 2026-05-09

## Goal

Port command, domain, settings, and storage behavior from Rust/Tauri to
Node/TypeScript while keeping the existing UI contract stable.

## Scope

- Create TypeScript backend modules for:
  - command handlers
  - command error serialization
  - SQLite connection and migrations
  - workflow repository
  - workflow settings defaults and validation
  - import/export package format
- Implement the new SQLite schema:
  - `workflows`
  - `runs`
  - `run_steps`
- Implement workflow CRUD.
- Implement settings save/load/validate.
- Implement graph save/load shell commands before compiler parity.
- Implement import/export for the new package format.
- Preserve current command-facing error shape: `{ message, field? }`.

## Out Of Scope

- Running workflows.
- Browser launch.
- Full graph compiler.
- Batch execution.
- Old Tauri package/database import.

## TDD And Checks

- Use `.agents/skills/test-driven-development` before code changes.
- Start with failing repository and command handler tests for workflow CRUD,
  settings defaults, validation errors, and package import/export.
- Run:
  - repository tests against a temporary SQLite database
  - command handler tests
  - `npm test -- src/lib/workflowApi.test.ts`
  - affected page/component tests
  - `npx tsc --noEmit`

## Docs To Update

- `docs/architecture/persistence.md`
- `docs/architecture/command-boundary.md`
- Electron IPC contract doc
- `docs/contracts/workflow-types.md`
- `docs/domain/product-model.md`
- `docs/domain/user-visible-invariants.md` if visible behavior changes

## DONE Gate

- New SQLite database initializes from Electron app data.
- Workflow CRUD works through IPC.
- Workflow Settings persist and validate through TypeScript backend services.
- Graph documents save and load as JSON.
- Import/export uses the new package format.
- UI remains functional against the new command layer.
- Focused tests and docs updates pass.
- Changes are committed.
