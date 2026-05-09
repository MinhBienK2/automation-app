# Persistence Architecture

## Purpose

Persistence stores workflows, versioned workflow graph authoring data, and per-workflow settings in SQLite. Legacy ordered workflow step rows still exist for compatibility paths, but they are no longer the product authoring source of truth.
Legacy workflow-level browser runtime config rows still exist for compatibility, but product-facing browser launch settings now live in `workflow_settings.browser_json`.

The Electron rebuild has a separate new SQLite workspace schema in `electron/main/storage.ts`. It does not migrate the Tauri database and follows the rebuild storage spec: workflows, active graph versions, run profiles, identity profiles, environments, runs, run events, artifacts, evidence records, and a temporary renderer settings snapshot facade while the existing React UI is reused.

## Key Files

- `src-tauri/src/repositories/workflow_repository.rs`
- `src-tauri/migrations/`
- `src-tauri/src/db/mod.rs`
- `src-tauri/tests/persistence.rs`
- `electron/main/storage.ts`
- `electron/main/storage.test.ts`

## Current Behavior

- `list_workflows` returns workflow summaries with the legacy `step_count` field.
- Summaries sort by `updated_at DESC`, then name ascending.
- `get_workflow` currently returns workflow metadata plus legacy ordered steps for compatibility; product graph authoring data is loaded from `get_workflow_graph`.
- New workflows create a `Start -> New node` draft workflow graph with an unconfigured action node saved as `config: null`.
- Workflow graph authoring data is stored in `workflow_graphs.graph_json` keyed by `workflow_id`.
- Workflow browser runtime config is stored in `workflow_browser_configs` keyed by `workflow_id`.
- Workflow Settings are stored in `workflow_settings` keyed by `workflow_id`, with version plus JSON columns for General, Execution, Browser, Environment, Inputs, Triggers, and Advanced. The persisted Inputs column remains the compatibility storage for the UI's Variables section.
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
- Electron storage initializes `workspace.db` under app data, creates the rebuild schema from empty state, stores one active graph version per workflow, records workflow default profile references, persists workspace allowed-origin policy, persists Run Profile records, persists Environment records, appends monotonic run events, marks run records with terminal status/reason, lists run history by workflow, registers file-backed artifact metadata with path traversal rejection, persists Identity Profile records, validates basic identity coherence, stores sanitized evidence records, exports compact run evidence views with run summary, graph/profile/environment snapshots, and an export manifest, and hides soft-deleted workflows.
- Electron workflow settings snapshots are a transition facade for the current renderer and are not old database migration.

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

- Add a migration or schema initializer change for schema changes.
- Update repository tests.
- Update Electron storage tests when changing `electron/main/storage.ts`.
- Consider import/export compatibility.
- Preserve existing workflow deserialization unless intentionally migrating data.
