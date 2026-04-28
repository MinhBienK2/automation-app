# Current Step Type Case Coverage Design

Date: 2026-04-28

## Summary

Audit the 14 workflow step types currently supported by the app and define what "covered" means for each one from a user's browser-automation perspective.

This spec does not add new step types. It focuses on the existing action model:

- `navigate`
- `open_url`
- `sleep`
- `wait`
- `input_text`
- `type_text`
- `clear_input`
- `click`
- `scroll`
- `select_option`
- `set_checkbox`
- `press_key`
- `hotkey`
- `hover`

The goal is to identify the concrete user cases each step type should handle, compare them with the current implementation, and establish acceptance coverage for future implementation work.

## Goals

- Define detailed user-facing cases for each current step type.
- Separate legacy compatibility actions from the preferred taxonomy actions.
- Identify gaps across config schema, UI form fields, runner behavior, validation, error handling, and tests.
- Keep the scope limited to improving the 14 current step types.
- Avoid introducing new action types in this spec.

## Non-Goals

- Do not implement any behavior changes.
- Do not add step types such as `right_click`, `drag_and_drop`, `upload_file`, `focus_element`, or `handle_dialog`.
- Do not migrate saved workflow rows.
- Do not redesign the workflow builder UI.
- Do not introduce variables, extraction outputs, run history, profiles, sessions, cookies, or tab management.

## Coverage Levels

Each step type should be assessed with three levels.

| Level | Meaning |
|---|---|
| Minimum | The action has valid default config, renders editable core fields in the UI, validates required fields, and runs the most common happy path. |
| Robust | The action handles common failure cases, timeout behavior, iframe targeting where relevant, stable user-facing errors, and focused tests. |
| User-faithful | The action behaves like a real browser user interaction rather than a synthetic DOM shortcut when fidelity matters. |

The target for this audit is Robust coverage for all 14 current step types. User-faithful coverage is required for interaction-sensitive actions: `click`, `press_key`, `hotkey`, and `hover`.

## Shared Coverage Requirements

All current step types should satisfy these shared requirements:

- The Rust `ActionConfig` shape remains serializable and compatible with the TypeScript `ActionConfig` union.
- The `WorkflowStep.action_type` matches `WorkflowStep.config.type` after create, save, load, and run.
- Default config exists for every action type.
- Required fields fail validation before a run starts.
- Numeric fields reject invalid zero or negative values where zero is not meaningful.
- The UI form exposes every config field that the product expects users to control.
- Runner behavior uses every config field that is persisted, or the field is intentionally hidden/removed from the user-facing config.
- Element-targeting actions share consistent behavior for XPath lookup, iframe lookup, wait state, timeout, and errors.
- Test Step failure state includes step number, step name, action type, and actionable reason.

## Current Step Type Audit

### `navigate`

User intent: navigate the current browser page to a URL and wait until the page is ready enough for later steps.

Cases to cover:

- Blank URL is rejected.
- URL with leading/trailing whitespace is normalized or rejected consistently.
- URL without protocol has a clear policy: reject or normalize to `https://`.
- HTTP and HTTPS URLs run.
- Redirects are allowed and do not fail solely because the final URL differs.
- Slow navigation respects `timeout_ms`.
- `wait_until = load` waits for normal page load.
- `wait_until = dom_content_loaded` waits only for DOMContentLoaded.
- `wait_until = network_idle` waits for network quiet where supported.
- SPA route changes are considered successful if the browser reaches the requested URL and no navigation error occurs.
- Navigation errors produce a user-facing message such as "Navigation failed" or "Navigation timed out".

Current assessment:

- Minimum coverage exists.
- Config includes `wait_until` and `timeout_ms`.
- The current runner calls page navigation but does not fully apply the `wait_until` and `timeout_ms` semantics.

Acceptance coverage:

- Domain validation tests for blank URL and zero timeout.
- UI tests for editing URL, wait mode, and timeout.
- Runner tests or integration tests for successful navigation, timeout, and at least one wait mode.

### `open_url`

User intent: legacy action for opening a URL.

Cases to cover:

- Existing saved workflows with `open_url` still load, edit, save, and run.
- Blank URL is rejected.
- Basic HTTP and HTTPS URLs run.
- Errors remain understandable to users.

Current assessment:

- Minimum coverage is acceptable for legacy compatibility.
- It should not gain new behavior beyond compatibility.
- New workflows should prefer `navigate`.

Acceptance coverage:

- Serialization compatibility test.
- Repository load/save test for legacy rows.
- Runner happy-path smoke coverage.

### `sleep`

User intent: legacy fixed delay before the next step.

Cases to cover:

- Positive integer seconds.
- Positive decimal seconds.
- Zero and negative values rejected.
- Cancellation stops the sleep promptly.
- Very large values are either allowed with clear UI or bounded by product policy.

Current assessment:

- Robust enough for legacy fixed delay.
- It should remain available for saved workflows and simple waits.
- New workflows should prefer `wait` with `condition = duration`.

Acceptance coverage:

- Domain validation for zero and negative values.
- Runner cancellation test.
- UI test for decimal values.

### `wait`

User intent: wait for a page, URL, text, element state, or fixed duration before continuing.

Cases to cover:

- `duration` waits a positive duration.
- `page_load` waits for a stable document-ready state.
- `url_contains` waits until current URL includes the configured value.
- `text_visible` waits until page text includes the configured text.
- `element_visible` waits until the XPath exists and is visible.
- `element_hidden` succeeds when the element exists but is hidden, and also needs a clear policy for missing elements.
- `element_attached` waits until XPath exists in the DOM.
- `element_detached` waits until XPath is absent from the DOM.
- `element_enabled` waits until target is enabled.
- `element_disabled` waits until target is disabled.
- Timeout produces "Wait timed out" or a more specific reason.
- Cancellation should stop long waits.
- Element conditions should support iframe targeting if the product promises iframe support consistently.

Current assessment:

- Robust coverage is partial.
- Core conditions exist.
- Iframe targeting is missing.
- Cancellation during JavaScript polling is not fully represented as a browser-side cancellation path.

Acceptance coverage:

- Domain validation for required condition-specific fields.
- Tests for every wait condition.
- Timeout tests for element and URL/text waits.
- A clear missing-element policy for `element_hidden` and `element_detached`.

### `input_text`

User intent: enter text into an input-like element.

Cases to cover:

- XPath is required.
- Text is required, with an explicit policy for whether empty string is allowed as "set blank".
- Normal `<input>` works.
- `<textarea>` works.
- `contenteditable` works if supported by product policy.
- Controlled inputs in React/Vue/Svelte receive proper input/change events.
- `clear_before_input = true` replaces existing text.
- `clear_before_input = false` appends or sets according to `typing_mode`, with documented behavior.
- `typing_mode = set_value` sets text quickly and dispatches events.
- `typing_mode = type` simulates character entry with optional delay.
- `delay_ms` is honored when typing.
- Disabled, readonly, hidden, or non-editable targets produce clear errors.
- `iframe_xpath` targets fields inside an iframe.
- `wait_until` and `timeout_ms` wait for the element to become usable.

Current assessment:

- Robust coverage is partial.
- Runner supports many fields.
- UI does not currently expose all user-relevant fields such as `delay_ms`, `wait_until`, and `timeout_ms`.
- Controlled input behavior should be verified with tests rather than assumed.

Acceptance coverage:

- UI tests for all user-controlled fields.
- Runner tests for input, textarea, iframe, clear-before-input, set-value mode, type mode, and timeout.
- Failure tests for wrong XPath and non-editable element.

### `type_text`

User intent: legacy text entry action.

Cases to cover:

- Existing saved workflows load, edit, save, and run.
- XPath is required.
- Text is required.
- Basic input field receives text.

Current assessment:

- Minimum coverage is acceptable for legacy compatibility.
- It should not become the preferred text-entry path.
- New capabilities should be implemented in `input_text`.

Acceptance coverage:

- Serialization compatibility test.
- Basic runner happy-path test.
- UI still renders and saves legacy config.

### `clear_input`

User intent: clear an input-like element before later input or validation steps.

Cases to cover:

- XPath is required.
- Normal input clears.
- Textarea clears.
- Contenteditable clears if supported.
- `method = select_all` behaves as a user-style select-all clear or has documented equivalent behavior.
- `method = backspace` behaves as repeated deletion or has documented equivalent behavior.
- `method = dom` clears through direct value mutation.
- Input/change events fire after clearing.
- Disabled, readonly, hidden, or non-editable targets produce clear errors.
- `iframe_xpath` targets elements inside an iframe.
- `wait_until` and `timeout_ms` wait for the element to become usable.

Current assessment:

- Robust coverage is partial.
- Config contains method, iframe, wait, and timeout fields.
- Runner currently treats clear methods too similarly and does not fully apply wait/timeout semantics.

Acceptance coverage:

- Tests for input, textarea, contenteditable policy, method behavior, iframe, timeout, and non-editable failure.
- UI test for method and optional target fields.

### `click`

User intent: click an element like a real user.

Cases to cover:

- XPath is required.
- Real left click succeeds on a visible enabled target.
- Force DOM click remains available as an escape hatch.
- Single click works.
- Double click works.
- Right and middle click have a clear policy: either unsupported despite schema or implemented through `button`.
- Offscreen elements scroll into view when enabled.
- Covered elements fail with "Element is covered".
- Disabled elements fail with "Element is disabled".
- Hidden elements fail with "Element is not visible".
- `position` clicks center, corners, or offset.
- Offset requires X and Y.
- `iframe_xpath` targets elements inside an iframe.
- `wait_until`, `timeout_ms`, and `retry_interval_ms` wait for actionability.
- `post_click_wait_ms` pauses after a successful click and is cancellation-aware.
- Clicks that trigger navigation do not fail solely because the page changes.

Current assessment:

- Robust coverage is partial.
- Real click actionability is stronger than most other element actions.
- `button` exists in schema but is not honored by the runner.
- Several fields are persisted but not exposed in UI.
- Force DOM mode intentionally bypasses actionability, which should be documented.

Acceptance coverage:

- UI tests for all intended click controls.
- Runner tests for visible click, covered element, disabled element, offset, iframe, double click, post-click wait, and timeout.
- Schema or runner decision for `button`.

### `scroll`

User intent: scroll the page, a container, or an element into view.

Cases to cover:

- Page vertical scroll down and up.
- Page horizontal scroll left and right.
- Container scroll by XPath.
- Scroll target into view by XPath.
- Scroll until target is visible.
- `pixels` must be positive when directional scroll is used.
- `xpath` is required for container, into-view, and until-visible modes.
- `iframe_xpath` targets content in an iframe.
- `behavior = instant` and `smooth` are honored.
- `block` and `inline` are honored for into-view mode.
- `max_attempts` and `wait_ms` are honored for until-visible mode.
- Missing scroll target produces clear errors.
- Non-scrollable container behavior is documented.

Current assessment:

- This is the closest to Robust coverage.
- One schema issue remains: `pixels` is required even when `into_view` does not need it.

Acceptance coverage:

- Tests for page, horizontal, container, into-view, until-visible, iframe, missing XPath, and attempts exhausted.
- UI tests for mode-specific fields.

### `select_option`

User intent: select an option from a native select control.

Cases to cover:

- XPath is required.
- Value is required.
- Match by label.
- Match by value.
- Missing option produces "Option not found".
- XPath matching a non-select element produces "Element is not a select".
- Disabled select or disabled option has a clear policy and error.
- Multiple select has a clear policy: single-select only or supports multiple values.
- `iframe_xpath` targets a select inside an iframe.
- `wait_until` and `timeout_ms` wait for element availability.
- Input/change events fire after selection.

Current assessment:

- Minimum coverage exists for native select.
- Robust coverage is partial.
- Custom comboboxes are out of scope for this current step type unless explicitly redefined later.
- Wait and timeout fields are present but not fully used by the runner.

Acceptance coverage:

- Tests for label match, value match, missing option, non-select target, iframe, disabled policy, and events.
- UI test for match mode, value, iframe, and timeout fields.

### `set_checkbox`

User intent: ensure a native checkbox is checked or unchecked.

Cases to cover:

- XPath is required.
- `state = checked` checks an unchecked box.
- `state = checked` is no-op success for an already checked box.
- `state = unchecked` unchecks a checked box.
- `state = unchecked` is no-op success for an already unchecked box.
- XPath matching a non-checkbox element produces "Element is not a checkbox".
- Disabled checkbox has a clear error.
- Label-wrapped native checkbox is supported if XPath targets the input.
- Custom ARIA checkbox is explicitly unsupported in this step type unless product policy changes.
- `iframe_xpath` targets a checkbox inside an iframe.
- `wait_until` and `timeout_ms` wait for element availability.
- Input/change events fire after changing state.

Current assessment:

- Minimum native checkbox behavior exists.
- Robust coverage is partial.
- Disabled handling and wait/timeout behavior need explicit runner support.

Acceptance coverage:

- Tests for checked, unchecked, no-op states, non-checkbox, disabled checkbox, iframe, and event dispatch.
- UI test for state and optional target fields.

### `press_key`

User intent: press one keyboard key in the currently focused browser context.

Cases to cover:

- Key is required.
- Common keys work: Enter, Escape, Tab, Space, Backspace, Arrow keys.
- The key applies to the active focused element.
- If no element is focused, body/page receives the key.
- Event sequence is realistic enough for apps that depend on keyboard input.
- Browser-level behavior works where expected, such as Tab focus movement.
- Unsupported or malformed key names fail clearly.
- Platform differences are documented if relevant.

Current assessment:

- Minimum coverage exists.
- User-faithful coverage is missing because current behavior dispatches synthetic keyboard events from JavaScript.
- Some browser-native key behaviors may not happen.

Acceptance coverage:

- Tests for Enter/Escape/Tab/Arrow behavior.
- Runner implementation should use real browser keyboard APIs where possible.
- Failure behavior for invalid key names should be defined.

### `hotkey`

User intent: press a modifier shortcut such as Ctrl+S or Cmd+K.

Cases to cover:

- At least one key is required.
- Modifier keys are recognized: Control/Ctrl, Meta/Cmd/Command, Alt, Shift.
- Main key is required when modifiers are present.
- Platform mapping is clear: Ctrl on Windows/Linux, Cmd on macOS, or user-selected explicit key.
- Shortcut applies to the focused element or page.
- Browser-reserved shortcuts have a clear policy.
- Event sequence is realistic enough for web apps with shortcut handlers.
- Invalid key combinations fail clearly.

Current assessment:

- Minimum coverage exists.
- User-faithful coverage is missing because current behavior dispatches synthetic keyboard events.
- Platform-specific shortcut semantics are not explicit.

Acceptance coverage:

- Tests for Ctrl+S, Cmd/Ctrl policy, Shift+key, and invalid empty combinations.
- Runner should use real keyboard APIs where possible.

### `hover`

User intent: move the mouse over an element to reveal UI such as menus, tooltips, and hidden controls.

Cases to cover:

- XPath is required.
- Hover triggers JavaScript mouseover/mouseenter handlers.
- Hover triggers CSS `:hover` behavior.
- Hover target is visible and enabled according to policy.
- Offscreen target scrolls into view if product policy allows it.
- Covered target behavior is defined.
- `iframe_xpath` targets elements inside an iframe.
- `wait_until` and `timeout_ms` wait for element availability.
- Moving away is out of scope for this step type unless later added.

Current assessment:

- Minimum coverage exists.
- User-faithful coverage is partial because current implementation dispatches synthetic mouse events.
- CSS `:hover` behavior may not be activated without real mouse movement.

Acceptance coverage:

- Tests for JS hover handler, CSS hover reveal, iframe target, wrong XPath, and timeout.
- Runner should use real mouse movement where possible.

## Prioritized Gap List

Priority 1: Make persisted config match behavior.

- `navigate.wait_until` and `navigate.timeout_ms` should affect runner behavior.
- Element actions with `wait_until` and `timeout_ms` should use them or stop exposing them.
- `click.button` should either be implemented or removed from the user-facing schema.

Priority 2: Standardize element action behavior.

- Shared XPath resolution.
- Shared iframe resolution.
- Shared visible/enabled/actionable checks.
- Shared timeout and retry behavior.
- Shared stable error reasons.

Priority 3: Improve user-faithful interaction.

- Use real browser mouse behavior for `click` and `hover` where possible.
- Use real browser keyboard behavior for `press_key` and `hotkey` where possible.
- Keep synthetic DOM actions only as explicit fallback modes, such as `click.mode = force_dom`.

Priority 4: Strengthen tests.

- Domain validation for all required fields and numeric constraints.
- Serialization compatibility for legacy actions.
- UI form tests for every user-editable config field.
- Runner tests for happy paths and primary failure paths.

## Testing Strategy

### Domain Validation Tests

Add or keep tests for:

- Required fields for every action.
- Numeric fields that must be greater than zero.
- Condition-specific validation for `wait`.
- Mode-specific validation for `scroll`.
- Offset-specific validation for `click`.
- Legacy action compatibility.

### UI Form Tests

Add or keep tests for:

- Rendering the correct fields for every step type.
- Saving updated config without dropping existing fields.
- Showing mode-specific fields, such as `scroll.mode` and `wait.condition`.
- Editing optional fields that are intended to be user-controlled.

### Runner Tests

Add focused runner tests for:

- Navigate wait and timeout behavior.
- Wait conditions and timeout.
- Input text modes and event dispatch.
- Clear input methods.
- Click actionability, iframe, offset, double click, and timeout.
- Scroll modes.
- Select option by label and value.
- Checkbox checked and unchecked states.
- Real keyboard and mouse behavior for key/hotkey/hover where possible.

## Success Criteria

This audit is complete when:

- Every current step type has an explicit list of user cases.
- Every current step type has a clear current coverage assessment.
- Legacy actions are clearly marked as compatibility actions.
- The highest-risk gaps are prioritized.
- Future implementation can be planned without changing the 14-step-type scope.

