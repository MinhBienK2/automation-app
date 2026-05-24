# Persistence Architecture

## Purpose

Persistence stores workflows, versioned workflow graph authoring data, per-workflow settings, schedules, schedule events, runs, and run steps in SQLite. Electron/Node now owns the production persistence layer.

## Key Files

- Electron SQLite bootstrap: `electron/backend/persistence/database.ts`
- Electron workflow repository: `electron/backend/persistence/workflowRepository.ts`
- Electron schedule repository: `electron/backend/scheduling/workflowScheduleRepository.ts`
- Electron command handlers: `electron/backend/commands.ts`

## Current Behavior

- Electron app data uses `appData/automation-app`.
- The current schema creates document-shaped `workflows`, queryable `runs` and `run_steps`, plus `workflow_schedules` and `workflow_schedule_events`.
- Database initialization idempotently creates indexes for the core lookup paths:
  `runs(workflow_id, started_at DESC)`,
  `run_steps(run_id, step_number)`,
  `workflow_schedules(enabled, next_run_at)`,
  `workflow_schedule_events(schedule_id, created_at DESC)`, and
  `workflow_schedule_events(workflow_id, created_at DESC)`.
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
- Run evidence outputs store app-local artifact paths under run-scoped evidence directories; run rows persist the resulting output JSON and step error/trace JSON for audit. `run_steps` keeps the existing top-level compiled graph rows and appends executed nested action trace rows with parent control node id and sequence metadata inside `trace_json`, allowing branch, loop, and retry paths to be reconstructed from durable storage.
- Schedule rows store schedule config JSON, enabled state, next run time, and the latest schedule event summary.
- Schedule event rows store scheduling decisions such as started, skipped, missed, failed-to-start, and disabled. Skipped/missed events exist even when no run row is created. Schedule event history by schedule id or workflow id uses descending created-time indexes.
- Deleting a workflow cascades to its schedules and schedule events.
- Legacy ordered-step tables are intentionally not migrated into the new Electron data format.

## Belongs Here

- SQL queries.
- Migrations.
- Timestamp updates.
- Order index integrity.
- Serialization/deserialization of stored action config JSON.
- Serialization/deserialization of stored workflow graph JSON.
- Persistence of Workflow Settings rows.
- Persistence of workflow schedule rows and schedule event rows.

## Does Not Belong Here

- UI selection state.
- Runner execution.
- Domain validation rules before persistence.

## Change Checklist

- Add a migration for schema changes.
- Update repository tests.
- Consider import/export contract changes.
- Preserve existing workflow deserialization unless intentionally resetting the local Electron data format.
