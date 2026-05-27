# Electron IPC Contract

## Source Files

- Renderer wrappers: `src/lib/workflowApi.ts`
- Renderer wrapper tests: `src/lib/workflowApi.test.ts`
- Bridge types: `src/types/electron.ts`
- Preload bridge: `electron/preload.cts`
- IPC channels: `electron/ipc.ts`
- Main process registration: `electron/main.ts`
- Node command handlers: `electron/backend/commands.ts`
- SQLite repository: `electron/backend/persistence/workflowRepository.ts`

## Current Boundary

The renderer calls `src/lib/workflowApi.ts`, which delegates to
`window.workflowApi`. The bridge is exposed by Electron preload through
`contextBridge`; the renderer does not import Node, Electron, Playwright,
CloakBrowser, filesystem, or SQLite modules directly.

Electron main registers typed IPC channels and returns a result envelope:

```text
{ ok: true, value }
{ ok: false, error: { message, field? } }
```

The preload unwraps successful values and throws the serialized error object for
failed calls. This preserves the command-facing error shape used by
`src/lib/workflowUi.ts`. `electron/ipc.ts` is the canonical channel map; the
preload bridge derives channel strings from method names and type-checks those
method names against the canonical map instead of maintaining a second runtime
string map.

## Current Commands

- `listWorkflows`
- `getWorkflow`
- `createWorkflow`
- `renameWorkflow`
- `deleteWorkflow`
- `duplicateWorkflow`
- `getWorkflowGraph`
- `saveWorkflowGraph`
- `validateWorkflowGraph`
- `compileWorkflowGraph`
- `getWorkflowSettings`
- `resetWorkflowBrowserIdentity`
- `saveWorkflowSettings`
- `saveWorkflowSettingsSection`
- `validateWorkflowSettings`
- `getCloakBrowserDiagnostics`
- `installCloakBrowserBinary`
- `cleanupOrphanedBrowserProfiles`
- `validateWorkflowRun`
- `getWorkflowBrowserConfig`
- `saveWorkflowBrowserConfig`
- `runWorkflow`
- `runWorkflowFromNode`
- `stopRun`
- `getRunState`
- `listRunStates`
- `getOperationsOverview`
- `getOperationalRunDetail`
- `listSchedules`
- `getSchedule`
- `createSchedule`
- `updateSchedule`
- `deleteSchedule`
- `enableSchedule`
- `disableSchedule`
- `listScheduleEvents`
- `validateSchedule`
- `exportWorkflow`
- `importWorkflow`
- `exportWorkflowPackage`
- `previewWorkflowPackage`
- `importWorkflowPackage`
- `saveWorkflowPackageFile`
- `runBatchWorkflow`
- `suggestSelectors`
- `normalizeRecordedEvents`
- `dryRunValidateConfig`

`deleteWorkflow` accepts an optional `{ deleteBrowserProfile?: boolean }`
payload. The default is to keep browser profile data; when true, the backend
deletes the workflow's private browser profile directory only if no other
workflow still references it, no active run owns the workflow/profile, and no
retained session is active.

`resetWorkflowBrowserIdentity(workflowId)` rotates the Browser Launch identity
in the backend. It persists and returns updated Workflow Settings with a
crypto-generated `identity_id`, matching profile directory, deterministic
CloakBrowser-compatible seed, disabled Run from selected, and a migration note
recording the old and new identity. The command rejects while the workflow or
profile is active or a retained session still owns the profile.

`runWorkflow` and `runWorkflowFromNode` return a `WorkflowRunSnapshot` with the
new `run_id`, workflow metadata, source, start time, and nested run state.
`stopRun` accepts an optional run id and returns the stopped snapshot; omitting
the run id is valid only when exactly one workflow run is active. `listRunStates`
returns the current app-session run snapshots for multi-run monitoring.

`getOperationsOverview({ day_start_utc, day_end_utc, timezone_label?, attention_filter?, limits? })`
returns the bounded `OperationsOverview` read model for the operator's local
day expressed as UTC boundaries. The backend validates the range, applies list
limits, computes KPI/activity/attention meaning, and returns only safe evidence
metadata. `getOperationalRunDetail(runId)` returns one bounded persisted run
summary for Overview-to-Runs navigation; it is not an unbounded run-history or
artifact-opening API.

## Payload Rules

- Renderer wrapper names remain camelCase.
- IPC channels are namespaced strings in `electron/ipc.ts`, for example
  `workflow:listWorkflows`.
- Bridge method arguments use the shared TypeScript DTO shapes; no casing conversion
  happens at the Electron boundary.
- Native save-dialog and file-writing behavior is owned by Electron main through
  `saveWorkflowPackageFile`; package JSON is not written from the renderer.
- Command errors serialize as `{ message: string, field?: string | null }`.

## Persistence And Command Parity

Electron main initializes SQLite in app data, and Node command handlers now use
the TypeScript workflow repository for workflow CRUD, graph documents, Workflow
Settings and workflow package import/export.

Graph validation/compilation, run orchestration, SQLite persistence, workflow
package import/export, and CloakBrowser runner execution are owned by the
Electron backend.

Workflow schedule CRUD, schedule validation, enable-time workflow readiness
checks, schedule event history, and the in-app scheduler tick are owned by the
Electron backend. The renderer manages schedule form state and calls the typed
bridge; it does not own timers or schedule SQL.

Operations Overview aggregation is owned by the Electron backend. The renderer
can refresh and navigate from returned references, but it does not compute KPI
meaning from raw SQL rows or expose arbitrary run outputs.

CloakBrowser diagnostics and binary/profile lifecycle are command-owned as well.
The renderer can request wrapper/binary/profile diagnostics, trigger an explicit
binary install/check, and clean up orphaned inactive profile directories, but it
never imports CloakBrowser, reads profile storage, or receives proxy passwords,
cookies, localStorage, or sessionStorage values through IPC. Profile diagnostic
sizes are bounded approximations, not unbounded recursive storage scans.

## Change Checklist

- Update `src/lib/workflowApi.ts`, `src/types/electron.ts`, and
  `electron/preload.cts` together when the bridge surface changes.
- Add or update focused wrapper tests in `src/lib/workflowApi.test.ts`.
- Keep Electron main handlers returning the result envelope so preload can
  preserve serializable command errors.
- Update this document and `docs/task-routes.md` when command names, payloads,
  native dialog behavior, or verification commands change.
