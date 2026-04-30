# Plan 1: Graph Domain, Persistence, And Commands

## Objective

Add a versioned workflow graph model to Rust, persist it without breaking existing workflow steps, and expose command APIs for loading, saving, validating, compiling, and running graph workflows.

## TDD Slices

1. Add failing persistence tests:
   - Creating a workflow can save and reload a graph.
   - Deleting a workflow cascades its graph.
   - Existing workflows without graph rows still load.
2. Add failing domain tests:
   - A valid graph has exactly one start node and valid edge endpoints.
   - Graph validation rejects missing start, invalid ports, unreachable required nodes, and unsafe unbounded loops.
3. Add failing command tests:
   - `get_workflow_graph` returns a generated linear graph for workflows without saved graph data.
   - `save_workflow_graph` validates and persists graph JSON.
   - `validate_workflow_graph` returns validation issues without persisting.
   - `run_workflow_graph` starts the runner from compiled graph steps for supported graph nodes.

## Implementation Notes

- Add `WorkflowGraph`, `GraphNode`, `GraphEdge`, `GraphPort`, `GraphViewport`, `GraphValidationIssue`, and supporting enums under `src-tauri/src/domain/`.
- Add a migration for a dedicated graph table keyed by `workflow_id`.
- Repository methods:
  - `get_workflow_graph(workflow_id)`
  - `save_workflow_graph(workflow_id, graph)`
  - fallback builder from existing ordered steps.
- Commands:
  - `get_workflow_graph`
  - `save_workflow_graph`
  - `validate_workflow_graph`
  - `compile_workflow_graph`
  - `run_workflow_graph`
- Register commands in `src-tauri/src/lib.rs`.

## DONE Criteria

- `cd src-tauri && cargo test --test persistence` passes.
- `cd src-tauri && cargo test --test domain_validation` passes for new graph validation cases.
- `cd src-tauri && cargo test --test command_api` passes for graph commands.
- Existing command and persistence tests still pass.
- Docs contracts list new commands and graph shape.
