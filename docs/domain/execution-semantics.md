# Execution Semantics

## Runner Model

- Runs execute ordered action configs.
- `run_workflow` executes all workflow steps.
- `test_step` executes from the first step through the selected step.
- Background execution is started by `src-tauri/src/services/run_service.rs`.
- Browser execution lives under `src-tauri/src/runner/`.
- Visual graphs compile to executable action configs, including graph-internal control configs for switch, guarded loops, try/catch, fallback, loop break/continue, output assertions, transforms, subworkflow expansion, and domain allowlists.
- Graph control blocks compile branch ports into nested action configs, then continue from explicit continuation ports. `If`, `Switch`, and `Try/Catch` continue from `done`; retry continues from `success`; loop, repeat-until, and fallback blocks continue from `done`.
- Missing optional branches compile as empty nested steps. Missing continuation ports end the current path successfully. Missing required body ports such as loop body, retry try, try/catch try, and fallback primary are validation errors before compile/run.
- Graphs with no executable compiled steps are rejected before the runner starts.
- `run_workflow` loads Workflow Settings before starting the runner. Settings validation and run validation happen before browser launch.
- Environment defaults from Workflow Settings compile into setup actions before graph actions: geolocation, permission grants, extra headers, download directory, cookies, localStorage, and sessionStorage.
- Inputs & Variables settings seed the runtime variable store before graph actions. Required inputs without a saved default block manual runs until a per-run value source exists.
- Execution settings fill missing action `timeout_ms` fields from `default_action_timeout_ms`; action-level timeouts remain more specific.
- `set_variable` writes one or more named variables into the browser output store. Values are rendered as templates first, then parsed as text, JSON, number, or boolean according to each row's `value_type`. Object values are flattened into dotted variable names and array values remain arrays.
- `set_json_variables` renders its JSON text, requires a root object, and writes flattened keys into the browser output store.
- `repeat_for_each` can use either a manual item list or an `array_variable` that points at an array in the browser output store. Missing or non-array variable sources fail the action before running the loop body.

## Run State

- Status values are `idle`, `running`, `success`, `failed`, and `stopped`.
- Mode values are `none`, `run_workflow`, and `test_step`.
- Step progress reports current step id/number and completed step ids.
- Terminal run state includes captured outputs from `window.__wamOutputs` when the runner retained a browser session.
- Failures carry step id, step number, step name, action type, and reason when available.
- Terminal graph nodes can request browser closure. Outputs are captured before the browser is closed; otherwise the session is retained after terminal outcomes.

## Browser Sessions

- Runner launches a headed Chromium browser by default through `BrowserRunExecutor`.
- A startup `about:blank` page is reused for the first new-tab navigation when possible.
- Browser sessions are retained after success, failure, and stop by `AppState::finish_run`.
- `AppState::finish_run` captures runtime outputs before retaining the session, so command callers can inspect values produced by extract, screenshot, download, variable, and transform actions.
- `AppState::begin_run` closes retained sessions from previous terminal runs before a new run launches, releasing persistent profile locks while preserving post-run inspection until the next run starts.
- Workflow Settings Browser can set the launch profile, proxy, user agent, viewport, mobile flag, touch flag, and challenge policy before the browser starts. The frontend exposes coherent device profile presets that write those existing user agent, viewport, mobile, and touch fields together.
- Legacy browser config commands are compatibility wrappers over Workflow Settings Browser.
- Temporary user data directories are used unless a profile action config or Workflow Settings Browser profile selects a persistent profile. Persistent profile data is stored under the user's app data directory in `workflow-automation-manager/browser-profiles/<profile>`, not under the OS temp directory.

## Cancellation

- `stop_run` cancels the active run through `RunnerCancellation`.
- App state immediately reflects `stopped`.
- Runner loops check cancellation between steps and action code must preserve responsive cancellation for long operations.

## Failure Behavior

- Action failures become failed runner outcomes.
- Failure screenshots are attempted and appended to the failure reason when available.
- Runner infrastructure errors fail the run without a retained session.
- `break_loop` and `continue_loop` only have meaning inside graph loop configs. If they reach top-level runner execution, the run fails with a loop-control error.
- Graph validation blocks `break_loop` and `continue_loop` unless they are reachable through a loop body branch.
- Retry exhaustion without a failed branch fails the workflow with the last action error. Try/catch failure without an error branch fails the workflow with the original action error after running `finally` when present. Fallback primary failure without a fallback branch fails the workflow with the primary error.

## Preserve

- Step order semantics.
- Test-step slicing through the selected step.
- User-visible terminal states.
- Browser retention after terminal outcomes unless intentionally changed and documented.
