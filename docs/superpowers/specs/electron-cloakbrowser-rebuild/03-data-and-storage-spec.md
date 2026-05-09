# Data And Storage Spec

## Purpose

Define the new local storage model for the Electron/CloakBrowser rebuild.
Storage must support feature parity, structured run events, artifacts, evidence,
profile reuse, and future schema evolution without migrating old Tauri/Rust
data.

## In Scope

- New SQLite schema ownership.
- Versioned graph JSON.
- Run events and artifacts.
- Evidence records.
- Identity profiles and run profiles.
- Environment and variable storage.
- Secret reference strategy.
- Import/export data boundaries.

## Out Of Scope

- Migration from the old SQLite database.
- Exact ORM choice.
- Cloud sync.
- Multi-user collaboration.
- Secret vault implementation beyond local references.

## Product Concepts

Storage persists:

- Workspace metadata.
- Workflows.
- Workflow graph versions.
- Run profiles.
- Identity profiles.
- Environments.
- Runs.
- Run events.
- Artifacts.
- Evidence.
- App preferences and workspace policy.

## Technical Design

### Storage Engine

Use SQLite as the local durable database. Main process owns the database
connection and exposes storage through services. Renderer and runner never write
directly to SQLite.

The implementation may use `better-sqlite3`, Kysely, Drizzle, or a thin typed
repository layer. The spec requires typed queries and migration discipline, not
a specific library.

### File Layout

```text
app-data/
  workspace.db
  artifacts/
    runs/<run_id>/
      screenshots/
      downloads/
      traces/
      evidence/
  browser-profiles/
    <identity_profile_id or profile_slug>/
  logs/
```

SQLite stores artifact metadata and relative paths. Large payloads stay on disk.

### Schema Groups

Core tables:

- `workspaces`
- `app_preferences`
- `workspace_policies`
- `workflows`
- `workflow_graph_versions`
- `run_profiles`
- `identity_profiles`
- `environments`
- `runs`
- `run_events`
- `artifacts`
- `evidence_records`

Optional support tables:

- `workflow_exports`
- `secret_references`
- `profile_inventory`
- `schema_migrations`

### Versioning

Graph JSON and config JSON must carry explicit versions:

```json
{
  "schema_version": 1,
  "nodes": [],
  "edges": [],
  "viewport": {}
}
```

Migrations should be append-only scripts. No implementation should silently
reinterpret unknown graph/config versions.

### Soft Delete

Workflows, profiles, and runs may use soft delete for recoverability. Artifacts
can be garbage-collected by retention policy only after metadata state permits
cleanup.

### Import/Export

Export packages may include workflow, graph, run profile, environment, selected
identity profile metadata, and sanitized evidence. Exports must not include raw
proxy passwords, raw secrets, or browser profile storage by default.

Imports create new ids. They do not overwrite existing workflows unless a future
spec explicitly adds conflict handling.

## Interfaces / Contracts

Repository/service boundaries:

- `WorkflowRepository`
- `GraphRepository`
- `ProfileRepository`
- `EnvironmentRepository`
- `RunRepository`
- `ArtifactRepository`
- `EvidenceRepository`
- `PolicyRepository`

Main process services expose typed operations over IPC. Runner emits events and
artifact metadata; main persists them.

## Data Model

### Workflows

Fields:

- id
- name
- description
- tags JSON
- notes
- default run profile id
- default identity profile id
- default environment id
- created at
- updated at
- deleted at

### Workflow Graph Versions

Fields:

- id
- workflow id
- schema version
- graph JSON
- created at
- created by source such as user save, autosave, import
- active flag

Only one active graph version should exist per workflow.

### Run Profiles

Fields:

- id
- workflow id or workspace scope
- name
- timeout policy JSON
- retry policy JSON
- retention policy JSON
- concurrency policy JSON
- evidence policy JSON
- created at
- updated at

### Identity Profiles

Fields:

- id
- name
- description
- browser engine
- persistent profile slug/path
- device/browser identity JSON
- locale/timezone/geolocation JSON
- proxy reference JSON
- headed/headless policy
- preflight policy JSON
- created at
- updated at

### Environments

Fields:

- id
- name
- permissions JSON
- headers JSON
- cookies JSON or artifact reference
- local storage JSON or artifact reference
- session storage JSON or artifact reference
- download policy JSON
- initial variables JSON
- created at
- updated at

### Runs

Fields:

- id
- workflow id
- graph version id
- run profile snapshot JSON
- identity profile snapshot JSON
- environment snapshot JSON
- status
- started at
- ended at
- terminal reason
- operator id or local operator label

Snapshots preserve reproducibility even after profiles are edited.

### Run Events

Fields:

- id
- run id
- sequence
- event type
- severity
- node id
- action id
- payload JSON
- created at

Sequence must be monotonic per run.

### Artifacts

Fields:

- id
- run id
- event id nullable
- type
- relative path
- mime type
- size bytes
- checksum
- sanitized flag
- created at

### Evidence Records

Fields:

- id
- run id
- evidence type
- payload JSON
- sanitized payload JSON nullable
- exportable flag
- created at

## Error Handling

- Schema version mismatch blocks load with clear error.
- Database write failure fails the command or run event persistence operation.
- Artifact write failure creates a run issue and may fail the run depending on
  evidence policy.
- Import validation errors report file, section, and field.
- Retention cleanup must be best-effort and logged without corrupting run data.

## Security / Safety / Audit

- Store secrets by reference where possible.
- Raw proxy passwords must not appear in evidence or export packages.
- Identity snapshots should include proxy label/region, not credentials.
- Evidence export uses sanitized payloads by default.
- Artifact paths must stay inside app-controlled directories unless operator
  explicitly chooses export destination.

## Testing

Tests must cover:

- Fresh database initialization.
- Migration ordering.
- CRUD for workflows, graph versions, profiles, environments, runs, events,
  artifacts, and evidence.
- Run event sequence ordering.
- Export sanitization.
- Import creates new ids.
- Artifact path traversal rejection.

## Acceptance Criteria

- New SQLite schema initializes from empty app data.
- Old database migration is not required.
- Workflow and active graph can be saved and loaded.
- Run events and artifacts can be appended during execution.
- Evidence records preserve sanitized export payloads.
- Import/export boundaries exclude raw secrets by default.

## Dependencies

- Product Model Spec.
- Electron App Architecture Spec.

## Open Questions

None blocking. ORM/library selection is an implementation planning decision.
