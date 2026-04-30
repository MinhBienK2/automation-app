# Plan 6: Run Graph, Timeline, And Output Inspector

## Objective

Let users run supported graph workflows through the existing runner and inspect validation, execution timeline, and available variables/outputs from the graph workspace.

## TDD Slices

1. Add failing frontend tests:
   - Run Graph calls `run_workflow_graph`.
   - Validation panel shows blocking graph issues.
   - Timeline highlights current/completed/failed graph nodes from run state where metadata is available.
   - Output inspector shows known variables, loop variables, and redacted secrets.
2. Add failing Rust command tests:
   - `run_workflow_graph` compiles a supported graph and starts the injected fake runner.
   - unsupported graph execution returns a command error and does not start a run.

## Implementation Notes

- Use existing `RunState` where possible.
- Add graph metadata to compiled synthetic workflow steps so failures can point back to node labels.
- Use a timeline tree UI that can render flat current run state now and nested graph paths as runner metadata grows.

## DONE Criteria

- Focused run graph frontend tests pass.
- `cd src-tauri && cargo test --test command_api` passes for run graph.
- Existing run/test monitor behavior still passes.
- Graph run errors are readable and do not mislead users.
