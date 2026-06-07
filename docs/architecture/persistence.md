# Persistence Architecture

## Purpose

Persistence stores projects, project saved-session rows (in the compatibility
`project_environments` table), workflows, reusable subflows,
versioned workflow graph authoring data, per-workflow settings, schedules,
schedule events, runs, run steps, and operational attention events in SQLite.
Electron/Node now owns the production persistence layer.

## Key Files

- Electron SQLite bootstrap: `electron/backend/persistence/database.ts`
- Electron workflow repository: `electron/backend/persistence/workflowRepository.ts`
- Electron schedule repository: `electron/backend/scheduling/workflowScheduleRepository.ts`
- Electron operations read model: `electron/backend/operations/operationsRepository.ts`
- Electron evidence read model: `electron/backend/evidence/evidenceRepository.ts`
- Electron command handlers: `electron/backend/commands.ts`

## Current Behavior

- Electron app data uses `appData/automation-app`.
- The current schema creates `projects`, `project_environments`,
  document-shaped `workflows`, reusable `subflows`, queryable `runs` and
  `run_steps`, `workflow_schedules`, `workflow_schedule_events`, and
  `operational_attention_events`.
- A default project named `Main` and default project saved session are created
  for existing local data. Workflows store `project_id` and selected
  `environment_id`; subflows and compatibility project-environment/session rows
  store `project_id`.
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
- Project saved-session and private workflow-session Browser Launch settings
  are stored in `project_environments.browser_launch_json`. Project Settings can
  edit the saved fingerprint seed or ask the backend to regenerate the
  environment identity/profile/seed in that JSON payload; confirmed regeneration
  also removes the old unshared local project profile directory from
  `browser-profiles`.
- Workflows without saved settings return lazy defaults based on workflow metadata.
- Saving Workflow Settings touches the parent workflow `updated_at`; saving General also updates the workflow name used by summaries.
- Saving graph JSON touches the parent workflow `updated_at`.
- Workflow package import validates selected flow/settings and referenced
  subflows before creating a workflow. It writes recreated subflows, remapped
  workflow graph, and settings inside one SQLite transaction. Failed validation
  or save errors roll back the whole import.
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
- `EvidenceRepository` owns bounded evidence result pages over matching
  persisted run outputs and run steps without a fixed newest-run ceiling before
  filtering. It derives typed evidence items on read rather than maintaining a
  separate projection table, and validates run-scoped artifact paths before
  preview/reveal/export.
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
- Persistence of project rows, project saved-session rows, compatibility
  project-environment rows, and subflow rows.
- Persistence of workflow schedule rows and schedule event rows.
- Persistence of operational attention rows and bounded operations read queries.
- Persistence of durable run source and bounded evidence read queries.

## Does Not Belong Here

- UI selection state.
- Runner execution.
- Domain validation rules before persistence.

## Change Checklist

- Add a migration for schema changes.
- Update repository tests.
- Consider import/export contract changes.
- Preserve existing workflow deserialization unless intentionally resetting the local Electron data format.
