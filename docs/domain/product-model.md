# Product Model

## Purpose

Mission Control is an Electron desktop app for building and running browser automation workflows.

## Core Concepts

- A workflow is a named automation definition whose product authoring source is the saved visual graph.
- A project groups workflows, reusable subflows, and one project saved browser
  session. The current MVP creates and uses a default project named `Main` for
  existing local data.
- A project saved session is the project-owned default fingerprint identity and
  persistent browser profile. It stores the stable fingerprint seed plus the
  profile directory that preserves cookies, localStorage, sessionStorage, and
  login state across browser restarts. The persisted table/DTO is still named
  `project_environments` for compatibility, but the product UI exposes it as a
  grouped Project identity surface with an editable fingerprint seed, read-only
  identity id, and backend-owned identity regeneration instead of a full
  environment list. Regeneration is confirmed in the UI before it replaces the
  identity and deletes the old local project profile directory.
- A subflow is a reusable non-runnable graph fragment inside one project.
  Workflows call subflows through `call_subflow` graph nodes; subflows run in
  the caller's browser context and do not create independent runs or browser
  sessions.
- An action config is the executable behavior produced by graph compilation.
- A run executes compiled graph action configs through the Electron CloakBrowser runner and reports progress to the UI.
- Operations Overview is the default Mission Control workspace. It combines
  current run snapshots with durable run, schedule, launch-block attention, and
  evidence metadata so the app remains operationally meaningful after restart.
- Evidence Explorer is the durable investigation workspace for persisted run
  evidence. It lists safe typed evidence items across runs, loads bounded
  details on demand, previews screenshots only through validated backend file
  commands, reveals artifacts in their folder, and exports sanitized manifest
  bundles without exposing absolute paths or raw browser storage.
- Identity Lab is the durable workspace for workflow-owned browser identities.
  It derives current managed identity rows from Workflow Settings, shows
  session continuity, configured posture, latest observed browser identity
  evidence, matching run/evidence summaries, rotation history, sanitized
  diagnostics, and read-only historical identity references.
- Mission Control navigation is a typed in-memory target contract across
  Overview, Projects, Evidence, Schedules, Identities, App Settings, and graph
  issues. The Projects workspace exposes project-scoped Workflows,
  Subflows, and Settings collections through fixed tabs in the selected
  project's detail panel while the project list sidebar stays focused on
  search and project selection.
  Targets carry ids and optional focus metadata, while stale durable targets
  produce visible unavailable states instead of falling back silently.
- A workflow schedule is an in-app automation trigger that starts the latest saved workflow graph and saved Workflow Settings while the Electron app is open.
- Outputs are named values captured during execution, such as extracted text, screenshot paths, download paths, or runtime variables. Variable actions can write typed scalar values, arrays, and flattened object fields into this output store for later template interpolation and loop inputs.
- A workflow graph is a versioned visual authoring model with nodes, edges, ports, viewport metadata, and action config payloads.
- A compiled workflow graph is a generated executable plan that maps graph nodes to action configs and run-scope metadata such as domain policy.
- A browser recording session is a backend-owned workflow-authoring draft. It
  starts from either a new unsaved Workflow Settings draft or an existing
  workflow's saved Workflow Settings, exposes only sanitized session/settings
  metadata through IPC, captures browser usage into reviewable action configs,
  and is not a saved workflow until a reviewed recording draft is explicitly
  saved. Reviewed steps keep backend-held first/last event timing so saved
  recording graphs can replay positive inter-step gaps through ordinary edge
  delays. Native file chooser paths are not trusted from browser capture; upload
  recorder steps stay excluded until the reviewer enters explicit local file
  paths that can replay through the normal `upload_file` action.
- The visual graph editor is the primary UI for graph logic. It can add/connect/delete nodes through React Flow, edit action and structured graph configs, validate graph issues, run graphs, and show run progress through canvas node state. Graph-native nodes are the user-facing way to express control flow; backend compilation maps them to internal `ActionConfig` control variants.
- Merge graph nodes explicitly let multiple branch paths continue into one shared path without adding parallel or wait-for-all semantics. Router graph nodes evaluate stable-id cases in priority order and run the first matching branch before continuing through `done`.
- Graph autosave is an app-level editing preference controlled from App Settings.
- Workflow Settings is the per-workflow configuration aggregate for run policy,
  graph authoring defaults, browser launch/session selection, and initial
  environment variables.
- The Browser Launch section is identity-oriented. New project saved sessions
  and private workflow sessions automatically get a browser identity with a
  stable `identity_id`, editable display name, stable `profile_dir`, fixed
  CloakBrowser fingerprint seed, and a stored persona selected from
  `src/lib/personaCatalog.ts`. The persona binds
  the OS/browser bucket, viewport/window dimensions, timezone/locale metadata,
  proxy/geo policy, WebRTC mode, font bundle metadata, and behavior timing
  profile so the identity is explainable and less clustered than one fixed
  desktop shape. Reuse login session only controls persistent storage; it does
  not rotate the fingerprint identity. The section also owns proxy
  server/credentials/bypass, timezone/locale/GeoIP, supported WebRTC IP policy
  values, the humanize toggle and `default`/`careful` preset, and
  headed/headless policy. New project saved sessions enable GeoIP by default so
  blank timezone/locale fields are resolved from the current public or proxy
  exit IP; blank legacy location settings normalize back to GeoIP, while
  operators who need GeoIP off should set explicit timezone and locale.
  Settings validation warns when proxy-enabled identities lack explicit
  timezone/locale and GeoIP is off, and when a configured fingerprint fonts
  directory can create a stable font hash across identities.
- CloakBrowser diagnostics are backend commands. They report wrapper/binary/cache/display/GeoIP status and browser profile metadata with bounded approximate profile sizes, and provide explicit binary install/check plus orphaned inactive profile cleanup without exposing browser storage or secrets to the renderer.
- The Run Policy section owns maximum workflow duration, terminal browser retention, the Allow Run JavaScript policy, Run from selected enablement/scope, and batch defaults for headless mode, concurrency, and stopping after the first failed row.
- The Graph section owns the default duration-only wait copied onto newly created graph links.
- The Environment section owns initial variable rows that are available before graph actions run.

## User Workflows

Users can:

- Create, select, rename, duplicate, and delete projects. Newly created
  projects automatically contain a project saved session and a draft workflow
  named `Main`.
- Export and import project packages containing project metadata, saved-session
  launch posture, private workflow sessions, workflows, saved graphs/settings,
  and subflows. Import creates a new project with fresh browser
  identities/profiles and does not import runs, evidence, schedules, app
  settings, or browser profile storage.
- Create, rename, open, and delete workflows inside a selected project.
- Create workflows in the default `Main` project by reusing the project saved
  session, or by creating a new private workflow session.
- Inspect the selected project's saved session from the selected project's
  Settings collection, edit its fingerprint seed, or regenerate its backend-owned
  identity/profile/seed after confirming that the old local profile will be
  deleted.
- Manage the selected project from the selected project's Settings collection:
  rename it, duplicate it as an independent project copy with copied workflows
  and subflows plus fresh browser identities, or delete it and all workflows,
  subflows, and saved browser sessions inside it after confirmation.
- Create workflows with a `Start -> New node` draft graph. `New node` is an unconfigured action draft that can be connected and saved before an action type is chosen.
- Turn graph autosave on or off from App Settings.
- Run a full workflow.
- Test a selected step with visible progress.
- Stop an active run from the workflow list row, workflow detail header, or
  graph run controls.
- Use browser/session/network/orchestration actions when building complex automation.
- Load, edit, save, validate, compile, and run supported visual workflow graphs.
- Create, open, save, duplicate, and delete reusable subflows from the selected
  project's Subflows collection. Deletion is blocked when a subflow is
  referenced by workflows.
- Add reusable subflows to workflow graphs from the dedicated Add Subflow
  toolbar picker, map inputs into the subflow, and inspect usage warnings before
  saving subflow changes.
- Create a reusable subflow from selected workflow graph nodes. The creation
  dialog can either only persist the new subflow or persist it and replace the
  selected nodes with a configured Call Subflow node.
- Configure the workflow's browser identity and launch behavior before running it.
- Configure Workflow Settings from the workflow list Edit action or the workflow detail Settings action.
- Export workflow packages containing Flow, selected Workflow Settings
  sections, and referenced subflows.
- Import workflow packages as new workflows in the selected project without
  overwriting existing workflows or the selected project's saved session.
- Duplicate workflows locally while preserving the saved graph and non-storage local settings, while creating a fresh browser identity/profile/fingerprint so the copy starts with a new session.
- Configure owned workflow pacing through explicit waits, retry blocks, and run policy controls; these do not bypass CAPTCHA, anti-bot, spam, or third-party account controls.
- Create, enable, disable, edit, delete, and audit workflow schedules from the Schedules page. Schedules can be one-time, interval-based, or friendly calendar presets and can coexist per workflow.
- Start, inspect, stop, and discard backend-owned browser recording sessions.
  Recorder sessions launch through backend browser/session infrastructure,
  inject page-side capture, observe top-level page navigation, and collect raw
  navigation, click, literal text input including clearing/whitespace,
  contenteditable input, select, checkbox/radio, clipboard copy/paste,
  keyboard, tab, and scroll events in memory. Capture
  drops malformed locator candidates, bounds locator strings, and redacts
  password or secret-like text field values before they enter the event stream;
  redacted input steps are generated excluded with a review warning until an
  operator supplies a safe value or variable. Backend normalization turns that
  raw stream into reviewable action-intent steps with ordered locator candidates,
  weak-locator warnings, deduped form-control clicks, text-editing keyboard
  noise suppression, stable grouping for editable targets whose visible text
  changes while typing, and paste replay as Set Clipboard followed by Paste
  Clipboard while suppressing the duplicate input event caused by the paste.
  Stopping a recorder session drains any buffered
  page-side fallback events before draft generation. Draft generation creates a
  validated review-only v2 workflow graph with deterministic row-wrapped layout
  and fixed edge delays for recorded inter-step pacing without persisting a
  workflow or replacing an existing saved graph. The workflow list exposes
  Record Workflow for creating a new workflow from a recording. The workflow
  detail header does not expose a Record Replacement action. The review dialog
  lets operators edit the workflow name,
  step labels, step inclusion, and supported captured values before
  `saveRecordingDraft` creates a normal workflow or explicitly replaces the
  linked graph. Draft save reconciles those edits against the backend-held draft
  by step id and ignores renderer-supplied action type, locator replacement, or
  timing replacement.
  Discarding a recorder session removes its in-memory session and drafts, and
  saving a draft consumes the draft/session after successful persistence.
- Open Overview to scan active runs, successful runs today, attention items,
  execution activity, recent evidence metadata, and upcoming schedules.
- Open Evidence to search/filter persisted screenshot, download, browser
  identity, action trace, and evidence manifest items across historical runs,
  then navigate back to the related run or workflow.
- Open Identities to inspect current managed browser identities, close an
  active retained session without deleting profile data, reset a guarded
  workflow identity through the existing backend rotation command, and navigate
  to related Evidence or Workflow Settings.
- Open App Settings to inspect sanitized environment readiness, trigger a
  guarded CloakBrowser binary install/check, clean up orphaned inactive browser
  profiles, control graph autosave, and view graph shortcut guidance.

## Current Source Files

- Frontend types: `src/types/workflow.ts`
- Shared persona catalog: `src/lib/personaCatalog.ts`
- UI orchestration: `src/App.tsx`
- Project workspace: `src/features/projects/pages/ProjectsPage.tsx`,
  `src/features/projects/components/ProjectEnvironmentSettings.tsx`
- Subflow pages: `src/features/workflows/pages/SubflowListPage.tsx`,
  `src/features/workflows/pages/SubflowDetailPage.tsx`
- Electron bridge wrappers: `src/lib/workflowApi.ts`
- Electron bridge type: `src/types/electron.ts`
- Electron main/preload: `electron/main.ts`, `electron/preload.cts`
- Node command handlers: `electron/backend/commands.ts`
- Browser recorder sessions: `electron/backend/recording/recorderSessionManager.ts`
- Run lifecycle manager: `electron/backend/runtime/runManager.ts`
- Browser session manager: `electron/backend/browser/sessionManager.ts`
- Workflow Settings service: `electron/backend/services/workflowSettingsService.ts`
- Workflow package service: `electron/backend/services/workflowPackageService.ts`
- Graph validation: `electron/backend/graph/validateGraph.ts`
- Graph compiler: `electron/backend/graph/compiler.ts`
- CloakBrowser runner: `electron/backend/runtime/runner.ts`
- SQLite bootstrap: `electron/backend/persistence/database.ts`
- Workflow repository: `electron/backend/persistence/workflowRepository.ts`
- Schedule repository and engine: `electron/backend/scheduling/workflowScheduleRepository.ts`, `electron/backend/scheduling/scheduler.ts`
- Operations read model: `electron/backend/operations/operationsRepository.ts`
- Evidence read model and artifact boundary:
  `electron/backend/evidence/evidenceRepository.ts`
- Identity read model: `electron/backend/identity/identityRepository.ts`

## Invariant

The product model is defined by current code. If this doc and code disagree during a task, update this doc for the touched area.
