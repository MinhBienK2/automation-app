# Action Taxonomy

## Source Files

- TypeScript union: `src/types/workflow.ts`
- Capability registry: `src/lib/actionCapabilities.ts`
- UI labels/groups: `src/lib/workflowUi.ts`
- Graph compiler/defaults: `electron/backend/graphCompiler.ts`
- Runner dispatch: `electron/backend/runner.ts`
- Command validation/orchestration: `electron/backend/commands.ts`

## UI Groups

Current action groups are semantic and defined in `src/lib/workflowUi.ts`.
The primary Add Action palette is filtered by the capability registry in
`src/lib/actionCapabilities.ts`; compatibility, launch-time, and planned actions
remain serializable but are not promoted as ordinary in-run choices.

- Navigation: page navigation, browser history, and tab movement.
- Element Interaction: click, hover, drag/drop, focus/blur, and scroll.
- Form Fields: fill, clear, select, checkbox/radio, upload, submit, custom dropdown, and rich text.
- Keyboard: key presses, hotkeys, character-by-character typing, clipboard, and paste.
- Wait: fixed duration/condition waits and random duration waits.
- Capture Data: text/attribute/field/table/list extraction, screenshots, and downloads that create outputs.
- Browser Context: dialogs, downloads, viewport, geolocation, permissions, and other runtime-safe browser context actions.
- Variables & Checks: set variables, set JSON variables, assert element, assert text.
- Session & Storage: cookies, clear cookies, localStorage, and sessionStorage. Profile, proxy, user-agent, session, and secret actions are launch-time or planned compatibility actions.
- Network: request headers, request/response waits, request blocking, and response mocking. Proxy selection belongs in Workflow Settings before launch.
- Advanced: JavaScript escape hatch.

## Capability Classes

Every serialized `ActionType` has an explicit capability classification:

- `implemented`: visible and expected to execute its advertised behavior.
- `implemented_partial_requires_validation`: visible only when backend validation can reject unsupported or incomplete field combinations before run.
- `launch_time_only`: hidden from the primary palette and rejected as an in-run action; configure it in Workflow Settings before browser launch.
- `compatibility_hidden`: loadable from saved workflows and graph compiler output, but hidden from active Add Action authoring.
- `planned_hidden`: retained for DTO compatibility, hidden from active authoring, and rejected at runtime until implemented truthfully.
- `unsupported_visible_error`: reserved for a visible action that must fail explicitly until implemented.

Hidden compatibility action types remain supported in saved workflows but are not visible in the main action picker. This includes graph-internal control configs:

- `if_condition`
- `repeat_times`
- `repeat_for_each`
- `retry_block`
- `switch_condition`
- `while_loop`
- `repeat_until`
- `try_catch`
- `fallback_block`
- `break_loop`
- `continue_loop`
- `stop_workflow`
- `transform_variable`
- `assert_output`
- `run_subworkflow`
- `domain_allowlist`

Additional hidden or compatibility actions include launch-time and planned actions such as:

- `set_checkbox`
- `switch_frame`
- `set_download_directory`
- `use_profile`
- `save_session`
- `load_session`
- `set_secret`
- `use_proxy`
- `set_user_agent`
- `detect_challenge`
- `pause_for_human`
- `fallback_selector`
- `retry_step`
- `checkpoint`
- `resume_when_condition`

Intent-focused UI labels preserve serialized action types. Examples: `input_text` displays as Fill Field, `clear_input` as Clear Field, `type_sequence` as Type Keys, `paste_clipboard` as Paste Into Field, `extract_input_value` as Extract Field Value, and `execute_js` as Run JavaScript. Visible browser action defaults are target-first and omit engine-level timing, typing, retry, positioning, clear-method, and legacy XPath fields. Legacy selector fields are converted into structured targets by graph v2 migration.

Removed legacy actions: `open_url`, `sleep`, and `type_text` are migrated or normalized to `navigate`, duration `wait`, and `input_text`.

## Change Rule

When adding or changing an action, keep these in sync:

- TypeScript `ActionType` and `ActionConfig`.
- UI label, group, summary, and form behavior.
- Default config.
- Capability registry classification.
- Backend validation.
- Runner execution or explicit unsupported error.
- Persistence JSON compatibility.
- Command and domain tests.
- Smoke checklist when user-visible behavior changes.

Do not infer current actions from `docs/superpowers`; verify code.
