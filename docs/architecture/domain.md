# Domain Architecture

## Purpose

Domain code defines workflow/action/run types and business validation.

## Key Files

- `src-tauri/src/domain/workflow.rs`
- `src-tauri/src/domain/action_config.rs`
- `src-tauri/src/domain/validation.rs`
- `src-tauri/src/domain/run.rs`
- `src-tauri/src/domain/orchestration.rs`
- `src-tauri/src/domain/builder_assist.rs`
- `src-tauri/tests/domain_validation.rs`

## Belongs Here

- Serde-compatible domain types.
- Action config enums and validation.
- Workflow graph structural and semantic validation, including one-edge-per-port rules, block continuation semantics, required body ports, unreachable nodes, unsupported cycles, unconfigured action drafts, and loop-control context.
- Run status/mode/error types.
- Orchestration schedule and batch request validation.
- Builder assist input/output types.

## Does Not Belong Here

- React rendering rules.
- SQL queries.
- Chromium API calls.
- Command-specific serialization wrappers unless they are domain DTOs.

## Change Checklist

- Keep TypeScript DTOs in `src/types/workflow.ts` compatible.
- Add focused domain tests before validation changes.
- Keep validation errors field-addressable where UI can act on a field.
- Check default configs in `src-tauri/src/services/run_service.rs`.
