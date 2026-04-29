# Architecture Overview

## Layers

```text
React UI
  -> src/App.tsx orchestration
  -> src/features/workflows/* screens and components
  -> src/lib/workflowApi.ts invoke wrappers
  -> Tauri command boundary
Rust commands
  -> src-tauri/src/commands.rs validation/adapters
  -> src-tauri/src/domain/* domain types and validation
  -> src-tauri/src/repositories/workflow_repository.rs SQLite persistence
  -> src-tauri/src/services/run_service.rs run orchestration/default configs
  -> src-tauri/src/runner/* browser execution
SQLite
  -> workflows
  -> workflow_steps
```

## Boundaries

- Frontend owns interaction state and rendering.
- `workflowApi.ts` owns invoke names and payload keys.
- Commands own validation before persistence and serializable errors.
- Domain owns business validation and serde-compatible types.
- Repository owns SQL, timestamps, ordering, and JSON persistence.
- Runner owns Chromium session behavior and action execution.

## Read By Task

Use `docs/task-routes.md`; do not scan every architecture doc for normal tasks.

