# Persistence Architecture

## Purpose

Persistence stores workflows and ordered workflow steps in SQLite.

## Key Files

- `src-tauri/src/repositories/workflow_repository.rs`
- `src-tauri/migrations/`
- `src-tauri/src/db/mod.rs`
- `src-tauri/tests/persistence.rs`

## Current Behavior

- `list_workflows` returns workflow summaries with step counts.
- Summaries sort by `updated_at DESC`, then name ascending.
- `get_workflow` returns workflow metadata plus steps ordered by `order_index ASC`.
- Step configs are stored as serialized `ActionConfig` JSON.
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

## Does Not Belong Here

- UI selection state.
- Runner execution.
- Domain validation rules before persistence.

## Change Checklist

- Add a migration for schema changes.
- Update repository tests.
- Consider import/export compatibility.
- Preserve existing workflow deserialization unless intentionally migrating data.
