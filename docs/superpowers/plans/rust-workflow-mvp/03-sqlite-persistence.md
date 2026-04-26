# Plan 03 - SQLite Persistence

## Goal

Persist workflows and steps locally with SQLite and migrations.

This plan has no UI and no browser runner.

## Scope

Create:

- Database connection setup.
- SQLx migration runner.
- Initial migration.
- Workflow repository.
- Repository tests with temporary SQLite databases.

## Migration 001

Create:

```sql
CREATE TABLE workflows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE workflow_steps (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  type TEXT NOT NULL,
  config_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
);

CREATE INDEX idx_workflow_steps_workflow_id
  ON workflow_steps(workflow_id);

CREATE UNIQUE INDEX idx_workflow_steps_order
  ON workflow_steps(workflow_id, order_index);
```

## Repository Operations

Implement:

- List workflows with step count.
- Create workflow.
- Get workflow with ordered steps.
- Rename workflow.
- Delete workflow.
- Add step to end.
- Update step.
- Delete step and compact order indexes.
- Reorder steps in one transaction.

## DONE Gate

This plan is DONE when:

- Migrations run at startup or through a callable init path.
- Repository tests use temporary SQLite.
- Create/list/get/update/delete workflow works.
- Add/update/delete/reorder steps works.
- Deleting a workflow deletes its steps.
- Step order is compact after deleting a step.
- Step config round-trips through `config_json`.
- `cargo test` passes.

## Checks

```text
cargo test
cargo fmt --check
cargo clippy --all-targets --all-features
```

## Stop Rule

Stop after persistence tests pass. Do not add Tauri commands or UI in this plan.
