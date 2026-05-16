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
`src/lib/actionCapabilities.ts`; graph-internal actions remain serializable for
compiler/runner orchestration but are not promoted as ordinary in-run choices.

- Navigation: page navigation, browser history, and tab movement.
- Element Interaction: click, hover, drag/drop, focus/blur, and scroll.
- Form Fields: fill, clear, select, checkbox/radio, upload, submit, custom dropdown, and rich text.
- Keyboard: key presses, hotkeys, character-by-character typing, clipboard, and paste.
- Wait: fixed duration/condition waits and random duration waits.
- Capture Data: text/attribute/field/table/list extraction, screenshots, and downloads that create outputs.
- Browser Context: dialogs, downloads, runtime viewport size, geolocation, permissions, and other runtime-safe browser context actions. Device scale factor, mobile mode, and touch capability are launch-time Browser Launch identity settings, not in-run Set Viewport behavior.
- Variables & Checks: set variables, set JSON variables, assert element, assert text.
- Session & Storage: cookies, clear cookies, localStorage, and sessionStorage. Profile, proxy, user-agent, session, and secret controls belong in Workflow Settings Browser Launch or app-level secret storage, not in-run action nodes.
- Network: request headers, request/response waits, request blocking, and response mocking. Proxy selection belongs in Workflow Settings before launch.
- Advanced: JavaScript escape hatch.

## Capability Classes

Every serialized `ActionType` has an explicit capability classification:

- `implemented`: visible and expected to execute its advertised behavior.
- `implemented_partial_requires_validation`: visible only when backend validation can reject unsupported or incomplete field combinations before run.
- `graph_internal`: compiler/runner orchestration action generated from graph-native nodes, hidden from the main Add Action authoring palette.

Graph-internal action types are not visible in the main action picker. This includes:

- `if_condition`
- `graph_noop`
- `router_condition`
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
- `domain_allowlist`

Intent-focused UI labels preserve serialized action types. Examples: `input_text` displays as Fill Field, `clear_input` as Clear Field, `type_sequence` as Type Keys, `paste_clipboard` as Paste Into Field, `extract_input_value` as Extract Field Value, and `execute_js` as Run JavaScript. Visible browser action defaults are target-first and omit engine-level timing, typing, retry, positioning, and clear-method fields. Scroll is the exception that exposes Page pixel distance and element-targeted scroll modes because those are the action's core contract. The visible structured target editor defaults its locator kind to XPath while allowing more stable locator kinds when available.

Removed actions: `open_url`, `sleep`, and `type_text` are not part of the current authoring contract.

## Change Rule

When adding or changing an action, keep these in sync:

- TypeScript `ActionType` and `ActionConfig`.
- UI label, group, summary, and form behavior.
- Default config.
- Capability registry classification.
- Backend validation.
- Runner execution or explicit unsupported error.
- Persistence JSON contract.
- Command and domain tests.
- Smoke checklist when user-visible behavior changes.

Do not infer current actions from `docs/superpowers`; verify code.
