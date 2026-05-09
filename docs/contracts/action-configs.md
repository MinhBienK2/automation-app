# Action Config Contracts

## Source Files

- `src/types/workflow.ts`
- `src/lib/workflowUi.ts`
- `src/features/workflows/lib/workflowStepForm.ts`
- `src/features/workflows/components/ActionConfigEditor.tsx`
- `src/features/workflows/components/ActionConfig*Fields.tsx`
- `src-tauri/src/domain/action_config.rs`
- `src-tauri/src/domain/validation.rs`
- `src-tauri/src/services/run_service.rs`
- `src-tauri/src/runner/actions/`

## Required Sync Points

Every serialized action type that can cross the Tauri boundary must be represented by TypeScript `ActionType` and `ActionConfig`, and by Rust `ActionType` and `ActionConfig`. The visible Add Action palette is a narrower product subset maintained in `workflowUi.ts` and the graph palette helpers.

Every user-addable action type must have:

- Rust `ActionType::as_str` and `ActionType::label`.
- Default config in `default_config`.
- UI label/group in `workflowUi.ts`.
- UI summary in `stepSummary`.
- Form support in workflow step form logic/components when user editable.
- Domain validation when fields have constraints.
- Runner execution or intentional no-op/unsupported behavior.

Graph-internal executable configs such as `if_condition`, `repeat_times`, `repeat_for_each`, `retry_block`, `switch_condition`, `while_loop`, `repeat_until`, `try_catch`, `fallback_block`, `break_loop`, `continue_loop`, `stop_workflow`, `transform_variable`, `assert_output`, `run_subworkflow`, and `domain_allowlist` are Rust/TypeScript `ActionConfig` variants used by graph compilation and runner orchestration. They are intentionally included in TypeScript `ActionType` for DTO safety, but hidden from the main Add Action picker. Graph-native nodes are the user-facing control-flow authoring surface. Variable configs include backward-compatible `set_variable`, multi-row `set_variable`, and `set_json_variables`. Hidden compatibility actions such as `set_checkbox`, reliability actions, and human checkpoint actions remain serde-compatible and editable when loaded from existing workflows, but are not visible in the main Add Action picker. They still require serde compatibility, validation, and runner or command-layer execution semantics.

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
- The runner resolves structured targets at runtime and then reuses the existing frame-aware action path.

Recovery config semantics must preserve failure behavior when recovery branches are absent:

- `retry_block` with empty `failed_steps` fails with the last try error after attempts are exhausted.
- `try_catch` with empty `error_steps` fails with the original try error after running `finally_steps` when present.
- `fallback_block` with empty `fallback_steps` fails with the primary branch error.

## Validation Ownership

- Backend validation is authoritative.
- Frontend may provide ergonomic form behavior but cannot be the only validation.
- `dry_run_validate_config` exposes backend validation for builder assist.

## Persistence

Configs persist as JSON in `workflow_steps.config_json`.

Preserve serde compatibility for existing configs unless a migration or import/export compatibility path is intentionally added.

## Removed Legacy Actions

`open_url`, `sleep`, and `type_text` are not part of the current action type set. Existing persisted configs are migrated or normalized as follows:

- `open_url` -> `navigate`
- `sleep` -> `wait` with `condition: "duration"` and `duration_ms`

`random_wait` is a first-class wait action with `min_ms` and `max_ms`. Both values must be greater than zero, and `max_ms` must be greater than or equal to `min_ms`.
- `type_text` -> `input_text`
