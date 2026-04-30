# Workflow Type Contracts

## Source Files

- TypeScript: `src/types/workflow.ts`
- Rust workflow domain: `src-tauri/src/domain/workflow.rs`
- Rust action configs: `src-tauri/src/domain/action_config.rs`
- Rust graph domain: `src-tauri/src/domain/workflow_graph.rs`
- Rust run types: `src-tauri/src/domain/run.rs`
- Repository DTOs: `src-tauri/src/repositories/workflow_repository.rs`

## Workflow Shapes

Frontend and backend must agree on:

- `WorkflowSummary`: `id`, `name`, `step_count`, `created_at`, `updated_at`.
- `Workflow`: `id`, `name`, `created_at`, `updated_at`.
- `WorkflowStep`: legacy/internal step row shape used by import/export compatibility and compiled graph runner adapters.
- `WorkflowDetail`: currently `workflow`, `steps` for compatibility, while the product UI loads graph authoring data through `get_workflow_graph`.
- `WorkflowGraph`: `version`, `nodes`, `edges`, `viewport`.
- `GraphNode`: `id`, `node_type`, `label`, `position`, `config`, `ports`, optional `group_id`.
- `GraphEdge`: `id`, `source_node_id`, `source_port`, `target_node_id`, `target_port`, optional `label`, optional `condition`.
- `CompiledWorkflowGraph`: `steps`, where each compiled step carries `node_id`, `label`, and `config`.

## Graph Shape

Workflow graph data is the product authoring surface and is versioned separately from legacy ordered workflow step rows. New workflows create a default graph with start and success end nodes. Existing linear step rows can still be represented as a generated graph for compatibility paths.

Graph validation issues serialize as `{ level, node_id, edge_id, message }`, where `level` is `error` or `warning`.

Current frontend graph authoring supports explicit port connection, edge deletion, action config editing, and structured config editing for:

- `if` conditions.
- `repeat_times` loop counts.
- `repeat_for_each` item name and literal item list.
- `retry` max attempts and delay.
- `manual_approval` reason and optional timeout.
- `rate_limit` delay.

The backend compiler currently executes supported action, manual approval, rate limit, `if`, `repeat_times`, `repeat_for_each`, and `retry` graph nodes. Other advanced graph node types are represented in the DTO but fail compile/run with explicit unsupported-node errors until their runtime semantics are implemented.

Executable frontend/Rust ports must agree:

- `start`: output `out`
- `end_success` / `end_failure`: input `in`
- `action`: input `in`, output `out`
- `if`: input `in`, outputs `true`, `false`
- `repeat_times` / `repeat_for_each`: input `in`, outputs `loop`, `done`
- `retry`: input `in`, outputs `try`, `success`, `failed`
- `manual_approval` / `rate_limit`: input `in`, output `out`

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
