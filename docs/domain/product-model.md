# Product Model

## Purpose

Workflow Automation Manager is an Electron desktop app for building and running browser automation workflows.

## Core Concepts

- A workflow is a named automation definition whose product authoring source is the saved visual graph.
- An action config is the executable behavior produced by graph compilation.
- A run executes compiled graph action configs through the Electron CloakBrowser runner and reports progress to the UI.
- A workflow schedule is an in-app automation trigger that starts the latest saved workflow graph and saved Workflow Settings while the Electron app is open.
- Outputs are named values captured during execution, such as extracted text, screenshot paths, download paths, or runtime variables. Variable actions can write typed scalar values, arrays, and flattened object fields into this output store for later template interpolation and loop inputs.
- A workflow graph is a versioned visual authoring model with nodes, edges, ports, viewport metadata, and action config payloads.
- A compiled workflow graph is a generated executable plan that maps graph nodes to action configs and run-scope metadata such as domain policy.
- The visual graph editor is the primary UI for graph logic. It can add/connect/delete nodes through React Flow, edit action and structured graph configs, validate graph issues, run graphs, and show run progress through canvas node state. Graph-native nodes are the user-facing way to express control flow; backend compilation maps them to internal `ActionConfig` control variants.
- Merge graph nodes explicitly let multiple branch paths continue into one shared path without adding parallel or wait-for-all semantics. Router graph nodes evaluate stable-id cases in priority order and run the first matching branch before continuing through `done`.
- Graph autosave is an app-level editing preference controlled from Settings.
- Workflow Settings is the per-workflow configuration aggregate for workflow identity, run policy, browser launch, graph authoring defaults, and initial environment variables.
- The Browser Launch section is identity-oriented. New workflows automatically get a browser identity with a stable `identity_id`, editable display name, stable `profile_dir`, and fixed CloakBrowser fingerprint seed. Reuse login session only controls persistent storage; it does not rotate the fingerprint identity. The section also owns Run from selected enablement, proxy posture and non-secret proxy metadata, timezone/locale/GeoIP, supported WebRTC IP policy values, optional Custom fingerprint overrides for tested user-agent/device/hardware bundles, the humanize toggle and `default`/`careful` preset, optional owned fingerprint preflight, and headed/headless policy.
- CloakBrowser diagnostics are backend commands. They report wrapper/binary/cache/display/GeoIP status and browser profile metadata, and provide explicit binary install/check plus orphaned inactive profile cleanup without exposing browser storage or secrets to the renderer.
- The Run Policy section owns maximum workflow duration, terminal browser retention, and batch defaults for headless mode, concurrency, and stopping after the first failed row.
- The Graph section owns the default duration-only wait copied onto newly created graph links.
- The Environment section owns initial variable rows that are available before graph actions run.

## User Workflows

Users can:

- Create, rename, open, and delete workflows.
- Create workflows with a `Start -> New node` draft graph. `New node` is an unconfigured action draft that can be connected and saved before an action type is chosen.
- Turn graph autosave on or off from Settings.
- Run a full workflow.
- Test a selected step with visible progress.
- Stop an active run, including a selected run from Run Center when multiple isolated workflows are active.
- Use browser/session/network/orchestration actions when building complex automation.
- Load, edit, save, validate, compile, and run supported visual workflow graphs.
- Configure the workflow's browser identity and launch behavior before running it.
- Configure Workflow Settings from the workflow list Edit action or the workflow detail Settings action.
- Export workflow packages containing Flow and selected Workflow Settings sections.
- Import workflow packages as new workflows without overwriting existing workflows.
- Duplicate workflows locally while preserving the saved graph and non-storage local settings, while creating a fresh browser identity/profile/fingerprint so the copy starts with a new session.
- Configure owned workflow pacing through explicit waits, retry blocks, and run policy controls; these do not bypass CAPTCHA, anti-bot, spam, or third-party account controls.
- Create, enable, disable, edit, delete, and audit workflow schedules from the Schedules page. Schedules can be one-time, interval-based, or friendly calendar presets and can coexist per workflow.
- Open Run Center to monitor concurrent workflow run snapshots and stop a selected active run by run id.

## Current Source Files

- Frontend types: `src/types/workflow.ts`
- UI orchestration: `src/App.tsx`
- Electron bridge wrappers: `src/lib/workflowApi.ts`
- Electron bridge type: `src/types/electron.ts`
- Electron main/preload: `electron/main.ts`, `electron/preload.cts`
- Node command handlers: `electron/backend/commands.ts`
- Graph compiler: `electron/backend/graphCompiler.ts`
- CloakBrowser runner: `electron/backend/runner.ts`
- SQLite bootstrap: `electron/backend/database.ts`
- Workflow repository: `electron/backend/workflowRepository.ts`
- Schedule repository and engine: `electron/backend/workflowScheduleRepository.ts`, `electron/backend/scheduler.ts`

## Invariant

The product model is defined by current code. If this doc and code disagree during a task, update this doc for the touched area.
