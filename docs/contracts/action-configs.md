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

Graph-internal executable configs such as `if_condition`, `repeat_times`, `repeat_for_each`, `retry_block`, `switch_condition`, `while_loop`, `repeat_until`, `try_catch`, `fallback_block`, `break_loop`, `continue_loop`, `stop_workflow`, `transform_variable`, `assert_output`, `run_subworkflow`, and `domain_allowlist` are TypeScript `ActionConfig` variants used by graph compilation and runner orchestration. They are intentionally included in TypeScript `ActionType` for DTO safety, but hidden from the main Add Action picker. Graph-native nodes are the user-facing control-flow authoring surface. Legacy action nodes that contain graph-internal configs render a compatibility panel with the action label, read-only JSON, and replacement/delete affordances instead of an empty editor. Variable configs include backward-compatible `set_variable`, multi-row `set_variable`, and `set_json_variables`. Hidden compatibility actions such as `set_checkbox`, reliability actions, and human checkpoint actions remain loadable when present in existing workflows, but are not visible in the main Add Action picker. They still require DTO compatibility, validation, and runner or command-layer execution semantics.

Terminal graph nodes can compile to `stop_workflow` with `close_browser: true`. When `close_browser` is missing or false, terminal runs keep retaining the browser session. When true, the runner still captures outputs first and then closes the browser instead of retaining the session.

Variable config rules:

- Legacy `set_variable` `{ name, value }` must still deserialize and run.
- New `set_variable` rows use `{ name, value_type, value }`, where `value_type` is `text`, `json`, `number`, or `boolean`.
- `set_json_variables` requires a JSON object root.
- Dot-path names are valid variable paths.
- Object values flatten into dot-path outputs; arrays stay whole at their path.
- Later writes to the same path overwrite earlier writes.
- `repeat_for_each` can use literal `items` or an `array_variable` source.

Element target config rules:

- Element-facing actions keep legacy `xpath` and `iframe_xpath` fields for compatibility.
- The same actions may also carry `target`, a structured locator bundle with ordered locators (`test_id`, `role`, `label`, `placeholder`, `text`, `css`, `xpath`, or `attribute`) plus optional constraints (`visible`, `enabled`, `contains_text`, `index`) and optional iframe target.
- Drag/drop uses `source_target` and `target_target`; custom select uses `trigger_target`.
- Backend validation accepts either a non-empty legacy XPath or a valid structured target for required element actions.
- The runner resolves structured targets at runtime through ordered locators, supports role/label/placeholder/text/CSS/XPath/attribute locator kinds, applies supported constraints, and reuses the frame-aware action path.

Evidence config rules:

- `take_screenshot.path` is an artifact name, not a filesystem path.
- Screenshot/checkpoint artifact names must be relative names without `file:`, absolute paths, path separators, or parent traversal.
- Generated screenshot and download paths are stored under `evidence/runs/<run_id>/...`.
- `__evidence` contains structured artifact metadata; compact output paths remain for compatibility.

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

## Persistence

Configs persist as JSON inside `workflows.graph_json` and workflow package `flow` payloads. Legacy `WorkflowStep.config` remains a DTO/import-export compatibility shape.

Preserve JSON compatibility for existing configs unless a migration or import/export compatibility path is intentionally added.

## Removed Legacy Actions

`open_url`, `sleep`, and `type_text` are not part of the current action type set. Existing persisted configs are migrated or normalized as follows:

- `open_url` -> `navigate`
- `sleep` -> `wait` with `condition: "duration"` and `duration_ms`

`random_wait` is a first-class wait action with `min_ms` and `max_ms`. Both values must be greater than zero, and `max_ms` must be greater than or equal to `min_ms`.
- `type_text` -> `input_text`
