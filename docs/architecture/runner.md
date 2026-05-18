# Runner Architecture

## Purpose

The Electron runner executes compiled action configs through CloakBrowser's Playwright runtime and reports progress through the shared run-state contract.

## Key Files

- `electron/backend/runner.ts`
- `electron/backend/evidenceArtifacts.ts`
- `electron/backend/runner.test.ts`
- `electron/backend/runner.smoke.test.ts`
- `electron/backend/commands.ts`
- `electron/backend/graphCompiler.ts`

## Current Behavior

- `BrowserWorkflowRunner` runs action configs through CloakBrowser and Playwright-compatible page/context APIs.
- CloakBrowser `humanize` defaults to enabled for both temporary and persistent contexts and follows the Workflow Settings Browser Launch toggle. The Browser Launch `human_preset` value maps to CloakBrowser `humanPreset` (`default` or `careful`).
- `BrowserWorkflowRunner` maps Workflow Settings Browser Launch identity values to CloakBrowser launch options before the first page action. The mapping includes stable fingerprint seed, persistent profile directory, proxy server/bypass/credentials, timezone, locale, GeoIP, supported WebRTC fingerprint args, optional Custom fingerprint overrides, and headless mode. Unsupported WebRTC disable policies are rejected by backend settings validation or normalized to `default` when persisted JSON is loaded. In-run Set Viewport changes only width and height.
- Real CloakBrowser launches fail before Chromium starts when a headed Linux identity has no `DISPLAY` or `WAYLAND_DISPLAY`; unit tests that inject a fake driver bypass this host prerequisite guard.
- Command handlers compile the saved graph, pass persisted settings to the runner, and expose the shared run-state shape over Electron IPC. Nested compiled graph actions retain their source graph node ids so runner progress can light up branch/body nodes before the outer control block continues.
- Command handlers can also compile a selected main-path graph node into a sub-plan and ask the runner to reuse the retained browser session instead of launching a new context.
- Command handlers own run orchestration around the runner: run-id scoped workflow entries, same-workflow/profile/batch conflict checks, per-run `BrowserWorkflowRunner` instances for active workflow execution, begin/finish state transitions, per-run max-duration timeout, SQLite run persistence, and batch row sequencing.
- Graph-internal action configs execute branch, router, switch, loop, retry, try/catch, fallback, break/continue, transform, output assertion, variable mutation, Merge no-op, and domain allowlist semantics above the browser action dispatch layer.
- Compiled run plans may include `domain_policy`; the runner enforces it before navigation-like actions call Playwright.
- Variable actions write to the browser session output store. `set_variable` accepts typed rows, renders templates before parsing values, flattens object fields into dotted output keys, and keeps array values whole. `set_json_variables` renders and parses a JSON object before storing flattened keys.
- `repeat_for_each` can iterate a manual item list or a variable-backed array from the output store. Object items expose dotted `item_name.field` variables inside the loop body, and loop outputs are retained for later steps.
- Action failures produce failed outcomes with optional run-scoped failure screenshots.
- Runner infrastructure errors fail the run without a retained session.
- Browser sessions are retained in the Electron runner after terminal outcomes unless Workflow Settings Run Policy browser retention is `close` or a compiled terminal Stop Workflow config requests browser closure. Captured `window.__wamOutputs` values are copied into run state before retention or closure.
- Retained-session metadata is keyed by workflow/profile and shared across isolated runner instances so retained browsers remain discoverable after the run-specific runner finishes. Run-from-selected checks the matching metadata before execution and refuses stale, closed, missing, or mismatched sessions.
- Starting a fresh run closes only a retained session that conflicts with the same workflow/profile before CloakBrowser launches, so persistent profile directories are not reused while an older browser process still owns the profile lock. Retained sessions for unrelated workflow/profile pairs remain available for inspection.
- Run-from-selected is the exception to the relaunch rule: it keeps the retained context/page alive and runs the selected-node sub-plan against that page. If the operator closed the browser manually, the runner clears retained metadata and reports that no reusable browser session is available.
- Browser launch settings come from Workflow Settings Browser Launch. `browser_launch.headless` switches CloakBrowser between headed and headless mode.
- Browser identities use CloakBrowser persistent contexts under the user's app data directory at `automation-app/browser-profiles/<profile_dir>` when Reuse login session is enabled. Runs without persistent storage use temporary contexts while keeping the configured fingerprint seed, and terminal retention still follows Run Policy and terminal node `close_browser` settings.
- Optional owned fingerprint preflight runs after launch and initial environment setup but before graph actions. It opens the allowlisted probe URL, parses a structured JSON verdict, stores sanitized `fingerprint_preflight` evidence, and fails the run before graph execution on blocked or malformed verdicts.
- Runner outputs include a sanitized `browser_identity` record with run id, identity id/display name, profile directory or temporary marker, fingerprint seed hash, non-secret proxy label/region/provider/test-account binding, timezone/locale and source, GeoIP/supported WebRTC policy, Custom fingerprint override status, viewport summary or auto marker, configured humanization status and preset, active advanced overrides, and CloakBrowser wrapper/binary evidence.
- Before graph actions run, the command layer prepends Environment initial variables from Workflow Settings.
- Graph settings are not runner-facing settings. The runner only receives edge waits after the graph compiler has emitted them as ordinary fixed or random wait steps.
- Default action timeouts and interaction fidelity settings are not part of the runner-facing settings contract.
- Cancellation is checked between actions and inside long waits through an `AbortSignal`. Stop returns a stopped run state and closes temporary contexts according to retention policy.
- Batch execution compiles the saved graph, prepends row variables, applies settings defaults for headless and concurrency when the request omits them, runs rows sequentially, persists one run per executed row, and stops early when `batch_stop_on_first_failed_row` is enabled. Concurrency above 1 is rejected until row isolation is implemented.
- `BrowserWorkflowRunner` records compact action traces into outputs under `__action_traces`, classifying actions by trace mode and status.
- Generated screenshots and downloads are written under `evidence/runs/<run_id>/...` and mirrored in outputs under both compact output keys and structured `__evidence` metadata.
- Run-scoped screenshot and download artifact names plus path containment checks live in `electron/backend/evidenceArtifacts.ts`; the runner calls those helpers before writing browser-produced files.
- `run_steps.trace_json` stores action trace entries when the runner emits them, and failed step rows carry serialized run errors for later evidence/history views.

## Belongs Here

- CloakBrowser session launch and tab/frame/download behavior.
- Workflow Settings Browser Launch identity application at browser launch.
- Action dispatch and browser interaction.
- Cancellation-aware execution.
- Runner-level errors and outcomes.

## Action Modules

Browser action dispatch lives in `electron/backend/runner.ts` and is grouped by user behavior:

- Pointer: click, hover, double click, and drag/drop dispatch CloakBrowser-patched locator/frame primitives where possible. Right click uses a custom human move plus right-button down/up because the installed CloakBrowser human patch does not preserve the right-button option on its patched click path.
- Scroll: Page mode uses an isolated custom human wheel implementation because CloakBrowser does not patch `page.mouse.wheel` directly; `window.scrollBy` is only a fallback for driver adapters without wheel input. Into View and Until Visible resolve the target and call the CloakBrowser/Playwright `scrollIntoViewIfNeeded` path instead of app-written wheel timing.
- Browser context: Set Viewport changes runtime width and height only; device scale factor, mobile mode, and touch capability are launch-time Custom fingerprint overrides and remain seed-derived while that optional group is disabled.
- Wait: duration, page, URL, text, and element waits with cancellation support.
- Input: text input, clearing input, and contenteditable updates. `Fill Field` uses the browser field-fill primitive; CloakBrowser owns behavior realism.
- Forms/keyboard/clipboard: select, checkbox/radio, submit, key presses, hotkeys, in-run clipboard, and paste actions. Select Radio tries CloakBrowser locator `check()` then locator click before DOM fallback. Targeted Submit Form tries locator click/press before DOM `requestSubmit` fallback; no-target Submit Form uses custom key hold timing for Enter. Paste focuses the target through a CloakBrowser locator click, writes the browser clipboard, then sends the platform paste shortcut instead of filling the field.
- Target resolution: structured target bundles map to Playwright locators, including ordered locator fallback, role/label/placeholder/text/CSS/XPath/attribute kinds, constraints, and iframe targeting; XPath strings remain supported.
- Data capture: text, attribute, input value, list/table, screenshot, download, and JavaScript outputs. Extract Table reads table rows and `th`/`td` cells through locator-side DOM evaluation. Execute JavaScript treats the script text as a browser-side function body, so `return ...` scripts can store values through `output_name`. Screenshot and download artifacts are run-scoped.
- Variables/control flow: variable mutation, loops, branches, router first-match cases, retries, try/catch, fallback, Merge no-op, stop, output assertions, and domain allowlists.

## Does Not Belong Here

- UI polling logic.
- SQL persistence.
- Command payload naming.

## Change Checklist

- Preserve cancellation behavior.
- Update runner tests for action behavior.
- Update command tests when run state semantics change.
- Update `docs/contracts/run-state.md` for status/progress changes.
