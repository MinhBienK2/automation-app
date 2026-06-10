# Workflow Lifecycle

## Create

- UI calls `create_workflow` through `src/lib/workflowApi.ts`.
- Electron backend commands validate a non-blank workflow name before persistence.
- Repository trims and stores the workflow with timestamps, associates it with
  the selected or default project, assigns a project browser profile, creates a
  `Start -> New node` draft graph, and persists default Workflow Settings.
  `New node` is an unconfigured action node with `config: null`.
- The workflow list Create dialog asks for the workflow name only. Omitted
  backend create options use the default project and that project's initial
  browser profile.
- UI refreshes list and opens the created workflow.
- The workflow list exposes icon-only row actions for view, run, edit settings, duplicate, export, and delete. List Run calls `run_workflow` for the saved workflow without opening the detail page or saving any visible detail-page draft. While a workflow has an active run, the row disables Run, Duplicate, Export, and Delete and exposes Stop for the active run id. Duplicate calls the graph-first `duplicate_workflow` command, which creates `Copy of <name>`, copies the saved graph JSON, copies non-storage Workflow Settings without package-export sanitization, preserves the selected browser profile, disables Run from selected, and refreshes the list.
- If a manual full-run launch from Graph Builder or the workflow list is
  blocked by graph/settings validation before a run row is created, the backend
  records one sanitized `launch_blocked` operational attention row for Overview.
  Manual Validate does not write this audit row.
- The workflow list header exposes Import Workflow for JSON workflow packages.
  Import rejects files larger than 5 MB before reading JSON, previews valid
  packages, and always creates a new workflow in the selected project on
  success; it never overwrites an existing workflow or mutates an existing
  browser profile.

## Project Create

- Projects UI calls `createProject` through `src/lib/workflowApi.ts`.
- Electron backend commands validate a non-blank project name before
  persistence.
- The command transactionally creates the project, its initial browser profile,
  and one normal draft workflow named `Main` selecting that profile.
- UI selects the created project, switches to its Workflows collection, and
  refreshes workflows so the `Main` workflow is visible immediately.

## Project Settings

- Projects -> Settings can rename the selected project through `updateProject`.
- Duplicate project calls `duplicateProject`, creates `Copy of <project name>`,
  copies browser profiles, subflows, workflows, workflow graphs, and non-storage
  settings, remaps copied Call Subflow references to copied subflows, preserves
  workflow profile selections through copied profile ids, and gives copied
  browser profiles fresh identity/profile/fingerprint values so the new project
  does not reuse the source project's local identities.
- Export project calls `exportProjectPackage` and then `saveProjectPackageFile`
  to write a `.project.json` package through the native Save dialog. The
  package includes project metadata, browser profiles, subflows,
  workflows, saved graphs, and Workflow Settings, with proxy secrets, proxy URL
  credentials, local fingerprint font directories, and preflight fields
  sanitized.
- Delete project opens an in-app confirmation before calling `deleteProject`.
  The backend rejects deletion while any workflow in that project has an active
  run, active profile, or retained session, then deletes the project's
  workflows, subflows, and browser profile rows. The UI selects the next available
  project after deletion.

## Project Import

- Import project accepts a JSON project package from the Projects workspace
  header next to Create Project, previews workflows, subflows, project
  browser profiles, and sanitized omitted fields, then calls `importProjectPackage`.
  Import validates package graphs/settings first, transactionally creates
  `<project name> (imported)`, recreates browser profiles, subflows, and
  workflows, remaps Call Subflow ids, gives imported browser profiles fresh
  identity/profile/fingerprint values, selects the new project, and switches to
  Workflows. It does not import runs, evidence, schedules, app
  settings, or browser profile storage.

## Open Detail

- UI calls `get_workflow`.
- UI calls `get_workflow_graph`.
- UI calls `get_workflow_settings` for the workflow-level settings aggregate.
- Saved graph JSON is loaded as the workflow authoring source.
- The workflow detail header shows the owning project name and exposes a Settings action that opens Workflow Settings at Browser Launch.
- The workflow list Edit action opens Workflow Settings at General.
- Opening workflow detail collapses the app sidebar to the icon rail and leaves
  the graph with no node or link selected.
- UI does not select or store a current list step.

## Edit Visual Graph

- The workflow detail screen renders `WorkflowGraphEditor` as the only workflow
  builder. The graph canvas uses the full graph workspace width until a node,
  link, or multi-item selection opens the graph inspector as a right-side
  drawer; closing the drawer clears the selection.
- Users can add supported graph nodes from grouped canvas toolbar pickers. The toolbar shows icon controls for undo, redo, select mode, pan mode, fit view, auto arrange, and shortcuts, followed by New node, Add Action, Add Subflow, Add Logic, Add Variable, and Add End. Toolbar-created nodes are inserted near the center of the currently visible canvas view, with a small stagger to keep repeated additions reachable. Auto arrange repositions graph nodes through layered workflow layout into deterministic execution lanes, wrapping long main paths into left-to-right rows instead of one horizontal line, preserves same-column top-to-bottom order for nodes connected through ordered output ports or distinct ordered input ports, and can be undone. Multiple links entering the same input port, such as Merge `in`, do not create an arbitrary edge-id order that can override source output port order. There is no Add Output toolbar group; output-producing behavior comes from capture actions under Add Action. Add Variable exposes Set Variables and Set JSON Variables. Add End exposes End Success, End Failure, and Stop Workflow.
- The workflow Add Subflow picker lists same-project subflows by name,
  description, and usage count, and exposes an add-mode choice. Call Subflow
  mode creates a configured Call Subflow node whose canvas label starts as the
  subflow name and remains linked to the reusable subflow. Insert nodes mode
  loads the selected subflow graph, skips its Start node, clones the real
  non-start nodes plus their internal links into the workflow at the visible
  insertion point with fresh ids on collision, selects the inserted nodes, and
  leaves them independent from later subflow edits. The workflow Add Logic palette
  exposes Branching (If, Switch, Router, Random Choice, Merge), Loops (Repeat
  Times, Repeat For Each, While, Repeat Until, Break Loop, Continue Loop), and
  Recovery (Retry). The subflow
  editor uses the same graph editor in subflow mode and hides Add Subflow so MVP
  subflows cannot call other subflows.
- The action picker uses semantic groups from `docs/domain/action-taxonomy.md`, filters choices through the action capability registry, hides graph-internal actions from the main picker, and displays intent-focused labels such as Fill Field for `input_text`.
- Graph canvas nodes keep the operator-edited node name as the primary label,
  show a top-right category badge, and show the underlying action or graph node
  kind as secondary metadata. Action, logic, and subflow nodes use distinct
  category accent treatments while the running node keeps the stronger active
  execution styling. Action nodes also show compact configuration context when
  available, such as wait duration, random wait range, URL, key, hotkey, or
  target locator, so renamed nodes remain identifiable without opening the
  inspector. Nodes with many input or output ports grow vertically so canvas
  handles remain separated as branch tables add cases or choices. Loaded graph
  rendering and auto arrange use those port-aware heights when spacing nodes so
  tall nodes do not cover lower nodes in the same visual column. Auto arrange
  also preserves branch lanes across multi-node linear continuation chains, so
  each single-output node after a branch target stays beside that inherited
  branch lane instead of being compacted into another branch's open row.
- Users can connect edges through explicit source/target ports with left-button drag, hover graph ports for 1 second to read one custom tooltip explaining what each port means and which direction to connect, reconnect ports to replace prior source/target links, click React Flow canvas edges to select/delete links, edit a selected link's none/fixed/random wait in the inspector drawer, use the link context menu for link-scoped actions, read edge direction through arrowed React Flow links with execution-order labels on the edge, create new links with the workflow's current Graph link wait copied onto the edge, delete edges, drag nodes by holding the node body, box-select graph items by dragging empty canvas space, pan the canvas by holding Space while dragging, the pan toolbar mode, or viewport controls, duplicate/delete/copy nodes from the node context menu, open detailed node help from the inspector drawer or node context menu, open a configured Call Subflow node's referenced subflow detail from the inspector drawer or node context menu, return from that subflow detail to the originating workflow detail, rename any selected non-start node through the inspector drawer, change action node type through the inspector drawer's searchable action dropdown, edit action config, and edit structured config for branch, loop, retry, variable, assertion, domain allowlist, stop, and failure-end nodes.
- Action and graph-native node config fields in the inspector group related controls by target, content, match/value, output, mode, artifact, runtime policy, loop guard, retry policy, route table, choice table, or terminal behavior. Single-field nodes stay flat so dense graph authoring does not gain unnecessary wrappers.
- The graph editor supports app-level multi-selection, bulk duplicate, bulk delete, copy, paste, creating a subflow from selected workflow nodes, undo, redo, and shortcuts for graph edit commands. Bulk duplicate copies selected non-start nodes and internal links only; copy/paste uses an editor-local clipboard and creates fresh ids. Create subflow from selection opens a dialog for the subflow name and offers `Chỉ tạo` to persist the selected nodes as a project subflow while leaving the workflow graph unchanged, or `Tạo và thay thế` to also replace the selected nodes with a configured Call Subflow node. Extraction requires a clear selected entry node, excludes `Start` and nested Call Subflow nodes, and replacement supports at most one external incoming link and one external outgoing link so rewiring stays explicit. Replacement also rejects selections where a selected node has both internal outgoing links and outgoing links to the outside graph, because that branch shape cannot be collapsed into one Call Subflow continuation without changing flow semantics. Undo/redo tracks graph snapshots only, not run state, validation results, settings, or workflow metadata.
- The graph toolbar exposes a Shortcuts dialog, and App Settings includes the same graph shortcut guide for navigation, selection, editing, run, and save controls.
- Configured action node help reuses the same decision-guide action help content used by action/step forms. Graph-native node help uses the same popup structure and explains node purpose, expected use, minimum setup, port semantics, workflow examples, related nodes, and safety-sensitive guidance when relevant. Help popups use nested collapsible sections so readers can keep parent topics open and expand child groups, individual fields, options, outputs, examples, and related-node details only when needed.
- Set Variables edits typed rows in one node. The Set Variables editor stays tabular and scrolls horizontally when the inspector is too narrow. Set JSON Variables accepts a JSON object and flattens nested object keys into dot-path runtime variables while preserving arrays whole.
- Template-capable text fields expose an Insert variable picker. The picker includes known variables from Set Variables, Set JSON Variables, and output-producing actions when available. Inserted `{{variable.path}}` tokens remain editable and are highlighted in the preview.
- Repeat For Each can iterate over a manual list or over a runtime array variable. Variable-array mode requires an array variable name and binds each item to the configured item name in array order.
- Control blocks treat branch ports as work inside the block and continuation ports as work after the block. `If`, `Switch`, and `Try/Catch` expose `done` continuation ports; loop and fallback blocks continue through their existing `done` ports, and retry continues through `success`.
- Missing optional branch ports are allowed and compile as no-op paths. Missing continuation ports end the current path successfully. Required body ports such as loop body, retry try, try/catch try, and fallback primary block validation/run.
- `save_workflow_graph` persists graph JSON without rewriting ordered `workflow_steps`.
- `save_workflow_settings_section` persists one Workflow Settings section without changing graph JSON. The UI presents one Save Settings action in the Workflow Settings header, groups related controls inside each settings section, and saves dirty sections through that section command. General updates workflow summary metadata.
- Workflow Settings Run Policy keeps maximum duration, browser retention, Allow Run JavaScript, and Run from selected enablement/scope editable. Batch defaults remain visible, but the batch concurrency, batch headless, and stop-on-first-failed-row controls are disabled until Batch Run has a first-class UI flow.
- Workflow Settings Graph owns the workflow detail Live Run visibility toggle, the Follow current default when Live Run is enabled, and the default duration-only wait copied onto newly created graph links. New settings default Live Run on and Follow current off. Changing the link wait does not rewrite existing graph links.
- Closing Workflow Settings with unsaved edits opens a confirmation dialog that can save and close, discard changes back to the last saved settings snapshot, or keep editing.
- Graph autosave is enabled by default and persists graph edits after changes. Users can turn autosave off from App Settings and then use manual Save. Workflow detail manual Save is disabled until the loaded graph has content changes, or until a failed autosave can be retried.
- Leaving workflow detail with manual-save graph changes or failed autosave
  opens the shared unsaved changes dialog. Save and close persists the visible
  graph before navigation, Discard changes abandons the draft, and Keep editing
  stays on the detail page. When graph autosave is enabled and has not failed,
  navigation does not prompt.
- Autosave failures keep the visible draft graph in the UI and show a readable save status. Save can be used to retry.
- `validate_workflow_graph` returns node/edge issues for selected-node issue display without persisting.
- Validation/run issue results remain visible after graph edits so users do not lose the diagnostic context while fixing a workflow. After an edit, the issue panel marks those results as needing recheck until Validate or Run refreshes them.
- `run_workflow` loads the saved graph, compiles graph nodes into executable action configs, rejects same-workflow/profile/batch conflicts, creates a run-id scoped SQLite run record, and starts the Electron CloakBrowser runner.
- Canvas node status maps current/completed/failed run ids from `RunState` back
  to graph nodes when node ids are used as compiled step ids. Inlined Call
  Subflow ids map back to the caller node for main-workflow focus/highlight,
  while the failure text keeps the nested subflow label.

## Subflow Authoring

- The selected project's Subflows collection lists reusable subflows for that
  project with description, usage count, open, settings, duplicate, and delete
  actions. Settings opens Subflow Settings so the subflow name can be changed
  without opening the graph editor.
- Creating a subflow persists a saved graph fragment with a start node and the
  same graph DTO shape as workflows.
- Opening a subflow loads its graph and usage list, and the detail header shows
  the owning project name. The editor header has Settings and Save; Settings
  opens Subflow Settings for renaming, while Save is disabled until the subflow
  graph has content changes. Duplicate and Delete stay on the Subflows
  collection list, and subflow detail has no Launch Run action because subflows
  are reusable implementation units rather than product scenarios.
- Leaving subflow detail with unsaved graph changes opens the same unsaved
  changes dialog, with Save and close persisting the subflow graph before
  navigation, Discard changes leaving without saving, and Keep editing staying
  on the subflow detail page.
- When a subflow is used by workflows, the detail page warns that saving changes
  affects the next run of those callers. Delete is blocked while usage exists.
- Saving a subflow graph validates subflow-specific constraints, including no
  nested Call Subflow nodes in the MVP.

## Schedule Workflow

- The Schedules sidebar page lists all workflow schedules with workflow name, enabled state, schedule summary, next run time, last status, and last reason.
- Users can create disabled draft schedules, edit schedules, delete schedules, enable or disable schedules, and inspect schedule event history.
- Schedule kinds are one-time `once_at`, repeating `interval`, and friendly calendar presets for daily, weekly, and monthly local-time runs.
- Enabling a schedule validates the schedule config and the current saved workflow run readiness. Invalid saved graph/settings block enablement with a command-facing error.
- The Electron backend scheduler runs while the app process is open. It scans enabled schedules for `next_run_at <= now` through the schedule lookup index, processes due schedules in chronological order, and writes audit events for starts, skips, missed windows, failed validation/start, and automatic one-time disablement.
- Scheduled runs call the same saved-workflow backend path as `run_workflow`; they do not save or run unsaved detail-page drafts.
- If the scheduled workflow conflicts with an active run for the same workflow, an active run using the same persistent browser profile, or an active batch at the scheduled time, the occurrence is skipped and not queued. Due schedules for isolated workflows can start concurrently in the same tick.

## Run Full Workflow

- `run_workflow` loads the saved graph, validates and compiles it, then sends generated action steps to the Electron runner.
- The UI saves the visible graph and dirty Workflow Settings sections before invoking `run_workflow`; if either save fails, execution does not start.
- `run_workflow` loads and validates saved Workflow Settings, resolves Browser
  Launch from the workflow's selected project browser profile before launch
  including profile directory, fixed fingerprint seed, fingerprint fonts
  directory, proxy, explicit or detected local timezone/locale, supported
  WebRTC policy values, humanize toggle/preset, and headless mode, prepends
  Environment initial variables before the first graph step, compiles edge
  delays as synthetic wait steps before their target nodes, expands Call
  Subflow nodes into the caller's compiled plan with nested labels and mapped
  inputs, promotes graph domain allowlists into a pre-navigation run policy,
  enforces maximum workflow duration, rejects Run JavaScript when Run Policy
  disables direct script execution, and applies browser retention as the
  default terminal session policy. Authors use explicit Wait and Random Wait
  nodes when a workflow needs a business-semantic pause.
- Workflow Settings no longer exposes identity reset. Operators create/select a
  different project browser profile when they need a new browser identity.
- Identity Lab can close the selected workflow/profile's retained session
  through `closeIdentityRetainedSession`. Closing a retained session clears only
  in-memory browser context state and leaves persistent profile data, settings,
  cookies/login state, evidence, and historical runs intact. Identity Lab reset
  uses the same guarded `resetWorkflowBrowserIdentity` command as Workflow
  Settings.
- `validate_workflow_run` reports graph and settings issues without starting the runner.
- A Start-only graph is a valid saved draft but run is rejected with a graph validation error before the runner starts.
- Graph runs reject ambiguous links, duplicate links, self-links, unreachable nodes, unconfigured action nodes, missing required logic config/body ports, unsupported free cycles, and loop-control nodes reachable outside a loop body before the runner starts.
- UI polls `list_run_states` while any run snapshot is `running`, regardless of whether the run was started from the workflow detail workspace, directly from the workflow list, or by the scheduler. `get_run_state` remains a compatibility/latest-state view.
- Workflow detail renders the Live Run navigator only when saved Graph settings enable Live Run. The saved Follow current setting controls whether active run progress automatically selects and centers the current graph node; the navigator itself does not expose a separate Follow current toggle.
- Overview loads a bounded operations aggregate through `getOperationsOverview`,
  which rejects local-day UTC ranges over 48 hours before building hourly
  activity buckets. Live and failed run references navigate to the owning
  workflow, while recent evidence references can open Evidence focused on the
  selected evidence id.
- Evidence loads durable persisted run evidence through `listEvidenceItems`.
  Overview recent evidence can focus a specific evidence id, and Evidence
  queries can still filter by `run_id`.
- Identity Lab loads current browser identity posture from workflows' selected
  project browser profiles through `getIdentityLabOverview` /
  `getIdentityLabDetail`. Evidence details with an identity id open Identity Lab
  as a read-only historical identity reference with workflow, run, and evidence
  context.
- Persisted run rows record durable `source` provenance as `manual` or
  `schedule`; older local rows are migrated deterministically from started
  schedule events when possible and otherwise treated as manual.
- Graph runs share the same run-state lifecycle as full workflow runs, with each active workflow run tracked by its run id.
- Terminal run state, outputs, action traces, failure screenshot paths, and serialized step errors are persisted to `runs` and `run_steps`. Top-level run-step rows remain compatible with existing history queries, while executed nested branch/body traces are appended with parent node and sequence metadata for path reconstruction.
- End Success, End Failure, and Stop Workflow can opt into closing the browser at the terminal point. When that option is off, Workflow Settings Run Policy browser retention decides whether terminal runs retain or close the browser session.

## Batch Workflow

- `run_batch_workflow` remains globally exclusive with normal runs, compiles the saved graph, prepends each row's values as runtime variables after settings setup actions, applies Browser Launch settings and Run Policy batch headless defaults, runs rows sequentially, persists each executed row as a run with step evidence, closes each row browser session, and returns per-row status.
- `batch_concurrency_limit` values above 1 are rejected until isolated browser sessions support safe parallel rows.
- `batch_stop_on_first_failed_row` stops scheduling additional rows after the first failed row.
- Backend batch defaults remain active even though the Workflow Settings UI currently shows the batch defaults as paused, read-only controls.
- `stop_run` can stop an active batch before the next row.

## Stop

- `stop_run(runId)` cancels the targeted workflow run and immediately returns that stopped snapshot. Omitting `runId` is accepted only when one active run exists. Batch stop remains available through `stop_run`.
- Runner cancellation must remain responsive.

## Delete Workflow

- UI confirms with the user before calling `delete_workflow`.
- The confirmation includes a profile-data choice. Delete private browser
  profile data is checked by default; operators must uncheck it when retained
  login state should remain available for recovery or later cleanup. Deleting
  profile data removes only unshared inactive profile directories.
- Backend deletion rejects while the workflow has an active run, while the
  workflow's persistent profile is owned by any active run, or while a retained
  browser session still owns that workflow/profile.
- Deleting the selected workflow returns the UI to the list screen.

## Export Workflow Package

- The workflow list Export action opens an Export Workflow dialog.
- Users choose whether to include Flow and which Workflow Settings sections to include.
- Export calls `export_workflow_package`, opens the native system Save dialog with a suggested `.workflow.json` file name, and writes the `workflow_package` version 2 JSON to the selected path.
- Canceling the native Save dialog leaves the export dialog open and does not create a file.
- The Electron backend writes the package to the path returned by the native Save dialog; canceling the dialog leaves the workflow unchanged.
- Flow export uses the saved `WorkflowGraph`.
- Flow export includes subflows referenced by Call Subflow nodes and validates
  that referenced subflows belong to the same project.
- Settings export uses selected Workflow Settings sections and sanitizes machine-local or sensitive fields by default, including the browser launch proxy password, proxy URL credentials, and local fingerprint font directories.

## Import Workflow Package

- Import Workflow accepts a JSON workflow package file from the workflow list.
- The UI calls `preview_workflow_package` before import and shows package workflow name, Flow availability, Settings sections, and sanitized omitted fields.
- Import calls `import_workflow_package` with the selected Flow, Settings
  sections, and selected project id.
- Import validates selected Flow, referenced subflows, and Settings first, then
  transactionally creates a new workflow named `<package workflow name>
  (imported)` in the target project, recreates referenced subflows in that
  project, remaps Call Subflow ids in the imported Flow, saves selected Flow to
  the new workflow id, saves selected Settings after remapping `workflow_id`,
  refreshes the list, and opens the imported workflow.
- Importing the Browser Launch settings section saves the sanitized package
  Browser Launch values onto the new workflow. Imports that omit Browser Launch
  keep the new workflow's default Browser Launch settings and do not mutate the
  target project's saved identity.
- Import does not overwrite or merge into an existing workflow.
- Failed import validation or persistence rolls back without leaving a partial workflow.

## Preserve

- Graph authoring state must not diverge from the graph the user runs; the UI saves the current graph before `run_workflow`.
- Browser runtime config must not diverge from the config the user runs; dirty config is saved before `run_workflow`.
- Run status must not mislead the user after success, failure, or stop.
- Command-facing errors must remain serializable through `CommandError`.
- Invalid graph drafts may be saved, but `run_workflow` must validate/compile and fail before starting execution when blocking graph issues exist.
- Required workflow inputs without defaults block manual runs until per-run values exist.
