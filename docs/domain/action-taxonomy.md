# Action Taxonomy

## Source Files

- TypeScript union: `src/types/workflow.ts`
- Capability registry: `src/lib/actionCapabilities.ts`
- UI labels/groups: `src/lib/workflowUi.ts`
- Graph compiler/defaults: `electron/backend/graph/compiler.ts`
- Runner dispatch: `electron/backend/runtime/runner.ts`
- Backend action registry: `electron/backend/actions/registry.ts`
- Backend action validation registry: `electron/backend/actions/validation.ts`
- Backend action execution dispatcher: `electron/backend/actions/execution.ts`
- Graph validation: `electron/backend/graph/validateGraph.ts`
- Command validation/orchestration: `electron/backend/commands.ts`

## UI Groups

Current action groups are semantic and defined in `src/lib/workflowUi.ts`.
The primary Add Action palette is filtered by the capability registry in
`src/lib/actionCapabilities.ts`; graph-internal actions remain serializable for
compiler/runner orchestration but are not promoted as ordinary in-run choices.

- Navigation: page navigation, browser history, and tab movement.
- Element Interaction: click, find element, hover, drag/drop with optional destination positioning inside the target, focus/blur, and scroll.
- Form Fields: fill, clear, select, checkbox/radio, upload, submit, custom dropdown, and rich text.
- Keyboard: key presses, hotkeys, character-by-character typing, clipboard, and paste.
- Wait: fixed duration/condition waits and random duration waits.
- Capture Data: text/attribute/field/table/list extraction, screenshots, and downloads that create outputs.
- Browser Context: dialogs, downloads, runtime viewport size, geolocation, permissions, and other runtime-safe browser context actions. Set Viewport changes runtime width and height only.
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
- `random_choice`
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

The backend action registry enumerates every serialized action type with an
execution owner, palette visibility, and audit-risk tag. Backend validation now
uses `electron/backend/actions/validation.ts`, and runner dispatch goes through
`electron/backend/actions/execution.ts`. Compiler and runner defense-in-depth
checks use the same registry lookup for unsupported action errors before
reaching action-specific validation or execution logic. `execute_js` is tagged
as high audit risk in the registry and can be disabled per workflow by Run
Policy before script text is evaluated.

Intent-focused UI labels preserve serialized action types. Examples: `input_text` displays as Fill Field, `clear_input` as Clear Field, `find_element` as Find Element, `type_sequence` as Type Keys, `paste_clipboard` as Paste Into Field, `extract_input_value` as Extract Field Value, and `execute_js` as Run JavaScript. Visible browser action defaults are target-first and omit engine-level timing, typing, retry, positioning, and clear-method fields. Targetable single-target actions expose Use locator versus Use Find Element ref when they can consume a prior `find_element` runtime ref; Drag and Drop exposes the same choice independently for Drag source and Drop target through `source_ref` and `target_ref`, and Custom Select exposes it for the dropdown trigger through `trigger_ref`. Scroll is the exception that exposes Page Scroll style/pixel distance and element-targeted scroll modes because those are the action's core contract, but target scroll still hides low-level target constraints and planner tuning. The visible structured target editor defaults its locator kind to XPath while allowing more stable locator kinds when available.

Removed actions: `open_url`, `sleep`, and `type_text` are not part of the current authoring contract.

## Change Rule

When adding or changing an action, keep these in sync:

- TypeScript `ActionType` and `ActionConfig`.
- UI label, group, summary, and form behavior.
- Default config.
- Capability registry classification.
- Backend validation.
- Runner execution or explicit unsupported error.
- Backend action registry owner, visibility, and audit-risk metadata.
- Backend action validation and execution registry coverage.
- Persistence JSON contract.
- Command and domain tests.
- Smoke checklist when user-visible behavior changes.

Do not infer current actions from `docs/superpowers`; verify code.
