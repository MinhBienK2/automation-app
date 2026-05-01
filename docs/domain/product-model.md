# Product Model

## Purpose

Workflow Automation Manager is a Tauri desktop app for building and running browser automation workflows.

## Core Concepts

- A workflow is a named automation definition with ordered steps.
- A workflow step has an id, name, workflow id, order index, action type, action-specific config, and timestamps.
- An action config is the executable behavior for a step.
- A run executes step configs through the Rust runner and reports progress to the UI.
- A test-step run executes from the first step through the selected step.
- Outputs are named values captured during execution, such as extracted text, screenshot paths, download paths, or runtime variables.
- A workflow graph is a versioned visual authoring model with nodes, edges, ports, viewport metadata, and action config payloads.
- A compiled workflow graph is a generated executable plan that maps graph nodes to action configs and expands subworkflow nodes before runner start.
- The visual graph editor is the primary UI for graph logic. It can add/connect/delete nodes through React Flow, edit action and structured graph configs, validate graph issues, run graphs, and show run progress through canvas node state. Graph-native nodes are the user-facing way to express control flow; backend compilation maps them to internal `ActionConfig` control variants.
- Graph autosave is an app-level editing preference controlled from Settings.

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
- Configure safe human checkpoints and pacing nodes; these do not bypass CAPTCHA, anti-bot, spam, or third-party account controls.

## Current Source Files

- Frontend types: `src/types/workflow.ts`
- UI orchestration: `src/App.tsx`
- Tauri command wrappers: `src/lib/workflowApi.ts`
- Rust domain: `src-tauri/src/domain/`
- Graph domain: `src-tauri/src/domain/workflow_graph.rs`
- Persistence: `src-tauri/src/repositories/workflow_repository.rs`
- Runner: `src-tauri/src/runner/`

## Invariant

The product model is defined by current code. If this doc and code disagree during a task, update this doc for the touched area.
