# Execution Semantics

## Runner Model

- Runs execute ordered action configs.
- `run_workflow` executes the compiled saved graph.
- `test_step` executes from the first step through the selected step.
- During the Electron migration, graph validation and compilation are owned by `electron/backend/graphCompiler.ts`.
- Browser execution runs through the Electron backend `BrowserWorkflowRunner`, backed by npm `cloakbrowser` and Playwright-compatible page/context APIs.
- Visual graphs compile to executable action configs, including graph-internal control configs for switch, guarded loops, try/catch, fallback, loop break/continue, output assertions, transforms, explicit unsupported subworkflow placeholders, and domain allowlists.
- Graph control blocks compile branch ports into nested action configs, then continue from explicit continuation ports. `If`, `Switch`, and `Try/Catch` continue from `done`; retry continues from `success`; loop, repeat-until, and fallback blocks continue from `done`.
- Missing optional branches compile as empty nested steps. Missing continuation ports end the current path successfully. Missing required body ports such as loop body, retry try, try/catch try, and fallback primary are validation errors before compile/run.
- Graphs with no executable compiled steps are rejected before the runner starts.
- The TypeScript compiler emits the runner-facing `CompiledWorkflowGraph` and command handlers use it for `validate_workflow_graph` and `compile_workflow_graph`.
- Command handlers pass the compiled graph and persisted settings to the Electron runner for `run_workflow`; runner outputs and action traces return through the shared run-state contract.
- Command handlers reject a second active run, persist begin/finish records to SQLite `runs`, persist compiled step evidence to `run_steps`, and update live run state from runner progress callbacks.
- `run_workflow` loads Workflow Settings before starting the runner. Settings validation and run validation happen before browser launch.
- Environment initial variables from Workflow Settings compile into setup actions before graph actions.
- Domain allowlist graph nodes are promoted into a run-scope `domain_policy`. The runner enforces that policy after template rendering and before `navigate` or `open_new_tab` can call the browser navigation API. Runtime `domain_allowlist` nodes remain available as in-flow assertions.
- Owned Test Gates fingerprint preflight opens the configured allowlisted probe URL before graph actions. The probe must return the JSON verdict contract; failed or malformed verdicts stop the run before workflow actions and store sanitized `fingerprint_preflight` evidence in outputs when available.
- Run Policy `max_workflow_duration_ms` starts a run-level timer in the background service. When it expires, the run is canceled through `RunnerCancellation` and finishes as `failed` with a clear workflow timeout reason.
- Run Policy `browser_retention` is the default terminal browser policy. Terminal graph nodes that explicitly request close still close the session; otherwise `retain` keeps the session for inspection and `close` closes it after outputs are captured.
- `set_variable` writes one or more named variables into the browser output store. Values are rendered as templates first, then parsed as text, JSON, number, or boolean according to each row's `value_type`. Object values are flattened into dotted variable names and array values remain arrays.
- `set_json_variables` renders its JSON text, requires a root object, and writes flattened keys into the browser output store.
- `repeat_for_each` can use either a manual item list or an `array_variable` that points at an array in the browser output store. Missing or non-array variable sources fail the action before running the loop body.
- `while_loop`, `repeat_until`, and `resume_when_condition` honor configured timeouts as well as max-attempt guards. `repeat_until.timeout_steps` run when the predicate remains false after max attempts or timeout.
- `run_subworkflow` is preserved as a compatibility action config but fails explicitly at runtime until nested lifecycle, recursion, and evidence ownership are designed.
- Launch-time-only actions such as profile/proxy/user-agent/download-directory settings are hidden from active action authoring and fail explicitly if loaded as in-run actions.
- Dialog actions register one-shot browser dialog handlers. `wait_for_download` waits for a real download event and saves the artifact under the current run evidence directory.

## Run State

- Status values are `idle`, `running`, `success`, `failed`, and `stopped`.
- Mode values are `none`, `run_workflow`, and `test_step`.
- Step progress reports current step id/number and completed step ids. Graph branch/body actions keep their source node ids in the compiled run plan, so nested `If`, loop, retry, and related branch nodes can appear as active/completed on the canvas before continuation nodes run.
- Terminal run state includes captured outputs from `window.__wamOutputs` when the runner retained a browser session.
- Captured outputs may include backend evidence keys such as `__action_traces`, `__evidence`, and `fingerprint_preflight`.
- Failures carry step id, step number, step name, action type, and reason when available.
- Terminal graph nodes can request browser closure. Outputs are captured before the browser is closed; otherwise the session is retained after terminal outcomes.

## Batch Execution

- `run_batch_workflow` uses the same saved graph/settings plan as `run_workflow`.
- Batch execution shares the active-run lifecycle lock with normal runs. Starting a normal run while a batch is active, or a batch while another run is active, fails with a command error.
- `stop_run` aborts an active batch before the next row and terminal state reports the stopped batch summary.
- Each row is inserted as a `set_variable` setup action after persisted settings setup actions and before graph actions.
- Request `headless` overrides `run_policy.batch_headless`; omitted request values use settings defaults.
- Concurrency above 1 is rejected until parallel row isolation is implemented.
- Rows execute sequentially and each executed row is persisted as a run record with its own step evidence.
- When `batch_stop_on_first_failed_row` is true, row execution stops after the first failed row and the summary reports only executed rows in `results`.

## Browser Sessions

- Runner launches CloakBrowser Chromium through `BrowserWorkflowRunner`; `humanize` is enabled by default.
- A startup `about:blank` page is reused for the first new-tab navigation when possible.
- Browser sessions are retained after success, failure, and stop by the Electron runner unless retention settings or terminal configs request closure.
- The Electron runner captures runtime outputs before retaining or closing the session, so command callers can inspect values produced by extract, screenshot, download, variable, and transform actions.
- Starting a new run closes retained sessions from previous terminal runs before a new CloakBrowser context launches, releasing persistent profile locks while preserving post-run inspection until the next run starts.
- Workflow Settings Browser Launch can set temporary versus persistent profile mode, profile name, proxy, and headless mode before the browser starts.
- Legacy browser config commands are compatibility wrappers over Workflow Settings Browser Launch.
- Temporary CloakBrowser contexts are used unless Workflow Settings Browser Launch selects a persistent profile. Persistent profile data is stored under the user's app data directory in `automation-app/browser-profiles/<profile>`, not under the OS temp directory.

## Cancellation

- `stop_run` cancels the active run through `RunnerCancellation`.
- App state immediately reflects `stopped`.
- Runner loops check cancellation between steps and action code must preserve responsive cancellation for long operations.
- In the Electron runner, cancellation is carried by an `AbortSignal`; long waits listen to the signal and command state returns `stopped` promptly while the runner finishes cleanup.

## Failure Behavior

- Action failures become failed runner outcomes.
- Failure screenshots are attempted under `evidence/runs/<run_id>/screenshots/` and appended to the failure reason when available. Artifact names are run-scoped to avoid overwriting prior runs.
- Runner infrastructure errors fail the run without a retained session.
- `break_loop` and `continue_loop` only have meaning inside graph loop configs. If they reach top-level runner execution, the run fails with a loop-control error.
- Graph validation blocks `break_loop` and `continue_loop` unless they are reachable through a loop body branch.
- Retry exhaustion without a failed branch fails the workflow with the last action error. Try/catch failure without an error branch fails the workflow with the original action error after running `finally` when present. Fallback primary failure without a fallback branch fails the workflow with the primary error.

## Preserve

- Step order semantics.
- Test-step slicing through the selected step.
- User-visible terminal states.
- Browser retention after terminal outcomes unless intentionally changed and documented.
