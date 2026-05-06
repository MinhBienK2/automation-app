# Workflow Lifecycle

## Create

- UI calls `create_workflow` through `src/lib/workflowApi.ts`.
- Rust validates a non-blank workflow name in `src-tauri/src/domain/workflow.rs`.
- Repository trims and stores the workflow with timestamps, then creates a `Start -> New node` draft graph. `New node` is an unconfigured action node with `config: null`.
- UI refreshes list and opens the created workflow.

## Open Detail

- UI calls `get_workflow`.
- UI calls `get_workflow_graph`.
- UI calls `get_workflow_browser_config` for workflow-level launch settings.
- Saved graph JSON is loaded when present; compatibility fallback can render a generated linear graph from legacy ordered steps.
- The workflow detail header exposes a Runtime action that opens workflow-level browser launch settings in a dialog.
- UI does not select or store a current list step.

## Edit Visual Graph

- The workflow detail screen renders `WorkflowGraphEditor` as the only workflow builder.
- Users can add supported graph nodes from grouped canvas toolbar pickers. The toolbar shows icon controls for undo, redo, select mode, pan mode, fit view, and shortcuts, followed by New node, Add Action, Add Logic, Add Variable, and Add End. There is no Add Output toolbar group; output-producing behavior comes from capture actions under Add Action. Add Variable exposes Set Variables and Set JSON Variables. Add End exposes End Success, End Failure, and Stop Workflow.
- The Add Logic palette exposes Branching (If, Switch), Loops (Repeat Times, Repeat For Each, While, Repeat Until, Break Loop, Continue Loop), and Recovery (Retry). Try/Catch, Fallback, Manual Approval, Rate Limit, Domain Allowlist, and Stop Workflow remain compatible when loaded from saved graphs but are hidden from the main Add Logic palette.
- The action picker uses semantic groups from `docs/domain/action-taxonomy.md`, hides duplicate or advanced compatibility actions from the main picker, and displays intent-focused labels such as Fill Field for `input_text`.
- Users can connect edges through explicit source/target ports with left-button drag, reconnect ports to replace prior source/target links, click React Flow canvas edges to select/delete links, use the link context menu for link-scoped actions, read edge direction through arrowed React Flow links with order labels on the edge, delete edges, drag nodes through the node drag handle, box-select graph items by dragging empty canvas space, pan the canvas by holding Space while dragging, the pan toolbar mode, or viewport controls, duplicate/delete/copy nodes from the node context menu, open detailed node help from the inspector or node context menu, change action node type through the inspector's searchable action dropdown, edit action config, and edit structured config for branch, loop, retry, manual approval, rate limit, variable, assertion, subworkflow, domain allowlist, stop, and failure-end nodes.
- The graph editor supports app-level multi-selection, bulk duplicate, bulk delete, copy, paste, undo, redo, and shortcuts for graph edit commands. Bulk duplicate copies selected non-start nodes and internal links only; copy/paste uses an editor-local clipboard and creates fresh ids. Undo/redo tracks graph snapshots only, not run state, validation results, settings, or workflow metadata.
- The graph toolbar exposes a Shortcuts dialog, and Settings includes the same graph shortcut guide for navigation, selection, editing, run, and save controls.
- Configured action node help reuses the same decision-guide action help content used by action/step forms. Graph-native node help uses the same popup structure and explains node purpose, expected use, minimum setup, port semantics, workflow examples, common mistakes, related nodes, and safety-sensitive guidance when relevant.
- Set Variables edits multiple typed rows in one node while keeping legacy single `{ name, value }` saved configs loadable. The Set Variables editor stays tabular and scrolls horizontally when the inspector is too narrow. Set JSON Variables accepts a JSON object and flattens nested object keys into dot-path runtime variables while preserving arrays whole.
- Template-capable text fields expose an Insert variable picker. The picker includes known variables from Set Variables, Set JSON Variables, and output-producing actions when available. Inserted `{{variable.path}}` tokens remain editable and are highlighted in the preview.
- Repeat For Each can iterate over a manual list or over a runtime array variable. Variable-array mode requires an array variable name and binds each item to the configured item name in array order.
- Control blocks treat branch ports as work inside the block and continuation ports as work after the block. `If`, `Switch`, and `Try/Catch` expose `done` continuation ports; loop and fallback blocks continue through their existing `done` ports, and retry continues through `success`.
- Missing optional branch ports are allowed and compile as no-op paths. Missing continuation ports end the current path successfully. Required body ports such as loop body, retry try, try/catch try, and fallback primary block validation/run.
- `save_workflow_graph` persists graph JSON without rewriting ordered `workflow_steps`.
- `save_workflow_browser_config` persists workflow-level browser launch settings without changing graph JSON.
- Graph autosave is enabled by default and persists graph edits after changes. Users can turn autosave off from Settings and then use manual Save.
- Autosave failures keep the visible draft graph in the UI and show a readable save status. Save can be used to retry.
- `validate_workflow_graph` returns node/edge issues for selected-node issue display without persisting.
- `run_workflow` loads the saved graph, compiles graph nodes into executable action configs, expands subworkflow nodes through the command layer, and starts the existing runner path.
- Canvas node status maps current/completed/failed run ids from `RunState` back to graph nodes when node ids are used as compiled step ids.

## Legacy Step Rows

- List-step authoring is retired from the product UI and Tauri command registration.
- Internal Rust helpers and repository methods for `workflow_steps` may remain temporarily for import/export compatibility and legacy tests.

## Run Full Workflow

- `run_workflow` loads the saved graph, validates and compiles it, then sends generated action steps to the background runner.
- The UI saves the visible graph and any dirty browser runtime config before invoking `run_workflow`; if either save fails, execution does not start.
- `run_workflow` loads and validates persisted browser runtime config when present. If no workflow-level config row exists, the browser runner falls back to legacy launch inference from action configs for compatibility.
- A Start-only graph is still a valid saved legacy draft but run is rejected with a graph validation error before the runner starts.
- Graph runs reject ambiguous links, duplicate links, self-links, unreachable nodes, unconfigured action nodes, missing required logic config/body ports, unsupported free cycles, and loop-control nodes reachable outside a loop body before the runner starts.
- UI polls `get_run_state` while status is `running`.
- Invalid advanced graph nodes fail before a run starts with a command-facing error instead of silently no-oping.
- Graph runs share the same run-state lifecycle as full workflow runs.
- End Success, End Failure, and Stop Workflow can opt into closing the browser at the terminal point. When that option is off, terminal runs retain the browser session as before.

## Stop

- `stop_run` cancels the active run and immediately returns a stopped state.
- Runner cancellation must remain responsive.

## Delete Workflow

- UI confirms with the user before calling `delete_workflow`.
- Deleting the selected workflow returns the UI to the list screen.

## Preserve

- Graph authoring state must not diverge from the graph the user runs; the UI saves the current graph before `run_workflow`.
- Browser runtime config must not diverge from the config the user runs; dirty config is saved before `run_workflow`.
- Run status must not mislead the user after success, failure, or stop.
- Command-facing errors must remain serializable through `CommandError`.
- Invalid graph drafts may be saved, but `run_workflow` must validate/compile and fail before starting execution when blocking graph issues exist.
