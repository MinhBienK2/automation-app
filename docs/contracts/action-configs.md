# Action Config Contracts

## Source Files

- `src/types/workflow.ts`
- `src/lib/workflowUi.ts`
- `src/features/workflows/lib/workflowStepForm.ts`
- `src/features/workflows/components/StepForm.tsx`
- `src-tauri/src/domain/action_config.rs`
- `src-tauri/src/domain/validation.rs`
- `src-tauri/src/services/run_service.rs`
- `src-tauri/src/runner/actions/`

## Required Sync Points

Every user-addable action type must have:

- TypeScript `ActionType`.
- TypeScript `ActionConfig` variant.
- Rust `ActionType`.
- Rust `ActionConfig` variant.
- Rust `ActionType::as_str` and `ActionType::label`.
- Default config in `default_config`.
- UI label/group in `workflowUi.ts`.
- UI summary in `stepSummary`.
- Form support in workflow step form logic/components when user editable.
- Domain validation when fields have constraints.
- Runner execution or intentional no-op/unsupported behavior.

Graph-internal executable configs such as `if_condition`, `repeat_times`, `repeat_for_each`, `retry_block`, `switch_condition`, `while_loop`, `repeat_until`, `try_catch`, `fallback_block`, `break_loop`, `continue_loop`, `stop_workflow`, `transform_variable`, `assert_output`, `run_subworkflow`, and `domain_allowlist` are Rust/TypeScript `ActionConfig` variants used by graph compilation and runner orchestration. Graph-native nodes are the user-facing control-flow authoring surface, so these control-flow configs are not listed in the user action palette. They still require serde compatibility, validation, and runner or command-layer execution semantics.

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
- `type_text` -> `input_text`
