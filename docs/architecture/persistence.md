# Persistence Architecture

## Purpose

Persistence stores workflows, versioned workflow graph authoring data, per-workflow settings, runs, and run steps in SQLite. Plan 01 creates the Electron app data directories and the first Node-owned SQLite schema; full command parity is completed in the storage plan.

## Key Files

- Electron SQLite bootstrap: `electron/backend/database.ts`
- Electron command stubs: `electron/backend/commands.ts`
- Temporary reference repository: `src-tauri/src/repositories/workflow_repository.rs`
- Temporary reference migrations: `src-tauri/migrations/`

## Current Behavior

- Electron app data uses `appData/automation-app`.
- The current schema creates document-shaped `workflows` plus queryable `runs` and `run_steps`.
- Plan 01 command handlers use in-memory workflow data while the database schema is bootstrapped; Plan 02 moves command parity onto SQLite.
- `listWorkflows` returns workflow summaries with the legacy `step_count` field.
- Summaries sort by `updated_at DESC`, then name ascending.
- `get_workflow` currently returns workflow metadata plus legacy ordered steps for compatibility; product graph authoring data is loaded from `get_workflow_graph`.
- New workflows create a `Start -> New node` draft workflow graph with an unconfigured action node saved as `config: null`.
- Workflow graph authoring data is stored in `workflow_graphs.graph_json` keyed by `workflow_id`.
- Workflow browser runtime config is stored in `workflow_browser_configs` keyed by `workflow_id`.
- The new schema stores graph and settings documents as JSON columns on `workflows`.
- Workflows without a settings row return lazy defaults based on workflow metadata and any legacy browser config row.
- Saving Workflow Settings touches the parent workflow `updated_at`; saving General also updates the workflow name used by summaries.
- Workflows without a graph row still open through a compatibility linear graph fallback.
- Legacy browser config rows are read into lazy Workflow Settings defaults when no settings row exists.
- Removed legacy step configs are migrated or normalized on read: `open_url` to `navigate`, `sleep` to duration `wait`, and `type_text` to `input_text`.
- `add_step` appends with `MAX(order_index) + 1`.
- `delete_step` compacts order indexes.
- `reorder_steps` rewrites indexes through temporary negative values.
- Child step changes touch the parent workflow `updated_at`.
- Graph, Workflow Settings, and legacy browser config saves touch the parent workflow `updated_at`.

## Belongs Here

- SQL queries.
- Migrations.
- Timestamp updates.
- Order index integrity.
- Serialization/deserialization of stored action config JSON.
- Serialization/deserialization of stored workflow graph JSON.
- Persistence of Workflow Settings rows and legacy workflow browser runtime config rows.
- Compatibility behavior for legacy step rows until that schema is removed.

## Does Not Belong Here

- UI selection state.
- Runner execution.
- Domain validation rules before persistence.

## Change Checklist

- Add a migration for schema changes.
- Update repository tests.
- Consider import/export compatibility.
- Preserve existing workflow deserialization unless intentionally resetting the local Electron data format.
