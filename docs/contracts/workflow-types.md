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

Workflow graph data is the product authoring surface and is versioned separately from legacy ordered workflow step rows. New workflows create a `Start -> New node` draft graph, where `New node` is an action node with `config: null`. Existing Start-only saved graphs remain valid drafts, and existing linear step rows can still be represented as a generated graph with action nodes and a success end node for compatibility paths.

Graph validation issues serialize as `{ level, node_id, edge_id, message }`, where `level` is `error` or `warning`.

Graph links are directed execution edges. The frontend replaces any existing edge that shares the same source output or target input when a port is reconnected. Backend validation is authoritative and rejects self-links, duplicate edges, more than one outgoing edge from the same output port, more than one incoming edge to the same input port, missing ports/nodes, unreachable non-start nodes, unsupported free cycles, and loop-control nodes reachable outside a loop body. Validation may return warnings for optional branches or continuations that are missing but still executable.

Current frontend graph authoring uses `@xyflow/react` for pan, zoom, drag, handles, minimap, controls, background, and selection. Persisted `WorkflowGraph` remains the source of truth and is converted through frontend React Flow adapters.

Current frontend graph authoring supports explicit port connection, edge deletion, multi-selection bulk edit commands, action config editing, and structured config editing for:

- `if` conditions.
- `switch` expressions and case ports.
- `repeat_times` loop counts.
- `repeat_for_each` item name and literal item list.
- `while` and `repeat_until` conditions plus loop guard settings.
- `retry` max attempts and delay.
- `manual_approval` reason and optional timeout.
- `rate_limit` delay.
- `stop_workflow`, `set_variable`, `transform_variable`, `assert_output`, `run_subworkflow`, `domain_allowlist`, and `end_failure`.

The main graph toolbar only exposes beginner-facing authoring groups: New node, Add Action, Add Logic, Add Variable, and Add End. Some graph node types in the contract remain loadable/editable for compatibility but are hidden from the main add palettes.

The backend compiler currently executes action, manual approval, rate limit, `if`, `switch`, `repeat_times`, `repeat_for_each`, `while`, `repeat_until`, `retry`, `try_catch`, `fallback`, loop break/continue, stop, variable, output assertion, subworkflow, domain allowlist, success end, and failure end graph nodes. `run_subworkflow` is expanded at the command layer before the browser runner starts. Graph-native control blocks compile branch ports into nested action configs and then continue through explicit continuation ports.

Executable frontend/Rust ports must agree:

- `start`: output `out`
- `end_success` / `end_failure`: input `in`
- `action`: input `in`, output `out`; `config: null` is a saveable draft marker but blocks validation/compile/run.
- `if`: input `in`, outputs `true`, `false`, `done`
- `switch`: input `in`, outputs `case_N`, `default`, `done`
- `repeat_times` / `repeat_for_each` / `while`: input `in`, outputs `loop`, `done`
- `repeat_until`: input `in`, outputs `loop`, `done`, `timeout`
- `retry`: input `in`, outputs `try`, `success`, `failed`
- `try_catch`: input `in`, outputs `try`, `success`, `error`, `finally`, `done`
- `fallback`: input `in`, outputs `primary`, `fallback`, `done`
- `break_loop` / `continue_loop` / `stop_workflow`: input `in`
- `manual_approval` / `rate_limit`: input `in`, output `out`
- `set_variable` / `transform_variable` / `assert_output` / `run_subworkflow` / `domain_allowlist`: input `in`, output `out`

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
