# Run State Contract

## Source Files

- Frontend types: `src/types/workflow.ts`
- UI helpers: `src/lib/workflowUi.ts`
- App orchestration: `src/App.tsx`
- Graph run presentation: `src/features/workflows/components/WorkflowGraphEditor.tsx`
- Run issue presentation: `src/features/workflows/components/RunIssuePanel.tsx`
- Run Monitor drawer: `src/features/workflows/components/RunMonitorDrawer.tsx`
- Status bar: `src/features/workflows/components/RunStatusBar.tsx`
- Electron runner: `electron/backend/runtime/runner.ts`
- Browser session manager: `electron/backend/browser/sessionManager.ts`
- Electron command handlers: `electron/backend/commands.ts`
- Electron run lifecycle manager: `electron/backend/runtime/runManager.ts`

## Shape

Run state includes:

- `status`: `idle`, `running`, `success`, `failed`, `stopped`
- `mode`: `none`, `run_workflow`, `test_step`
- `target_step_id`
- `current_step_id`
- `current_step_number`
- `completed_step_ids`: completed graph node ids in completion order. Nested
  branch/body/loop actions may appear more than once when the same graph node
  executes multiple times, such as loop iterations or retries.
- `outputs`: captured runtime outputs/variables available after the runner has a browser session to inspect
- `retained_session`: whether a reusable retained browser session is available, plus workflow/profile ownership and a reason when unavailable
- `error`

Run errors include:

- `step_id`
- `step_number`
- `step_name`
- `action_type`
- `reason`
- optional `diagnostics`: structured runtime context for failure display and
  audit logs. It may include `compiled_step_id`, `parent_step_id`,
  `subflow_node_id`, `subflow_id`, `subflow_name`, `subflow_step_number`,
  `subflow_step_count`, `label_path`, and `action_summary`. UI should prefer
  `label_path`, subflow step ordinal, the failing serialized action/node type,
  and `action_summary` for operator-facing context, leaving raw ids for
  details/copy/logs.

`WorkflowRunSnapshot` wraps the run-state shape when the app needs to track a
specific run:

- `run_id`
- `workflow_id`
- `workflow_name`
- `source`: `manual` or `schedule`
- `started_at`
- `state`: the nested `RunState`

The snapshot also mirrors the top-level run-state fields for compatibility with
older UI helpers that expect a direct `RunState`.
The same `manual`/`schedule` source is persisted on SQLite `runs.source` when a
run row begins. Session snapshots and durable history therefore use the same
source vocabulary for Overview, workflow row status, and Evidence filtering.

## Lifecycle

- `run_workflow` delegates to the run manager to create a run-id scoped snapshot, close only a conflicting retained browser session for the same workflow/profile when launching a fresh session, then set that snapshot status to `running`, mode, target step id, and clears progress/error.
- `run_workflow_from_node` reuses an existing retained session and runs from a selected main-path graph node. It requires browser retention `retain`, a persistent selected browser profile, and a retained session matching the workflow/profile. The operator can choose the scope (only rerun selected node vs run from selected node onward) directly from the Run from selected action menu on the detail page, which also persists that choice back to the workflow settings. Selected-node compilation resolves Call Subflow nodes the same way as full workflow runs.
- Progress events set current step and completed step ids. Nested compiled graph actions also report their original graph node ids while they execute, allowing branch/body nodes to surface in the same run-state fields as top-level continuation nodes. Repeated nested executions append repeated ids to `completed_step_ids` so live monitors can show each loop/retry occurrence as a separate activity log entry; canvas completion styling should treat the array as membership rather than uniqueness.
- Multiple different workflows can run concurrently when they do not share a persistent browser profile. A second run for the same workflow fails with a workflow conflict, and a second run that would reuse the same persistent browser profile fails with a profile conflict.
- `run_batch_workflow` remains globally exclusive. A batch blocks normal runs while active, normal runs block a batch start, batch reports progress through the same state shape, and it can be stopped through `stop_run`.
- `stop_run(runId)` delegates to the run manager to set the targeted run status to `stopped` and clear error. Omitting `runId` is allowed only when there is exactly one active run; omitting it while multiple runs are active fails with a command error. Batch stopping remains supported through the same command.
- Runner completion clears active run, clears current step, captures `window.__wamOutputs` from the browser session when present, sets terminal status, and asks `BrowserSessionManager` to retain or forget the CloakBrowser context according to the resolved terminal/browser-retention policy.
- Terminal `get_run_state` preserves the terminal retained-session snapshot after the active run entry is removed. It refreshes retained-session status only by looking up the same workflow/profile, so a null-profile lookup cannot replace useful terminal session evidence.
- If the operator manually closes the retained browser, the next retained-session check marks `retained_session.available` false and run-from-selected fails with a readable error instead of relaunching from the selected node.
- If the operator closes a retained browser from Identity Lab, the backend
  clears only that workflow/profile's retained in-memory session state. Future
  run-from-selected checks report the missing retained session until the
  workflow creates a new reusable session.
- Terminal runs are persisted to SQLite `runs`; compiled top-level graph steps are persisted to `run_steps` with action type, status, trace JSON, and error JSON when available. Executed nested branch/body actions are also appended as `run_steps` rows from `__action_traces`; their trace JSON carries `parent_node_id`, `trace_sequence`, started/finished timestamps when emitted, output/evidence summaries, trace failure reasons, subflow step ordinal metadata for inlined subflow failures, and failure action summaries when available.
- Infrastructure failure sets status to `failed` without retained session.
- When Workflow Settings `execution.max_workflow_duration_ms` is set, the background run cancels through the normal cancellation token at that limit. The terminal state is `failed` with a workflow-level timeout reason such as `Workflow exceeded maximum duration of <ms> ms`.
- Outputs can contain evidence generated by the backend, including `browser_identity` for sanitized browser identity launch evidence, `__action_traces` for per-action execution mode and execution-path evidence, and `__evidence` for run-scoped screenshot/download metadata. Each trace entry in `__action_traces` carries an optional `output_values` map containing the actual values of added or changed variables at that step, which the frontend uses to display changes and compute the full environment state. Failed `__action_traces` may include `action_summary`, such as the target locator or output assertion, plus `subflow_name`, `subflow_step_number`, and `subflow_step_count` for inlined Call Subflow steps, so monitor/log views can distinguish repeated labels without making raw ids the primary operator cue. Nested `__action_traces` entries include the parent control node id and monotonic sequence so durable storage can reconstruct the executed path through If, Router, loop, and Retry bodies.
- `browser_identity` includes CloakBrowser wrapper/binary evidence, fingerprint seed hash, configured fingerprint font hash when available, sanitized persona id/label/rationale, OS/browser bucket, viewport/window dimensions, font bundle label/expected families, timezone/locale source, GeoIP/supported WebRTC policy, active advanced override names such as `fingerprint_fonts_dir`, and configured humanization status/preset. It must not include proxy passwords, operator-entered proxy metadata fields, test-account bindings, cookies, localStorage, sessionStorage, raw profile storage, raw font directory paths, or raw local font directory contents.
- `__evidence_model` has `schema_version: 1`, the canonical evidence categories (`operator_input`, `browser_identity`, `network_posture`, `action_trace`, `page_observation`, `generated_output`, `sensitive_redacted`), and per-output manifest entries with key, category, approximate serialized byte size, redaction flag, and truncation flag. Arbitrary page-observation outputs are recursively redacted by sensitive key pattern and limited for large strings/arrays/objects. Structured backend evidence such as `browser_identity`, `__action_traces`, and `__evidence` is intentionally structured; Evidence Explorer still recursively filters sensitive keys from nested action-trace details before renderer display.
- Batch runs create one run record per executed row. Each row prepends row values as `set_variable` actions before the compiled graph, runs sequentially, returns per-row status/error summary, and records skipped/stopped rows in batch outputs.
- `list_run_states` returns run snapshots for the current app session, sorted by start time, so the renderer can present multiple active runs and recent terminal states.
- On command handler startup, durable run rows that still have `status:
  "running"` and no `finished_at` are treated as interrupted by a previous app
  shutdown. Startup recovery marks them `failed`, sets `finished_at`, records
  empty outputs, and stores a workflow-level error reason of `App exited before
  the run completed`.

## UI Expectations

- `App.tsx` polls `list_run_states` while any snapshot is running, including runs started from the workflow list or scheduler where the detail graph workspace is not open. It falls back to `get_run_state` only for legacy bridge compatibility.
- Run status bar displays compact terminal and error state labels only; detailed
  runtime/startup error copy belongs in run issue presentation.
- Workflow detail exposes a Run Monitor drawer whenever saved Graph settings
  enable Live Run. The Monitor button lets operators open or hide the drawer;
  active runs open it automatically unless the operator closed it for the
  current workflow session. The drawer derives the current/failed node,
  chronological node-activity log rows, and focus targets from
  `current_step_id`, `current_step_number`, `completed_step_ids`, and
  `error.step_id`, and uses graph labels for readable node names. The drawer
  does not render a separate current-node summary section. Each visible node
  occurrence is one timeline row: it is running while `current_step_id` points to
  it, becomes completed when its id appears in `completed_step_ids`, and becomes
  failed when `error.step_id` points to it. Repeated ids create additional rows
  for loop/retry occurrences. Future pending graph nodes remain visible on the
  graph canvas instead of in the timeline, and timeline rows do not receive
  separate current/active selection styling when the graph highlights the
  current node. The saved Follow current setting controls whether progress
  selects and centers the current node as it changes; the drawer does not expose
  a separate Follow current toggle. Timeline row selection performs graph focus
  on demand.
- Workflow list rows display the active snapshot for their workflow, disable only the affected row Run action, and expose row-level Stop for that run id.
- Workflow detail renders `Run from selected` only when the Workflow Settings Run Policy toggle is enabled, then enables it only when run state reports a matching retained session and exactly one supported main-path node is selected. Call Subflow nodes are supported selected starts; Merge is not a supported selected start because it compiles to an internal no-op graph marker.
- Run issue presentation is derived from run state, command errors, and graph validation issues. Runtime failures show the compiled label/path, subflow step ordinal with the failing serialized action/node type, and action summary when available, while raw compiled ids stay in diagnostic details.
- Graph runs reuse this shape. `WorkflowGraphEditor` renders current/completed/failed graph node state when `current_step_id`, `completed_step_ids`, or `error.step_id` match compiled graph node ids, including nested branch/body node ids preserved by graph compilation. Workflow detail maps inlined Call Subflow ids of the form `<call-node>::<subflow-node>` back to `<call-node>` before selecting or highlighting the main graph, while preserving the nested compiled label and original compiled id in diagnostics for issue text, details, and logs.

## Change Checklist

- Update TypeScript run-state types and Electron command/runner tests together.
- Update monitor/status tests.
- Update command tests when lifecycle semantics change.
- Update `docs/domain/execution-semantics.md`.
