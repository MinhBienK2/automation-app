# Architecture Overview

## Layers

```text
React renderer
  -> src/App.tsx orchestration
  -> src/features/workflows/* screens and components
  -> visual graph editor for graph authoring and canvas run state
  -> src/lib/workflowApi.ts typed bridge wrappers
  -> window.workflowApi exposed by Electron preload
Electron preload
  -> contextBridge surface defined in src/types/electron.ts
  -> no direct Node integration in the renderer
Electron main
  -> app lifecycle and BrowserWindow
  -> app data paths under appData/automation-app
  -> IPC registration and native dialogs
Node/TypeScript backend
  -> electron/backend/commands.ts command handlers
  -> electron/backend/workflowRepository.ts workflow repository
  -> electron/backend/database.ts SQLite bootstrap
SQLite
  -> workflows
  -> runs
  -> run_steps
```

## Migration State

The renderer command boundary is Electron IPC. The TypeScript backend owns
workflow CRUD, graph document storage, Workflow Settings, browser-config
compatibility, package import/export, and SQLite persistence.

`src-tauri/` remains in the repository as a temporary implementation reference
for graph compilation and runner parity. It is not required by the Electron
command boundary.

## Boundaries

- Frontend owns interaction state and rendering.
- `workflowApi.ts` owns renderer-facing command wrapper names.
- `electron/preload.ts` exposes the narrow bridge and unwraps serializable command errors.
- Electron main owns app lifecycle, app data paths, native dialogs, and IPC registration.
- Node backend commands own validation before persistence or execution.
- Repository/database code owns SQL, timestamps, JSON persistence, and run history.
- Runner code owns CloakBrowser/Playwright execution once ported in later plans.

## Read By Task

Use `docs/task-routes.md`; do not scan every architecture doc for normal tasks.
