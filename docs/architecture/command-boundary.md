# Command Boundary

## Purpose

The Tauri command layer is the contract between React and Rust.

## Key Files

- Frontend wrappers: `src/lib/workflowApi.ts`
- Wrapper tests: `src/lib/workflowApi.test.ts`
- Rust commands: `src-tauri/src/commands.rs`
- Rust graph command internals: `src-tauri/src/commands/graph.rs`
- Rust import/export command internals: `src-tauri/src/commands/import_export.rs`
- Command tests: `src-tauri/tests/command_api.rs`
- Tauri registration: `src-tauri/src/lib.rs`

## Belongs Here

- Command names and payload keys.
- Conversion from repository/domain/runner errors into `CommandError`.
- Workflow lookup and command-level not-found errors.
- Validation before persistence or execution.
- Workflow Settings load/save/section-save commands, run validation, and validation before persistence or execution.
- Legacy workflow browser runtime config commands map to Workflow Settings Browser.
- Import/export, duplicate, batch run, builder assist command logic.
- Workflow graph load, save, validate, compile, and run command logic.
- Graph commands must keep invalid advanced node execution explicit: return a serializable command error before starting a run instead of compiling invalid nodes to no-ops.
- Graph runs reject graphs with no executable compiled steps before starting the runner.
- `run_subworkflow` nodes are expanded here before the browser runner starts, with cycle detection.
- Product-facing workflow execution goes through `run_workflow`, which runs the saved workflow graph with saved Workflow Settings as the run baseline. The UI saves the current graph and dirty settings sections before invoking it.
- Product-facing local copy goes through `duplicate_workflow`, which copies saved graph and full local settings without package-export sanitization.
- Debug-only fixture generation is not part of the production invoke surface.
- List-step authoring commands are retired from Tauri registration; legacy Rust helpers may remain internal until import/export and persistence cleanup is complete.

## Does Not Belong Here

- UI state decisions.
- SQL implementation details.
- Browser action internals.
- Long-running run progress state internals outside calls into `AppState`.

## Change Checklist

- Update `workflowApi.ts` and `workflowApi.test.ts` for invoke contract changes.
- Keep `CommandError` serializable as `{ message, field }`.
- Add/update `src-tauri/tests/command_api.rs`.
- Register new Tauri commands in `src-tauri/src/lib.rs`.
