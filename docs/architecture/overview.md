# Architecture Overview

## Layers

```text
React renderer
  -> src/App.tsx orchestration
  -> src/features/overview/pages/OperationsOverviewPage.tsx durable operations dashboard
  -> src/features/evidence/pages/EvidenceExplorerPage.tsx evidence investigation workspace
  -> src/features/identities/pages/IdentityLabPage.tsx identity posture workspace
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
  -> electron/backend/operations/operationsRepository.ts operations read model
  -> electron/backend/evidence/evidenceRepository.ts evidence read model and artifact commands
  -> electron/backend/identity/identityRepository.ts identity read model
  -> electron/backend/scheduling/workflowScheduleRepository.ts schedule repository
  -> electron/backend/scheduling/scheduler.ts in-app schedule engine
  -> electron/backend/persistence/database.ts SQLite bootstrap
SQLite
  -> projects
  -> project_environments
  -> workflows
  -> subflows
  -> runs
  -> run_steps
  -> workflow_schedules
  -> workflow_schedule_events
  -> operational_attention_events
  -> run outputs used as evidence source
```

## Runtime State

The renderer command boundary is Electron IPC. The TypeScript backend owns
project/environment CRUD, workflow CRUD, subflow CRUD, graph document storage,
Workflow Settings, package import/export, graph validation/compilation,
workflow scheduling, SQLite persistence, backend-owned browser recorder session
lifecycle, run lifecycle orchestration, and CloakBrowser execution.
The Operations Overview read model is also backend-owned: it merges current
process run snapshots with persisted runs, schedule decisions, launch-block
attention, and sanitized evidence metadata before returning a bounded DTO to
the renderer.
The Evidence read model is backend-owned as well: it derives typed evidence
items from persisted run outputs/run steps, validates artifact references under
the app evidence directory, and owns screenshot preview, reveal, and sanitized
bundle export commands.
The Identity Lab read model is backend-owned: it derives current managed
identity rows from Workflow Settings, matches persisted runs/evidence by
workflow and identity snapshot, returns read-only historical references for old
identity ids, and sanitizes diagnostics before renderer display.
The renderer owns cross-workspace Mission Control routing only as typed
in-memory navigation targets. Those targets connect sidebar navigation,
Overview, Evidence, Identity Lab, Runs, Schedules, Workflows, and graph issue
focus without creating a persisted navigation table or exposing raw backend
payloads.

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
  referenced-subflow preparation and id remapping, selected-section validation,
  and export sanitization.
- Browser recorder session manager owns active in-memory recorder sessions,
  including new-workflow settings drafts, existing-workflow settings snapshots,
  sanitized browser identity metadata, backend browser launch/cleanup,
  stop/discard lifecycle state, and recording event buffers. Failed recorder
  launch/setup/navigation closes any browser context before surfacing the error,
  and replacement recording rejects active workflow/profile/batch conflicts
  before launch. The event collector injects bounded page-side capture, drains
  buffered fallback events on stop, redacts sensitive text field values and
  secret-like raw keys, drops malformed locator candidates, and observes backend
  top-level page navigation before the locator generator and timeline normalizer convert
  raw events into stable review steps, including clipboard paste replay as Set
  Clipboard plus Paste Clipboard. Graph draft generation converts those
  steps into a standard v2 `WorkflowGraph` and validates it without persistence.
  Draft save reconciles reviewed labels, inclusion, and supported value edits
  against backend-held steps through `saveRecordingDraft`, creating a normal
  workflow with the recorder settings snapshot or replacing the linked graph,
  then consumes the in-memory draft/session.
- Repository/database code owns SQL, timestamps, JSON persistence, and run history.
- Operations repository code owns dashboard aggregation, attention
  correlation, local-day activity buckets, bounded persisted run detail, and
  safe evidence metadata extraction. Persisted run detail includes the
  workflow identity reference from the run settings snapshot when available so
  the renderer can offer traceability without inspecting raw run outputs.
- Evidence repository code owns historical evidence listing, filtering,
  deterministic evidence ids, typed detail payloads, artifact path containment,
  native reveal, screenshot preview, and manifest-based bundle export.
- Identity repository code owns current identity listing, managed/historical
  detail resolution, run/evidence matching, rotation history, diagnostic
  sanitization, and Identity Lab data warnings.
- Schedule repository/engine code owns schedule SQL, next-run calculation, due-schedule scanning, and schedule event audit history.
- Graph validation code owns structural/semantic workflow graph checks before persistence or compilation.
- Graph compiler code owns validated graph-to-action compilation and settings prelude insertion.
- Runner code owns CloakBrowser/Playwright execution.

## Read By Task

Use `docs/task-routes.md`; do not scan every architecture doc for normal tasks.
