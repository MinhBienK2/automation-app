# Execution Semantics

## Runner Model

- Runs execute ordered action configs.
- `run_workflow` executes the compiled saved graph.
- `run_workflow_from_node` executes the saved graph from one selected main-path graph node by reusing the currently retained browser session. Run Policy scope selects either only that node or that node through the downstream main path.
- `test_step` executes from the first step through the selected step.
- During the Electron migration, graph validation and compilation are owned by `electron/backend/graph/compiler.ts`.
- Browser execution runs through the Electron backend `BrowserWorkflowRunner`, backed by npm `cloakbrowser` by default and Playwright-compatible page/context APIs. Setting `AUTOMATION_BROWSER_ENGINE=camoufox` selects the local Camoufox Firefox-compatible runtime for lab runs when the binary exists at `CAMOUFOX_EXECUTABLE_PATH` or `~/.cache/camoufox/camoufox`. Browser launch, retained-session state, and browser identity evidence are delegated to `electron/backend/browser/sessionManager.ts`.
- Visual graphs compile to executable action configs, including graph-internal control configs for router, switch, guarded loops, try/catch, fallback, loop break/continue, output assertions, transforms, Merge no-ops, explicit unsupported subworkflow placeholders, and domain allowlists.
- Unknown graph node, action, nested action, and condition discriminants are
  validation errors before normal save/import/run boundaries. If a malformed
  compiled plan reaches the runner directly, unknown action and condition kinds
  fail the run instead of becoming no-ops or false conditions.
- Graph edge delays compile to synthetic fixed or random wait steps before the edge target node. They are duration-only transition timing, not page-state waits.
- Graph control blocks compile branch ports into nested action configs, then continue from explicit continuation ports. `If`, `Switch`, `Router`, and `Try/Catch` continue from `done`; retry continues from `success`; loop, repeat-until, and fallback blocks continue from `done`.
- Router nodes evaluate cases in saved order using `first_match` semantics. The first matching case branch runs; when no cases match, the default branch runs. Missing case/default branches are no-ops, and a missing `done` continuation ends successfully after Router.
- Merge nodes compile as internal no-op graph steps so run progress can show the convergence point. Merge does not touch browser page, output store, network policy, or session state.
- Missing optional branches compile as empty nested steps. Missing continuation ports end the current path successfully. Missing required body ports such as loop body, retry try, try/catch try, and fallback primary are validation errors before compile/run.
- Graphs with no executable compiled steps are rejected before the runner starts.
- The TypeScript compiler emits the runner-facing `CompiledWorkflowGraph` and command handlers use it for `validate_workflow_graph` and `compile_workflow_graph`.
- Command handlers pass the compiled graph and persisted settings to the Electron runner for `run_workflow`; runner outputs and action traces return through the shared run-state contract.
- Command handlers pass a selected-node compiled sub-plan to the runner for `run_workflow_from_node`; this path does not launch a new browser and fails if no matching retained session exists. `run_policy.run_from_selected_mode` controls whether the sub-plan stops after the selected node or continues through the downstream main path. Merge cannot be selected as the start node because it is a graph-native no-op, not an executable browser or control decision.
- Command handlers manage run-id scoped workflow runs. They block only same-workflow conflicts, shared persistent browser profile conflicts, and batch conflicts, then persist begin/finish records to SQLite `runs`, persist compiled top-level step evidence and executed nested action traces to `run_steps`, and update the matching live run snapshot from runner progress callbacks.
- Run persistence records durable `source` provenance as `manual` or
  `schedule` at run creation so historical evidence filtering remains
  meaningful after restart.
- Scheduled runs start through the same saved-workflow command path as manual full runs. If the scheduled workflow conflicts with an active workflow, active persistent profile, or active batch, the scheduler records a skipped occurrence instead of queueing it; isolated due schedules can start in the same scheduler tick.
- Manual full-run launch attempts that fail graph or Workflow Settings
  validation before a run row exists write sanitized operational attention for
  Overview. Scheduled validation failures continue to use schedule events and
  are not duplicated into operational attention rows.
- `run_workflow` loads Workflow Settings before starting the runner. Settings validation and run validation happen before browser launch.
- Environment initial variables from Workflow Settings compile into setup actions before graph actions.
- Graph settings affect authoring only; the runner executes the edge delays already saved on the graph.
- Domain allowlist graph nodes are promoted into a run-scope `domain_policy`. The runner enforces that policy after template rendering and before `navigate` or `open_new_tab` can call the browser navigation API. Runtime `domain_allowlist` nodes remain available as in-flow assertions.
- Run Policy `max_workflow_duration_ms` starts a run-level timer in the background service. When it expires, the run is canceled through `RunnerCancellation` and finishes as `failed` with a clear workflow timeout reason.
- Run Policy `browser_retention` is the default terminal browser policy. Terminal graph nodes that explicitly request close still close the session; otherwise `retain` keeps the session for inspection and `close` closes it after outputs are captured.
- Run Policy `execute_js_enabled` defaults to enabled. When disabled, `execute_js` fails before script evaluation with a clear Run Policy error so lower-risk profiles can reject direct DOM scripting while keeping the action available for authorized workflows.
- `run_workflow_from_node` requires Run Policy `run_from_selected_enabled`, Browser Launch `persistent_profile`, Run Policy browser retention `retain`, and a retained session owned by the same workflow/profile directory. Temporary retained sessions are not eligible.
- `set_variable` writes one or more named variables into the browser output store. Values are rendered as templates first, then parsed as text, JSON, number, or boolean according to each row's `value_type`. Object values are flattened into dotted variable names and array values remain arrays.
- `set_json_variables` renders its JSON text, requires a root object, and writes flattened keys into the browser output store.
- `repeat_for_each` can use either a manual item list or an `array_variable` that points at an array in the browser output store. Missing or non-array variable sources fail the action before running the loop body.
- `while_loop` and `repeat_until` honor configured timeouts as well as max-attempt guards. `repeat_until.timeout_steps` run when the predicate remains false after max attempts or timeout.
- Browser identity, proxy, profile, and download behavior belong in Workflow Settings Browser Launch, not in in-run action nodes.
- `set_viewport` changes only runtime viewport width and height. Workflow Settings Browser Launch no longer exposes viewport width, viewport height, device scale factor, mobile mode, or touch capability controls.
- Click, double click, hover, fill, select, checkbox, and drag/drop prefer CloakBrowser-patched locator/frame APIs so CloakBrowser owns supported humanization.
- Runner action traces record compact action mode/status metadata. Nested branch/body traces also record parent control node id, sequence order, timestamps, output summary, evidence summary, and failure reason when present. The runner also keeps an internal interaction capability map: CloakBrowser-native for supported element/page/frame APIs, CloakBrowser-assisted or custom human behavior for app-owned interaction timing such as scroll, and direct DOM for read/assert/storage or final fallback paths.
- Select Radio tries the CloakBrowser locator `check()` path first, then locator click, and only falls back to DOM checked/input/change mutation if the native paths fail.
- Submit Form with a target tries locator click/press first and only falls back to DOM `requestSubmit`; Submit Form without a target uses custom Enter key hold timing on the page keyboard.
- Right Click uses custom human movement to the resolved target followed by right-button down/up, avoiding CloakBrowser patched click paths that do not preserve the right-button option.
- Scroll Page mode uses custom human wheel gestures because CloakBrowser does not expose a page-distance scroll helper; `window.scrollBy` is only a fallback for driver adapters without wheel input. Page Scroll calculates a small number of decisive chunks from the requested pixel distance while preserving the exact total. Each chunk is emitted as a short eased burst of smaller wheel pulses with random sub-pulse pauses and a longer random pause before the next chunk. Scroll To Element resolves the target and first tries CloakBrowser's exported human scroll helper when the Playwright page exposes the required mouse and viewport primitives; if the helper is unavailable or fails, the runner falls back to the app-owned wheel planner. The planner recalculates chunk size and pause duration from the remaining distance until the target is sufficiently visible, scrolling down or up depending on whether the target is below or above the viewport. Scroll movement stays monotonic toward the goal to avoid jittery up/down oscillation. `scrollIntoViewIfNeeded` is not the primary path for Scroll actions.
- Dialog actions register one-shot browser dialog handlers. `wait_for_download` waits for a real download event and saves the artifact under the current run evidence directory.
- `extract_table` resolves the target table or nearest owning table and stores rows as arrays of trimmed `th`/`td` cell text.
- `execute_js` runs script text as a browser-side function body only when Run Policy allows it. Scripts may use `return ...`; when `output_name` is set, the returned value is stored in run outputs.

## Run State

- Status values are `idle`, `running`, `success`, `failed`, and `stopped`.
- Mode values are `none`, `run_workflow`, and `test_step`.
- Step progress reports current step id/number and completed step ids. Graph branch/body actions keep their source node ids in the compiled run plan, so nested `If`, loop, retry, and related branch nodes can appear as active/completed on the canvas before continuation nodes run.
- Terminal run state includes captured outputs from `window.__wamOutputs` when the runner retained a browser session.
- Captured outputs may include backend evidence keys such as `__action_traces` and `__evidence`. At finish time, command persistence keeps compatible top-level `run_steps` rows and appends executed nested trace rows, so the stored rows can reconstruct which branch, loop iteration, or retry attempt actually ran.
- Overview only reads metadata from sanitized structured evidence; artifact
  opening, raw output inspection, absolute local paths, and arbitrary file
  paths stay outside this phase.
- Evidence Explorer reads typed evidence summaries and bounded details from
  persisted outputs and run steps. Screenshot preview, artifact reveal, and
  evidence-bundle export are backend commands that revalidate run-scoped
  artifact paths under the app evidence directory before touching files.
- Failures carry step id, step number, step name, action type, and reason when available.
- Terminal graph nodes can request browser closure. Outputs are captured before the browser is closed; otherwise the session is retained after terminal outcomes.

## Batch Execution

- `run_batch_workflow` uses the same saved graph/settings plan as `run_workflow`.
- Batch execution is globally exclusive with normal runs. Starting a normal run while a batch is active, or a batch while any normal run is active, fails with a command error.
- `stop_run` aborts an active batch before the next row and terminal state reports the stopped batch summary.
- Each row is inserted as a `set_variable` setup action after persisted settings setup actions and before graph actions.
- Request `headless` overrides `run_policy.batch_headless`; omitted request values use settings defaults.
- Concurrency above 1 is rejected until parallel row isolation is implemented.
- Rows execute sequentially and each executed row is persisted as a run record with its own step evidence.
- When `batch_stop_on_first_failed_row` is true, row execution stops after the first failed row and the summary reports only executed rows in `results`.

## Browser Sessions

- Runner launches CloakBrowser Chromium through `BrowserWorkflowRunner`; `humanize` defaults to enabled and can be disabled from Workflow Settings Browser Launch. The `human_preset` setting maps to CloakBrowser `humanPreset` and supports `default` or `careful`.
- A startup `about:blank` page is reused for the first new-tab navigation when possible.
- Browser sessions are retained after success, failure, and stop by the Electron runner unless retention settings or terminal configs request closure.
- The Electron runner captures runtime outputs before retaining or closing the session, so command callers can inspect values produced by extract, screenshot, download, variable, and transform actions.
- Retained browser sessions are keyed by workflow/profile so multiple isolated workflows can retain inspectable browsers at the same time. Starting a fresh run closes only the retained session that would conflict with that workflow/profile before a new CloakBrowser context launches, releasing that persistent profile lock while preserving unrelated retained sessions.
- A run-from-selected run reuses the matching retained context/page instead of closing and relaunching. If the retained browser was closed manually, the runner clears retained-session metadata and the command reports that a new reusable session must be created by running the workflow again.
- Identity Lab can close a retained session by workflow/profile through a
  guarded command. This releases only the retained in-memory browser context;
  it does not remove the persistent profile directory, saved identity settings,
  cookies/login state, evidence files, or historical run rows.
- Workflow Settings Browser Launch resolves the browser identity before the browser starts. `BrowserSessionManager` maps persistent versus temporary storage, stable profile directory, fingerprint seed, fingerprint fonts directory, proxy server/bypass/credentials, explicit timezone/locale or local machine timezone/locale, GeoIP, supported WebRTC policy values, humanize toggle/preset, and headless mode into CloakBrowser launch options. New workflows enable GeoIP by default, and blank legacy location settings normalize back to GeoIP, so CloakBrowser resolves blank timezone/locale fields from the current public or proxy exit IP. Running with GeoIP off requires explicit timezone and locale values. It also applies the current CloakBrowser/Fingerprint.com lab mitigation flags: `--fingerprint-noise=false`, `--fingerprint-storage-quota=500`, and `--fingerprint-platform=windows`. When `AUTOMATION_BROWSER_ENGINE=camoufox`, the session manager maps the same storage/proxy/timezone/locale/headless/download settings into Playwright Firefox options and records Camoufox runtime evidence; CloakBrowser-only fingerprint flags are intentionally not passed to Firefox. Persona viewport/window dimensions stay in sanitized identity evidence for audit, but Browser Launch still does not send explicit Playwright `viewport`, `userAgent`, `--window-size`, or CloakBrowser screen-size overrides. In-run Set Viewport can still change runtime viewport later.
- Real headed CloakBrowser launches on Linux require `DISPLAY` or `WAYLAND_DISPLAY`; otherwise the runner fails with a clear startup prerequisite error before starting Chromium.
- Temporary CloakBrowser contexts are used unless Workflow Settings Browser Launch selects a persistent profile. Persistent profile data is stored under the user's app data directory in `automation-app/browser-profiles/<profile_dir>`, not under the OS temp directory. Disabling Reuse login session changes storage mode only and keeps the identity fingerprint seed stable.
- `browser_identity` run evidence records CloakBrowser wrapper/binary version, binary installed status, fingerprint seed hash, configured fingerprint font hash when available, sanitized selected persona metadata and rationale, timezone/locale source, GeoIP/supported WebRTC policy, active advanced override names such as `fingerprint_fonts_dir`, and configured humanization status/preset. Package export redacts proxy passwords, proxy URL credentials, and local fingerprint font directories.
- Final run outputs include `__evidence_model`, a per-output category/limit/redaction manifest. It preserves structured action traces and generated artifact metadata while redacting sensitive arbitrary page-observation outputs and limiting oversized strings, arrays, and objects. `execute_js` remains available for authorized testing, can be disabled per workflow through Run Policy, and its traces carry explicit direct-DOM audit tags when allowed.

## Cancellation

- `stop_run(runId)` cancels the targeted run through its `RunnerCancellation`; omitting `runId` is valid only when one active run exists. Batch stop uses the same command path.
- App state immediately reflects `stopped` for the targeted run snapshot.
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
