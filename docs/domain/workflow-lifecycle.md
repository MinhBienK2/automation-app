# Workflow Lifecycle

## State Machine

```
Create → Draft → [Edit Graph / Edit Settings] → Save → Validate → Compile → Run → Terminal
                                                                                ↓
                                                                         Stop (any time)
```

## Create

- `create_workflow`: validates non-blank name, assigns project + browser profile, creates `Start → New node` draft graph.
- `createProject`: transactionally creates project + initial browser profile + `Main` workflow.

## Edit

- Graph authoring through `WorkflowGraphEditor` (React Flow). Source of truth: persisted `WorkflowGraph`.
- Graph autosave (app-level setting, default on). Manual save disabled until content changes.
- Leaving detail with unsaved changes: save/discard/keep editing dialog.
- Workflow Settings: dialog-level save for dirty sections. Closing with unsaved edits: confirm dialog.

## Subflows

- Project-scoped reusable graph fragments, same DTO shape as workflows.
- CRUD: create, open, rename (Subflow Settings), save, duplicate, delete.
- Deletion blocked while referenced by workflows.
- No nested Call Subflow (MVP), no Launch Run.

## Run

- Full run pipeline: save visible graph + dirty settings → validate graph + settings → compile → launch runner.
- If save or validation fails, run does not start.
- Blocked launch attempt → one `launch_blocked` attention item on Overview. Manual Validate alone does not.
- List Run: executes saved state without opening detail.
- Run from selected: retained-session debug command, requires persistent profile + `retain` retention.
- Concurrent runs: OK if different persistent profiles. Same-workflow/profile/batch conflicts rejected.
- Batch: globally exclusive, sequential rows, `concurrency_limit > 1` rejected until isolated sessions ready.

## Schedule

- Scheduler runs while Electron app is active. Missed = skipped + recorded.
- Skip reasons: `active_workflow`, `active_profile`, `active_batch`. One-time disabled after skip.
- Enabling validates schedule config + saved workflow readiness.
- Scheduled runs use saved graph + settings at fire time (not drafts).

## Stop

- `stop_run(runId)`: cancels targeted run, returns stopped snapshot immediately.
- Omitting `runId`: accepted only when one active run exists.

## Delete

- In-app confirmation with profile-data choice (delete checked by default).
- Rejected while: active run, active profile, retained session.
- Profile deletion removes only unshared inactive directories.

## Package Export/Import

- **Export**: Flow + selected Settings sections + referenced subflows. Native Save dialog. Sanitizes proxy password, URL credentials, font dirs.
- **Import**: validates → creates new workflow in target project → recreates subflows → remaps ids. Browser Launch import creates private profile. Never overwrites existing.

## Project Import

- Creates `<name> (imported)` project with fresh identities. No runs/evidence/schedules/storage.

## Invariants

- Graph saved before run; settings saved before run.
- Run status must not mislead after success/failure/stop.
- Invalid drafts can be saved but block run validation.
- Command errors: `{ message, field? }`.
