# Workflow Type Contracts

## Source Files

- TypeScript: `src/types/workflow.ts`
- Rust workflow domain: `src-tauri/src/domain/workflow.rs`
- Rust action configs: `src-tauri/src/domain/action_config.rs`
- Rust run types: `src-tauri/src/domain/run.rs`
- Repository DTOs: `src-tauri/src/repositories/workflow_repository.rs`

## Workflow Shapes

Frontend and backend must agree on:

- `WorkflowSummary`: `id`, `name`, `step_count`, `created_at`, `updated_at`.
- `Workflow`: `id`, `name`, `created_at`, `updated_at`.
- `WorkflowStep`: `id`, `name`, `workflow_id`, `order_index`, `action_type`, `config`, `created_at`, `updated_at`.
- `WorkflowDetail`: `workflow`, `steps`.

## Action Config Shape

Action configs use a tagged shape compatible with Rust serde:

```text
{ type: "click", config: { ... } }
```

The `type` string must match Rust `ActionType` snake_case serialization.

## Change Checklist

- Update TypeScript and Rust together.
- Update default configs for new action variants.
- Update persistence tests if stored JSON shape changes.
- Update command tests if command response shape changes.
- Update docs in `contracts/` and affected domain docs.

