# Runner Architecture

## Purpose

The Electron runner executes compiled action configs through CloakBrowser's Playwright runtime and reports progress through the shared run-state contract.

## Key Files

- `electron/backend/runtime/runner.ts`
- `electron/backend/browser/sessionManager.ts`
- `electron/backend/evidence/artifacts.ts`
- `electron/backend/evidence/model.ts`
- `electron/backend/runtime/runner.test.ts`
- `electron/backend/browser/sessionManager.test.ts`
- `electron/backend/evidence/model.test.ts`
- `electron/backend/runtime/runner.smoke.test.ts`
- `electron/backend/commands.ts`
- `electron/backend/runtime/runManager.ts`
- `electron/backend/actions/registry.ts`
- `electron/backend/actions/execution.ts`
- `electron/backend/actions/validation.ts`
- `electron/backend/graph/compiler.ts`

## Current Behavior

- `BrowserWorkflowRunner` runs action configs through CloakBrowser by default and Playwright-compatible page/context APIs. `AUTOMATION_BROWSER_ENGINE=camoufox` switches the default backend driver to the local Camoufox Firefox-compatible runtime at `CAMOUFOX_EXECUTABLE_PATH` or `~/.cache/camoufox/camoufox`.
- CloakBrowser `humanize` defaults to enabled for both temporary and persistent contexts and follows the Workflow Settings Browser Launch toggle. The Browser Launch `human_preset` value maps to CloakBrowser `humanPreset` (`default` or `careful`).
- `BrowserSessionManager` maps Workflow Settings Browser Launch identity values to CloakBrowser launch options before the first page action. The mapping includes stable fingerprint seed, fingerprint fonts directory, persistent profile directory, proxy server/bypass/credentials, explicit timezone/locale or detected local machine timezone/locale, GeoIP, supported WebRTC fingerprint args, humanization timing profile, headless mode, and the lab-verified CloakBrowser mitigation flags `--fingerprint-noise=false`, `--fingerprint-storage-quota=500`, and `--fingerprint-platform=windows`. New workflows enable GeoIP by default and blank legacy location settings normalize back to GeoIP; disabling GeoIP requires explicit timezone and locale values. It does not send empty `userAgent`, explicit Playwright launch `viewport`, `--window-size`, or CloakBrowser screen-size overrides. Persona viewport/window dimensions remain in sanitized evidence. Unsupported WebRTC disable policies are rejected by backend settings validation or normalized to `default` when persisted JSON is loaded. In-run Set Viewport changes only width and height.
- In Camoufox mode, `BrowserSessionManager` maps storage mode, persistent user data dir, proxy, explicit timezone/locale, headless mode, and download settings into Playwright Firefox launch/context options. It records `browser_engine: "camoufox"` plus Camoufox runtime evidence in `browser_identity`; CloakBrowser-only fingerprint seed/font/WebRTC/humanize flags remain saved identity metadata but are not passed to Firefox.
- Real CloakBrowser launches fail before Chromium starts when a headed Linux identity has no `DISPLAY` or `WAYLAND_DISPLAY`; unit tests that inject a fake driver bypass this host prerequisite guard.
- Command handlers compile the saved graph and pass persisted settings plus the compiled graph to the run manager, which invokes the runner and exposes the shared run-state shape back through Electron IPC. Nested compiled graph actions retain their source graph node ids so runner progress can light up branch/body nodes before the outer control block continues.
- Command handlers can also compile a selected main-path graph node into a sub-plan and ask the runner to reuse the retained browser session instead of launching a new context. The Run Policy scope decides whether that sub-plan contains only the selected node or continues from that node through the downstream main path.
- `RunManager` owns run orchestration around the runner: run-id scoped workflow entries, same-workflow/profile/batch conflict checks, per-run `BrowserWorkflowRunner` instances for active workflow execution, begin/finish state transitions, per-run max-duration timeout, SQLite run persistence, and batch row state.
- Graph-internal action configs execute branch, router, random-choice, switch, loop, retry, try/catch, fallback, break/continue, transform, output assertion, variable mutation, Merge no-op, and domain allowlist semantics above the browser action dispatch layer.
- Compiled run plans may include `domain_policy`; the runner enforces it before navigation-like actions call Playwright.
- Variable actions write to the browser session output store. `set_variable` accepts typed rows, renders templates before parsing values, flattens object fields into dotted output keys, and keeps array values whole. `set_json_variables` renders and parses a JSON object before storing flattened keys.
- `repeat_for_each` can iterate a manual item list or a variable-backed array from the output store. Object items expose dotted `item_name.field` variables inside the loop body, and loop outputs are retained for later steps.
- Action failures produce failed outcomes with optional run-scoped failure screenshots.
- Runner infrastructure errors fail the run without a retained session.
- Browser sessions are retained through `BrowserSessionManager` after terminal outcomes unless Workflow Settings Run Policy browser retention is `close` or a compiled terminal Stop Workflow config requests browser closure. Captured `window.__wamOutputs` values are copied into run state before retention or closure.
- Retained-session metadata is keyed by workflow/profile inside `BrowserSessionManager` and shared across isolated runner instances so retained browsers remain discoverable after the run-specific runner finishes. Run-from-selected checks the matching metadata before execution and refuses stale, closed, missing, or mismatched sessions.
- Identity Lab closes retained sessions through a narrow workflow/profile
  command that delegates to the runner/session manager after command-level
  active-run/profile guards pass. This clears retained in-memory context state
  only and does not delete persistent browser profile data.
- Starting a fresh run closes only a retained session that conflicts with the same workflow/profile before CloakBrowser launches, so persistent profile directories are not reused while an older browser process still owns the profile lock. Retained sessions for unrelated workflow/profile pairs remain available for inspection.
- Run-from-selected is the exception to the relaunch rule: it keeps the retained context/page alive and runs the selected-node sub-plan against that page. Depending on Run Policy scope, the sub-plan may stop after the selected node or continue downstream. If the operator closed the browser manually, the runner clears retained metadata and reports that no reusable browser session is available.
- Browser launch settings come from Workflow Settings Browser Launch. `browser_launch.headless` switches CloakBrowser between headed and headless mode.
- Browser identities use CloakBrowser persistent contexts under the user's app data directory at `automation-app/browser-profiles/<profile_dir>` when Reuse login session is enabled. Runs without persistent storage use temporary contexts while keeping the configured fingerprint seed, and terminal retention still follows Run Policy and terminal node `close_browser` settings.
- `BrowserSessionManager` provides the sanitized `browser_identity` record with run id, identity id/display name, profile directory or temporary marker, selected persona id/label/rationale and population buckets, fingerprint seed hash, configured fingerprint font hash when a readable font bundle is present, timezone/locale and source, GeoIP/supported WebRTC policy, active advanced override names such as `fingerprint_fonts_dir`, configured humanization status and preset, and CloakBrowser wrapper/binary evidence.
- Browser recorder sessions also launch through `BrowserSessionManager`, but
  they do not execute compiled workflow steps. The recorder session manager
  uses the same Workflow Settings browser identity baseline, injects page-side
  capture through the Playwright-compatible page adapter, supports a limited
  recorder-safe `headless` launch override for verification runs, observes
  top-level page navigation plus backend tab/download/dialog events, drains buffered in-page
  events when an adapter binding cannot call back and again before stopping,
  redacts password/secret-like text field values and secret-like raw keys before
  they are stored, drops malformed locator candidates, stores bounded raw
  recording events in memory, closes partially launched contexts when
  setup/navigation fails, and closes the recorder context on stop or discard.
  Replacement recording rejects active workflow/profile/batch conflicts before
  launch. Recorder normalization maps only to existing runner actions, preserves
  literal text input values, captures contenteditable text and clipboard
  copy/paste, suppresses text-editing keyboard noise and duplicate form-control
  clicks, normalizes paste to Set Clipboard plus Paste Clipboard while dropping
  the following duplicate input event, and normalizes tab/scroll transitions
  before graph generation;
  redacted sensitive inputs and upload replay require reviewer-entered safe
  values or local file paths, and native file chooser captures remain warnings
  until reviewed.
- Before graph actions run, the command layer prepends Environment initial variables from Workflow Settings.
- Graph settings are not runner-facing settings. The runner only receives edge waits after the graph compiler has emitted them as ordinary fixed or random wait steps.
- Default action timeouts and interaction fidelity settings are not part of the runner-facing settings contract.
- Cancellation is checked between actions and inside long waits through an `AbortSignal`. Stop returns a stopped run state and closes temporary contexts according to retention policy.
- Batch execution compiles the saved graph, prepends row variables, applies settings defaults for headless and concurrency when the request omits them, runs rows sequentially, persists one run per executed row, and stops early when `batch_stop_on_first_failed_row` is enabled. Concurrency above 1 is rejected until row isolation is implemented.
- `BrowserWorkflowRunner` records compact action traces into outputs under `__action_traces`, classifying actions by trace mode and status. Nested branch/body actions that retain `graph_node_id` emit trace entries with `parent_node_id`, monotonic `trace_sequence`, started/finished timestamps, and compact output/evidence summaries before the parent control node records its final trace.
- Runner output finalization emits `__evidence_model`, which classifies outputs into operator input, browser identity, network posture, action trace, page observation, generated output, and sensitive/redacted categories. Arbitrary page-observation outputs are recursively redacted by sensitive key pattern and limited for large strings/arrays/objects; structured backend evidence and action traces are preserved so nested execution evidence remains usable.
- `execute_js` is gated by Run Policy `execute_js_enabled`; disabled workflows fail the step before evaluating script text. When allowed, traces include explicit audit tags `direct_dom_script` and `requires_review`, and script output values pass through the shared evidence output limits/redaction before final run state is returned or persisted.
- Generated screenshots and downloads are written under `evidence/runs/<run_id>/...` and mirrored in outputs under both compact output keys and structured `__evidence` metadata.
- Run-scoped screenshot and download artifact names plus path containment checks live in `electron/backend/evidence/artifacts.ts`; the runner calls those helpers before writing browser-produced files.
- `run_steps.trace_json` stores action trace entries when the runner emits them. Command persistence preserves existing top-level graph step rows, then appends trace-driven nested rows so branch, loop, and retry body executions remain durable for evidence/history views. Failed rows carry serialized run errors or trace reasons.

## Belongs Here

- CloakBrowser session launch and tab/frame/download behavior.
- Workflow Settings Browser Launch identity application at browser launch.
- Retained browser session lookup, stale detection, and close/retain bookkeeping.
- Workflow/profile-scoped retained-session close for Identity Lab.
- Action dispatch and browser interaction.
- Cancellation-aware execution.
- Runner-level errors and outcomes.

## Action Modules

Browser action dispatch lives in `electron/backend/runtime/runner.ts` and is grouped by user behavior:

The backend action registry enumerates all serialized action types and tags
their execution owner, palette visibility, and audit risk. The runner dispatches
through `electron/backend/actions/execution.ts`, which resolves handlers by
registry lookup before action-specific code runs. Unknown action payloads fail
through the same unsupported-action gate as compiler validation, and the typed
handler map makes missing execution coverage explicit when an action is added.

- Pointer: click, hover, double click, and drag/drop dispatch CloakBrowser-patched locator/frame primitives where possible. Right click uses a custom human move plus right-button down/up because the installed CloakBrowser human patch does not preserve the right-button option on its patched click path.
- Scroll: Page mode uses an isolated custom human wheel implementation because CloakBrowser does not expose a page-distance scroll helper; `window.scrollBy` is only a fallback for driver adapters without wheel input. Page mode defaults to `human_like`, deriving a small number of decisive chunks from the requested pixel distance while preserving the exact total, then emitting each chunk as smaller eased wheel pulses with short random pauses inside the gesture and longer random pauses between gestures. Page mode can also use `smooth_single`, which sends one wheel gesture for the requested distance and only falls back to DOM `window.scrollBy({ behavior: "smooth" })` when the driver has no wheel input. Scroll To Element resolves the target and first tries CloakBrowser's exported human scroll helper when the active page exposes the required mouse and viewport primitives, then falls back to the app-owned wheel planner if CloakBrowser cannot handle the target. Scroll Until Element Visible repeats Page-style scroll gestures in the configured direction until the target has a visible bounding box, which lets lazy-load pages create missing DOM nodes, and then uses the same target-scroll path. The planner recalculates chunk size and pause duration from the remaining distance, and the wheel delta points down or up based on the target's position relative to the viewport. Movement stays monotonic and goal-directed while avoiding direct `scrollIntoViewIfNeeded` jumps.
- Browser context: Set Viewport changes runtime width and height only; Browser Launch does not send explicit launch viewport/window overrides and does not expose device scale factor, mobile mode, or touch capability controls. Persona viewport/window values are audit metadata, not forced launch dimensions.
- Wait: duration, page, URL, text, and element waits with cancellation support.
- Input: text input, clearing input, and contenteditable updates. `Fill Field` uses the browser field-fill primitive; CloakBrowser owns behavior realism.
- Forms/keyboard/clipboard: select, checkbox/radio, submit, key presses, hotkeys, in-run clipboard, and paste actions. Select Radio tries CloakBrowser locator `check()` then locator click before DOM fallback. Targeted Submit Form tries locator click/press before DOM `requestSubmit` fallback; no-target Submit Form uses custom key hold timing for Enter. Paste focuses the target through a CloakBrowser locator click, writes the browser clipboard, then sends the platform paste shortcut instead of filling the field.
- Target resolution: structured target bundles map to Playwright locators, including ordered locator fallback, role/label/placeholder/text/CSS/XPath/attribute kinds, constraints, and iframe targeting; XPath strings remain supported.
- Data capture: text, attribute, input value, list/table, screenshot, download, and JavaScript outputs. Extract Table reads table rows and `th`/`td` cells through locator-side DOM evaluation. Execute JavaScript treats the script text as a browser-side function body, so `return ...` scripts can store values through `output_name`. Screenshot and download artifacts are run-scoped.
- Variables/control flow: variable mutation, loops, branches, router first-match cases, weighted random-choice branches, retries, try/catch, fallback, Merge no-op, stop, output assertions, and domain allowlists.

## Does Not Belong Here

- UI polling logic.
- SQL persistence.
- Command payload naming.

## Change Checklist

- Preserve cancellation behavior.
- Update runner tests for action behavior.
- Update command tests when run state semantics change.
- Update `docs/contracts/run-state.md` for status/progress changes.
