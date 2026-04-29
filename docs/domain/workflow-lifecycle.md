# Workflow Lifecycle

## Create

- UI calls `create_workflow` through `src/lib/workflowApi.ts`.
- Rust validates a non-blank workflow name in `src-tauri/src/domain/workflow.rs`.
- Repository trims and stores the workflow with timestamps.
- UI refreshes list and opens the created workflow.

## Open Detail

- UI calls `get_workflow`.
- Repository returns workflow metadata plus steps ordered by `order_index ASC`.
- UI selects the preferred step when present, otherwise the first step.

## Add Step

- UI opens an Add Step palette from the `Builder Steps` panel, then sends workflow id and selected action type to `add_step`.
- The Add Step palette defaults to the `All` category so every action type is visible before filtering.
- Backend creates the default config in `src-tauri/src/services/run_service.rs`.
- Repository appends at `MAX(order_index) + 1`.
- Step name defaults to the action label.

## Edit Step

- UI edits name and action-specific config.
- `update_step` validates config before persistence.
- Repository stores config JSON and trims blank step names back to the action label.
- Successful step saves show a temporary success message so the user gets immediate confirmation without blocking the UI.

## Duplicate Step

- UI duplicates from the selected step detail form.
- Duplicate creates a new step with the same action type through `add_step`.
- UI then saves the current form name plus ` Copy` and current form config onto the new step through `update_step`.
- The duplicated step becomes the selected step after the workflow reloads.

## Reorder Or Delete Step

- `reorder_steps` rewrites order indexes through a temporary negative-index pass.
- `delete_step` compacts remaining order indexes to stay contiguous.
- Workflow `updated_at` is touched when child steps change.

## Test Selected Step

- `test_step` loads the workflow, finds the selected step, and runs steps through that index.
- Run mode is `test_step`.
- Target step id is stored in run state.

## Run Full Workflow

- `run_workflow` loads the workflow and sends every step to the background runner.
- UI polls `get_run_state` while status is `running`.

## Stop

- `stop_run` cancels the active run and immediately returns a stopped state.
- Runner cancellation must remain responsive.

## Delete Workflow

- UI confirms with the user before calling `delete_workflow`.
- Deleting the selected workflow returns the UI to the list screen.

## Preserve

- Step order must remain stable, ordered, and contiguous.
- Run/test status must not mislead the user after success, failure, or stop.
- Command-facing errors must remain serializable through `CommandError`.
