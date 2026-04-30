# Persistence Architecture

## Purpose

Persistence stores workflows and versioned workflow graph authoring data in SQLite. Legacy ordered workflow step rows still exist for compatibility paths, but they are no longer the product authoring source of truth.

## Key Files

- `src-tauri/src/repositories/workflow_repository.rs`
- `src-tauri/migrations/`
- `src-tauri/src/db/mod.rs`
- `src-tauri/tests/persistence.rs`

## Current Behavior

- `list_workflows` returns workflow summaries with the legacy `step_count` field.
- Summaries sort by `updated_at DESC`, then name ascending.
- `get_workflow` currently returns workflow metadata plus legacy ordered steps for compatibility; product graph authoring data is loaded from `get_workflow_graph`.
- New workflows create a default workflow graph.
- Workflow graph authoring data is stored in `workflow_graphs.graph_json` keyed by `workflow_id`.
- Workflows without a graph row still open through a compatibility linear graph fallback.
- Removed legacy step configs are migrated or normalized on read: `open_url` to `navigate`, `sleep` to duration `wait`, and `type_text` to `input_text`.
- `add_step` appends with `MAX(order_index) + 1`.
- `delete_step` compacts order indexes.
- `reorder_steps` rewrites indexes through temporary negative values.
- Child step changes touch the parent workflow `updated_at`.

## Belongs Here

- SQL queries.
- Migrations.
- Timestamp updates.
- Order index integrity.
- Serialization/deserialization of stored action config JSON.
- Serialization/deserialization of stored workflow graph JSON.
- Compatibility behavior for legacy step rows until that schema is removed.

## Does Not Belong Here

- UI selection state.
- Runner execution.
- Domain validation rules before persistence.

## Change Checklist

- Add a migration for schema changes.
- Update repository tests.
- Consider import/export compatibility.
- Preserve existing workflow deserialization unless intentionally migrating data.
