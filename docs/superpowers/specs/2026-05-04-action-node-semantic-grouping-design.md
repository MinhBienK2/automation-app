# Action Node Semantic Grouping Design

## Status

Approved by the user on 2026-05-04.

This spec redesigns the user-facing `Add Action` taxonomy. The picker should no
longer use a broad `Core` group. Each action should belong to the semantic group
that best describes what the action does.

## Problem

The current action picker groups actions by a mix of priority, implementation
area, and product phase:

- Core
- Forms
- Keyboard
- Pointer & Scroll
- Data
- Browser
- Logic
- Session
- Network
- Human Verification
- Reliability
- Advanced

This creates several UX problems:

- `Core` mixes unrelated concepts such as navigation, filling fields, clearing
  fields, and waiting.
- Common actions such as `Click` and `Scroll` are not in `Core`, even though
  users expect them early.
- Checkbox behavior has overlapping actions: `set_checkbox`, `check`,
  `uncheck`, and `toggle_checkbox`.
- Some labels are technical (`Input Text`, `Set Contenteditable`,
  `Paste Clipboard`, `Execute JS`) instead of intent-focused.
- Logic and recovery action configs overlap with graph-native logic nodes.
- Advanced and sensitive actions are too visible for normal authoring.

## Goals

- Group action nodes by what they do, not by how common they are.
- Remove `Core` as a primary action group.
- Keep a single canonical group for each action in the main taxonomy.
- Use user-facing labels that match user intent while preserving serialized
  `ActionType` values.
- Hide duplicate or advanced actions from the main picker where they compete with
  clearer graph-native nodes or simpler actions.
- Preserve compatibility for saved workflows and existing action configs.

## Non-Goals

- Do not delete action types from TypeScript or Rust in this change.
- Do not migrate saved workflow JSON.
- Do not change runner behavior.
- Do not add analytics, favorites, or command palette behavior.
- Do not duplicate the same action inside multiple primary groups.

## Approved Direction

The action picker should use semantic groups. There should be no `Core` primary
group.

The picker may later add a separate quick-access feature, but this design does
not include one. If quick access is added later, it must be modeled as a filter
or shortcut list, not as duplicate action definitions.

## User-Facing Labels

The serialized action type remains unchanged. Only user-facing labels and
descriptions should change.

Recommended label changes:

| Action type | Current label | New user-facing label |
|---|---|---|
| `input_text` | Input Text | Fill Field |
| `clear_input` | Clear Input | Clear Field |
| `set_contenteditable` | Set Contenteditable | Fill Rich Text |
| `type_sequence` | Type Sequence | Type Keys |
| `paste_clipboard` | Paste Clipboard | Paste Into Field |
| `extract_input_value` | Extract Input Value | Extract Field Value |
| `set_download_directory` | Set Download Directory | Choose Download Folder |
| `set_extra_headers` | Set Extra Headers | Set Request Headers |
| `use_proxy` | Use Proxy | Set Proxy |
| `execute_js` | Execute JS | Run JavaScript |

Descriptions should explain when to use each action. For example:

- `Fill Field`: enter text into an input, textarea, or normal form field.
- `Type Keys`: type character by character when the site needs real keyboard
  events.
- `Paste Into Field`: paste clipboard text into a field.
- `Fill Rich Text`: fill a contenteditable or rich text editor.
- `Extract Field Value`: read the current value from an input field.

## Main Action Groups

### Navigation

Actions:

- `navigate`
- `go_back`
- `go_forward`
- `reload`
- `open_new_tab`
- `switch_tab`
- `close_tab`

Use for moving between pages, tabs, and browser history.

### Element Interaction

Actions:

- `click`
- `double_click`
- `right_click`
- `hover`
- `drag_and_drop`
- `focus_element`
- `blur_element`
- `scroll`

Use for direct interaction with elements or moving the page/container so an
element can be reached. `Scroll` belongs here because it moves the page,
container, or element into view as part of interacting with the UI.

### Form Fields

Actions:

- `input_text`
- `clear_input`
- `select_option`
- `select_custom_option`
- `check`
- `uncheck`
- `toggle_checkbox`
- `select_radio`
- `upload_file`
- `submit_form`
- `set_contenteditable`

Use for filling, clearing, selecting, submitting, and editing form-like controls.

`set_checkbox` should be hidden from the main picker because `Check`, `Uncheck`,
and `Toggle Checkbox` are clearer user-facing actions. Existing configs using
`set_checkbox` remain compatible.

### Keyboard

Actions:

- `press_key`
- `hotkey`
- `type_sequence`
- `set_clipboard`
- `paste_clipboard`

Use for keyboard-specific behavior. `Focus Element` and `Blur Element` are kept
in `Element Interaction` because they target a page element rather than sending a
keyboard command.

### Wait

Actions:

- `wait`

Use for waiting on time, page state, element state, text, URL, or page load. Keep
this as its own group because waiting is a distinct workflow action and has many
condition modes inside one config.

### Capture Data

Actions:

- `extract_text`
- `extract_attribute`
- `extract_input_value`
- `extract_table`
- `extract_list`
- `take_screenshot`
- `wait_for_download`

Use for producing named outputs, files, or evidence from the browser. `Wait For
Download` belongs here because its result is a downloaded file path output.

### Browser Context

Actions:

- `switch_frame`
- `accept_dialog`
- `dismiss_dialog`
- `set_download_directory`
- `set_viewport`
- `set_geolocation`
- `grant_permission`
- `set_user_agent`

Use for browser-level context, permissions, dialogs, frames, viewport, device
identity, and download behavior.

### Variables & Checks

Actions:

- `set_variable`
- `assert_element`
- `assert_text`

Use for storing simple named values and verifying UI state.

Do not include graph-internal logic configs in this group. The following should
remain hidden from `Add Action` because graph-native nodes are the user-facing
authoring surface:

- `if_condition`
- `repeat_times`
- `repeat_for_each`
- `retry_block`
- `stop_workflow`

### Session & Storage

Actions:

- `use_profile`
- `save_session`
- `load_session`
- `set_cookie`
- `clear_cookies`
- `set_secret`
- `set_local_storage`
- `set_session_storage`

Use for browser profile, session state, cookies, secrets, and browser storage.
These are advanced but semantically belong together.

### Network

Actions:

- `use_proxy`
- `set_extra_headers`
- `wait_for_request`
- `wait_for_response`
- `block_request`
- `mock_response`

Use for request routing, headers, waiting on network events, blocking requests,
and mocked responses.

### Reliability

Actions:

- `fallback_selector`
- `retry_step`
- `checkpoint`

Use for advanced recovery and debugging. These should be hidden from the main
picker by default because graph-native `Retry` is clearer for normal retry
logic. Existing configs remain compatible.

### Human Checkpoint

Actions:

- `detect_challenge`
- `pause_for_human`
- `resume_when_condition`

Use for detecting manual checkpoints and pausing for authorized human action.
This group should be hidden from the main picker by default unless the product
adds a clearly framed advanced checkpoint surface. It must not be described as
challenge bypass or anti-detection.

### Advanced

Actions:

- `execute_js`

Use as an escape hatch when no normal action can express the required behavior.
This should stay advanced and should not be promoted as a default no-code path.

## Hidden From Main Picker

The following action types should remain supported but hidden from the main
action picker:

- `set_checkbox`
- `if_condition`
- `repeat_times`
- `repeat_for_each`
- `retry_block`
- `stop_workflow`
- `fallback_selector`
- `retry_step`
- `checkpoint`
- `detect_challenge`
- `pause_for_human`
- `resume_when_condition`

Reasons:

- `set_checkbox` duplicates clearer checkbox actions.
- Graph-internal logic configs should be represented by graph-native nodes.
- Reliability actions are advanced and overlap with graph `Retry`.
- Human checkpoint actions need stronger product framing before main exposure.

Hidden action types must still render, edit, save, validate, and run when loaded
from existing workflows.

## Picker Behavior

- Category list should show semantic groups only.
- Search should continue to find visible action labels and descriptions.
- Search should not show hidden actions unless an explicit advanced toggle or
  compatibility mode is later added.
- Action type dropdown in the inspector should use the same semantic groups and
  label mapping as the main `Add Action` palette.
- Existing action nodes with hidden action types should still display their
  current label and inspector fields.

## Compatibility

The UI changes must not change serialized action config shapes.

Examples:

- User-facing `Fill Field` still saves `type: "input_text"`.
- User-facing `Clear Field` still saves `type: "clear_input"`.
- User-facing `Run JavaScript` still saves `type: "execute_js"`.
- Existing saved `set_checkbox` actions still load and execute.

Rust enum variants, serde names, validation, runner dispatch, and persistence
remain unchanged.

## Documentation Updates During Implementation

When implementation changes are made, update:

- `docs/domain/action-taxonomy.md` with the semantic action groups.
- `docs/domain/workflow-lifecycle.md` if graph action picker behavior changes.
- `docs/domain/user-visible-invariants.md` for visible action picker behavior.
- `docs/architecture/frontend.md` for palette ownership.
- `docs/contracts/action-configs.md` if hidden/main-picker action visibility is
  documented there.
- `README.md` smoke checklist for the updated action picker.

Docs should explain that group membership is semantic and that hidden actions
remain compatible for existing workflows.

## Testing

Implementation should add or update focused frontend tests:

- `Add Action` no longer renders a `Core` category.
- Categories render semantic labels such as `Navigation`, `Element Interaction`,
  `Form Fields`, `Wait`, `Capture Data`, `Browser Context`,
  `Variables & Checks`, `Session & Storage`, `Network`, and `Advanced` where
  visible.
- `Fill Field` is shown for `input_text` while saved configs still use
  `input_text`.
- `Clear Field`, `Fill Rich Text`, `Type Keys`, `Paste Into Field`,
  `Extract Field Value`, `Choose Download Folder`, `Set Request Headers`,
  `Set Proxy`, and `Run JavaScript` labels appear where relevant.
- Hidden actions do not appear in the main action picker.
- Existing action nodes with hidden action types still render inspector fields.
- Search returns visible semantic labels without duplicate results.

Required checks during implementation:

- Focused Vitest tests for action picker and action type dropdown.
- `npx tsc --noEmit` if TypeScript props or types change.
- `npm test -- src/AppCss.test.ts` if styling invariants change.

## Acceptance Criteria

- The action picker has no `Core` primary group.
- Each visible action belongs to the semantic group that best describes what it
  does.
- User-facing labels use intent-focused names while serialized action types stay
  unchanged.
- Duplicate or advanced action types are hidden from the main picker without
  breaking existing workflows.
- Search and inspector action type selection use the same taxonomy.
- No Rust runner or persistence changes are required.

## Self-Review

- No placeholders remain.
- The spec avoids duplicate primary group membership.
- The design preserves current action config contracts.
- The scope is independent from graph logic and toolbar simplification specs.
