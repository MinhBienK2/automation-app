# Action Taxonomy

## Source Files

- TypeScript union: `src/types/workflow.ts`
- UI labels/groups: `src/lib/workflowUi.ts`
- Rust enum/config: `src-tauri/src/domain/action_config.rs`
- Defaults: `src-tauri/src/services/run_service.rs`
- Runner dispatch: `src-tauri/src/runner/actions/mod.rs`

## UI Groups

Current visible action groups are semantic and defined in `src/lib/workflowUi.ts`:

- Navigation: page navigation, browser history, and tab movement.
- Element Interaction: click, hover, drag/drop, focus/blur, and scroll.
- Form Fields: fill, clear, select, checkbox/radio, upload, submit, custom dropdown, and rich text.
- Keyboard: key presses, hotkeys, character-by-character typing, clipboard, and paste.
- Wait: wait conditions.
- Capture Data: text/attribute/field/table/list extraction, screenshots, and downloads that create outputs.
- Browser Context: frames, dialogs, download folder, viewport, geolocation, permissions, and user agent.
- Variables & Checks: set variable, assert element, assert text.
- Session & Storage: profiles, sessions, cookies, secrets, localStorage, and sessionStorage.
- Network: proxy, request headers, request/response waits, request blocking, and response mocking.
- Advanced: JavaScript escape hatch.

Hidden compatibility action types remain supported in saved workflows but are not visible in the main action picker:

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

Intent-focused UI labels preserve serialized action types. Examples: `input_text` displays as Fill Field, `clear_input` as Clear Field, `type_sequence` as Type Keys, `paste_clipboard` as Paste Into Field, `extract_input_value` as Extract Field Value, and `execute_js` as Run JavaScript.

Removed legacy actions: `open_url`, `sleep`, and `type_text` are migrated or normalized to `navigate`, duration `wait`, and `input_text`.

## Change Rule

When adding or changing an action, keep these in sync:

- TypeScript `ActionType` and `ActionConfig`.
- Rust `ActionType` and `ActionConfig`.
- UI label, group, summary, and form behavior.
- Default config.
- Validation.
- Runner execution.
- Persistence JSON compatibility.
- Command and domain tests.
- Smoke checklist when user-visible behavior changes.

Do not infer current actions from `docs/superpowers`; verify code.
