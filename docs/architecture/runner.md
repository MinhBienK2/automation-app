# Runner Architecture

## Purpose

The runner executes action configs in a headed Chromium browser and reports progress back to app state.

The Electron rebuild adds a Node runner foundation that executes runner-native plans and emits structured events. It is separate from the Tauri/Rust runner and is implemented under `electron/runner/`.

## Key Files

- `src-tauri/src/runner/browser.rs`
- `src-tauri/src/runner/actions/mod.rs`
- `src-tauri/src/runner/actions/`
- `src-tauri/src/runner/executor.rs`
- `src-tauri/src/runner/cancellation.rs`
- `src-tauri/src/runner/error.rs`
- `src-tauri/src/services/run_service.rs`
- `src-tauri/src/app_state.rs`
- `src-tauri/tests/runner_spike.rs`
- `electron/runner/runnerCore.ts`
- `electron/runner/cloakBrowserAdapter.ts`
- `electron/main/runnerSupervisor.ts`
- `electron/runner/stdio-runner.mjs`
- `electron/runner/runnerCore.test.ts`
- `electron/main/runnerSupervisor.test.ts`

## Current Behavior

- `BrowserRunExecutor` runs action configs through `BrowserRunner`.
- `BrowserRunExecutor` accepts optional workflow browser runtime config and passes it to `BrowserRunner` before launch.
- `BrowserRunner` emits `StepStarted` and `StepCompleted`.
- `run_service` maps progress step numbers back to workflow step ids.
- Graph-internal action configs execute branch, switch, loop, retry, try/catch, fallback, break/continue, transform, output assertion, variable mutation, and domain allowlist semantics above the browser action dispatch layer.
- Variable actions write to the browser session output store. `set_variable` accepts typed rows, renders templates before parsing values, flattens object fields into dotted output keys, and keeps array values whole. `set_json_variables` renders and parses a JSON object before storing flattened keys.
- `repeat_for_each` can iterate a manual item list or a variable-backed array from the output store. Object items expose dotted `item_name.field` variables inside the loop body, and loop outputs are retained for later steps.
- Action failures produce failed outcomes with optional failure screenshots.
- Runner infrastructure errors fail the run without a retained session.
- Browser sessions are retained in `AppState` after terminal outcomes unless Workflow Settings Execution browser retention is `close` or a compiled terminal Stop Workflow config requests browser closure. Captured `window.__wamOutputs` values are copied into run state before retention or closure.
- Starting a new run closes any retained sessions from previous terminal outcomes before Chromium launches, so persistent profile directories are not reused while an older browser process still owns the profile lock.
- Browser launch settings come from Workflow Settings Browser. `browser.headless` switches `BrowserRunExecutor` from the default headed Chromium launch to headless mode. Legacy browser config commands map to the Browser section.
- Fingerprint preflight is compiled as settings setup when enabled. The runner opens the configured probe URL, parses the JSON verdict in-page, stores sanitized `fingerprint_preflight` evidence, and fails before graph actions when the verdict is malformed or not passed.
- Named browser profiles use persistent Chromium user data directories under the user's app data directory at `workflow-automation-manager/browser-profiles/<profile>`. Runs without a profile continue to use temporary user data directories.
- Before graph actions run, the command layer prepends supported Environment defaults and Variables seed values from Workflow Settings.
- Execution settings fill missing action `timeout_ms` fields from the workflow default action timeout before the runner receives steps.
- Execution interaction fidelity settings are applied before the runner receives steps. `high` currently migrates compatible fill-field defaults to typed keyboard input while preserving explicit direct-value configs.
- Execution settings can insert fixed or random waits between compiled graph nodes before the runner receives steps. Explicit Wait and Random Wait nodes override the global wait at their position.
- Execution max duration is enforced in `run_service` with the same cancellation token used by Stop. Timeout finishes the run as failed with a workflow-level timeout error.
- Batch execution compiles the saved graph, applies settings defaults for headless and concurrency when the request omits them, runs rows sequentially, closes each row session, and stops early when `batch_stop_on_first_failed_row` is enabled. Concurrency above 1 is rejected until row isolation is implemented.
- `BrowserRunner` records compact action traces into the browser output store under `__action_traces`, classifying actions as browser input, assisted browser input, direct DOM, observer, or manual.
- Electron runner core consumes compiled `RunPlan` payloads, enforces origin allowlists for navigation, emits deterministic lifecycle/step/issue/artifact events, supports cooperative cancellation between actions, and writes artifacts only under main-allocated run directories.
- `createCloakBrowserAdapter` uses the `cloakbrowser` package as the browser launch source and maps locator-first action configs to Playwright-style page/locator APIs.
- `RunnerSupervisor` currently proves the local runner process boundary through a stdio JSONL health handshake. Full process-backed `startRun` remains the next runner milestone before replacing the in-process app API vertical slice.

## Belongs Here

- Chromium session launch and tab/frame/download behavior.
- Workflow Settings Browser application at browser launch.
- Action dispatch and browser interaction.
- Cancellation-aware execution.
- Runner-level errors and outcomes.

## Action Modules

Browser action script builders live under `src-tauri/src/runner/actions/` and are grouped by user behavior:

- `pointer.rs`: click target geometry and explicit force-DOM fallback helpers. Click, hover, double/right click, and drag/drop dispatch browser-level mouse primitives from `actions/mod.rs`.
- `scroll.rs`: page, container, into-view, and until-visible scrolling.
- `wait.rs`: wait condition polling scripts.
- `input.rs`: text input, clearing input, and contenteditable updates. `Fill Field`
  can either set field values directly or, when `typing_mode` is `type`, focus the
  element and emit per-character key/input/change events with a visible default delay.
- `form.rs`: select, checkbox/radio, custom option, and submit form actions.
- `keyboard.rs`: legacy keyboard script-builder tests. Runtime press-key, hotkey, type-sequence, and high-fidelity fill-field paths dispatch browser-level keyboard primitives from `actions/mod.rs`.
- `target.rs`: structured target resolver that maps ordered locator bundles and iframe targets to runtime XPath/frame context.
- `clipboard.rs`: in-run clipboard store and paste actions.
- `element.rs`: focus and blur element actions.
- `data_capture.rs`: output extraction and storage scripts.
- Variable and loop storage helpers live in `actions/mod.rs` because they coordinate runner control flow and browser output state.
- `actionability.rs`, `js.rs`: shared helper code used by action modules.

## Does Not Belong Here

- UI polling logic.
- SQL persistence.
- Command payload naming.

## Change Checklist

- Preserve cancellation behavior.
- Update runner tests for action behavior.
- Update Electron runner tests for `electron/runner/runnerCore.ts` and process-supervision changes.
- Update command tests when run state semantics change.
- Update `docs/contracts/run-state.md` for status/progress changes.
