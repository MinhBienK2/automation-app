# Workflow Lifecycle

## Create

- UI calls `create_workflow` through `src/lib/workflowApi.ts`.
- Rust validates a non-blank workflow name in `src-tauri/src/domain/workflow.rs`.
- Repository trims and stores the workflow with timestamps, then creates a default graph.
- UI refreshes list and opens the created workflow.

## Open Detail

- UI calls `get_workflow`.
- UI calls `get_workflow_graph`.
- Saved graph JSON is loaded when present; compatibility fallback can render a generated linear graph from legacy ordered steps.
- UI does not select or store a current list step.

## Edit Visual Graph

- The workflow detail screen renders `WorkflowGraphEditor` as the only workflow builder.
- Users can add supported graph nodes from grouped canvas toolbar pickers. The action picker is reserved for browser/data/session/network actions, while graph logic is added from the Logic picker. Users can connect edges through explicit source/target ports with left-button drag, click canvas edges to select/delete links, read edge direction through arrowed links with order badges on the edge, delete edges, drag nodes through the node drag handle, pan the canvas by dragging empty canvas space or using viewport controls, delete/duplicate/rename nodes, use node context actions from right-click, change action node type in the inspector, edit action config, and edit structured config for branch, loop, retry, manual approval, rate limit, variable, assertion, subworkflow, domain allowlist, stop, and failure-end nodes.
- `save_workflow_graph` persists graph JSON without rewriting ordered `workflow_steps`.
- `validate_workflow_graph` returns node/edge issues for selected-node issue display without persisting.
- `run_workflow` loads the saved graph, compiles graph nodes into executable action configs, expands subworkflow nodes through the command layer, and starts the existing runner path.
- Canvas node status maps current/completed/failed run ids from `RunState` back to graph nodes when node ids are used as compiled step ids.

## Legacy Step Rows

- List-step authoring is retired from the product UI and Tauri command registration.
- Internal Rust helpers and repository methods for `workflow_steps` may remain temporarily for import/export compatibility and legacy tests.

## Run Full Workflow

- `run_workflow` loads the saved graph, validates and compiles it, then sends generated action steps to the background runner.
- UI polls `get_run_state` while status is `running`.
- Invalid advanced graph nodes fail before a run starts with a command-facing error instead of silently no-oping.
- Graph runs share the same run-state lifecycle as full workflow runs.

## Stop

- `stop_run` cancels the active run and immediately returns a stopped state.
- Runner cancellation must remain responsive.

## Delete Workflow

- UI confirms with the user before calling `delete_workflow`.
- Deleting the selected workflow returns the UI to the list screen.

## Preserve

- Graph authoring state must not diverge from the graph the user runs; the UI saves the current graph before `run_workflow`.
- Run status must not mislead the user after success, failure, or stop.
- Command-facing errors must remain serializable through `CommandError`.
- Invalid graph drafts may be saved, but `run_workflow` must validate/compile and fail before starting execution when blocking graph issues exist.
