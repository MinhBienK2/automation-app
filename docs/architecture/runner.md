# Runner Architecture

## Purpose

The Electron runner executes compiled action configs through CloakBrowser's Playwright runtime and reports progress through the shared run-state contract.

## Key Files

- Core runner: `electron/backend/runtime/` (`runner.ts`, `runManager.ts`, `batchWorkflowRun.ts`, `runnerActionExecutors.ts`)
- Browser context: `electron/backend/browser/sessionManager.ts`
- Action execution: `electron/backend/actions/` (`registry.ts`, `execution.ts`, `validation.ts`)
- Evidence and artifacts: `electron/backend/evidence/` (`artifacts.ts`, `model.ts`)
- Helper modules: `electron/backend/runtime/` (`actionTrace`, `targetResolver`, `interactionPrimitives`, `interactionActions`, `runtimeHelpers`, `conditions`, `runnerEvidence`, `domainPolicy`, `variables`)
- Unit and smoke tests: `runner.test.ts`, `runner.smoke.test.ts`, `sessionManager.test.ts`

## Current Behavior

- `BrowserWorkflowRunner` runs action configs through CloakBrowser by default and Playwright-compatible page/context APIs. `AUTOMATION_BROWSER_ENGINE=camoufox` switches the default backend driver to the local Camoufox Firefox-compatible runtime.
- CloakBrowser `humanize` defaults to enabled for both temporary and persistent contexts. The Browser Launch `human_preset` maps to CloakBrowser `humanPreset` (`default` or `careful`).
- `BrowserSessionManager` maps browser profile settings to CloakBrowser launch options (stable seed, fonts dir, persistent profile dir, proxy, timezone/locale, GeoIP, WebRTC args, and platform mitigations). Disabling GeoIP requires explicit timezone/locale. Viewport sizing changes only width and height.
- In Camoufox mode, `BrowserSessionManager` maps storage mode, user data, proxy, timezone/locale, headless mode, and downloads to Playwright Firefox options, recording `browser_engine: "camoufox"`.
- Headed Linux runs fail if no `DISPLAY` or `WAYLAND_DISPLAY` is set (bypassed in unit tests).
- Command handlers compile the graph and pass workflow settings to `RunManager` which invokes the runner and exposes progress via Electron IPC. Nested action nodes retain source graph node ids to track execution status.
- Selected-node plans can reuse a retained browser session (Run Policy scope determines selected node only or downstream main path).
- `RunManager` orchestrates active runs: same-workflow/profile/batch conflict checks, max-duration timeouts, SQLite persistence, and batch status.
- Graph-internal control actions (loops, branches, routers, retries, variables, allowlists) execute above the browser dispatch layer.
- `set_variable` accepts typed rows, renders templates, and flattens objects. `set_json_variables` parses JSON.
- `repeat_for_each` iterates list items or variable arrays. Loop outputs are retained for downstream steps.
- Action failures yield failed outcomes with screenshots. Errors carry step label details.
- Browser sessions are retained unless Workflow Settings or terminal node closes them. Output `window.__wamOutputs` values are copied.
- Retained sessions are managed by `BrowserSessionManager` across runner instances. Reruns check for stale, closed, or mismatched sessions.
- fresh persistent-profile runs close any existing retained session using that profile to avoid lock conflicts.
- Cancellation is checked via `AbortSignal`. Stop returns stopped state and respects retention policy.
- Batch preflight compiles the graph. `batchWorkflowRun.ts` runs rows sequentially, persisting run data via `RunManager`, and stops early on failure if `batch_stop_on_first_failed_row` is enabled. Concurrency > 1 is rejected.
- `BrowserWorkflowRunner` writes traces under `__action_traces`. Nested nodes emit trace entries with sequence, timestamps, and evidence.
- Output finalization emits `__evidence_model`, classifying and recursively redacting outputs based on sensitive key patterns.
- `execute_js` requires `execute_js_enabled`. Allowed scripts include `direct_dom_script` and `requires_review` trace tags.
- Generated files (screenshots, artifacts, downloads) are written to `evidence/runs/<run_id>/...` and mirrored in outputs.
- SQLite `run_steps` persists trace rows so branch, loop, and retry executions are durably tracked for history views.

## Belongs Here

- CloakBrowser session launch, tab/frame/download behavior, and profile options.
- Retained browser session lookup, stale detection, and lifecycle bookkeeping.
- Action dispatch, browser interaction, and cancellation-aware execution.

## Action Modules

Browser action dispatch in `runner.ts` maps behavior using `execution.ts` registry lookups:
- Pointer: Click, hover, drag/drop (supports offset/percent drag calculation), custom select, right click (custom human move), and element blur.
- Scroll: Page/target scroll. Page mode uses human-like pulsed wheel chunks or smooth single wheel inputs, falling back to page scrollBy. Scroll-until-visible plans scroll in the configured direction.
- Browser: Set Viewport changes width/height (launch overrides not exposed).
- Wait: Cancellation-supported duration, page, URL, text, and element wait states.
- Input: Text fill (browser primitive), clear input, and contenteditable updates.
- Forms/keys: Select radio (check/click fallback), targeted submit form (press/click/requestSubmit fallback), key presses, hotkeys, and paste (uses platform paste shortcut after writing clipboard).
- Target Resolution: Structured target mapping (CSS, XPath, role, placeholder, attribute, constraints) and Find Element candidate ranking (ranking by viewport intersection and area).
- Data Capture: Text/attribute extraction, list/table extraction, regex matches, screenshots, downloads, text-file output, and custom JS evaluation.
- Control Flow: Branches, routers, loop iterations, retries, variable mutations, assertions, and domain allowlists.

## Helpers & Execution Map

Modules under `electron/backend/runtime/` support the runner:
- `variables.ts`: Set Variables, template rendering, Set JSON Variables, item binding.
- `domainPolicy.ts`: Hostname normalization, Domain Allowlist policy checks.
- `actionTrace.ts`: Diagnostic logs, action trace mode, compact summaries.
- `targetResolver.ts`: Element target resolution, iframe roots, Find Element candidate ranking.
- `interactionPrimitives.ts` / `interactionActions.ts`: Mouse drag, custom pulsed human wheel scroll, submit/radio fallbacks, clipboard, right-click.
- `runtimeHelpers.ts`: Abort sleep, weighted random, JS wrapping, table extraction.
- `runnerActionExecutors.ts`: Action executor map mapping runner callbacks.
- `conditions.ts`: Branch, loop, and router conditions.
- `runnerEvidence.ts`: Output finalization, screenshots, and evidence mutations.

## Does Not Belong Here

- UI polling logic.
- SQL persistence.
- Command payload naming.

## Change Checklist

- Preserve cancellation behavior.
- Update runner tests for action behavior.
- Update command tests when run state semantics change.
- Update `docs/contracts/run-state.md` for status/progress changes.

