# Runner Architecture

## Purpose

The Electron runner executes compiled action configs through CloakBrowser's Playwright runtime and reports progress through the shared run-state contract.

## Key Files

- `electron/backend/runner.ts`
- `electron/backend/runner.test.ts`
- `electron/backend/runner.smoke.test.ts`
- `electron/backend/commands.ts`
- `electron/backend/graphCompiler.ts`

## Current Behavior

- `BrowserWorkflowRunner` runs action configs through CloakBrowser and Playwright-compatible page/context APIs.
- CloakBrowser `humanize` is enabled by default for both temporary and persistent contexts.
- `BrowserWorkflowRunner` maps Workflow Settings Browser Launch values to CloakBrowser launch options before the first page action.
- Command handlers compile the saved graph, pass persisted settings to the runner, and expose the shared run-state shape over Electron IPC. Nested compiled graph actions retain their source graph node ids so runner progress can light up branch/body nodes before the outer control block continues.
- Command handlers own run orchestration around the runner: one active run at a time, begin/finish state transitions, max-duration timeout, SQLite run persistence, and batch row sequencing.
- Graph-internal action configs execute branch, switch, loop, retry, try/catch, fallback, break/continue, transform, output assertion, variable mutation, and domain allowlist semantics above the browser action dispatch layer.
- Compiled run plans may include `domain_policy`; the runner enforces it before navigation-like actions call Playwright.
- Variable actions write to the browser session output store. `set_variable` accepts typed rows, renders templates before parsing values, flattens object fields into dotted output keys, and keeps array values whole. `set_json_variables` renders and parses a JSON object before storing flattened keys.
- `repeat_for_each` can iterate a manual item list or a variable-backed array from the output store. Object items expose dotted `item_name.field` variables inside the loop body, and loop outputs are retained for later steps.
- Action failures produce failed outcomes with optional run-scoped failure screenshots.
- Runner infrastructure errors fail the run without a retained session.
- Browser sessions are retained in the Electron runner after terminal outcomes unless Workflow Settings Run Policy browser retention is `close` or a compiled terminal Stop Workflow config requests browser closure. Captured `window.__wamOutputs` values are copied into run state before retention or closure.
- Starting a new run closes any retained session from previous terminal outcomes before CloakBrowser launches, so persistent profile directories are not reused while an older browser process still owns the profile lock.
- Browser launch settings come from Workflow Settings Browser Launch. `browser_launch.headless` switches CloakBrowser between headed and headless mode. Legacy browser config commands map to Browser Launch.
- Fingerprint preflight is compiled as settings setup when enabled. The runner opens the configured probe URL, parses the JSON verdict in-page, stores sanitized `fingerprint_preflight` evidence, and fails before graph actions when the verdict is malformed or not passed.
- Named browser profiles use CloakBrowser persistent contexts under the user's app data directory at `automation-app/browser-profiles/<profile>`. Runs without a profile use temporary contexts that close after the run.
- Before graph actions run, the command layer prepends Environment initial variables and owned-test-gate fingerprint preflight steps from Workflow Settings.
- Default action timeouts, interaction fidelity, and global wait-between-nodes settings are legacy v1 settings and are not part of the v2 runner-facing settings contract.
- Cancellation is checked between actions and inside long waits through an `AbortSignal`. Stop returns a stopped run state and closes temporary contexts according to retention policy.
- Batch execution compiles the saved graph, prepends row variables, applies settings defaults for headless and concurrency when the request omits them, runs rows sequentially, persists one run per executed row, and stops early when `batch_stop_on_first_failed_row` is enabled. Concurrency above 1 is rejected until row isolation is implemented.
- `BrowserWorkflowRunner` records compact action traces into outputs under `__action_traces`, classifying actions as browser input, assisted browser input, direct DOM, observer, or manual.
- Generated screenshots and downloads are written under `evidence/runs/<run_id>/...` and mirrored in outputs under both compact output keys and structured `__evidence` metadata.
- `run_steps.trace_json` stores action trace entries when the runner emits them, and failed step rows carry serialized run errors for later evidence/history views.

## Belongs Here

- CloakBrowser session launch and tab/frame/download behavior.
- Workflow Settings Browser Launch application at browser launch.
- Action dispatch and browser interaction.
- Cancellation-aware execution.
- Runner-level errors and outcomes.

## Action Modules

Browser action dispatch lives in `electron/backend/runner.ts` and is grouped by user behavior:

- Pointer: click, hover, double/right click, and drag/drop dispatch browser-level primitives where possible.
- Scroll: page scrolling is implemented; unsupported scroll modes are rejected by backend validation until runner support lands.
- Wait: duration, page, URL, text, and element waits with cancellation support.
- Input: text input, clearing input, and contenteditable updates. `Fill Field`
  can either set field values directly or, when `typing_mode` is `type`, focus the
  element and emit per-character key/input/change events with a visible default delay.
- Forms/keyboard/clipboard: select, checkbox/radio, submit, key presses, hotkeys, in-run clipboard, and paste actions.
- Target resolution: structured target bundles map to Playwright locators, including ordered locator fallback, role/label/placeholder/text/CSS/XPath/attribute kinds, constraints, and iframe targeting; XPath strings remain supported.
- Data capture: text, attribute, input value, list/table, screenshot, download, and JavaScript outputs. Screenshot and download artifacts are run-scoped.
- Variables/control flow: variable mutation, loops, branches, retries, try/catch, fallback, stop, output assertions, and domain allowlists.

## Does Not Belong Here

- UI polling logic.
- SQL persistence.
- Command payload naming.

## Change Checklist

- Preserve cancellation behavior.
- Update runner tests for action behavior.
- Update command tests when run state semantics change.
- Update `docs/contracts/run-state.md` for status/progress changes.
