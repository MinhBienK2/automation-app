# Execution Semantics

## Runner Model

- Runs execute compiled action configs from `electron/backend/graph/compiler.ts`.
- Default engine: CloakBrowser (`npm cloakbrowser`). Alt: `AUTOMATION_BROWSER_ENGINE=camoufox` for Firefox lab runs.
- Session management: `electron/backend/browser/sessionManager.ts`.
- Graph edge delays → synthetic wait steps (duration-only, not page-state).
- Unknown action/condition discriminants → validation errors before save/import/run.
- Graphs with no executable compiled steps → rejected before runner starts.

## Compilation Rules

- Control blocks compile branch ports into nested configs, continue from explicit continuation ports.
- Router: `first_match` order. Missing branches → no-ops. Missing `done` → ends successfully.
- Merge: internal no-op step. No browser/output/session side effects.
- Call Subflow: resolves same-project subflow, inlines steps with prefixed ids/labels. Shares caller's run/browser/output/evidence/domain policy. No nested Call Subflow (MVP). Empty subflow → blocking error.
- Missing optional branches → empty steps. Missing continuation → successful end. Missing required body → validation error.
- Run from selected: `selected_only` or `from_selected`. Same subflow resolver. Merge not selectable (no-op). If the selected node is inside one or more loop nodes (e.g., repeat_for_each, repeat_times, while, repeat_until), the compiler automatically injects prelude steps to initialize these ancestor loop variables (setting system loop indices to index 0 / number 1 and extracting the first item of list variables where applicable) to act as if the first iteration is active.

## Run State

- Status: `idle` | `running` | `success` | `failed` | `stopped`.
- Step progress: `current_step_id`, `current_step_number`, `completed_step_ids`.
- Nested branch/body actions keep source node ids → canvas shows active/completed.
- Terminal state includes captured `__wamOutputs`, `__action_traces`, `__evidence`.
- Failures carry: step id, step number, compiled name, action type, reason, diagnostics.
- Call Subflow failures: nested label `<subflow> > <node>`, parent/subflow node ids, step ordinal.

## Browser Sessions

- Retained after success/failure/stop unless retention/terminal config requests closure.
- Keyed by workflow/profile. Starting fresh run → closes existing retained session on same profile dir.
- Run from selected → reuses matching retained context. Manually closed → cleared + readable error.
- Identity Lab close → releases in-memory context only (no profile/settings/evidence deletion).
- Profile data: stored under app data `browser-profiles/<profile_dir>` (not OS temp).

## Key Action Behaviors

- `set_variable`: template render → type parse (evaluating simple math expressions for number fields) → write to output store. Objects are stored natively without flattening; expressions and condition checking resolve nested properties dynamically at runtime using deep path lookups (`getDeepValue`). `set_json_variables` also recursively evaluates math expressions inside string properties.
- `repeat_for_each`: manual items or `array_variable`. Missing/non-array → fail before loop.
- `execute_js`: requires Run Policy `execute_js_enabled`. Returns value to `output_name`.
- `domain_allowlist`: promoted to run-scope policy. Enforced after template render, before navigation.
- Run Policy `max_workflow_duration_ms` → run-level timer → cancel + timeout reason.

## Batch Execution

- Globally exclusive with normal runs. Sequential rows. `concurrency > 1` rejected.
- Each row inserted as `set_variable` after settings setup, before graph actions.
- `batch_stop_on_first_failed_row`: stops after first failure.
- `stop_run` aborts batch before next row.

## Cancellation

- `stop_run(runId)`: cancels via `RunnerCancellation` (AbortSignal). Immediate `stopped` state.
- Runner loops check cancellation between steps.

## Failure Behavior

- Action failures → failed run. Failure screenshots attempted under `evidence/runs/<run_id>/screenshots/`.
- `break_loop`/`continue_loop` outside loop → fail. Retry exhaustion without `failed` branch → fail. Try/catch without `error` branch → fail after `finally`.
