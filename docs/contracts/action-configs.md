# Action Config Contracts

## Source Files

- `src/types/workflow.ts`
- `src/lib/workflowUi.ts`
- `src/features/workflows/lib/workflowStepForm.ts`
- `src/features/workflows/components/ActionConfigEditor.tsx`
- `src/features/workflows/components/ActionConfig*Fields.tsx`
- `electron/backend/graphCompiler.ts`
- `electron/backend/commands.ts`
- `electron/backend/runner.ts`

## Required Sync Points

Every serialized action type that can cross the Electron IPC boundary must be represented by TypeScript `ActionType` and `ActionConfig`. The visible Add Action palette is a narrower product subset maintained in `workflowUi.ts` and the graph palette helpers.

Every user-addable action type must have:

- TypeScript action type and config shape.
- Capability registry status in `src/lib/actionCapabilities.ts`.
- Default config in frontend defaults or graph compiler settings prelude when applicable.
- UI label/group in `workflowUi.ts`.
- UI label/help text in `workflowUi.ts` and `stepHelpContent.ts`.
- Form support in workflow step form logic/components when user editable.
- Backend validation when fields have constraints.
- Runner execution or an explicit unsupported error. Silent success for stubbed actions is not allowed.

Browser identity actions such as profile, proxy, user-agent, and download-directory settings are not part of the in-run action contract. Browser identity belongs in Workflow Settings Browser Launch.

Runner traces classify every top-level executed action with compact mode/status metadata. The runner's CloakBrowser-native/custom-human/direct-DOM capability map is internal execution policy, not a serialized action config field.

Graph-internal executable configs such as `graph_noop`, `if_condition`, `router_condition`, `repeat_times`, `repeat_for_each`, `retry_block`, `switch_condition`, `while_loop`, `repeat_until`, `try_catch`, `fallback_block`, `break_loop`, `continue_loop`, `stop_workflow`, `transform_variable`, `assert_output`, and `domain_allowlist` are TypeScript `ActionConfig` variants used by graph compilation and runner orchestration. They are intentionally included in TypeScript `ActionType` for DTO safety, but hidden from the main Add Action picker. Graph-native nodes are the user-facing control-flow authoring surface. Variable configs include multi-row `set_variable` and `set_json_variables`.

Merge nodes compile to `{ type: "graph_noop", config: { kind: "merge" } }` and have no browser, output, session, or network side effects. Router nodes compile to `router_condition` with `mode: "first_match"`, stable case ids/labels/conditions, nested case steps, and `default_steps`.

Terminal graph nodes can compile to `stop_workflow` with `close_browser: true`. When `close_browser` is missing or false, terminal runs keep retaining the browser session. When true, the runner still captures outputs first and then closes the browser instead of retaining the session.

Variable config rules:

- `set_variable` rows use `{ name, value_type, value }`, where `value_type` is `text`, `json`, `number`, or `boolean`.
- `set_json_variables` requires a JSON object root.
- Dot-path names are valid variable paths.
- Object values flatten into dot-path outputs; arrays stay whole at their path.
- Later writes to the same path overwrite earlier writes.
- `repeat_for_each` can use literal `items` or an `array_variable` source.

Element target config rules:

- User-authored element-facing actions use `target`, a structured locator bundle with ordered locators (`test_id`, `role`, `label`, `placeholder`, `text`, `css`, `xpath`, or `attribute`) plus optional constraints (`visible`, `enabled`, `contains_text`, `index`) and optional iframe target.
- Drag/drop uses `source_target` and `target_target`; custom select uses `trigger_target`.
- Backend validation requires a valid structured target for required element actions.
- The runner resolves structured targets at runtime through ordered locators, supports role/label/placeholder/text/CSS/XPath/attribute locator kinds, applies supported constraints, and reuses the frame-aware action path.
- Scroll config supports `mode: "page" | "into_view" | "until_visible"`. Missing `mode` remains compatible with legacy Page scroll and requires `direction` plus positive `pixels`. `into_view` and `until_visible` require `target` or legacy `xpath`, may include `iframe_xpath`, and may set positive `timeout_ms`.
- Visible action defaults no longer include action-level typing fidelity, retry interval, post-click wait, click positioning, or clear-field method fields. Scroll exposes only mode-specific fields: Page shows direction/pixels, while element-targeted modes show target and timeout.
- Backend validation rejects unsupported enum values for preserved element/form/assertion fields such as readiness wait mode, select matching mode, checkbox state, and assertion match mode; the runner keeps matching defensive guards for direct execution inputs.
- Runner interaction dispatch uses an internal capability map: CloakBrowser-native paths are preferred for supported element/page/frame APIs, custom human behavior is isolated to unsupported cases such as page pixel scroll, untargeted key chords, paste shortcut orchestration, and right-click button preservation, and direct DOM is used for read/assert/storage actions or final fallbacks only.

Evidence config rules:

- `take_screenshot.path` is an artifact name, not a filesystem path.
- Screenshot artifact names must be relative names without `file:`, absolute paths, path separators, or parent traversal.
- Generated screenshot and download paths are stored under `evidence/runs/<run_id>/...`.
- `__evidence` contains structured artifact metadata; compact output paths remain for existing output consumers.

Recovery config semantics must preserve failure behavior when recovery branches are absent:

- `retry_block` with empty `failed_steps` fails with the last try error after attempts are exhausted.
- `try_catch` with empty `error_steps` fails with the original try error after running `finally_steps` when present.
- `fallback_block` with empty `fallback_steps` fails with the primary branch error.

## Validation Ownership

- Electron backend validation is authoritative.
- `electron/backend/graphCompiler.ts` owns graph structural validation, graph-native semantic validation, and graph-to-action compilation.
- Frontend may provide ergonomic form behavior but cannot be the only validation.
- `dry_run_validate_config` exposes backend validation for builder assist.
- Backend action validation covers visible action families, nested graph-internal action arrays, safe evidence names, geolocation and viewport ranges, network status ranges, required output names, and storage/header/permission lists.

Set Viewport is a runtime viewport-size action. Active authoring exposes only `width` and `height`. Device scale factor, mobile mode, and touch capability belong in Workflow Settings Browser Launch before Chromium starts.

## Persistence

Configs persist as JSON inside `workflows.graph_json` and workflow package `flow` payloads.

Preserve the current v2 graph JSON contract unless a schema change is intentionally designed.

## Removed Actions

`open_url`, `sleep`, and `type_text` are not part of the current action type set.

- `open_url` -> `navigate`
- `sleep` -> `wait` with `condition: "duration"` and `duration_ms`

`random_wait` is a first-class wait action with `min_ms` and `max_ms`. Both values must be greater than zero, and `max_ms` must be greater than or equal to `min_ms`.
- `type_text` -> `input_text`
