# Agent Technical Guide

Date: 2026-04-27

## Executive Summary

Workflow Automation Manager is a Tauri desktop MVP for building browser automation workflows. The frontend is a React/Vite app that owns interaction state and calls typed Tauri commands. The backend is Rust with a SQLite repository, domain validation, command adapters, and a Chromium runner.

The core product model is intentionally small:

- A workflow has a name and ordered steps.
- A step has a name, action type, order index, and action-specific config.
- Users build workflows manually, run the full workflow, or test from step 1 through a selected step.
- Runner sessions open a headed Chromium browser and keep it open after success, failure, or stop.

The current frontend flow is split into two screens:

1. Workflow List: create, inspect, open, and delete workflows.
2. Workflow Detail: rename, run/test/stop, reorder steps, add steps, edit selected step config, and inspect test progress.

## Reading Paths

For UI changes:

1. Read `DESIGN.md`.
2. Read `src/App.tsx:38` for state orchestration.
3. Read the relevant component under `src/components/workflows/`.
4. Update `src/App.test.tsx` before implementation.

For command or payload changes:

1. Read `src/types/workflow.ts:1` and keep it compatible with Rust serialization.
2. Read `src/lib/workflowApi.ts:1` for frontend command wrappers.
3. Read `src-tauri/src/commands.rs:42` for command implementations.
4. Add or update Rust tests under `src-tauri/tests/`.

For persistence changes:

1. Read `src-tauri/src/domain/workflow.rs:6`.
2. Read `src-tauri/src/repositories/workflow_repository.rs:44`.
3. Add a migration under `src-tauri/migrations/`.
4. Update repository tests.

For runner changes:

1. Read `src-tauri/src/runner/mod.rs:97`.
2. Read `src-tauri/src/app_state.rs` for run-state storage and cancellation.
3. Update `src-tauri/tests/runner_spike.rs` and command tests.

## Architecture Overview

```text
React UI
  -> src/App.tsx state orchestration
  -> src/components/workflows/* presentational workflow UI
  -> src/lib/workflowApi.ts typed invoke wrappers
  -> Tauri invoke boundary
Rust commands
  -> src-tauri/src/commands.rs validation and command adapters
  -> src-tauri/src/repositories/workflow_repository.rs SQLite persistence
  -> src-tauri/src/runner/mod.rs Chromium execution
  -> src-tauri/src/app_state.rs shared repository, run state, active run
SQLite
  -> workflows
  -> workflow_steps
```

The important boundary is the Tauri command layer. Frontend code should not know SQL details or runner internals. Rust command code should not know React component structure.

## Frontend Structure

### `src/App.tsx`

`src/App.tsx:38` is the top-level orchestrator. It owns:

- Current screen: `list` or `detail`.
- Workflow summaries and selected workflow detail.
- Selected step id.
- Run state and polling.
- Test monitor open state and included step ids.
- Form state for new workflow name and new action type.
- Command-level error text.

It does not render low-level workflow UI directly. It passes state and callbacks to `WorkflowListPage`, `WorkflowDetailPage`, and `TestStepMonitor`.

Key flows:

- Initial load: `list_workflows` and `get_run_state` at `src/App.tsx:54`.
- Open detail: `openWorkflow` loads `get_workflow`, selects a preferred or first step, then switches screen at `src/App.tsx:79`.
- Create: `createWorkflow` calls `create_workflow`, refreshes list, then opens detail at `src/App.tsx:115`.
- Step save: the callback at `src/App.tsx:273` calls `update_step` and reloads detail.
- Test step: `testStep` opens the monitor and calls `test_step` at `src/App.tsx:187`.
- Run polling: while status is `running`, polling refreshes run state every 250ms at `src/App.tsx:59`.

### Components

| File | Responsibility |
| --- | --- |
| `src/components/workflows/WorkflowListPage.tsx` | Full list screen, create form, workflow cards, `View Details`, delete action. |
| `src/components/workflows/WorkflowDetailPage.tsx` | Full workflow workspace, back action, rename form, run controls, step panels. |
| `src/components/workflows/StepList.tsx` | Sortable ordered steps and add-step form. Owns dnd-kit sensors. |
| `src/components/workflows/StepForm.tsx` | Selected step name and action-specific config fields. Owns field-level save errors. |
| `src/components/workflows/RunStatusBar.tsx` | Run status and command error display. |
| `src/components/workflows/TestStepMonitor.tsx` | Modal progress view for `test_step`. |

The components are deliberately prop-driven. They do not call Tauri commands directly. This keeps command payloads centralized in `App.tsx` and `src/lib/workflowApi.ts`.

### Shared Frontend Modules

`src/types/workflow.ts:1` defines the TypeScript mirror of backend DTOs. Keep these shapes aligned with Rust `Serialize`/`Deserialize` output.

`src/lib/workflowApi.ts:1` wraps Tauri `invoke`. Keep command names and payload keys here. Existing tests assert these payloads, so changing wrappers should be paired with frontend test updates.

`src/lib/workflowUi.ts:1` contains pure helpers:

- Action labels and options.
- Initial and normalized run state.
- Step config summaries.
- Command error message extraction.
- Monitor per-step status.
- Rule-based failure suggestions.

Pure helpers are the right place for UI-only rules that do not need backend persistence.

## Design System

`DESIGN.md` is mandatory for changes to `src/App.css`, layout structure, or user-facing styling.

Current UI principles:

- Dark native page canvas: `#171717`.
- Dark panels and controls: `#0f0f0f`.
- Depth through borders, not shadows.
- Green only for primary action borders, active state, and status accent.
- Dense operational layout, not marketing composition.
- Primary workflow actions use pill buttons.
- Cards and panels use 8px radius.
- Mobile layout collapses to one column below the CSS breakpoint.

The UI should remain task-focused. Do not add decorative gradients, oversized hero sections, nested cards, or unrelated marketing copy.

## Backend Structure

### Domain

`src-tauri/src/domain/workflow.rs:6` defines `Workflow` and `WorkflowStep`. `Workflow::validate` ensures names are not blank. `WorkflowStep::new` sets the default step name from the action label.

`src-tauri/src/domain/action_config.rs:5` defines action types and action configs. The enum uses serde tags:

```text
{ type: "click", config: { xpath: "..." } }
```

This shape must stay compatible with `src/types/workflow.ts`.

Validation is domain-owned:

- Open URL requires URL.
- Sleep seconds must be greater than 0.
- Type Text requires XPath and text.
- Click requires XPath.
- Scroll pixels must be greater than 0.

### Repository

`src-tauri/src/repositories/workflow_repository.rs:44` handles SQLite reads and writes.

Important behavior:

- `list_workflows` returns workflow summaries with step counts, ordered by updated time then name.
- `get_workflow` returns the workflow plus ordered steps.
- `add_step` appends by using `MAX(order_index) + 1`.
- `update_step` stores step name, action type, and serialized config.
- `delete_step` and `reorder_steps` preserve contiguous order indexes.
- Workflow `updated_at` is touched when child steps change.

Persistence owns JSON serialization for action configs. UI code should treat configs as structured objects and avoid string manipulation.

### Commands

`src-tauri/src/commands.rs:42` exposes command implementation functions and Tauri command wrappers.

Command responsibilities:

- Convert repository and validation errors into serializable `CommandError`.
- Validate workflow names and action configs before persistence.
- Slice steps for selected-step testing.
- Start background runs through `start_background_run`.

Command-facing errors must remain serializable:

```rust
pub struct CommandError {
    pub message: String,
    pub field: Option<String>,
}
```

### Runner

`src-tauri/src/runner/mod.rs:97` is the Chromium runner.

Runner behavior:

- Launches a headed Chromium browser by default for MVP flows.
- Creates a temporary user data directory.
- Executes each action in order.
- Reports `StepStarted` and `StepCompleted` progress.
- Supports cancellation through `RunnerCancellation`.
- Returns success, failed, or stopped outcomes.
- Keeps the browser session open after terminal outcomes unless explicitly closed by backend cleanup.

Action execution intentionally avoids broad auto-wait behavior. Sleep is the explicit wait mechanism.

## Data Flow Details

### Open Workflow Detail

```text
WorkflowListPage View Details
  -> App.openWorkflow(id)
  -> workflowApi.getWorkflow(id)
  -> Tauri get_workflow
  -> repository.get_workflow
  -> App sets detail, selected step, screen = detail
  -> WorkflowDetailPage renders workspace
```

### Save Step

```text
StepForm submit
  -> WorkflowDetailPage onSaveStep prop
  -> App callback at src/App.tsx:273
  -> workflowApi.updateStep(stepId, name, config)
  -> Tauri update_step
  -> ActionConfig.validate
  -> repository.update_step
  -> App.reloadSelectedWorkflow(stepId)
```

### Test Step

```text
WorkflowDetailPage Test to Here
  -> App.testStep(selectedStepId)
  -> App opens monitor with steps 1..selected
  -> workflowApi.testStep(workflowId, stepId)
  -> Tauri test_step slices steps through selected index
  -> background runner updates RunStateDto
  -> App polls get_run_state every 250ms while running
  -> TestStepMonitor renders progress, failure detail, suggestions
```

## Testing Strategy

Frontend:

- Tests live in `src/App.test.tsx`.
- Use Testing Library for user-facing flow assertions.
- Mock `@tauri-apps/api/core` and assert command payloads.
- The navigation test verifies list/detail separation.

Relevant commands:

```bash
npm test -- src/App.test.tsx
npx tsc --noEmit
npm run build
```

Rust:

- Command API tests: `src-tauri/tests/command_api.rs`.
- Domain validation tests: `src-tauri/tests/domain_validation.rs`.
- Persistence tests: `src-tauri/tests/persistence.rs`.
- Runner tests/spikes: `src-tauri/tests/runner_spike.rs`.

Relevant commands:

```bash
cd src-tauri && cargo test
cd src-tauri && cargo fmt --check
cd src-tauri && cargo clippy --all-targets --all-features
```

## Common Change Guide

### Add A New Action Type

1. Add Rust enum variant in `src-tauri/src/domain/action_config.rs`.
2. Add validation rules in the same file.
3. Add default config in `src-tauri/src/commands.rs`.
4. Add runner behavior in `src-tauri/src/runner/mod.rs`.
5. Add TypeScript variant in `src/types/workflow.ts`.
6. Add label and option in `src/lib/workflowUi.ts`.
7. Add fields in `src/components/workflows/StepForm.tsx`.
8. Add frontend and Rust tests.

### Change Workflow UI Layout

1. Read `DESIGN.md`.
2. Add or update frontend tests first.
3. Keep screen-level state in `App.tsx`.
4. Keep command-free rendering inside components.
5. Update `src/App.css` using existing tokens and class patterns.

### Change Persistence

1. Write or update repository tests.
2. Add a migration under `src-tauri/migrations/`.
3. Update repository mapping code.
4. Update TypeScript DTOs only if the command payload changes.

### Change Runner Progress

1. Update `RunStateDto` in `src-tauri/src/app_state.rs`.
2. Update command tests for progress payload.
3. Update frontend type in `src/types/workflow.ts`.
4. Update monitor rendering helpers in `src/lib/workflowUi.ts`.

## Operational Notes

- The app uses npm for frontend commands and cargo inside `src-tauri/`.
- Do not bypass TDD for behavior changes. The project-level `AGENTS.md` requires test-first work.
- Keep the README smoke checklist accurate when user-visible workflow behavior changes.
- Do not revert unrelated local changes. Work with the current tree.
- AI commits, if requested, must include a `Co-Authored-By` trailer as described in `AGENTS.md`.

## Known Boundaries

- No router dependency is used; screen switching is local state.
- No external frontend state store is used.
- No recorder, element picker, run history, variables, screenshots, or profile persistence exists in the MVP.
- Chromium runner behavior is intentionally simple and manual-wait driven.
