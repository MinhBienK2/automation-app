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
- Evidence read model: `electron/backend/evidence/evidenceRepository.ts`
- Identity read model: `electron/backend/identity/identityRepository.ts`

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
- `listProjects`
- `createProject`
- `updateProject`
- `duplicateProject`
- `exportProjectPackage`
- `previewProjectPackage`
- `importProjectPackage`
- `deleteProject`
- `listProjectEnvironments`
- `createProjectEnvironment`
- `updateProjectEnvironment`
- `deleteProjectEnvironment`
- `setWorkflowProjectEnvironment`
- `resetProjectEnvironmentBrowserIdentity`
- `createSubflow`
- `listSubflows`
- `getSubflow`
- `updateSubflow`
- `getSubflowGraph`
- `saveSubflowGraph`
- `duplicateSubflow`
- `deleteSubflow`
- `getSubflowUsage`
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
- `listEvidenceItems`
- `getEvidenceDetail`
- `getEvidenceScreenshotPreview`
- `revealEvidenceArtifact`
- `exportEvidenceBundle`
- `getIdentityLabOverview`
- `getIdentityLabDetail`
- `closeIdentityRetainedSession`
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
- `saveProjectPackageFile`
- `runBatchWorkflow`
- `startRecordingSession`
- `getRecordingSession`
- `stopRecordingSession`
- `listRecordingEvents`
- `discardRecordingSession`
- `generateRecordingDraft`
- `getRecordingDraft`
- `saveRecordingDraft`
- `dryRunValidateConfig`

Project commands expose default-project and compatibility project-profile
management to the renderer. `createProject(input)` creates the project, initial
browser profile, and an initial draft workflow named `Main` in one
transaction, then returns the created `Project`. `updateProject(projectId, input)` renames or updates
the selected project metadata. `duplicateProject(projectId)` creates an
independent `Copy of <name>` project with copied environments, subflows,
workflows, remapped Call Subflow references, and fresh browser
identity/profile/fingerprint values for copied profiles. `deleteProject(projectId)`
deletes the project after active-run/profile/retained-session guards pass,
removing workflows before the project row so workflows are not orphaned.
`createWorkflow(name, options?)` accepts an optional project id. Omitted options
use the default project and assign its initial browser profile. `createProjectEnvironment`
creates a new browser profile for a project, `updateProjectEnvironment` renames
or updates profile metadata, `deleteProjectEnvironment(environmentId)` deletes
an unused profile plus its local browser storage, and
`setWorkflowProjectEnvironment(workflowId, environmentId)` selects the browser
profile used by a workflow. Deletion is rejected while workflows select the
profile. `resetProjectEnvironmentBrowserIdentity(environmentId)` remains a
legacy guarded backend command, but the product UI gets new identities by
creating profiles instead of exposing regeneration. Subflow commands expose project-scoped
reusable graphs, metadata rename through `updateSubflow`, usage queries,
guarded deletion, and graph save/load.

Workflow Browser Launch reads the selected browser profile through
`getWorkflowSettings` and changes selection through
`setWorkflowProjectEnvironment`. Legacy Browser Launch saves are applied to the
selected profile so older command callers stay consistent with profile-owned
runtime identity; the product UI does not expose identity field editing or
workflow identity reset.

`importWorkflowPackage(packageValue, options)` accepts the selected Flow and
Settings sections plus optional `target_project_id`. When present, the backend
creates the imported workflow and recreated subflows in that project. Importing
  Browser Launch creates a private imported browser profile for the imported
  workflow instead of mutating an existing target-project profile.

`exportProjectPackage(projectId)` returns a full `project_package` JSON payload
for the selected project. `previewProjectPackage(packageValue)` validates and
summarizes project package contents. `importProjectPackage(packageValue)`
validates the package, then creates a new `<project name> (imported)` project
  with recreated browser profiles, subflows, workflows, remapped Call Subflow ids, and
fresh imported browser identities/profiles. It does not import runs, evidence,
schedules, app settings, or browser profile storage. `saveProjectPackageFile`
owns the native Save dialog and JSON file write for `.project.json` exports.

`deleteWorkflow` accepts an optional `{ deleteBrowserProfile?: boolean }`
payload. The default is to keep browser profile data; when true, the backend
deletes the workflow's private browser profile directory only if no other
workflow still references it, no active run owns the workflow/profile, and no
retained session is active.

`resetWorkflowBrowserIdentity(workflowId)` remains a legacy guarded backend
identity rotation command for compatibility. The current product UI does not
expose it; operators create/select browser profiles for normal identity
rotation.

`runWorkflow` and `runWorkflowFromNode` return a `WorkflowRunSnapshot` with the
new `run_id`, workflow metadata, source, start time, and nested run state.
Both commands resolve Browser Launch from the workflow's selected browser profile
before browser launch or retained-session checks.
`stopRun` accepts an optional run id and returns the stopped snapshot; omitting
the run id is valid only when exactly one workflow run is active. `listRunStates`
returns the current app-session run snapshots for multi-run monitoring.

Recorder session commands are backend-owned. `startRecordingSession`
accepts `{ mode, workflow_id?, workflow_name?, initial_url?,
  browser_launch_overrides? }` and returns a `RecordingSession` with sanitized
  browser identity metadata and a sanitized Workflow Settings snapshot. The
  recorder accepts the safe `browser_launch_overrides.headless` boolean for
  headless verification runs and warns on unsupported override keys.
  `replace_current_graph` rejects active workflow, active profile, and active
  batch conflicts before launching. Starting a session launches a backend-owned
  recorder browser through the existing browser session infrastructure, injects
  bounded page-side capture with an in-page buffer fallback for adapter binding
  failures, observes top-level page navigation plus backend tab creation,
  download, dialog, and clipboard copy/paste events,
  and optionally navigates to `initial_url`. Embedded frame navigations are ignored
  instead of becoming review `navigate` steps. If launch, capture setup, or
  initial navigation fails, the backend closes any partially launched recorder
  context before returning the command error.
Dialogs observed through the backend adapter are dismissed with a review warning
so the recorder browser does not block on native modal state. `listRecordingEvents`
returns the in-memory raw event stream for the session. `stopRecordingSession` and
`discardRecordingSession` close the recorder browser context. Stop drains
buffered page-side fallback events before closing so immediate review does not
miss events captured while the binding fallback was active. Discard consumes the
in-memory session and any generated drafts for that session. Commands operate by
session id and serialize errors as `{ message, field? }`.

`generateRecordingDraft(sessionId, options)` normalizes the selected session
events, maps paste to Set Clipboard plus Paste Clipboard while suppressing the
duplicate input event caused by the paste, creates a review-only
`RecordingWorkflowDraft`, generates a standard v2
`WorkflowGraph` with row-wrapped recorded node positions and fixed edge delays
for positive captured inter-step timing, validates it through backend graph
validation, stores the draft in backend memory, and returns it without creating
workflow rows or replacing an existing graph. `getRecordingDraft(draftId)`
returns the stored review draft.
`saveRecordingDraft(draftId, input)` is the only recorder command that persists
reviewed output. It reconciles renderer-reviewed step labels, inclusion flags,
and supported action value edits, including reviewed clipboard text, against the backend-held draft steps by step id,
regenerates and validates the graph, then either creates a normal workflow with
the recorder browser settings snapshot or replaces the linked workflow graph for
`replace_current_graph` drafts. Renderer-supplied action type or locator
replacement is ignored, and timing metadata remains backend-owned. Successful
save consumes the in-memory draft and its source session; subsequent
`getRecordingDraft` or session lookups return not-found command errors.

The legacy prototype helpers `suggestSelectors` and `normalizeRecordedEvents`
are no longer part of the production Electron bridge. Selector generation and
timeline normalization belong behind the `Recording*` session/draft contract.

`getOperationsOverview({ day_start_utc, day_end_utc, timezone_label?, attention_filter?, limits? })`
returns the bounded `OperationsOverview` read model for the operator's local
day expressed as UTC boundaries. The backend validates the range, rejects
ranges over 48 hours before building hourly buckets, applies list limits,
computes KPI/activity/attention meaning, and returns only safe evidence
metadata. Live and failed run references point to the owning workflow, while
recent evidence references can open Evidence by evidence id.

`listEvidenceItems(request?)` returns a bounded historical evidence page derived
from all matching persisted run outputs and run steps.
`getEvidenceDetail(evidenceId)` returns one typed bounded detail payload.
Evidence time filters are validated as parseable UTC-normalized instants and
invalid ranges return typed command errors instead of raw runtime exceptions.
`getEvidenceScreenshotPreview(evidenceId)`,
`revealEvidenceArtifact(evidenceId)`, and
`exportEvidenceBundle({ evidence_ids })` accept evidence ids only; the backend
resolves and validates file artifact paths before preview, native reveal, or
manifest-bundle export.

`getIdentityLabOverview(request?)` returns a bounded Identity Lab read model for
workflows' selected project browser profiles. `getIdentityLabDetail(target)`
returns one managed identity detail or read-only historical identity reference.
`closeIdentityRetainedSession(workflowId, profileName)` closes only the
matching in-memory retained browser context after backend workflow/profile/run
guards pass; it does not delete persistent profile data, settings, evidence,
or historical runs.

## Payload Rules

- Renderer wrapper names remain camelCase.
- IPC channels are namespaced strings in `electron/ipc.ts`, for example
  `workflow:listWorkflows`.
- Bridge method arguments use the shared TypeScript DTO shapes; no casing conversion
  happens at the Electron boundary.
- Native save-dialog and file-writing behavior is owned by Electron main through
  `saveWorkflowPackageFile` and `saveProjectPackageFile`; package JSON is not
  written from the renderer.
- Command errors serialize as `{ message: string, field?: string | null }`.
- Recorder DTOs use the `Recording*` prefix. Session snapshots and recording
  events sent to the renderer must not include browser secrets such as proxy
  passwords or captured password/secret-like field values.

## Persistence And Command Parity

Electron main initializes SQLite in app data, and Node command handlers now use
the TypeScript workflow repository for project/environment CRUD, workflow CRUD,
subflow CRUD, graph documents, Workflow Settings and workflow package
import/export.

Graph validation/compilation, Call Subflow resolution, run orchestration,
SQLite persistence, workflow package import/export, and CloakBrowser runner
execution are owned by the Electron backend.

Workflow schedule CRUD, schedule validation, enable-time workflow readiness
checks, schedule event history, and the in-app scheduler tick are owned by the
Electron backend. The renderer manages schedule form state and calls the typed
bridge; it does not own timers or schedule SQL.

Operations Overview aggregation is owned by the Electron backend. The renderer
can refresh and navigate from returned references, but it does not compute KPI
meaning from raw SQL rows or expose arbitrary run outputs.

Evidence Explorer aggregation and artifact actions are owned by the Electron
backend. The renderer never receives absolute original artifact paths and does
not import filesystem, SQLite, Electron shell/dialog, or raw output readers.

Identity Lab aggregation and retained-session close are owned by the Electron
backend. The renderer receives current managed identity summaries, historical
references, rotation history, run/evidence references, and sanitized
diagnostics only; it never receives absolute profile/font/binary paths, proxy
credentials, raw browser storage, cookies, tokens, or raw run outputs through
the Identity Lab boundary.

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
  native dialog behavior, recorder lifecycle behavior, or verification commands
  change.
