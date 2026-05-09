# Architecture Overview

## Layers

Current Tauri/Rust app:

```text
React UI
  -> src/App.tsx orchestration
  -> src/features/workflows/* screens and components
  -> visual graph editor for graph authoring and canvas run state
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
  -> workflow_graphs
  -> workflow_settings
  -> workflow_browser_configs (legacy compatibility)
```

Electron/CloakBrowser rebuild foundation:

```text
Electron Main
  -> electron/main/main.ts app lifecycle/window security
  -> electron/main/ipc.ts typed IPC routing
  -> electron/main/appApi.ts preload-shaped product API facade
  -> electron/main/storage.ts new SQLite workspace schema
  -> electron/main/runnerSupervisor.ts local runner process health supervision

Preload
  -> electron/preload/preload.ts contextBridge API

React Renderer
  -> existing src/ UI during transition
  -> src/lib/workflowApi.ts selects Electron preload API when available, otherwise Tauri invoke

Runner
  -> electron/runner/runnerCore.ts runner-native plan execution and events
  -> electron/runner/cloakBrowserAdapter.ts CloakBrowser/Playwright adapter
  -> electron/runner/stdio-runner.mjs health-check process used by supervisor tests
```

## Boundaries

- Frontend owns interaction state and rendering.
- `workflowApi.ts` owns invoke names and payload keys.
- Commands own validation before persistence and serializable errors.
- Domain owns business validation and serde-compatible types.
- Repository owns SQL, timestamps, ordering, and JSON persistence.
- Runner owns Chromium session behavior and action execution.
- During the rebuild, Electron code is parallel to the Tauri app. Do not remove Tauri/Rust paths until parity and decommission milestones are explicitly met.
- Electron renderer code must go through preload `window.cloakBrowser`; it must not use Node, SQLite, Playwright, or CloakBrowser directly.

## Read By Task

Use `docs/task-routes.md`; do not scan every architecture doc for normal tasks.
