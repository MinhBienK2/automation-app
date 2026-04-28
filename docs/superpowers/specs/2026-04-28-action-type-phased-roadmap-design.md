# Action Type Phased Roadmap Design

Date: 2026-04-28

## Summary

This spec defines the phased roadmap for expanding Workflow Browser Automation Manager from a linear browser macro tool into a practical no-code automation product. The roadmap goes beyond visible action types. Real user workflows also need browser context, data capture, variables, session state, proxy/network controls, CAPTCHA handling, recovery, and orchestration.

The product should treat these as separate layers:

- User actions: actions that mimic what a person does in the page.
- Browser context actions: actions that control tabs, frames, downloads, and browser navigation.
- Data actions: actions that capture page state and produce workflow outputs.
- Control flow actions: actions that make workflows branch, loop, retry, and use variables.
- Runtime capabilities: run-level settings such as profile, session, proxy, device, CAPTCHA policy, scheduling, and diagnostics.

The implementation should proceed in phases. Each phase should be useful on its own, small enough to test, and compatible with existing saved workflows.

## Goals

- Cover the practical cases users need to automate real browser work.
- Keep common human actions easy to find and configure.
- Avoid exposing advanced runtime controls as primary action types too early.
- Preserve existing workflow compatibility while adding new actions.
- Give each phase clear scope, dependencies, and test expectations.
- Make proxy, CAPTCHA, profile, and scheduler explicit roadmap items instead of afterthoughts.

## Non-Goals

- Do not implement this roadmap in one large change.
- Do not bypass CAPTCHA or evade website protections.
- Do not add paid third-party integrations by default.
- Do not require users to understand Playwright or Chromium internals.
- Do not migrate existing workflow rows until compatibility is proven.

## Current State

The app already supports a useful first layer:

- Core and legacy actions: `navigate`, `open_url`, `sleep`, `wait`, `input_text`, `type_text`, `clear_input`, `click`, `scroll`.
- Early P1 actions: `select_option`, `set_checkbox`, `press_key`, `hotkey`, `hover`.
- Grouped action picker: Core, Forms, Keyboard, Mouse, Legacy.
- Rust and TypeScript share serializable action config shapes.
- Runner actions are already split into dedicated modules and shared JavaScript helpers.

This gives a solid base, but it does not yet cover all user-like behavior, browser state, data outputs, anti-friction cases such as CAPTCHA, or workflow logic.

## Design Principles

The action model should start from user intent. For example, `double_click`, `right_click`, and `drag_and_drop` should be visible user actions because users think of them as distinct behaviors. Wait variants should stay config under `wait` because the intent is still waiting.

Runtime capabilities should not be forced into step actions unless the user naturally expects them in the step list. Proxy, browser profile, device emulation, and CAPTCHA policy are usually run/profile settings. Actions may reference them, but the main configuration belongs outside the normal step list.

Each new action should reuse shared element targeting behavior where possible:

```ts
type ElementTargetConfig = {
  xpath: string;
  iframe_xpath?: string | null;
  wait_until?: "attached" | "visible" | "enabled" | "clickable" | null;
  timeout_ms?: number | null;
};
```

The UI should expose common actions first. Advanced groups can be searchable or collapsed so the builder remains usable as the action count grows.

## Phase 1: Human Interaction Core

Purpose: make workflows imitate common human interactions inside a web page.

Actions:

| Action | Purpose |
|---|---|
| `double_click` | Open items, edit cells, select words, and trigger double-click handlers. |
| `right_click` | Open native or custom context menus. |
| `drag_and_drop` | Reorder items, move cards/files, and drop into browser drop zones. |
| `focus_element` | Put focus on a target before keyboard or validation behavior. |
| `blur_element` | Move focus away to trigger validation/change handlers. |
| `type_sequence` | Send realistic key-by-key text input for autocomplete, command palettes, and rich text fields. |
| `set_clipboard` | Put text into the system/browser clipboard for paste-oriented workflows. |
| `paste_clipboard` | Paste clipboard contents into the focused element. |
| `check` | Ensure a checkbox is checked. |
| `uncheck` | Ensure a checkbox is unchecked. |
| `toggle_checkbox` | Flip a checkbox regardless of its current state. |
| `select_radio` | Select a radio option in a group. |

Existing actions to keep and harden in this phase:

- `click`
- `input_text`
- `clear_input`
- `scroll`
- `wait`
- `select_option`
- `press_key`
- `hotkey`
- `hover`

Notes:

- Existing `set_checkbox` can remain as a compatibility action. The UI should eventually show `check`, `uncheck`, and `toggle_checkbox` because those are clearer to users.
- `type_sequence` is not the default way to enter text. `input_text` remains the default for normal fields.
- `right_click` and `double_click` can share click targeting helpers but should be separate action types in the picker.
- `drag_and_drop` is part of the human interaction phase, but it can be implemented after the simpler Phase 1 actions because it needs reliable source/target targeting and browser fixtures.
- Clipboard actions are useful for apps that only respond to paste events or rich text editors. They must be explicit because clipboard access can be surprising.

Completion criteria:

- Form-heavy and web-app workflows can be expressed without JavaScript.
- Each action has domain validation, UI fields, runner support, and focused tests.
- Legacy workflows still run unchanged.

## Phase 2: Form And File Workflows

Purpose: support login, checkout, admin panels, data entry, and document upload.

Actions:

| Action | Purpose |
|---|---|
| `upload_file` | Attach one or more local files to a file input. |
| `submit_form` | Submit the nearest form or a specific form target. |
| `select_custom_option` | Select an option from common non-native combobox/listbox patterns. |
| `set_contenteditable` | Enter formatted/plain text into contenteditable or rich text surfaces. |

Enhancements:

- `select_option` should support native select by label/value first.
- Custom selects should be separate from native select if their config and failure modes differ.
- Form actions should emit browser-like `input`, `change`, `blur`, and submit events where appropriate.

Errors:

- `file_not_found`
- `unsupported_element`
- `element_not_enabled`
- `option_not_found`
- `form_not_found`

Completion criteria:

- Users can automate common form submission flows without custom JS.
- File upload validates paths before run or fails with clear guidance.
- Custom select support starts narrow and tested, not as an unreliable universal solver.

## Phase 3: Browser Navigation And Context

Purpose: make workflows behave like a real browser user moving through pages, tabs, frames, popups, and downloads.

Actions:

| Action | Purpose |
|---|---|
| `go_back` | Browser back. |
| `go_forward` | Browser forward. |
| `reload` | Reload current page. |
| `open_new_tab` | Open a URL or blank page in a new tab. |
| `switch_tab` | Switch by index, title contains, or URL contains. |
| `close_tab` | Close current or matched tab. |
| `switch_frame` | Set active iframe context for later element actions. |
| `accept_dialog` | Accept alert/confirm/prompt dialogs. |
| `dismiss_dialog` | Dismiss alert/confirm/prompt dialogs. |
| `wait_for_download` | Wait for a triggered download and capture its path. |
| `set_download_directory` | Choose where downloads for the run should be saved. |

Notes:

- The current `iframe_xpath` field is acceptable for compatibility, but repeated iframe fields will become noisy. `switch_frame` or a shared frame context should reduce repetition.
- Tab and dialog support likely requires the runner to manage browser session state beyond a single page reference.
- Download handling needs a configured download directory and output metadata.

Completion criteria:

- Multi-tab workflows are possible.
- Iframe-heavy workflows do not require repeating iframe XPath on every step.
- Dialog and download cases fail predictably instead of hanging.

## Phase 4: Data Capture And Outputs

Purpose: let workflows produce useful results, not only click through pages.

Actions:

| Action | Purpose |
|---|---|
| `extract_text` | Capture visible or textContent text from an element. |
| `extract_attribute` | Capture attributes such as `href`, `src`, or `data-*`. |
| `extract_input_value` | Capture current value from inputs, textareas, and editable fields. |
| `extract_table` | Capture HTML table rows and cells. |
| `extract_list` | Capture repeated elements into a list. |
| `take_screenshot` | Save a screenshot of the page or element. |
| `save_page_pdf` | Save current page as PDF when Chromium supports it. |

Required foundation:

- Output store keyed by user-defined names.
- Step result model in run state or run history.
- UI display for captured values.
- Export format for CSV/JSON where appropriate.

Completion criteria:

- Extract actions can save named outputs and later phases can reference them.
- Screenshots and PDFs have deterministic file paths.
- Failed extraction reports whether the selector, attribute, or output name was invalid.

## Phase 5: Variables, Conditions, Loops, And Assertions

Purpose: move from linear macros to real workflow logic.

Actions:

| Action | Purpose |
|---|---|
| `set_variable` | Define a variable manually or from an expression. |
| `assert_element` | Fail if an element state is not true. |
| `assert_text` | Fail if expected text is missing or mismatched. |
| `if_condition` | Branch based on URL, text, element state, or variable value. |
| `repeat_times` | Repeat a block a fixed number of times. |
| `repeat_for_each` | Iterate over a list or input rows. |
| `retry_block` | Retry a block with delay and max attempts. |
| `stop_workflow` | Stop with success or failure reason. |

Syntax:

- Variables should use a simple template form such as `{{name}}`.
- Early expressions should be intentionally limited: equality, contains, exists, numeric comparison, and boolean checks.
- Secrets should not be plain variables; they belong to a later secrets store.

Completion criteria:

- Users can automate flows where content changes between runs.
- Tests cover variable interpolation in user action configs.
- Control flow appears in the builder without making normal step editing confusing.

## Phase 6: Session, Profile, Identity, And Secrets

Purpose: support sites that need login state or multiple accounts.

Capabilities and actions:

| Item | Type | Purpose |
|---|---|---|
| Persistent browser profile | Runtime capability | Reuse cookies, localStorage, and login state. |
| `save_session` | Action or profile command | Save current storage state. |
| `load_session` | Action or profile command | Load a known storage state. |
| `set_cookie` | Advanced action | Set a cookie for current domain. |
| `clear_cookies` | Advanced action | Clear cookies by domain or all. |
| Secrets vault | Runtime capability | Store passwords, tokens, and sensitive values. |
| Account profiles | Runtime capability | Run the same workflow as different identities. |

Notes:

- Profile isolation is critical. One workflow should not accidentally use another account's session.
- Secrets must not be shown in plain text in step summaries, logs, or exported workflow files.

Completion criteria:

- Users can run login-required workflows without logging in every time.
- Profile/session behavior is explicit in the UI.
- Sensitive values are redacted in logs and summaries.

## Phase 7: Network, Proxy, Geo, And Device Controls

Purpose: support region-specific sites, proxy-required environments, and device-specific behavior.

Runtime capabilities:

| Capability | Purpose |
|---|---|
| Proxy per run/profile | Route browser traffic through HTTP/SOCKS proxy. |
| Proxy authentication | Support username/password proxies. |
| User agent override | Test or run as a specific browser/device. |
| Viewport/device emulation | Mobile, tablet, desktop sizes and touch mode. |
| Locale/timezone | Match region-specific content. |
| Geolocation | Provide browser geolocation with user consent. |
| Extra headers | Add headers for controlled environments. |
| Network throttling | Simulate slow network or debug timing. |

Actions:

| Action | Purpose |
|---|---|
| `set_viewport` | Change viewport mid-run when needed. |
| `set_geolocation` | Change browser geolocation mid-run. |
| `set_extra_headers` | Advanced action for controlled environments. |
| `grant_permission` | Grant browser permissions such as geolocation, notifications, camera, or microphone for controlled tests. |

Notes:

- Proxy should primarily be a profile/run setting, not a normal step.
- Device, timezone, and locale should be configured before browser launch where possible.
- Header manipulation and network controls should be advanced, because they can change site behavior in hard-to-debug ways.
- Permission grants should be visible and scoped. They should not silently grant sensitive permissions across unrelated profiles.

Completion criteria:

- A user can choose a proxy/profile before running a workflow.
- Proxy failures surface as connection/auth errors, not generic browser launch failures.
- Device emulation is testable and visible in run metadata.

## Phase 8: CAPTCHA And Human Verification

Purpose: handle human verification honestly and predictably.

Policy:

- The app should not promise CAPTCHA bypass.
- The default behavior should be detection, pause, user solve, then resume.
- Optional solver integration can be added only as user-configured provider support, with clear user responsibility and site policy warnings.

Actions and capabilities:

| Item | Type | Purpose |
|---|---|---|
| `detect_challenge` | Action | Detect common CAPTCHA or challenge UI patterns. |
| `pause_for_human` | Action | Pause and let the user solve something in the visible browser. |
| `resume_when_condition` | Action | Resume after URL, element, or text condition is met. |
| CAPTCHA policy | Runtime capability | Decide detect-only, pause, or provider-assisted mode. |
| Solver provider settings | Runtime capability | User-supplied provider key and mode, disabled by default. |

Completion criteria:

- Workflows do not silently fail or hang when a challenge appears.
- Manual solve is supported in headed browser mode.
- The app logs that a human verification pause occurred.

## Phase 9: Reliability, Recovery, And Observability

Purpose: make workflows debuggable and resilient.

Actions and capabilities:

| Item | Type | Purpose |
|---|---|---|
| `retry_step` | Control action/capability | Retry a flaky step. |
| `fallback_selector` | Config capability | Try alternate XPath/selectors. |
| `checkpoint` | Action | Mark progress and capture state. |
| Screenshot on failure | Runtime capability | Capture failure context. |
| Video recording | Runtime capability | Record a run for debugging. |
| Trace export | Runtime capability | Save timing, screenshots, console, and network events. |
| Console log capture | Runtime capability | Include page console errors in diagnostics. |

Completion criteria:

- Failed runs provide enough evidence to fix selectors and timing.
- Retry behavior is explicit, bounded, and visible.
- Diagnostics do not expose secrets.

## Phase 10: Orchestration, Batch Runs, And Integrations

Purpose: support repeated and team-scale automation.

Capabilities:

| Capability | Purpose |
|---|---|
| Scheduler | Run workflows at a time or interval. |
| Queue | Run jobs sequentially with status. |
| Batch input CSV/JSON | Run the same workflow over multiple input rows. |
| Import/export workflow | Share or back up workflows. |
| Notifications | Send completion/failure events. |
| Webhooks | Trigger external systems. |
| Headless mode | Run without visible browser when workflows are stable. |
| Concurrency limits | Prevent resource exhaustion. |

Completion criteria:

- Users can run repeat jobs without manually pressing Run.
- Batch runs produce per-row results.
- Headless mode remains optional and debuggable via traces/screenshots.

## Phase 11: Advanced Runtime And Developer Escape Hatches

Purpose: support difficult workflows that cannot be modeled cleanly as no-code user actions.

Actions and capabilities:

| Item | Type | Purpose |
|---|---|---|
| `execute_js` | Advanced action | Run user-provided JavaScript in the page. |
| `wait_for_request` | Advanced action | Wait until a matching network request occurs. |
| `wait_for_response` | Advanced action | Wait until a matching network response occurs. |
| `block_request` | Advanced capability | Block images, fonts, analytics, or specific URL patterns. |
| `mock_response` | Advanced capability | Return a controlled response for a URL pattern. |
| `set_local_storage` | Advanced action | Set localStorage values for current origin. |
| `set_session_storage` | Advanced action | Set sessionStorage values for current origin. |
| Browser console command | Advanced capability | Run/debug commands during a paused workflow. |

Notes:

- `execute_js` should be clearly marked as advanced. It can break the no-code abstraction and can make workflows harder to support.
- Network wait and mocking need stable matching rules: URL contains, regex, method, status, and resource type.
- Storage actions overlap with session/profile. They should be added only after session behavior is understood.

Completion criteria:

- Advanced users can solve edge cases without weakening the simple builder.
- JavaScript and network actions are isolated in an Advanced group.
- Errors include script exceptions, timeout, invalid matcher, and permission issues.

## Phase 12: Builder Assist, Recorder, And Element Discovery

Purpose: reduce the need for users to manually find XPath and configure every step by hand.

Capabilities:

| Capability | Purpose |
|---|---|
| Element picker | Click an element in the live browser and generate a selector. |
| Selector suggestions | Offer XPath/CSS/test-id candidates ranked by stability. |
| Recorder | Record user actions into draft workflow steps. |
| Step cleanup | Normalize recorded actions into higher-level actions. |
| Dry-run validation | Check selectors and configs before a full run. |
| Fixture generator | Save a small local test page or captured structure for debugging. |

Notes:

- Recorder output should be treated as a draft, not as perfect automation.
- Selector generation should prefer stable attributes over absolute DOM paths.
- This phase improves workflow creation but should not replace strong action semantics.

Completion criteria:

- A user can create a draft workflow without manually copying every XPath.
- Generated selectors are explainable and editable.
- Recorder output maps to the action taxonomy instead of raw low-level events.

## Action Picker Model

The long-term picker should be grouped as:

- Core: Navigate, Click, Input Text, Clear Input, Scroll, Wait.
- Mouse: Hover, Double Click, Right Click, Drag and Drop.
- Keyboard: Press Key, Hotkey, Type Sequence, Focus, Blur, Clipboard.
- Forms: Select Option, Select Custom Option, Check, Uncheck, Toggle Checkbox, Select Radio, Upload File, Submit Form, Set Rich Text.
- Browser: Back, Forward, Reload, Open Tab, Switch Tab, Close Tab, Switch Frame, Dialog, Download.
- Data: Extract Text, Extract Attribute, Extract Input Value, Extract Table, Extract List, Screenshot, PDF.
- Logic: Variable, Assert, If, Repeat, Retry, Stop.
- Advanced: Cookies, Session, Viewport, Geolocation, Headers, Permissions, Human Verification, Network Waits, Execute JS.

The default view should show Core, Mouse, Keyboard, and Forms first. Advanced groups should be collapsed or searchable.

## Compatibility Strategy

Existing actions remain valid:

| Existing action | Roadmap treatment |
|---|---|
| `open_url` | Legacy alias for `navigate`. |
| `sleep` | Legacy alias for `wait.duration`. |
| `type_text` | Legacy alias for `input_text` with clear-before-input behavior. |
| `set_checkbox` | Compatibility action; new UI should prefer `check`, `uncheck`, `toggle_checkbox`. |

Migration sequence:

1. Keep reading and running existing saved workflows.
2. Add UI labels and picker groups for new phases.
3. Add new action configs and runner support behind tests.
4. Save newly created steps using new action names.
5. Migrate old rows only after compatibility is proven.

## Error Handling

Errors should stay user-facing and stable. Recommended error codes:

| Code | Meaning |
|---|---|
| `invalid_config` | Required config is missing or invalid. |
| `element_not_found` | Selector did not match an element. |
| `frame_not_found` | Iframe context was not found. |
| `element_not_visible` | Element exists but is not visible. |
| `element_not_enabled` | Element is disabled. |
| `element_not_actionable` | Element is covered or cannot receive the action. |
| `unsupported_element` | Action does not apply to the matched element. |
| `timeout` | Wait or action exceeded timeout. |
| `navigation_failed` | Browser navigation failed. |
| `option_not_found` | Select or custom select option was not found. |
| `file_not_found` | Upload file path does not exist. |
| `profile_not_found` | Requested browser profile/session is missing. |
| `proxy_connection_failed` | Proxy could not connect. |
| `proxy_auth_failed` | Proxy credentials were rejected. |
| `captcha_detected` | Human verification was detected and policy requires pause/fail. |
| `download_failed` | Download did not complete or path was unavailable. |

## Testing Strategy

Every implementation phase should follow the repository TDD requirement.

Test layers:

- Domain validation for config shape and invalid fields.
- TypeScript/Rust serialization compatibility.
- UI form rendering and action picker grouping.
- Runner execution against browser fixtures.
- Run-state and error reporting for failures.

Phase-specific tests:

- Phase 1: mouse, keyboard, checkbox, radio, focus/blur behavior.
- Phase 2: upload file, submit form, native select, custom select fixtures.
- Phase 3: tab switching, frame context, dialogs, downloads.
- Phase 4: extracted outputs, screenshots, tables, missing attributes.
- Phase 5: variable interpolation, condition branching, loops, retries.
- Phase 6: profile isolation, session reuse, secret redaction.
- Phase 7: proxy config validation, viewport/device metadata, launch errors.
- Phase 8: challenge detection, pause/resume, timeout.
- Phase 9: retry bounds, failure screenshot, trace/log redaction.
- Phase 10: scheduler, queue, batch result accounting.
- Phase 11: JavaScript execution, network request/response waits, storage actions.
- Phase 12: element picker, selector generation, recorder normalization.

## Recommended Implementation Order

The product should implement phases in this order:

1. Phase 1: Human Interaction Core.
2. Phase 2: Form And File Workflows.
3. Phase 4 foundation: output store, then basic extraction and screenshots.
4. Phase 3: Browser Navigation And Context.
5. Phase 5: Variables, Conditions, Loops, And Assertions.
6. Phase 6: Session, Profile, Identity, And Secrets.
7. Phase 7: Network, Proxy, Geo, And Device Controls.
8. Phase 8: CAPTCHA And Human Verification.
9. Phase 9: Reliability, Recovery, And Observability.
10. Phase 10: Orchestration, Batch Runs, And Integrations.
11. Phase 11: Advanced Runtime And Developer Escape Hatches.
12. Phase 12: Builder Assist, Recorder, And Element Discovery.

Phase 4 output foundation is intentionally pulled before the full browser context phase because variables and later workflow logic need named outputs.

## First Implementation Slice

The next implementable slice should be Phase 1 only:

- Add action configs for `double_click`, `right_click`, `focus_element`, `blur_element`, `type_sequence`, `set_clipboard`, `paste_clipboard`, `check`, `uncheck`, `toggle_checkbox`, and `select_radio`.
- Keep `set_checkbox` for compatibility.
- Reuse existing element-target fields and runner helpers.
- Add focused tests before implementation.
- Defer `drag_and_drop` to a second Phase 1 slice because it needs source/target targeting and more browser fixture coverage.
- Do not include proxy, CAPTCHA, variables, tabs, extraction, recorder, or advanced JavaScript/network actions in the first slice.

This keeps the first implementation valuable and bounded.

## Deferred Phase-Specific Decisions

- Whether selectors should remain XPath-only or introduce CSS/test-id selectors.
- Whether output variables are stored only during a run or persisted in run history.
- Whether profile/session is workflow-level, workspace-level, or run-level.
- Whether solver-provider CAPTCHA integration should exist at all.
- Whether headless mode is allowed before trace/screenshot diagnostics are stable.
- Whether recorder should be implemented before or after variables depends on how much draft workflow editing the UI supports.

These decisions should be made in the relevant phase specs, not in the roadmap.
