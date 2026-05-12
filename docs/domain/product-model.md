# Product Model

## Purpose

Workflow Automation Manager is an Electron desktop app for building and running browser automation workflows.

## Core Concepts

- A workflow is a named automation definition whose product authoring source is the saved visual graph.
- Legacy workflow step rows have an id, name, workflow id, order index, action type, action-specific config, and timestamps. They remain compatibility data, not the main authoring surface.
- An action config is the executable behavior produced by graph compilation or legacy compatibility rows.
- A run executes compiled graph action configs through the Electron CloakBrowser runner and reports progress to the UI.
- Test-step mode remains a legacy/internal run-state mode and is not currently registered as a product command.
- Outputs are named values captured during execution, such as extracted text, screenshot paths, download paths, or runtime variables. Variable actions can write typed scalar values, arrays, and flattened object fields into this output store for later template interpolation and loop inputs.
- A workflow graph is a versioned visual authoring model with nodes, edges, ports, viewport metadata, and action config payloads.
- A compiled workflow graph is a generated executable plan that maps graph nodes to action configs and run-scope metadata such as domain policy. Subworkflow nodes remain compatibility placeholders and fail explicitly until nested lifecycle semantics are implemented.
- The visual graph editor is the primary UI for graph logic. It can add/connect/delete nodes through React Flow, edit action and structured graph configs, validate graph issues, run graphs, and show run progress through canvas node state. Graph-native nodes are the user-facing way to express control flow; backend compilation maps them to internal `ActionConfig` control variants.
- Graph autosave is an app-level editing preference controlled from Settings.
- Workflow Settings is the per-workflow configuration aggregate for workflow identity, execution defaults, browser launch profile, environment defaults, initial variables, planned trigger metadata, and advanced compatibility diagnostics.
- The Browser section of Workflow Settings owns the reuse-login-session control, launch profile, proxy, device profile presets, user agent, viewport, mobile/touch flags, headed/headless default, challenge handling policy, and fingerprint preflight gate. Enabling reuse generates or uses a named persistent browser profile; disabling reuse clears the profile name so runs use temporary browser state. Device profile presets keep user agent, viewport, mobile, and touch settings coherent; legacy browser config commands map to this section for compatibility.
- The Execution section owns interaction fidelity, direct DOM fallback policy, and timing profile controls in addition to timeout, retention, wait-between-nodes, and batch defaults. Existing workflows default to standard fidelity.

## User Workflows

Users can:

- Create, rename, open, and delete workflows.
- Create workflows with a `Start -> New node` draft graph. `New node` is an unconfigured action draft that can be connected and saved before an action type is chosen.
- Turn graph autosave on or off from Settings.
- Use legacy step data through compatibility paths.
- Run a full workflow.
- Test a selected step with visible progress.
- Stop an active run.
- Use browser/session/network/orchestration actions when building complex automation.
- Load, edit, save, validate, compile, and run supported visual workflow graphs.
- Configure browser launch behavior for a workflow before running it.
- Gate sensitive workflow runs on an owned fingerprint probe and retain compact verdict evidence in outputs.
- Configure Workflow Settings from the workflow list Edit action or the workflow detail Settings action.
- Export workflow packages containing Flow and selected Workflow Settings sections.
- Import workflow packages as new workflows without overwriting existing workflows.
- Duplicate workflows locally while preserving saved graph and full local settings.
- Configure safe human checkpoints and pacing nodes; these do not bypass CAPTCHA, anti-bot, spam, or third-party account controls.

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

## Invariant

The product model is defined by current code. If this doc and code disagree during a task, update this doc for the touched area.
