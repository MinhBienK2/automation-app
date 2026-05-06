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
- `get_workflow_graph`
- `save_workflow_graph`
- `validate_workflow_graph`
- `compile_workflow_graph`
- `get_workflow_settings`
- `save_workflow_settings`
- `save_workflow_settings_section`
- `validate_workflow_settings`
- `validate_workflow_run`
- `get_workflow_browser_config`
- `save_workflow_browser_config`
- `run_workflow`
- `stop_run`
- `get_run_state`
- `validate_schedule`
- `export_workflow`
- `import_workflow`
- `export_workflow_package`
- `preview_workflow_package`
- `import_workflow_package`
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
- Graph command payloads:
  - `get_workflow_graph`: `{ workflowId }`
  - `save_workflow_graph`: `{ workflowId, graph }`
  - `validate_workflow_graph`: `{ graph }`
  - `compile_workflow_graph`: `{ graph }`
- Browser runtime config command payloads:
  - `get_workflow_browser_config`: `{ workflowId }`
  - `save_workflow_browser_config`: `{ workflowId, config }`
- Workflow Settings command payloads:
  - `get_workflow_settings`: `{ workflowId }`
  - `save_workflow_settings`: `{ workflowId, settings }`
  - `save_workflow_settings_section`: `{ workflowId, section, sectionValue }`
  - `validate_workflow_settings`: `{ settings }`
  - `validate_workflow_run`: `{ workflowId }`
- `run_workflow`: `{ workflowId }`; the frontend saves the current graph first, then this command validates, compiles, and runs the saved graph.
- Workflow package command payloads:
  - `export_workflow_package`: `{ workflowId, options }`, where `options` selects `include_flow` and `settings_sections`.
  - `preview_workflow_package`: `{ package }`; validates package kind/version/name and reports available sections before import.
  - `import_workflow_package`: `{ package, options }`; always creates a new workflow and never overwrites an existing workflow.

## Workflow Package Commands

`export_workflow_package` is the product-facing import/export path. It emits `workflow_package` version 2 JSON with optional `flow` and partial `settings` sections. Flow uses saved `WorkflowGraph`; Settings sections use the current Workflow Settings contract.

Package export sanitizes machine-local or sensitive settings fields by default. The current sanitizer omits browser proxy passwords, environment download directories, cookies, local storage, session storage, and session restore refs, and lists omitted field paths in `omitted_fields`.

`import_workflow_package` validates the package header and selected Settings sections before creating the new workflow. The imported workflow name is derived as `<package workflow name> (imported)`, selected Flow is saved to the new workflow id, and selected Settings are remapped to the new workflow id with General name updated to the imported name.

## Retired Product Commands

The list-step builder is no longer a product surface. `add_step`, `update_step`, `delete_step`, `reorder_steps`, `test_step`, and `run_workflow_graph` are not registered Tauri commands. Some Rust implementation helpers and repository methods may remain temporarily for import/export compatibility and legacy test coverage.

## Change Checklist

- Update `workflowApi.ts`.
- Update `workflowApi.test.ts`.
- Update `commands.rs`.
- Register new commands in `src-tauri/src/lib.rs`.
- Update `command_api.rs`.
