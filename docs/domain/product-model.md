# Product Model

## Purpose

Mission Control is an Electron desktop app for building and running browser automation workflows.

## Core Concepts

- A workflow is a named automation definition whose product authoring source is the saved visual graph.
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
- A workflow schedule is an in-app automation trigger that starts the latest saved workflow graph and saved Workflow Settings while the Electron app is open.
- Outputs are named values captured during execution, such as extracted text, screenshot paths, download paths, or runtime variables. Variable actions can write typed scalar values, arrays, and flattened object fields into this output store for later template interpolation and loop inputs.
- A workflow graph is a versioned visual authoring model with nodes, edges, ports, viewport metadata, and action config payloads.
- A compiled workflow graph is a generated executable plan that maps graph nodes to action configs and run-scope metadata such as domain policy.
- The visual graph editor is the primary UI for graph logic. It can add/connect/delete nodes through React Flow, edit action and structured graph configs, validate graph issues, run graphs, and show run progress through canvas node state. Graph-native nodes are the user-facing way to express control flow; backend compilation maps them to internal `ActionConfig` control variants.
- Merge graph nodes explicitly let multiple branch paths continue into one shared path without adding parallel or wait-for-all semantics. Router graph nodes evaluate stable-id cases in priority order and run the first matching branch before continuing through `done`.
- Graph autosave is an app-level editing preference controlled from Settings.
- Workflow Settings is the per-workflow configuration aggregate for workflow identity, run policy, browser launch, graph authoring defaults, and initial environment variables.
- The Browser Launch section is identity-oriented. New workflows automatically get a browser identity with a stable `identity_id`, editable display name, stable `profile_dir`, fixed CloakBrowser fingerprint seed, and a stored persona selected from `src/lib/personaCatalog.ts`. The persona binds the OS/browser bucket, viewport/window dimensions, timezone/locale metadata, proxy/geo policy, WebRTC mode, font bundle metadata, and behavior timing profile so the identity is explainable and less clustered than one fixed desktop shape. Reuse login session only controls persistent storage; it does not rotate the fingerprint identity. The section also owns proxy server/credentials/bypass, timezone/locale/GeoIP, supported WebRTC IP policy values, the humanize toggle and `default`/`careful` preset, and headed/headless policy. New workflows enable GeoIP by default so blank timezone/locale fields are resolved from the current public or proxy exit IP; blank legacy location settings normalize back to GeoIP, while operators who need GeoIP off should set explicit timezone and locale. Settings validation warns when proxy-enabled identities lack explicit timezone/locale and GeoIP is off, and when a configured fingerprint fonts directory can create a stable font hash across identities.
- CloakBrowser diagnostics are backend commands. They report wrapper/binary/cache/display/GeoIP status and browser profile metadata with bounded approximate profile sizes, and provide explicit binary install/check plus orphaned inactive profile cleanup without exposing browser storage or secrets to the renderer.
- The Run Policy section owns maximum workflow duration, terminal browser retention, the Allow Run JavaScript policy, Run from selected enablement/scope, and batch defaults for headless mode, concurrency, and stopping after the first failed row.
- The Graph section owns the default duration-only wait copied onto newly created graph links.
- The Environment section owns initial variable rows that are available before graph actions run.

## User Workflows

Users can:

- Create, rename, open, and delete workflows.
- Create workflows with a `Start -> New node` draft graph. `New node` is an unconfigured action draft that can be connected and saved before an action type is chosen.
- Turn graph autosave on or off from Settings.
- Run a full workflow.
- Test a selected step with visible progress.
- Stop an active run, including a selected run from Runs when multiple isolated workflows are active.
- Use browser/session/network/orchestration actions when building complex automation.
- Load, edit, save, validate, compile, and run supported visual workflow graphs.
- Configure the workflow's browser identity and launch behavior before running it.
- Configure Workflow Settings from the workflow list Edit action or the workflow detail Settings action.
- Export workflow packages containing Flow and selected Workflow Settings sections.
- Import workflow packages as new workflows without overwriting existing workflows.
- Duplicate workflows locally while preserving the saved graph and non-storage local settings, while creating a fresh browser identity/profile/fingerprint so the copy starts with a new session.
- Configure owned workflow pacing through explicit waits, retry blocks, and run policy controls; these do not bypass CAPTCHA, anti-bot, spam, or third-party account controls.
- Create, enable, disable, edit, delete, and audit workflow schedules from the Schedules page. Schedules can be one-time, interval-based, or friendly calendar presets and can coexist per workflow.
- Open Runs to monitor concurrent workflow run snapshots and stop a selected active run by run id.
- Open Overview to scan active runs, successful runs today, attention items,
  execution activity, recent evidence metadata, and upcoming schedules.
- Open Evidence to search/filter persisted screenshot, download, browser
  identity, action trace, and evidence manifest items across historical runs,
  then navigate back to the related run or workflow.

## Current Source Files

- Frontend types: `src/types/workflow.ts`
- Shared persona catalog: `src/lib/personaCatalog.ts`
- UI orchestration: `src/App.tsx`
- Electron bridge wrappers: `src/lib/workflowApi.ts`
- Electron bridge type: `src/types/electron.ts`
- Electron main/preload: `electron/main.ts`, `electron/preload.cts`
- Node command handlers: `electron/backend/commands.ts`
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

## Invariant

The product model is defined by current code. If this doc and code disagree during a task, update this doc for the touched area.
