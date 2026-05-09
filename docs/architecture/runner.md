# Runner Architecture

## Purpose

The Electron runner executes compiled action configs through CloakBrowser's Playwright runtime and reports progress through the shared run-state contract.

## Key Files

- `electron/backend/runner.ts`
- `electron/backend/runner.test.ts`
- `electron/backend/runner.smoke.test.ts`
- `electron/backend/commands.ts`
- `electron/backend/graphCompiler.ts`
- Temporary Rust parity reference: `src-tauri/src/runner/`, `src-tauri/src/services/run_service.rs`, `src-tauri/src/app_state.rs`

## Current Behavior

- `BrowserWorkflowRunner` runs action configs through CloakBrowser and Playwright-compatible page/context APIs.
- CloakBrowser `humanize` is enabled by default for both temporary and persistent contexts.
- `BrowserWorkflowRunner` maps Workflow Settings Browser and Environment values to CloakBrowser launch/context options before the first page action.
- Command handlers compile the saved graph, pass persisted settings to the runner, and expose the shared run-state shape over Electron IPC.
- Graph-internal action configs execute branch, switch, loop, retry, try/catch, fallback, break/continue, transform, output assertion, variable mutation, and domain allowlist semantics above the browser action dispatch layer.
- Variable actions write to the browser session output store. `set_variable` accepts typed rows, renders templates before parsing values, flattens object fields into dotted output keys, and keeps array values whole. `set_json_variables` renders and parses a JSON object before storing flattened keys.
- `repeat_for_each` can iterate a manual item list or a variable-backed array from the output store. Object items expose dotted `item_name.field` variables inside the loop body, and loop outputs are retained for later steps.
- Action failures produce failed outcomes with optional failure screenshots.
- Runner infrastructure errors fail the run without a retained session.
- Browser sessions are retained in the Electron runner after terminal outcomes unless Workflow Settings Execution browser retention is `close` or a compiled terminal Stop Workflow config requests browser closure. Captured `window.__wamOutputs` values are copied into run state before retention or closure.
- Starting a new run closes any retained session from previous terminal outcomes before CloakBrowser launches, so persistent profile directories are not reused while an older browser process still owns the profile lock.
- Browser launch settings come from Workflow Settings Browser. `browser.headless` switches CloakBrowser between headed and headless mode. Legacy browser config commands map to the Browser section.
- Fingerprint preflight is compiled as settings setup when enabled. The runner opens the configured probe URL, parses the JSON verdict in-page, stores sanitized `fingerprint_preflight` evidence, and fails before graph actions when the verdict is malformed or not passed.
- Named browser profiles use CloakBrowser persistent contexts under the user's app data directory at `automation-app/browser-profiles/<profile>`. Runs without a profile use temporary contexts that close after the run.
- Before graph actions run, the command layer prepends supported Environment defaults and Variables seed values from Workflow Settings.
- Execution settings fill missing action `timeout_ms` fields from the workflow default action timeout before the runner receives steps.
- Execution interaction fidelity settings are applied before the runner receives steps. `high` currently migrates compatible fill-field defaults to typed keyboard input while preserving explicit direct-value configs.
- Execution settings can insert fixed or random waits between compiled graph nodes before the runner receives steps. Explicit Wait and Random Wait nodes override the global wait at their position.
- Cancellation is checked between actions and inside long waits through an `AbortSignal`. Stop returns a stopped run state and closes temporary contexts according to retention policy.
- Batch execution compiles the saved graph, applies settings defaults for headless and concurrency when the request omits them, runs rows sequentially, closes each row session, and stops early when `batch_stop_on_first_failed_row` is enabled. Concurrency above 1 is rejected until row isolation is implemented.
- `BrowserWorkflowRunner` records compact action traces into outputs under `__action_traces`, classifying actions as browser input, assisted browser input, direct DOM, observer, or manual.

## Belongs Here

- CloakBrowser session launch and tab/frame/download behavior.
- Workflow Settings Browser application at browser launch.
- Action dispatch and browser interaction.
- Cancellation-aware execution.
- Runner-level errors and outcomes.

## Action Modules

Browser action dispatch now lives in `electron/backend/runner.ts` and is grouped by user behavior. The old Rust action modules remain a temporary reference until final Tauri removal:

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
- Update command tests when run state semantics change.
- Update `docs/contracts/run-state.md` for status/progress changes.
