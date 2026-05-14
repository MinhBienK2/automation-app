# Workflow Lifecycle

## Create

- UI calls `create_workflow` through `src/lib/workflowApi.ts`.
- Electron backend commands validate a non-blank workflow name before persistence.
- Repository trims and stores the workflow with timestamps, creates a `Start -> New node` draft graph, and persists default Workflow Settings with a browser identity. `New node` is an unconfigured action node with `config: null`.
- UI refreshes list and opens the created workflow.
- The workflow list exposes icon-only row actions for view, run, edit settings, duplicate, export, and delete. List Run calls `run_workflow` for the saved workflow without opening the detail page or saving any visible detail-page draft. Duplicate calls the graph-first `duplicate_workflow` command, which creates `Copy of <name>`, copies the saved graph JSON, remaps full Workflow Settings to the new workflow id without package-export sanitization, preserves legacy step rows for compatibility, and refreshes the list.
- The workflow list header exposes Import Workflow for JSON workflow packages. Import rejects files larger than 5 MB before reading JSON, previews valid packages, and always creates a new workflow on success; it never overwrites an existing workflow.

## Open Detail

- UI calls `get_workflow`.
- UI calls `get_workflow_graph`.
- UI calls `get_workflow_settings` for the workflow-level settings aggregate.
- Saved graph JSON is loaded when present; compatibility fallback can render a generated linear graph from legacy ordered steps.
- The workflow detail header exposes a Settings action that opens Workflow Settings at Browser Launch.
- The workflow list Edit action opens Workflow Settings at General.
- UI does not select or store a current list step.

## Edit Visual Graph

- The workflow detail screen renders `WorkflowGraphEditor` as the only workflow builder.
- Users can add supported graph nodes from grouped canvas toolbar pickers. The toolbar shows icon controls for undo, redo, select mode, pan mode, fit view, and shortcuts, followed by New node, Add Action, Add Logic, Add Variable, and Add End. There is no Add Output toolbar group; output-producing behavior comes from capture actions under Add Action. Add Variable exposes Set Variables and Set JSON Variables. Add End exposes End Success, End Failure, and Stop Workflow.
- The Add Logic palette exposes Branching (If, Switch), Loops (Repeat Times, Repeat For Each, While, Repeat Until, Break Loop, Continue Loop), and Recovery (Retry). Try/Catch, Fallback, Manual Approval, Rate Limit, Domain Allowlist, and Stop Workflow remain compatible when loaded from saved graphs but are hidden from the main Add Logic palette.
- The action picker uses semantic groups from `docs/domain/action-taxonomy.md`, filters choices through the action capability registry, hides duplicate, launch-time, planned, and graph-internal compatibility actions from the main picker, and displays intent-focused labels such as Fill Field for `input_text`.
- Users can connect edges through explicit source/target ports with left-button drag, reconnect ports to replace prior source/target links, click React Flow canvas edges to select/delete links, use the link context menu for link-scoped actions, read edge direction through arrowed React Flow links with order labels on the edge, delete edges, drag nodes through the node drag handle, box-select graph items by dragging empty canvas space, pan the canvas by holding Space while dragging, the pan toolbar mode, or viewport controls, duplicate/delete/copy nodes from the node context menu, open detailed node help from the inspector or node context menu, change action node type through the inspector's searchable action dropdown, edit action config, and edit structured config for branch, loop, retry, manual approval, rate limit, variable, assertion, subworkflow, domain allowlist, stop, and failure-end nodes.
- The graph editor supports app-level multi-selection, bulk duplicate, bulk delete, copy, paste, undo, redo, and shortcuts for graph edit commands. Bulk duplicate copies selected non-start nodes and internal links only; copy/paste uses an editor-local clipboard and creates fresh ids. Undo/redo tracks graph snapshots only, not run state, validation results, settings, or workflow metadata.
- The graph toolbar exposes a Shortcuts dialog, and Settings includes the same graph shortcut guide for navigation, selection, editing, run, and save controls.
- Configured action node help reuses the same decision-guide action help content used by action/step forms. Graph-native node help uses the same popup structure and explains node purpose, expected use, minimum setup, port semantics, workflow examples, common mistakes, related nodes, and safety-sensitive guidance when relevant.
- Set Variables edits multiple typed rows in one node while keeping legacy single `{ name, value }` saved configs loadable. The Set Variables editor stays tabular and scrolls horizontally when the inspector is too narrow. Set JSON Variables accepts a JSON object and flattens nested object keys into dot-path runtime variables while preserving arrays whole.
- Template-capable text fields expose an Insert variable picker. The picker includes known variables from Set Variables, Set JSON Variables, and output-producing actions when available. Inserted `{{variable.path}}` tokens remain editable and are highlighted in the preview.
- Legacy action nodes that contain graph-internal action configs remain inspectable through a compatibility panel with a read-only JSON preview and replacement/delete controls.
- Repeat For Each can iterate over a manual list or over a runtime array variable. Variable-array mode requires an array variable name and binds each item to the configured item name in array order.
- Control blocks treat branch ports as work inside the block and continuation ports as work after the block. `If`, `Switch`, and `Try/Catch` expose `done` continuation ports; loop and fallback blocks continue through their existing `done` ports, and retry continues through `success`.
- Missing optional branch ports are allowed and compile as no-op paths. Missing continuation ports end the current path successfully. Required body ports such as loop body, retry try, try/catch try, and fallback primary block validation/run.
- `save_workflow_graph` persists graph JSON without rewriting ordered `workflow_steps`.
- `save_workflow_settings_section` persists one Workflow Settings section without changing graph JSON. The UI presents one Save Settings action in the Workflow Settings header and saves dirty sections through that section command. General updates workflow summary metadata; legacy browser config commands map to `settings.browser_launch` while preserving stable browser identity metadata and launch preferences.
- Workflow Settings Run Policy keeps batch defaults visible for compatibility, but the batch concurrency, batch headless, and stop-on-first-failed-row controls are disabled until Batch Run has a first-class UI flow.
- Closing Workflow Settings with unsaved edits opens a confirmation dialog that can save and close, discard changes back to the last saved settings snapshot, or keep editing.
- Graph autosave is enabled by default and persists graph edits after changes. Users can turn autosave off from Settings and then use manual Save.
- Autosave failures keep the visible draft graph in the UI and show a readable save status. Save can be used to retry.
- `validate_workflow_graph` returns node/edge issues for selected-node issue display without persisting.
- Validation/run issue results remain visible after graph edits so users do not lose the diagnostic context while fixing a workflow. After an edit, the issue panel marks those results as needing recheck until Validate or Run refreshes them.
- `run_workflow` loads the saved graph, compiles graph nodes into executable action configs, rejects a second active run, creates a SQLite run record, and starts the Electron CloakBrowser runner.
- Canvas node status maps current/completed/failed run ids from `RunState` back to graph nodes when node ids are used as compiled step ids.

## Legacy Step Rows

- List-step authoring is retired from the product UI and Electron command registration.
- Legacy ordered step rows remain a DTO/import-export compatibility shape, not a production authoring surface.

## Run Full Workflow

- `run_workflow` loads the saved graph, validates and compiles it, then sends generated action steps to the Electron runner.
- The UI saves the visible graph and dirty Workflow Settings sections before invoking `run_workflow`; if either save fails, execution does not start.
- `run_workflow` loads and validates saved Workflow Settings, applies Browser Launch identity settings before launch including profile directory, fixed fingerprint seed, proxy, timezone, locale, viewport/device flags, WebRTC policy, humanization, and headless mode, optionally runs owned fingerprint preflight before graph actions, prepends Environment initial variables before the first graph step, promotes graph domain allowlists into a pre-navigation run policy, enforces maximum workflow duration, and applies browser retention as the default terminal session policy. Authors use explicit Wait and Random Wait nodes when a workflow needs a pause.
- `validate_workflow_run` reports graph and settings issues without starting the runner.
- A Start-only graph is still a valid saved legacy draft but run is rejected with a graph validation error before the runner starts.
- Graph runs reject ambiguous links, duplicate links, self-links, unreachable nodes, unconfigured action nodes, missing required logic config/body ports, unsupported free cycles, and loop-control nodes reachable outside a loop body before the runner starts.
- UI polls `get_run_state` while status is `running`, regardless of whether the run was started from the workflow detail workspace or directly from the workflow list.
- Invalid advanced graph nodes and legacy launch-time identity nodes fail before a run starts with a command-facing error instead of silently no-oping.
- Graph runs share the same run-state lifecycle as full workflow runs.
- Terminal run state, outputs, action traces, failure screenshot paths, and serialized step errors are persisted to `runs` and `run_steps`.
- End Success, End Failure, and Stop Workflow can opt into closing the browser at the terminal point. When that option is off, Workflow Settings Run Policy browser retention decides whether terminal runs retain or close the browser session.

## Batch Workflow

- `run_batch_workflow` uses the same active-run lifecycle lock as normal runs, compiles the saved graph, prepends each row's values as runtime variables after settings setup actions, applies Browser Launch settings and Run Policy batch headless defaults, runs rows sequentially, persists each executed row as a run with step evidence, closes each row browser session, and returns per-row status.
- `batch_concurrency_limit` values above 1 are rejected until isolated browser sessions support safe parallel rows.
- `batch_stop_on_first_failed_row` stops scheduling additional rows after the first failed row.
- Backend batch compatibility remains active even though the Workflow Settings UI currently shows the batch defaults as paused, read-only controls.
- `stop_run` can stop an active batch before the next row.

## Stop

- `stop_run` cancels the active run and immediately returns a stopped state.
- Runner cancellation must remain responsive.

## Delete Workflow

- UI confirms with the user before calling `delete_workflow`.
- Deleting the selected workflow returns the UI to the list screen.

## Export Workflow Package

- The workflow list Export action opens an Export Workflow dialog.
- Users choose whether to include Flow and which Workflow Settings sections to include.
- Export calls `export_workflow_package`, opens the native system Save dialog with a suggested `.workflow.json` file name, and writes the `workflow_package` version 2 JSON to the selected path.
- Canceling the native Save dialog leaves the export dialog open and does not create a file.
- The Electron backend writes the package to the path returned by the native Save dialog; canceling the dialog leaves the workflow unchanged.
- Flow export uses the saved `WorkflowGraph`.
- Settings export uses selected Workflow Settings sections and sanitizes machine-local or sensitive fields by default, including the browser launch proxy password and secret query/hash portions of fingerprint preflight probe URLs.

## Import Workflow Package

- Import Workflow accepts a JSON workflow package file from the workflow list.
- The UI calls `preview_workflow_package` before import and shows package workflow name, Flow availability, Settings sections, and sanitized omitted fields.
- Import calls `import_workflow_package` with the selected Flow and Settings sections.
- Import validates selected Flow and Settings first, then transactionally creates a new workflow named `<package workflow name> (imported)`, saves selected Flow to the new workflow id, saves selected Settings after remapping `workflow_id`, refreshes the list, and opens the imported workflow.
- Import does not overwrite or merge into an existing workflow.
- Failed import validation or persistence rolls back without leaving a partial workflow.

## Preserve

- Graph authoring state must not diverge from the graph the user runs; the UI saves the current graph before `run_workflow`.
- Browser runtime config must not diverge from the config the user runs; dirty config is saved before `run_workflow`.
- Run status must not mislead the user after success, failure, or stop.
- Command-facing errors must remain serializable through `CommandError`.
- Invalid graph drafts may be saved, but `run_workflow` must validate/compile and fail before starting execution when blocking graph issues exist.
- Required workflow inputs without defaults block manual runs until per-run values exist.
