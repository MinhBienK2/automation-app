# Plan 04 - Tauri Command API

## Goal

Expose workflow persistence and run-state placeholders to the frontend through Tauri commands.

This plan wires backend APIs to the app shell but does not build the full UI or browser runner.

## Scope

Add Tauri commands for workflow CRUD and step CRUD. Add placeholder run commands that return a clear not-implemented or no-op response only if the runner is not available yet.

## Commands

Implement:

- `list_workflows()`
- `create_workflow(name)`
- `get_workflow(id)`
- `rename_workflow(id, name)`
- `delete_workflow(id)`
- `add_step(workflow_id, action_type)`
- `update_step(step_id, config)`
- `delete_step(step_id)`
- `reorder_steps(workflow_id, ordered_step_ids)`
- `get_run_state()`

Add command signatures for later runner integration:

- `run_workflow(workflow_id)`
- `test_step(workflow_id, step_id)`
- `stop_run()`

If runner is not implemented yet, these runner commands must return a predictable MVP-safe response and must not pretend to run a browser.

## DTOs

Create JSON-safe DTOs for:

- Workflow summary.
- Workflow detail with ordered steps.
- Step detail.
- Action config.
- Validation errors.
- Run state.

## DONE Gate

This plan is DONE when:

- Frontend can call workflow CRUD commands.
- Commands return JSON-safe DTOs.
- Command errors map to user-facing messages.
- Invalid input returns validation errors.
- App initializes database and migrations before serving commands.
- `cargo test` passes.
- A minimal frontend command smoke check works.

## Checks

```text
cargo test
npm run build
```

## Stop Rule

Stop after command API works. Do not build the full workflow list or builder UI in this plan.
