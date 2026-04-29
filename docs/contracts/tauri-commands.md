# Tauri Command Contracts

## Source Files

- Frontend wrappers: `src/lib/workflowApi.ts`
- Frontend wrapper tests: `src/lib/workflowApi.test.ts`
- Rust commands: `src-tauri/src/commands.rs`
- Tauri registration: `src-tauri/src/lib.rs`
- Rust command tests: `src-tauri/tests/command_api.rs`

## Current Commands

- `ping`
- `app_data_dir`
- `list_workflows`
- `get_workflow`
- `create_workflow`
- `rename_workflow`
- `delete_workflow`
- `add_step`
- `update_step`
- `delete_step`
- `reorder_steps`
- `run_workflow`
- `test_step`
- `stop_run`
- `get_run_state`
- `validate_schedule`
- `export_workflow`
- `import_workflow`
- `run_batch_workflow`
- `suggest_selectors`
- `normalize_recorded_events`
- `dry_run_validate_config`
- `generate_fixture`

## Error Contract

Command errors serialize as:

```text
{ message: string, field: string | null }
```

Keep `CommandError` compatible with frontend error extraction in `src/lib/workflowUi.ts`.

## Payload Rules

- Frontend wrapper names may be camelCase.
- Invoke command names are snake_case strings.
- Payload keys must match Rust command parameter names after Tauri casing conversion expected by the current wrapper tests.

## Change Checklist

- Update `workflowApi.ts`.
- Update `workflowApi.test.ts`.
- Update `commands.rs`.
- Register new commands in `src-tauri/src/lib.rs`.
- Update `command_api.rs`.
