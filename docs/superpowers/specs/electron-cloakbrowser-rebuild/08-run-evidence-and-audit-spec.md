# Run Evidence And Audit Spec

## Purpose

Define run evidence, audit records, artifacts, traces, and export sanitization
for the Electron/CloakBrowser rebuild.

Evidence is a core product requirement because the app is used for authorized
testing of owned production and staging defenses.

## In Scope

- Run event taxonomy.
- Evidence record types.
- Artifact metadata.
- Action traces.
- Preflight verdict evidence.
- Export sanitization.
- Operator audit trail.
- Retention expectations.

## Out Of Scope

- Full report designer.
- Cloud reporting.
- SIEM integration.
- Long-term archive service.
- Raw browser profile export by default.

## Product Concepts

Evidence proves:

- what workflow ran;
- which graph version ran;
- which identity profile and run profile were used;
- which owned target/domain was touched;
- which actions executed and how;
- what artifacts were produced;
- what production fingerprint/preflight verdict was observed;
- why a run passed, failed, stopped, or was blocked.

## Technical Design

### Run Event Taxonomy

Event groups:

- lifecycle: run started/completed/failed/cancelled;
- graph: node started/completed/failed;
- action: action trace, retry, timeout;
- artifact: screenshot/download/trace/video/log created;
- issue: validation/runtime/policy/system issue;
- identity: profile resolved, profile lock acquired/released;
- preflight: started/verdict/passed/failed;
- operator: manual approval, stop, export.

### Action Trace

Minimum trace fields:

- run id;
- node id;
- action id/type;
- action mode;
- locator summary;
- fallback used;
- started at;
- completed at;
- duration;
- retry attempt;
- error summary;
- artifact ids;
- timing metadata where relevant.

### Evidence Records

Evidence records are compact JSON objects. They reference artifacts but do not
embed large payloads.

Evidence types:

- `run_summary`;
- `identity_snapshot`;
- `preflight_verdict`;
- `action_trace_summary`;
- `domain_policy`;
- `operator_action`;
- `terminal_outcome`;
- `export_manifest`.

### Artifacts

Artifacts are file-backed. Metadata includes type, path, mime type, checksum,
size, related event id, and sanitized/exportable flag.

### Export

Default export includes:

- run summary;
- graph and profile snapshots;
- event timeline;
- sanitized evidence records;
- selected screenshots/traces/download metadata;
- export manifest.

Default export excludes:

- raw proxy passwords;
- raw secrets;
- full browser profile directories;
- cookies/storage unless explicitly selected and sanitized;
- unrelated app logs.

## Interfaces / Contracts

Evidence service operations:

- `evidence.getRunSummary(runId)`
- `evidence.listEvents(runId)`
- `evidence.listArtifacts(runId)`
- `evidence.exportRun(runId, options)`
- `evidence.sanitize(payload)`

Runner events feed evidence records through main process. Renderer only reads
persisted event/evidence views.

## Data Model

Storage tables:

- `run_events`
- `artifacts`
- `evidence_records`

Every evidence record has:

- run id;
- evidence type;
- payload;
- sanitized payload;
- exportable flag;
- created at.

Every artifact has:

- run id;
- type;
- relative path;
- mime type;
- checksum;
- size;
- sanitized/exportable flag.

## Error Handling

- Evidence write failure creates system issue and may fail run if evidence
  policy requires strict evidence.
- Artifact write failure creates issue and follows run profile policy.
- Export failure reports section and artifact that failed.
- Sanitizer failure blocks export rather than leaking raw payload.

## Security / Safety / Audit

- Evidence is scoped to owned or authorized targets.
- Raw secrets are never exported by default.
- Operator actions such as stop, approval, and export should be recorded.
- Evidence should contain enough context for internal teams without exposing
  unnecessary account/session data.
- Manual checkpoints are recorded as operator handoff events.

## Testing

Tests must cover:

- event persistence ordering;
- action trace creation;
- artifact metadata registration;
- preflight evidence storage;
- export sanitizer removes credentials/secrets;
- strict evidence policy behavior on artifact failure;
- event timeline rendering data shape.

## Acceptance Criteria

- Runs produce durable event timelines.
- Artifacts are registered with metadata and file paths.
- Evidence records can be exported in sanitized form.
- Preflight verdicts are stored as evidence.
- Operator actions are auditable.
- Export never includes raw secrets by default.

## Dependencies

- Product Model Spec.
- Data And Storage Spec.
- CloakRunner Spec.
- Identity Profile And Fingerprint Preflight Spec.

## Open Questions

None blocking. External reporting integrations can be specified after local
evidence reaches parity.
