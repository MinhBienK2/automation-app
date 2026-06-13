# Persistence Architecture

## Purpose

Persistence stores projects, browser profile rows (in the compatibility
`project_environments` table), workflows, reusable subflows,
versioned workflow graph authoring data, per-workflow settings, schedules,
schedule events, runs, run steps, and operational attention events in SQLite.
Electron/Node now owns the production persistence layer.

## Key Files

- Electron SQLite bootstrap: `electron/backend/persistence/database.ts`
- Electron workflow repository: `electron/backend/persistence/workflowRepository.ts`
- Electron schedule repository: `electron/backend/scheduling/workflowScheduleRepository.ts`
- Electron operations read model: `electron/backend/operations/operationsRepository.ts`
- Electron command handlers: `electron/backend/commands.ts`

## Current Behavior

- Electron app data uses `appData/automation-app`.
- The current schema creates `projects`, `project_environments`,
  document-shaped `workflows`, reusable `subflows`, queryable `runs` and
  `run_steps`, `workflow_schedules`, `workflow_schedule_events`, and
  `operational_attention_events`.
- A default project named `Main` and initial browser profile are created for
  existing local data. Workflows store `project_id` and selected
  `environment_id`; subflows and compatibility project-environment/profile rows
  store `project_id`.
- Product-facing project creation writes the project row, default project
  browser-profile row, and a normal draft workflow named `Main` in one
  transaction.
- Project rename updates the `projects` row. Product-facing project deletion
  deletes workflows for that project before deleting the project row so workflow
  run/schedule/attention cascades apply and no projectless workflow rows are
  left behind; subflows and project-environment/profile rows cascade from the
  project row. Product-facing project duplication creates a new project, copies
  project environments, subflows, and workflows, remaps copied workflow Call
  Subflow references to copied subflows, and stores regenerated storage values
  for copied browser profiles.
- `runs.source` stores durable run provenance as `manual` or `schedule`.
  Existing local rows are migrated by marking rows referenced by started
  schedule events as `schedule`; all other legacy rows become `manual`.
- Database initialization idempotently creates indexes for the core lookup paths:
  `runs(workflow_id, started_at DESC)`,
  `runs(source, started_at DESC)`,
  `run_steps(run_id, step_number)`,
  `workflow_schedules(enabled, next_run_at)`,
  `workflow_schedule_events(schedule_id, created_at DESC)`, and
  `workflow_schedule_events(workflow_id, created_at DESC)`,
  `operational_attention_events(created_at DESC)`, and
  `operational_attention_events(workflow_id, created_at DESC)`, plus project
  lookup indexes for project environments, workflows, and subflows.
- `listWorkflows` returns workflow summaries used by the workflow list.
- Summaries sort by `updated_at DESC`, then name ascending.
- `getWorkflow` returns workflow metadata; product graph authoring data is loaded from `getWorkflowGraph`.
- New workflows create a `Start -> New node` draft workflow graph with an unconfigured action node saved as `config: null`.
- Workflow graph authoring data is stored in `workflows.graph_json`.
- Workflow Settings are stored in `workflows.settings_json`.
- Subflow graph authoring data is stored in `subflows.graph_json`.
- Updating subflow metadata, such as the name changed through Subflow Settings,
  updates the `subflows` row and touches `updated_at` without rewriting the
  graph JSON.
- Browser profiles are stored in `project_environments.browser_launch_json`.
  Workflows point at the selected profile through `workflows.environment_id`, and
  `getWorkflowSettings` overlays Browser Launch values from that profile for run
  resolution. Legacy workflow Browser Launch saves are written back to the
  selected profile so older command callers stay consistent with profile-owned
  runtime identity. Project Settings can create, rename, and delete profile rows;
  profile deletion removes the local browser profile directory after checking
  workflow usage.
- Workflows without saved settings return lazy defaults based on workflow metadata.
- Saving Workflow Settings touches the parent workflow `updated_at`; saving General also updates the workflow name used by summaries.
- Saving graph JSON touches the parent workflow `updated_at`.
- Workflow package import validates selected flow/settings and referenced
  packaged subflows before creating a workflow. It writes the target-project
  workflow, recreated subflows, remapped workflow graph, settings, and a private
  imported project-environment/session row when Browser Launch is selected
  inside one SQLite transaction. Failed validation or save errors roll back the
  whole import.
- Legacy workflow import writes the new workflow and optional imported settings
  inside one SQLite transaction. Failed settings validation or save errors roll
  back the new workflow row.
- Project package import validates packaged sessions, subflows, workflows,
  graphs, and Workflow Settings before persistence. It writes the imported
  project row, recreated project-environment/session rows with fresh browser
  identities/profiles, recreated subflows, workflows, remapped workflow graphs,
  and settings inside one SQLite transaction. Failed validation or save errors
  roll back the whole import. Project packages do not persist or restore runs,
  evidence, schedules, app settings, or browser profile storage.
- Run evidence outputs store app-local artifact paths under run-scoped evidence directories; run rows persist the resulting output JSON and step error/trace JSON for audit. `run_steps` keeps the existing top-level compiled graph rows and appends executed nested action trace rows with parent control node id and sequence metadata inside `trace_json`, allowing branch, loop, and retry paths to be reconstructed from durable storage.
- Schedule rows store schedule config JSON, enabled state, next run time, and the latest schedule event summary.
- Schedule event rows store scheduling decisions such as started, skipped, missed, failed-to-start, and disabled. Skipped/missed events exist even when no run row is created. Schedule event history by schedule id or workflow id uses descending created-time indexes.
- Operational attention rows store sanitized manual full-run launch blocks that happen before a run row exists. They keep workflow references and concise issue summaries, not browser storage, cookies, proxy credentials, or raw page outputs.
- Deleting a workflow cascades to its schedules, schedule events, and operational attention events.
- `OperationsRepository` owns bounded Overview SQL reads for run metrics,
  attention, upcoming schedules, and metadata-only evidence extracted from
  sanitized run outputs. The renderer supplies local-day UTC boundaries, the
  backend rejects Overview ranges over 48 hours before hourly bucket allocation,
  and persisted timestamps remain UTC. Overview recent evidence is bounded at
  the returned DTO page, not by a fixed newest-run scan window that can hide
  older matching evidence behind newer output-only runs.

- `IdentityRepository` derives managed identity run/evidence summaries by
  matching workflow id plus persisted identity snapshots and counting only
  valid run-scoped evidence metadata. Historical identity lookup scans matching
  workflow runs before choosing a bounded detail so old rotated identity
  references are not hidden behind newer runs; matched run rows provide the
  workflow context for historical details.
- Legacy ordered-step tables are intentionally not migrated into the new Electron data format.

## Belongs Here

- SQL queries.
- Migrations.
- Timestamp updates.
- Order index integrity.
- Serialization/deserialization of stored action config JSON.
- Serialization/deserialization of stored workflow graph JSON.
- Persistence of Workflow Settings rows.
- Persistence of project rows, browser profile rows, compatibility
  project-environment rows, and subflow rows.
- Persistence of workflow schedule rows and schedule event rows.
- Persistence of operational attention rows and bounded operations read queries.
- Persistence of durable run source.

## Does Not Belong Here

- UI selection state.
- Runner execution.
- Domain validation rules before persistence.

## Change Checklist

- Add a migration for schema changes.
- Update repository tests.
- Consider import/export contract changes.
- Preserve existing workflow deserialization unless intentionally resetting the local Electron data format.
