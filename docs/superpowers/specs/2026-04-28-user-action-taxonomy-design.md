# User Action Taxonomy Design

Date: 2026-04-28

## Summary

Design a practical action taxonomy for browser automation workflows based on real user behavior. The current action types are treated as legacy primitives, not as the final core model. The new taxonomy groups actions by user intent, keeps common actions easy to find, and leaves advanced browser/runtime capabilities for later phases.

The first implementation should not attempt to ship every action in this document. It should establish the taxonomy, preserve compatibility with existing workflows, and implement the highest-value P0/P1 actions first.

## Goals

- Define action groups that match real browser user behavior.
- Decide which actions should be top-level action types and which should be config modes.
- Map existing action types into the new taxonomy without breaking saved workflows.
- Keep the action picker usable as the number of actions grows.
- Give future implementation clear phases, config shapes, error behavior, and test expectations.

## Non-Goals

- Do not implement the taxonomy in this spec.
- Do not migrate existing database rows immediately.
- Do not add variables, run history, profiles, or session persistence as part of the first phase.
- Do not expose low-level browser or JavaScript operations as primary user actions.

## Design Principles

The taxonomy starts from the question: what is the user trying to do in the browser?

Existing actions such as `open_url`, `sleep`, `type_text`, `click`, and `scroll` are legacy primitives. They may be kept, renamed, split, or absorbed into broader action groups. The taxonomy should not call them core just because they already exist.

Action types should represent user-visible intent. Technical variations should become config where that keeps the UI simpler. For example, `click`, `double_click`, and `right_click` are separate actions because they express different user intent. `wait` conditions are config because the user intent is still waiting for something.

## Priority Groups

### P0: Human Interaction Core

P0 actions are the default actions users reach for when building browser workflows.

| Action | Purpose | Main config |
|---|---|---|
| `navigate` | Open or navigate to a URL. | `url`, `wait_until?`, `timeout_ms?` |
| `click` | Left-click an element. | `xpath`, `iframe_xpath?`, `position?`, `wait_until?`, `timeout_ms?` |
| `input_text` | Enter text into an input-like element. | `xpath`, `text`, `clear_before_input`, `typing_mode`, `delay_ms?` |
| `clear_input` | Clear an input-like element. | `xpath`, `method` |
| `scroll` | Scroll a page, container, or element into view. | `mode`, `direction?`, `pixels?`, `xpath?`, `until_visible?` |
| `wait` | Wait for a real UI/browser condition. | `condition`, `xpath?`, `text?`, `url?`, `duration_ms?`, `timeout_ms?` |

Legacy mapping:

| Legacy type | New taxonomy |
|---|---|
| `open_url` | `navigate` |
| `sleep` | `wait` with `condition = "duration"` |
| `type_text` | `input_text` with `clear_before_input = true` |
| `click` | `click` |
| `scroll` | `scroll` |

`sleep` should remain available for compatibility, but it should not be promoted as the main waiting pattern. Users do not normally "sleep"; they wait for a page, modal, element, text, or button state.

### P1: Form Interaction

Form actions cover common login, checkout, filter, admin, and data-entry workflows.

| Action | Purpose |
|---|---|
| `select_option` | Select an option from a native select or simple combobox. |
| `check` | Ensure a checkbox is checked. |
| `uncheck` | Ensure a checkbox is unchecked. |
| `toggle_checkbox` | Flip a checkbox regardless of current state. |
| `select_radio` | Select a radio option. |
| `upload_file` | Choose a file through a file input. |
| `submit_form` | Submit the nearest form or a specific form by XPath. |

Do not create field-specific action types such as `enter_email`, `enter_password`, or `enter_phone`. Those are data labels, not distinct user behaviors. They should use `input_text`.

### P1: Mouse Interaction

Mouse actions should stay visible as separate actions when they represent different user intent.

| Action | Purpose |
|---|---|
| `double_click` | Open an item, edit a cell, or select a word. |
| `right_click` | Open a context menu. |
| `hover` | Reveal a menu, tooltip, or hidden control. |
| `drag_and_drop` | Reorder items, move content, or drop into a dropzone. |

`mouse_down` and `mouse_up` are not primary actions. They can be added later as advanced actions if a workflow truly needs low-level mouse control.

### P1: Keyboard Interaction

Keyboard actions are important for modern web apps, autocomplete fields, command palettes, menus, and rich text editors.

| Action | Purpose |
|---|---|
| `press_key` | Press one key such as Enter, Escape, Tab, or ArrowDown. |
| `hotkey` | Press a modifier shortcut such as Ctrl+S, Ctrl+A, or Cmd+K. |
| `type_sequence` | Simulate a typed sequence key by key. |
| `focus_element` | Move focus to an element. |
| `blur_element` | Move focus away to trigger validation or change handlers. |

`input_text` remains the main action for filling normal fields. `type_sequence` is for controls that depend on real key events.

### P1: Wait And Observe

`wait` should be a single action with conditions, not many separate top-level action types.

| Condition | Meaning |
|---|---|
| `duration` | Wait for a fixed duration. |
| `element_visible` | Wait until an element is visible. |
| `element_hidden` | Wait until an element is hidden. |
| `element_attached` | Wait until an element exists in the DOM. |
| `element_detached` | Wait until an element is removed from the DOM. |
| `text_visible` | Wait until text appears. |
| `url_contains` | Wait until the URL contains a value. |
| `page_load` | Wait for load, DOMContentLoaded, or network idle. |
| `element_enabled` | Wait until an element is enabled. |
| `element_disabled` | Wait until an element is disabled. |

The UI can expose these as presets while saving them as one `wait` action config.

### P2: Browser Navigation And Context

These are real browser behaviors but should follow after the core interaction model is stable.

| Action | Purpose |
|---|---|
| `go_back` | Browser back. |
| `go_forward` | Browser forward. |
| `reload` | Refresh the current page. |
| `open_new_tab` | Open a new tab. |
| `switch_tab` | Switch tabs by index, title, or URL match. |
| `close_tab` | Close the current tab or a matched tab. |
| `switch_frame` | Set the active iframe context. |

The current `iframe_xpath` pattern is useful for compatibility, but repeated iframe fields become noisy as workflows grow. A later `switch_frame` or shared context model can reduce repeated iframe config.

### P2: Data Capture

These actions are not pure hand actions, but they are common in real automation workflows.

| Action | Purpose |
|---|---|
| `extract_text` | Capture text from an element. |
| `extract_attribute` | Capture attributes such as `href`, `src`, or `data-*`. |
| `extract_input_value` | Capture the current value of an input. |
| `extract_table` | Capture rows and cells from an HTML table. |
| `take_screenshot` | Save a screenshot for debugging or output. |

Data capture needs an output or variable store to be useful, so it belongs after the interaction foundation.

### P3: Advanced Runtime

These actions are powerful but should not be primary workflow-building actions in the near term.

| Action | Reason to defer |
|---|---|
| `set_cookie`, `clear_cookies` | Needs a session model. |
| `save_session`, `load_session` | Needs profile or storage state design. |
| `execute_js` | Powerful but can break the no-code abstraction. |
| `wait_for_request`, `wait_for_response` | Needs a network event model. |
| `set_viewport` | Belongs with browser context configuration. |
| `grant_permission` | Rare and site-dependent. |

## Action Picker Design

The action picker should be grouped by behavior rather than shown as one flat list.

Recommended groups:

- Core: Navigate, Click, Input Text, Clear Input, Scroll, Wait.
- Forms: Select Option, Check, Uncheck, Toggle Checkbox, Select Radio, Upload File, Submit Form.
- Mouse: Double Click, Right Click, Hover, Drag and Drop.
- Keyboard: Press Key, Hotkey, Type Sequence, Focus Element, Blur Element.
- Browser: Back, Forward, Reload, Open Tab, Switch Tab, Close Tab, Switch Frame.
- Data: Extract Text, Extract Attribute, Extract Input Value, Extract Table, Screenshot.
- Advanced: Session, Cookies, Execute JS, Network Waits, Viewport, Permissions.

To avoid overwhelming users, the default picker should show Core and common P1 actions first. Advanced sections can be collapsed or searchable.

## Config Conventions

Element-based actions should share a base config:

```ts
type ElementTargetConfig = {
  xpath: string;
  iframe_xpath?: string | null;
  wait_until?: "attached" | "visible" | "enabled" | "actionable" | null;
  timeout_ms?: number | null;
};
```

Actions such as `click`, `input_text`, `clear_input`, `hover`, `check`, `uncheck`, and `select_option` should reuse this base shape where possible. The runner can share helper code for XPath resolution, iframe resolution, actionability checks, and timeout behavior.

Config details that represent technical variations should stay as fields:

- `wait.condition`
- `scroll.mode`
- `input_text.typing_mode`
- `clear_input.method`
- `click.position`
- `select_option.match_by`

## Runner Architecture

The runner should keep three layers:

1. `ActionConfig`: serializable data shared between Rust and TypeScript.
2. `ActionExecutor`: dispatch by action type.
3. Shared helpers:
   - resolve element by XPath
   - resolve iframe or frame context
   - wait for element state or actionability
   - perform cancellation-aware delays and waits
   - normalize DOM/browser errors into stable command errors

This keeps each new action small. For example, `hover`, `check`, and `select_option` should not each reimplement XPath lookup, iframe handling, and timeout behavior.

## Compatibility And Migration

Use a compatibility adapter before any hard database migration.

The app should continue reading legacy actions. The UI may display legacy actions with new taxonomy labels. When a legacy step is saved, the app can eventually write the new action type after the runner supports it.

Recommended sequence:

1. Read and run legacy actions unchanged.
2. Add taxonomy labels and grouped picker.
3. Add new action configs and executors.
4. Save newly created steps with new action types.
5. Migrate old saved workflows only after compatibility is proven.

This protects existing user workflows while allowing the product model to evolve.

## Error Handling

Action failures should use stable error codes so the UI can show targeted guidance.

```ts
type ActionError = {
  action_type: string;
  reason: string;
  field?: string;
  code?: string;
};
```

Recommended error codes:

| Code | Meaning |
|---|---|
| `invalid_config` | Config is missing or invalid. |
| `element_not_found` | XPath does not match an element. |
| `frame_not_found` | Iframe XPath does not match. |
| `element_not_visible` | Element exists but is not visible. |
| `element_not_enabled` | Element is disabled. |
| `element_not_actionable` | Element is covered or cannot receive the action. |
| `timeout` | A wait or actionability check exceeded the timeout. |
| `navigation_failed` | Navigation failed. |
| `unsupported_element` | The action does not apply to the matched element. |
| `file_not_found` | Upload file path does not exist. |

Error messages should describe what a user can understand in the browser. Prefer "Element is not visible" over low-level DOM predicate details.

## Testing Strategy

Implementation should follow the repository's TDD requirement. Tests should be added before behavior changes.

Test layers:

| Layer | Coverage |
|---|---|
| Domain validation | Valid and invalid config for each action. |
| Serialization | Rust `ActionConfig` remains compatible with TypeScript shapes. |
| UI form | Grouped action picker, field rendering, and saved config. |
| Runner | Actions execute against page fixtures. |

High-priority tests:

- Legacy `sleep` can be interpreted as `wait.duration`.
- Legacy `type_text` maps to `input_text` with `clear_before_input = true`.
- `wait.element_visible` passes and times out correctly.
- `clear_input` clears normal inputs and supported editable elements.
- `select_option` selects by label/value.
- `check` and `uncheck` leave checkbox state as requested.
- `press_key` and `hotkey` trigger real keyboard behavior.
- `hover` can reveal a hidden menu.
- Wrong XPath produces `element_not_found`.
- Wrong element type produces `unsupported_element`.

## First Implementation Phase

The first implementation should focus on foundation and the most practical P0/P1 actions.

Recommended scope:

- Add taxonomy labels and action grouping in the UI.
- Keep legacy actions compatible.
- Add or normalize P0 actions:
  - `navigate`
  - `input_text`
  - `clear_input`
  - `wait`
  - `click`
  - `scroll`
- Add essential P1 actions:
  - `select_option`
  - `check`
  - `uncheck`
  - `press_key`
  - `hotkey`
  - `hover`

Defer upload, extraction, tabs, sessions, cookies, network waits, and arbitrary JavaScript until the interaction foundation is stable.

## Completion Criteria

This design is ready for implementation planning when:

- The action groups and priorities are explicit.
- Legacy actions have a clear compatibility path.
- Each first-phase action has a clear user intent.
- Technical variations are modeled as config instead of unnecessary top-level action types.
- Error codes and timeout behavior are consistent enough for UI guidance.
- The first implementation phase is small enough to test and ship without rewriting the whole runner.
