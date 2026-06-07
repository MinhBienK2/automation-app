# Command Boundary

## Purpose

The Electron IPC bridge is the contract between the React renderer and the
Node/Electron backend.

## Key Files

- Frontend wrappers: `src/lib/workflowApi.ts`
- Wrapper tests: `src/lib/workflowApi.test.ts`
- Bridge types: `src/types/electron.ts`
- Electron preload: `electron/preload.cts`
- Electron IPC channels: `electron/ipc.ts`
- Electron main registration: `electron/main.ts`
- Node command handlers: `electron/backend/commands.ts`
- Run lifecycle manager: `electron/backend/runtime/runManager.ts`
- Workflow settings service: `electron/backend/services/workflowSettingsService.ts`
- Workflow package service: `electron/backend/services/workflowPackageService.ts`
- Electron SQLite bootstrap: `electron/backend/persistence/database.ts`
- Electron repository: `electron/backend/persistence/workflowRepository.ts`
- Operations read model: `electron/backend/operations/operationsRepository.ts`
- Evidence read model: `electron/backend/evidence/evidenceRepository.ts`
- Identity read model: `electron/backend/identity/identityRepository.ts`
- Command contract: `docs/contracts/electron-ipc.md`

## Belongs Here

- Bridge method names, IPC channel names, and payload keys.
- `electron/ipc.ts` is the canonical runtime IPC channel map. The preload bridge does not duplicate channel strings; it derives `workflow:<methodName>` from typed bridge method names and is type-checked against the canonical map.
- Conversion from repository/domain/runner errors into `CommandError`.
- Workflow lookup and command-level not-found errors.
- Delegating validation before persistence or execution to the domain service that owns the behavior.
- Workflow Settings load/save/section-save commands, run validation, and validation before persistence or execution.
- Legacy workflow browser runtime config commands map to Workflow Settings Browser.
- Import/export, duplicate, batch run, builder assist command logic.
- Browser recorder lifecycle commands. The backend starts, reports, stops,
  lists events for, and discards recorder sessions. Starting a session launches
  the recorder browser in the backend, applies supported recorder-safe launch
  overrides such as `headless`, injects capture with a page buffer fallback for
  adapter binding failures, observes backend top-level page navigation plus
  tab/download/dialog events, and records raw events including clipboard
  copy/paste; renderer code receives only typed sanitized DTOs and
  never launches or instruments browsers directly. Recorder setup failures close
  any launched browser context before returning the command error. Dialog
  observation dismisses native modal state with a review warning rather than
  leaving the recorder browser blocked. Replacement recording checks the same
  active workflow/profile/batch conflicts as workflow runs before launching.
  Stopping a session drains buffered page-side fallback events before closing
  the recorder context.
- Browser recorder draft commands. Draft generation normalizes recorded events,
  builds a review-only workflow graph, validates it, and returns/stores the
  draft in backend memory without persistence. Clipboard paste normalizes to
  Set Clipboard plus Paste Clipboard and suppresses the duplicate input caused
  by the paste. `saveRecordingDraft` consumes
  reviewed labels, inclusion flags, and supported value edits by reconciling
  renderer input against the backend-held draft steps, regenerates and validates
  the graph, and is the only recorder path that creates a workflow or replaces a
  linked workflow graph. Renderer-supplied action type or locator replacement is
  ignored. Successful save consumes the in-memory draft/session; discarding a
  session also removes any drafts generated from that session.
- Schedule CRUD, enable/disable validation, schedule event listing, and in-app scheduler tick logic.
- Operations aggregate reads through `getOperationsOverview` and
  `getOperationalRunDetail`; metric meanings, attention dedupe, evidence
  metadata filtering, and bounded limits stay in the backend.
- Evidence reads and artifact operations through `listEvidenceItems`,
  `getEvidenceDetail`, `getEvidenceScreenshotPreview`,
  `revealEvidenceArtifact`, and `exportEvidenceBundle`; evidence extraction,
  path validation, native reveal, and bundle writing stay in the backend.
- Identity Lab reads and session action through `getIdentityLabOverview`,
  `getIdentityLabDetail`, and `closeIdentityRetainedSession`; current identity
  aggregation, historical identity fallback, run/evidence matching, sanitized
  diagnostics, rotation history, and retained-session close guards stay in the
  backend.
- Workflow graph load, save, validate, compile, and run command logic.
- Project, compatibility Project Environment/session, and Subflow CRUD command
  logic. Browser Launch settings for project saved sessions and private
  workflow sessions are backend-owned, and subflow delete is guarded by workflow
  usage. The renderer exposes grouped project identity controls instead of a
  full Project Environment list/create/editor, project rename/duplicate/delete
  stays backend-owned through `updateProject`, `duplicateProject`, and
  `deleteProject`, and project identity regeneration stays backend-owned
  through `resetProjectEnvironmentBrowserIdentity`.
- Native file dialogs and file writes needed by command flows, such as workflow package export.
- Graph commands must keep invalid advanced node execution explicit: return a serializable command error before starting a run instead of compiling invalid nodes to no-ops.
- Graph runs reject graphs with no executable compiled steps before starting the runner.
- Workflow-to-workflow nesting and subflow-to-subflow nesting are not part of
  the current workflow contract.
- Product-facing workflow execution goes through `runWorkflow`, which runs the
  saved workflow graph with saved Workflow Settings plus the selected project
  saved session or private workflow-session Browser Launch settings as the run
  baseline. The UI saves the current graph and dirty settings sections before
  invoking it. Call Subflow nodes resolve same-project subflows and compile
  them into the caller's run plan.
- Manual full-run launch attempts blocked by graph/settings validation before a
  run row exists write one sanitized `launch_blocked` operational attention
  row. Manual validation alone does not write attention.
- Product-facing batch execution remains globally exclusive with normal workflow execution, shares run-manager stop handling and persisted run records, and rejects starts while any normal run is active.
- Product-facing scheduled execution uses the same saved-workflow run path as manual `runWorkflow`, uses run-manager workflow/profile/batch conflict checks instead of a global normal-run lock, and records skipped/missed/failed scheduler decisions in schedule events.
- Workflow package import delegates preview/import preparation, selected-section
  validation, referenced-subflow preparation, Call Subflow id remapping, and
  export sanitization to `WorkflowPackageService`; command handlers still wrap
  workflow, recreated subflows, graph, and settings writes in a SQLite
  transaction. Export sanitization removes proxy secrets, proxy URL
  credentials, and local fingerprint font directories.
- Production BrowserWindows keep `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`; renderer access stays limited to the typed preload bridge.
- Product-facing local copy goes through `duplicateWorkflow`, which copies the saved graph and non-storage local settings without package-export sanitization, but creates a fresh browser identity/profile/fingerprint and disables Run from selected so the copy does not reuse the source session.
- Product-facing project copy goes through `duplicateProject`, which copies the
  project row, project environments, subflows, workflows, graphs, and
  non-storage settings, remaps copied Call Subflow references, creates fresh
  browser identity/profile/fingerprint values for copied sessions, and disables
  copied workflows' Run from selected state.
- Product-facing project deletion goes through `deleteProject`. It rejects while
  any workflow in that project has an active run, active profile, or retained
  session, deletes workflows before deleting the project row so no workflow is
  orphaned, and removes only unshared local profile directories after the
  persisted deletion succeeds.
- CloakBrowser operational commands stay in the backend: diagnostics report wrapper/binary/cache/display/GeoIP/font/profile metadata plus last smoke summary fields, install triggers `ensureBinary()`, and orphan cleanup deletes only inactive profile directories that no workflow references. Font diagnostics inspect configured font directories directly and report file counts, total bytes, normalized content hash, expected family coverage, missing/unreadable directories, and shared-directory warnings. Profile-size diagnostics are bounded by traversal entry/depth/time limits so the command path does not recursively walk unbounded Chromium storage.
- Workflow Settings validation is service-owned and emits fingerprint-coherence warnings for proxy identities without timezone/locale or GeoIP, and for configured fingerprint fonts directories that can create a stable font hash across identities.
- Workflow deletion accepts an explicit profile-data choice from the renderer. It keeps browser profile data by default, deletes only unshared profile directories when requested, and rejects deletion while that workflow has an active run, while that workflow's profile is owned by an active run, or while that workflow's retained browser session still owns the profile.
- Browser identity rotation is command-owned through `resetWorkflowBrowserIdentity`. The backend generates the new high-entropy identity id, derives the CloakBrowser-compatible seed, persists a migration-note audit event, preserves non-storage Browser Launch preferences, disables Run from selected, and rejects reset while the workflow/profile is active or retained.
- Project saved-session identity rotation is command-owned through
  `resetProjectEnvironmentBrowserIdentity`. The backend generates the new
  high-entropy identity id, derives the CloakBrowser-compatible seed, updates
  matching profile fields, preserves non-storage Browser Launch preferences,
  deletes the old unshared project profile directory after the persisted update,
  and rejects reset while a workflow using that environment has an active run,
  active profile, or retained session.
- Workflow Settings saves reject identity profile reset/delete while that workflow's retained browser session still owns the profile.
- Debug-only fixture generation is not part of the production command surface.
- List-step authoring commands remain retired from the production command surface.
- The old prototype recorder helpers `suggestSelectors` and
  `normalizeRecordedEvents` are retired from the production bridge. New recorder
  behavior must use the `Recording*` session DTOs and backend-owned recorder
  modules.

## Does Not Belong Here

- UI state decisions.
- SQL implementation details.
- Renderer-side KPI or evidence aggregation.
- Renderer-side evidence extraction from raw outputs or filesystem paths.
- Renderer-side identity aggregation from raw run outputs, diagnostics,
  profile storage, or filesystem paths.
- Browser action internals.
- Active run/profile lock maps, run snapshots, batch state, and final run persistence internals outside calls into the run manager.

## Change Checklist

- Update `workflowApi.ts`, `src/types/electron.ts`, `electron/preload.cts`, and `electron/ipc.ts` for bridge contract changes.
- Update `workflowApi.test.ts` and focused command handler tests.
- Keep `CommandError` serializable as `{ message, field? }`.
- Keep the preload unwrap compatible with the IPC result envelope.
