# Run State Contract

## Source Files

- Frontend types: `src/types/workflow.ts`
- UI helpers: `src/lib/workflowUi.ts`
- App orchestration: `src/App.tsx`
- Graph run presentation: `src/features/workflows/components/WorkflowGraphEditor.tsx`
- Run issue presentation: `src/features/workflows/components/RunIssuePanel.tsx`
- Status bar: `src/features/workflows/components/RunStatusBar.tsx`
- Runs: `src/features/runs/pages/RunCenterPage.tsx`
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
- `completed_step_ids`
- `outputs`: captured runtime outputs/variables available after the runner has a browser session to inspect
- `retained_session`: whether a reusable retained browser session is available, plus workflow/profile ownership and a reason when unavailable
- `error`

Run errors include:

- `step_id`
- `step_number`
- `step_name`
- `action_type`
- `reason`

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
source vocabulary for Runs, Overview, and Evidence filtering.

## Lifecycle

- `run_workflow` delegates to the run manager to create a run-id scoped snapshot, close only a conflicting retained browser session for the same workflow/profile when launching a fresh session, then set that snapshot status to `running`, mode, target step id, and clears progress/error.
- `run_workflow_from_node` reuses an existing retained session and runs from a selected main-path graph node. It requires the Workflow Settings Run Policy Run from selected toggle, Reuse login session, browser retention `retain`, and a retained session matching the workflow/profile. Run Policy scope decides whether the compiled sub-plan contains only the selected node or the selected node through the downstream main path.
- Progress events set current step and completed step ids. Nested compiled graph actions also report their original graph node ids while they execute, allowing branch/body nodes to surface in the same run-state fields as top-level continuation nodes.
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
- Terminal runs are persisted to SQLite `runs`; compiled top-level graph steps are persisted to `run_steps` with action type, status, trace JSON, and error JSON when available. Executed nested branch/body actions are also appended as `run_steps` rows from `__action_traces`; their trace JSON carries `parent_node_id`, `trace_sequence`, started/finished timestamps when emitted, output/evidence summaries, and trace failure reasons.
- Infrastructure failure sets status to `failed` without retained session.
- When Workflow Settings `execution.max_workflow_duration_ms` is set, the background run cancels through the normal cancellation token at that limit. The terminal state is `failed` with a workflow-level timeout reason such as `Workflow exceeded maximum duration of <ms> ms`.
- Outputs can contain evidence generated by the backend, including `browser_identity` for sanitized browser identity launch evidence, `__action_traces` for per-action execution mode and execution-path evidence, and `__evidence` for run-scoped screenshot/download metadata. Nested `__action_traces` entries include the parent control node id and monotonic sequence so durable storage can reconstruct the executed path through If, Router, loop, and Retry bodies.
- `browser_identity` includes CloakBrowser wrapper/binary evidence, fingerprint seed hash, configured fingerprint font hash when available, sanitized persona id/label/rationale, OS/browser bucket, viewport/window dimensions, font bundle label/expected families, timezone/locale source, GeoIP/supported WebRTC policy, active advanced override names such as `fingerprint_fonts_dir`, and configured humanization status/preset. It must not include proxy passwords, operator-entered proxy metadata fields, test-account bindings, cookies, localStorage, sessionStorage, raw profile storage, raw font directory paths, or raw local font directory contents.
- `__evidence_model` has `schema_version: 1`, the canonical evidence categories (`operator_input`, `browser_identity`, `network_posture`, `action_trace`, `page_observation`, `generated_output`, `sensitive_redacted`), and per-output manifest entries with key, category, approximate serialized byte size, redaction flag, and truncation flag. Arbitrary page-observation outputs are recursively redacted by sensitive key pattern and limited for large strings/arrays/objects. Structured backend evidence such as `browser_identity`, `__action_traces`, and `__evidence` is intentionally structured; Evidence Explorer still recursively filters sensitive keys from nested action-trace details before renderer display.
- Batch runs create one run record per executed row. Each row prepends row values as `set_variable` actions before the compiled graph, runs sequentially, returns per-row status/error summary, and records skipped/stopped rows in batch outputs.
- `list_run_states` returns run snapshots for the current app session, sorted by start time, so the renderer can present multiple active runs and recent terminal states.

## UI Expectations

- `App.tsx` polls `list_run_states` while any snapshot is running, including runs started from the workflow list or scheduler where the detail graph workspace is not open. It falls back to `get_run_state` only for legacy bridge compatibility.
- Run status bar displays terminal and error states.
- Workflow detail displays a live run navigator whenever saved Graph settings enable Live Run and the loaded graph has active or recent run progress. The navigator derives the current/failed node and recent trail from `current_step_id`, `current_step_number`, `completed_step_ids`, and `error.step_id`, and uses graph labels for readable node names. The saved Follow current setting initializes whether progress selects and centers the current node as it changes; Focus current/failed node performs the same action on demand.
- Workflow list rows display the active snapshot for their workflow, disable only the affected row Run action, and expose row-level Stop for that run id.
- Runs displays all session run snapshots and can stop a selected active run by id.
- Workflow detail renders `Run from selected` only when the Workflow Settings Run Policy toggle is enabled, then enables it only when run state reports a matching retained session and exactly one supported main-path node is selected. Merge is not a supported selected start because it compiles to an internal no-op graph marker.
- Run issue presentation is derived from run state, command errors, and graph validation issues without changing the persisted run-state shape.
- Graph runs reuse this shape. `WorkflowGraphEditor` renders current/completed/failed graph node state when `current_step_id`, `completed_step_ids`, or `error.step_id` match compiled graph node ids, including nested branch/body node ids preserved by graph compilation.

## Change Checklist

- Update TypeScript run-state types and Electron command/runner tests together.
- Update monitor/status tests.
- Update command tests when lifecycle semantics change.
- Update `docs/domain/execution-semantics.md`.
