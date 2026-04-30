# Graph-Only Workflow Builder Design

Date: 2026-04-30

## Summary

The application will move to a graph-only workflow builder. Visual Graph becomes the primary and only workflow authoring surface. The old list-based step builder is removed from the product UI and its user-facing command paths are retired.

Workflow data is authored, saved, validated, and run from a workflow graph. Action configs remain the execution primitive inside action nodes, so the existing runner action implementations can still be reused through graph compilation.

## Goals

- Make Visual Graph the single workflow builder.
- Remove the list step builder from workflow detail UI.
- Avoid dual sources of truth between `workflow_steps` and `workflow_graphs`.
- Support only executable graph node types in the v1 palette.
- Let users configure action nodes directly inside the graph inspector.
- Make `Run` execute the graph currently visible to the user.
- Keep validation and runtime feedback attached to graph nodes and edges.

## Non-Goals

- No compatibility requirement for old list-only workflow data.
- No arbitrary freeform graph semantics beyond the supported executable node set.
- No unsupported advanced node authoring in the v1 palette.
- No requirement to drop the legacy `workflow_steps` database table in the first implementation pass.
- No visual browser companion or high-fidelity mockup as part of this spec.

## Supported Node Set

The v1 graph palette includes only node types with clear runtime behavior:

- `start`
- `end_success`
- `end_failure`
- `action`
- `if`
- `repeat_times`
- `repeat_for_each`
- `retry`
- `manual_approval`
- `rate_limit`

Other graph node types may remain in shared DTO enums for future compatibility, but they are not shown in the palette. If a persisted graph contains an unsupported node, validation or compile returns a serializable error instead of treating it as a no-op.

## Product UX

The workflow detail screen becomes a graph workspace.

Header actions:

- `Validate`
- `Run`
- `Stop` when a run is active
- `Save`

Header status should distinguish:

- saved graph
- unsaved changes
- validation errors
- run status

Main workspace:

- Left palette for supported executable nodes.
- Center graph canvas for nodes and edges.
- Right inspector for selected node or edge details.
- Runtime panels for validation issues, graph run timeline, and output/context inspection.

The old `StepList`, `StepForm` workflow detail panel, test-to-here, list drag/reorder, duplicate step flow, and selected step state are removed from the primary UI.

## Canvas And Inspector Behavior

The graph editor must support:

- creating supported nodes from the palette
- selecting nodes
- editing node labels
- editing node config
- moving nodes
- connecting nodes by explicit source port and target port
- deleting edges
- deleting nodes and their incident edges
- saving the current graph
- validating the current graph
- running the graph currently visible in the editor

Connection behavior must not choose the first output port implicitly. Multi-branch nodes need explicit port selection so users can create the intended branch.

Action nodes need a full action config editor. The existing step form logic should be split so reusable action config editing can be used by the graph inspector:

- `ActionConfigEditor` owns fields for an `ActionConfig`.
- Graph action nodes use `ActionConfigEditor`.
- Step-specific controls such as duplicate/delete/reorder are not carried forward as graph concepts.

Drag-to-move and pan/zoom are desirable, but they are not required for the first graph-only pass if keyboard/buttons or simple movement controls keep the editor usable. If implemented, they must preserve the existing dark design system.

## Data Model

Graph authoring data is the source of truth:

- `workflows` stores workflow metadata.
- `workflow_graphs.graph_json` stores graph nodes, edges, viewport, labels, and node config.

Legacy `workflow_steps` no longer represents the user-authored workflow. It may remain in the database during the first implementation pass to reduce migration risk, but the product should stop writing user-authored steps through list commands.

`create_workflow` creates a workflow and an initial graph:

```text
Start -> End Success
```

Workflow detail loading uses `get_workflow`, but the response shape changes from `{ workflow, steps }` to `{ workflow, graph }`. The UI no longer loads or stores selected step state. `get_workflow_graph` may remain as a lower-level command for isolated graph tests or future tooling, but product detail loading should use the single workflow detail command.

## Commands

The command boundary should be simplified around graph workflows.

Keep or adapt:

- `list_workflows`
- `get_workflow`, returning workflow metadata plus graph
- `create_workflow`
- `rename_workflow`
- `delete_workflow`
- `get_workflow_graph`
- `save_workflow_graph`
- `validate_workflow_graph`
- `compile_workflow_graph`
- `run_workflow`
- `stop_run`
- `get_run_state`
- graph-compatible import/export commands

Remove from the registered product API:

- `add_step`
- `update_step`
- `delete_step`
- `reorder_steps`
- `test_step`

`run_workflow` should run the saved graph for the workflow. Because the UI is graph-only, using `run_workflow` as the main run command is clearer than exposing both workflow run and graph run as separate product actions.

Before running, the frontend should auto-save the current graph, then call `run_workflow`. This prevents the user from seeing one graph while the backend runs an older saved graph.

## Port Contract

Frontend and Rust must share the same executable port contract.

The v1 port contract is:

- `start`: output `out`
- `end_success`: input `in`
- `end_failure`: input `in`
- `action`: input `in`, output `out`
- `if`: input `in`, outputs `true`, `false`
- `repeat_times`: input `in`, outputs `loop`, `done`
- `repeat_for_each`: input `in`, outputs `loop`, `done`
- `retry`: input `in`, outputs `try`, `success`, `failed`
- `manual_approval`: input `in`, output `out`
- `rate_limit`: input `in`, output `out`

The current mismatch where frontend `repeat_for_each` uses `loop` but Rust compile reads `item` must be fixed. The current mismatch where frontend `retry` exposes `failed` but Rust compile reads continuation from `success` must also be fixed.

## Validation

Graph validation should block save/run when the graph cannot execute predictably.

Validation covers:

- exactly one `start` node
- known node types only for executable graph runs
- supported nodes contain required ports
- every edge references existing nodes
- every edge references valid source and target ports
- source port direction is output
- target port direction is input
- action nodes contain valid `ActionConfig`
- `repeat_times` count is greater than zero
- `repeat_for_each` has a non-empty item name and non-empty items
- `retry` max attempts is greater than zero
- graph nodes intended to run are reachable from `start`
- unsupported persisted nodes produce explicit errors

Reachability should be an error in v1, not a warning, to keep run behavior obvious.

Validation issues should include `node_id` or `edge_id` whenever possible so the UI can highlight the relevant graph element. A field-level property may be added later if needed for inspector focus.

## Execution

Graph execution reuses the existing runner by compiling graph nodes to temporary workflow steps internally.

Execution flow:

1. UI auto-saves the current graph.
2. Backend loads the saved graph.
3. Backend validates and compiles the graph.
4. Compiled graph steps use graph `node_id` as temporary step id.
5. Existing run service executes the compiled action configs.
6. Run state reports node ids through `current_step_id`, `completed_step_ids`, and error `step_id`.
7. Graph UI highlights running, completed, and failed nodes.

The compiled temporary steps are an internal adapter only. They do not reintroduce list authoring as a product concept.

## Error Handling

Command errors continue to serialize as:

```text
{ message: string, field: string | null }
```

The UI should show graph-specific errors in the graph workspace, not only as a global app message. Expected surfaces:

- header status for broad save/run state
- validation panel for graph issues
- node and edge highlight state for issue targets
- run timeline for execution failures

Deleting a node should remove incident edges and mark the graph as unsaved. Deleting an edge should mark the graph as unsaved. Running with validation errors should keep the graph editable and show the blocking errors.

## Frontend Changes

Expected changes:

- Replace workflow detail builder layout with graph workspace layout.
- Remove `StepList` and step detail rendering from the workflow detail page.
- Split reusable action config fields out of the current step form into an action config editor.
- Update `WorkflowGraphEditor` to support explicit port selection, edge selection/deletion, node label editing, unsaved state, and graph-only run controls.
- Remove selected-step state and list drag/reorder handlers from `App.tsx`.
- Update frontend API wrappers and tests to match the graph-only command surface.
- Keep design aligned with `DESIGN.md` and the current dark Supabase-inspired theme.

## Backend Changes

Expected changes:

- Ensure workflow creation also creates a default graph.
- Make graph load/save/validate/compile/run the primary workflow path.
- Retire step-list commands from registration if no current path uses them.
- Adjust command tests to assert graph-first behavior.
- Keep action config validation intact.
- Keep graph unsupported-node compile errors explicit.
- Keep `workflow_steps` table only as temporary legacy schema if dropping it would create unnecessary migration risk.

## Documentation Changes

Update current source-of-truth docs when implementation happens:

- `docs/architecture/frontend.md`
- `docs/architecture/command-boundary.md`
- `docs/architecture/persistence.md`
- `docs/contracts/tauri-commands.md`
- `docs/contracts/workflow-types.md`
- `docs/domain/workflow-lifecycle.md`
- `docs/domain/user-visible-invariants.md`
- `README.md` smoke checklist
- `docs/task-routes.md` if route ownership or checks change

The docs must stop describing list step authoring as the primary workflow builder after the graph-only implementation lands.

## Testing Plan

Frontend tests:

- workflow detail renders graph workspace without list builder
- create workflow loads default graph
- add supported nodes and edit labels/config
- action node config editor saves typed `ActionConfig`
- connect nodes with explicit ports
- delete edge
- delete node removes incident edges
- validate shows node/edge-targeted issues
- run auto-saves current graph before invoking run
- run timeline highlights node ids from run state

Rust/domain tests:

- supported node port contract validates
- `repeat_for_each` compiles using `loop` and `done`
- `retry` compiles using `try`, `success`, and `failed`
- invalid action node config blocks compile
- unreachable nodes block compile
- unsupported nodes return explicit errors

Command tests:

- `create_workflow` creates default graph
- `get_workflow` or replacement returns graph detail
- `save_workflow_graph` persists graph JSON
- `run_workflow` runs saved graph
- removed step commands are not registered or no longer used by frontend

Persistence tests:

- graph persists and round-trips
- deleting workflow cascades graph data
- workflow updated timestamp changes on graph save

## Implementation Phasing

Recommended implementation phases:

1. Tighten graph domain contract: ports, validation, compile, command tests.
2. Create reusable action config editor from the current step form fields.
3. Convert workflow detail UI to graph-only workspace.
4. Remove frontend step-list flows and unused wrappers/tests.
5. Simplify command registration and docs to graph-first behavior.
6. Optional cleanup migration for legacy step schema after graph-only behavior is stable.

This phasing keeps runtime correctness ahead of large UI deletion and avoids mixing schema cleanup with product behavior changes.
