# Execution Semantics

## Runner Model

- Runs execute ordered action configs.
- `run_workflow` executes all workflow steps.
- `test_step` executes from the first step through the selected step.
- Background execution is started by `src-tauri/src/services/run_service.rs`.
- Browser execution lives under `src-tauri/src/runner/`.
- Visual graphs compile to executable action configs, including graph-internal control configs for switch, guarded loops, try/catch, fallback, loop break/continue, output assertions, transforms, subworkflow expansion, and domain allowlists.
- Graphs with no executable compiled steps are rejected before the runner starts.

## Run State

- Status values are `idle`, `running`, `success`, `failed`, and `stopped`.
- Mode values are `none`, `run_workflow`, and `test_step`.
- Step progress reports current step id/number and completed step ids.
- Terminal run state includes captured outputs from `window.__wamOutputs` when the runner retained a browser session.
- Failures carry step id, step number, step name, action type, and reason when available.

## Browser Sessions

- Runner launches a headed Chromium browser by default through `BrowserRunExecutor`.
- A startup `about:blank` page is reused for the first new-tab navigation when possible.
- Browser sessions are retained after success, failure, and stop by `AppState::finish_run`.
- `AppState::finish_run` captures runtime outputs before retaining the session, so command callers can inspect values produced by extract, screenshot, download, variable, and transform actions.
- Temporary user data directories are used unless a profile action config selects a persistent profile.

## Cancellation

- `stop_run` cancels the active run through `RunnerCancellation`.
- App state immediately reflects `stopped`.
- Runner loops check cancellation between steps and action code must preserve responsive cancellation for long operations.

## Failure Behavior

- Action failures become failed runner outcomes.
- Failure screenshots are attempted and appended to the failure reason when available.
- Runner infrastructure errors fail the run without a retained session.
- `break_loop` and `continue_loop` only have meaning inside graph loop configs. If they reach top-level runner execution, the run fails with a loop-control error.

## Preserve

- Step order semantics.
- Test-step slicing through the selected step.
- User-visible terminal states.
- Browser retention after terminal outcomes unless intentionally changed and documented.
