# Persistence Architecture

## Purpose

Persistence stores workflows, versioned workflow graph authoring data, per-workflow settings, runs, and run steps in SQLite. Electron/Node now owns the production persistence layer.

## Key Files

- Electron SQLite bootstrap: `electron/backend/database.ts`
- Electron workflow repository: `electron/backend/workflowRepository.ts`
- Electron command handlers: `electron/backend/commands.ts`

## Current Behavior

- Electron app data uses `appData/automation-app`.
- The current schema creates document-shaped `workflows` plus queryable `runs` and `run_steps`.
- `listWorkflows` returns workflow summaries used by the workflow list.
- Summaries sort by `updated_at DESC`, then name ascending.
- `getWorkflow` returns workflow metadata; product graph authoring data is loaded from `getWorkflowGraph`.
- New workflows create a `Start -> New node` draft workflow graph with an unconfigured action node saved as `config: null`.
- Workflow graph authoring data is stored in `workflows.graph_json`.
- Workflow Settings are stored in `workflows.settings_json`.
- Workflows without saved settings return lazy defaults based on workflow metadata.
- Saving Workflow Settings touches the parent workflow `updated_at`; saving General also updates the workflow name used by summaries.
- Saving graph JSON touches the parent workflow `updated_at`.
- Workflow package import validates selected flow/settings before creating a workflow and writes workflow, graph, and settings inside one SQLite transaction. Failed validation or save errors roll back the whole import.
- Run evidence outputs store app-local artifact paths under run-scoped evidence directories; run rows persist the resulting output JSON and step error/trace JSON for audit.
- Legacy ordered-step tables are intentionally not migrated into the new Electron data format.

## Belongs Here

- SQL queries.
- Migrations.
- Timestamp updates.
- Order index integrity.
- Serialization/deserialization of stored action config JSON.
- Serialization/deserialization of stored workflow graph JSON.
- Persistence of Workflow Settings rows.

## Does Not Belong Here

- UI selection state.
- Runner execution.
- Domain validation rules before persistence.

## Change Checklist

- Add a migration for schema changes.
- Update repository tests.
- Consider import/export contract changes.
- Preserve existing workflow deserialization unless intentionally resetting the local Electron data format.
