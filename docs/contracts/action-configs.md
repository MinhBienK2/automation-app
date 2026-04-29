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

Every action type must have:

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
