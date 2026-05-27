# Architecture Overview

## Layers

```text
React renderer
  -> src/App.tsx orchestration
  -> src/features/workflows/* screens and components
  -> src/lib/personaCatalog.ts shared workflow identity persona catalog
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
  -> electron/backend/runtime/runManager.ts run lifecycle manager
  -> electron/backend/browser/sessionManager.ts browser session manager
  -> electron/backend/services/workflowSettingsService.ts workflow settings service
  -> electron/backend/services/workflowPackageService.ts package service
  -> electron/backend/recording/recorderSessionManager.ts browser recorder session lifecycle
  -> electron/backend/graph/validateGraph.ts graph validation
  -> electron/backend/graph/compiler.ts graph compilation
  -> electron/backend/persistence/workflowRepository.ts workflow repository
  -> electron/backend/scheduling/workflowScheduleRepository.ts schedule repository
  -> electron/backend/scheduling/scheduler.ts in-app schedule engine
  -> electron/backend/persistence/database.ts SQLite bootstrap
SQLite
  -> workflows
  -> runs
  -> run_steps
  -> workflow_schedules
  -> workflow_schedule_events
```

## Runtime State

The renderer command boundary is Electron IPC. The TypeScript backend owns
workflow CRUD, graph document storage, Workflow Settings,
package import/export, graph validation/compilation, workflow scheduling, SQLite
  persistence, backend-owned browser recorder session lifecycle, run lifecycle
  orchestration, and CloakBrowser execution.

## Boundaries

- Frontend owns interaction state and rendering.
- `workflowApi.ts` owns renderer-facing command wrapper names.
- `electron/preload.cts` exposes the narrow sandbox-compatible bridge, derives IPC channel strings from typed bridge method names, and unwraps serializable command errors.
- Electron main owns app lifecycle, app data paths, native dialogs, and IPC registration.
- Node backend commands own validation before persistence or execution.
- `electron/backend/commands.ts` remains the backend command adapter; other backend files are grouped by ownership under `actions/`, `browser/`, `evidence/`, `graph/`, `persistence/`, `runtime/`, `scheduling/`, and `services/`.
- Run manager code owns active run/profile locks, run snapshots, stop handling,
  batch run state, run timeouts, and final run persistence.
- Browser session manager code owns CloakBrowser launch option mapping,
  persona evidence translation, retained-session state, profile launch paths,
  and browser identity evidence.
- Workflow settings service owns settings defaults, normalization, validation,
  browser-config compatibility mapping, persona resolution, local duplication
  settings, and browser identity seed helpers.
- Workflow package service owns workflow package preview, import preparation,
  selected-section validation, and export sanitization.
- Browser recorder session manager owns active in-memory recorder sessions,
  including new-workflow settings drafts, existing-workflow settings snapshots,
  sanitized browser identity metadata, stop/discard lifecycle state, and
  recording event buffers. Browser event capture and graph draft generation are
  layered behind this backend-owned session boundary.
- Repository/database code owns SQL, timestamps, JSON persistence, and run history.
- Schedule repository/engine code owns schedule SQL, next-run calculation, due-schedule scanning, and schedule event audit history.
- Graph validation code owns structural/semantic workflow graph checks before persistence or compilation.
- Graph compiler code owns validated graph-to-action compilation and settings prelude insertion.
- Runner code owns CloakBrowser/Playwright execution.

## Read By Task

Use `docs/task-routes.md`; do not scan every architecture doc for normal tasks.
