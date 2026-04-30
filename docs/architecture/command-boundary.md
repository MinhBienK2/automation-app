# Command Boundary

## Purpose

The Tauri command layer is the contract between React and Rust.

## Key Files

- Frontend wrappers: `src/lib/workflowApi.ts`
- Wrapper tests: `src/lib/workflowApi.test.ts`
- Rust commands: `src-tauri/src/commands.rs`
- Command tests: `src-tauri/tests/command_api.rs`
- Tauri registration: `src-tauri/src/lib.rs`

## Belongs Here

- Command names and payload keys.
- Conversion from repository/domain/runner errors into `CommandError`.
- Workflow lookup and command-level not-found errors.
- Validation before persistence or execution.
- Import/export, batch run, builder assist command logic.
- Workflow graph load, save, validate, compile, and run command logic.
- Graph commands must keep invalid advanced node execution explicit: return a serializable command error before starting a run instead of compiling invalid nodes to no-ops.
- `run_subworkflow` nodes are expanded here before the browser runner starts, with cycle detection.
- Product-facing workflow execution goes through `run_workflow`, which runs the saved workflow graph. The UI saves the current graph before invoking it.
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
