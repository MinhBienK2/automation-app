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

## User Workflows

Users can:

- Create, rename, open, and delete workflows.
- Add, edit, reorder, and delete steps.
- Run a full workflow.
- Test a selected step with visible progress.
- Stop an active run.
- Use browser/session/network/orchestration actions when building complex automation.

## Current Source Files

- Frontend types: `src/types/workflow.ts`
- UI orchestration: `src/App.tsx`
- Tauri command wrappers: `src/lib/workflowApi.ts`
- Rust domain: `src-tauri/src/domain/`
- Persistence: `src-tauri/src/repositories/workflow_repository.rs`
- Runner: `src-tauri/src/runner/`

## Invariant

The product model is defined by current code. If this doc and code disagree during a task, update this doc for the touched area.

