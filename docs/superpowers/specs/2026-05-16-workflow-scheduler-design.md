# Workflow Scheduler Design

## Status

Approved for implementation planning on 2026-05-16.

## Goal

Add an in-app scheduler that can automatically start saved workflows while the Electron app is open. The feature must support multiple schedules per workflow, preserve auditability, and use the existing backend run path so scheduled runs behave like manual workflow runs.

## Non-Goals

- Running schedules while the Electron app is closed.
- OS-level wake timers, background daemons, or system scheduler integration.
- Raw cron expression editing.
- Per-schedule timezone selection.
- Queueing missed or blocked runs.
- Running unsaved workflow detail drafts.

## Product Behavior

The scheduler runs only while the Electron app process is active. If the app is closed, or the process is suspended and later resumes after a due time has passed, the scheduler skips that missed occurrence, records an event, and waits for the next occurrence.

Each workflow can have multiple active schedules. Every scheduled run uses the latest saved workflow graph and saved Workflow Settings at the time the schedule fires. If a workflow detail page has unsaved graph or settings edits, those drafts are not part of the scheduled run.

If a schedule fires while any normal workflow run or batch run already owns the active-run lock, the scheduler skips that occurrence and records `skipped` with reason `active_run`. It does not queue the run. For one-time schedules, a skipped or failed fire disables the schedule because the scheduled opportunity has passed.

If the workflow graph or Workflow Settings are invalid when the schedule fires, the scheduler does not launch a browser. It records `failed_to_start` with validation details, computes the next occurrence, and continues processing other due schedules.

## Schedule Types

The MVP supports three schedule families:

- `once_at`: run once at a specific timestamp.
- `interval`: run repeatedly every configured number of seconds.
- `calendar`: run through friendly presets rather than raw cron.

Calendar presets:

- Daily at a local time.
- Weekly on selected weekdays at a local time.
- Monthly on a selected day of month at a local time.

All schedule calculation uses the app/system timezone. Stored `next_run_at` and event timestamps use ISO UTC strings. The UI displays them in local time.

Monthly day handling: if a configured day does not exist in a given month, that month is skipped without recording a missed event. The next valid month becomes the next occurrence.

## Data Model

Add `workflow_schedules`:

```text
id TEXT PRIMARY KEY
workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE
name TEXT NOT NULL
enabled INTEGER NOT NULL
kind_json TEXT NOT NULL
next_run_at TEXT
last_event_at TEXT
last_status TEXT
last_reason TEXT
created_at TEXT NOT NULL
updated_at TEXT NOT NULL
```

`kind_json` stores one of:

```json
{ "type": "once_at", "timestamp": "2026-05-16T15:30:00.000Z" }
{ "type": "interval", "every_seconds": 1800 }
{ "type": "calendar", "preset": "daily", "time": "09:00" }
{ "type": "calendar", "preset": "weekly", "weekdays": [1, 2, 3, 4, 5], "time": "09:00" }
{ "type": "calendar", "preset": "monthly", "day": 15, "time": "09:00" }
```

Add `workflow_schedule_events`:

```text
id TEXT PRIMARY KEY
schedule_id TEXT NOT NULL REFERENCES workflow_schedules(id) ON DELETE CASCADE
workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE
event_type TEXT NOT NULL
run_id TEXT
scheduled_for TEXT NOT NULL
created_at TEXT NOT NULL
reason TEXT
details_json TEXT
```

Supported event types:

- `started`
- `skipped`
- `missed`
- `failed_to_start`
- `disabled`

Runs that actually start continue to use the existing `runs` and `run_steps` tables for execution history and evidence. Schedule events are the audit layer for scheduling decisions, including skipped and missed occurrences that never create a run row.

## Backend Design

Add a schedule repository focused on schedule and event persistence. It may be a new `WorkflowScheduleRepository` or a clearly separated part of the existing workflow repository, but SQL ownership should remain backend-only.

Add a scheduler engine in the Electron backend. React must not own timers or direct scheduling. The engine starts during the Electron backend lifecycle, loads enabled schedules, periodically scans for `next_run_at <= now`, processes due schedules in chronological order, and updates `next_run_at` after each event.

Due schedule processing:

1. Load the schedule and due `scheduled_for`.
2. If the occurrence is outside the accepted active processing window because the app was closed or suspended, record `missed`, compute the next occurrence, and do not run.
3. If an active run exists, record `skipped` with reason `active_run`, compute the next occurrence, and disable one-time schedules.
4. Validate the saved workflow graph and saved Workflow Settings using the same rules as manual run validation.
5. If validation has blocking errors, record `failed_to_start`, include validation details, compute the next occurrence, and disable one-time schedules.
6. Start the workflow through the same backend path as `runWorkflow`.
7. Record `started` with `run_id` when available.
8. Compute the next occurrence, or disable a one-time schedule after it fires.

The current public `RunState` does not expose `run_id`. For schedule audit quality, implementation should expose the run id to the internal scheduler start path. The public renderer `RunState` contract can remain unchanged unless a UI requirement later needs run links.

The scheduler engine must isolate failures. A malformed schedule or one workflow validation failure must create a schedule event and must not crash the app or prevent other due schedules from processing.

## IPC Contract

Add renderer-facing commands:

- `listSchedules()`
- `getSchedule(scheduleId)`
- `createSchedule(input)`
- `updateSchedule(scheduleId, patch)`
- `deleteSchedule(scheduleId)`
- `enableSchedule(scheduleId)`
- `disableSchedule(scheduleId)`
- `listScheduleEvents(filter)`
- `validateSchedule(input)`

Command errors continue to serialize as `{ message, field? }`.

`enableSchedule` must validate both the schedule config and the current saved workflow run readiness. Draft schedules can be saved while disabled, but an enabled schedule must point at a workflow that currently passes run validation.

## UI Design

Add a sidebar page named `Schedules`.

The page shows a schedule table with:

- Enabled state.
- Schedule name.
- Workflow name.
- Human-readable schedule summary.
- Next run time.
- Last status.
- Last reason.
- Row actions for enable or disable, edit, delete, and history.

The page header exposes `New schedule`.

The create/edit dialog contains:

- Workflow selector.
- Schedule name.
- Schedule kind selector: Once, Interval, Calendar.
- Kind-specific controls.
- Enabled toggle.

Kind-specific controls:

- Once: local date and time.
- Interval: number plus unit of minutes, hours, or days.
- Calendar daily: local time.
- Calendar weekly: weekday toggles plus local time.
- Calendar monthly: day of month plus local time.

If the operator enables a schedule and workflow validation fails, the dialog shows readable graph/settings issues and keeps the schedule disabled.

The page or row history view shows recent events with event type, scheduled time, actual event time, reason, and details. `started` events can display a run reference when available; linking to a full run detail page can be a later enhancement if no run history UI exists yet.

The UI should state briefly that scheduled runs use the latest saved workflow. It should not imply unsaved detail-page drafts will be executed.

## Validation Rules

- Schedule name is required.
- Workflow id is required and must exist.
- `once_at` timestamp must be in the future when enabling.
- `interval.every_seconds` must be at least 60.
- Daily calendar schedules require a valid `HH:mm` local time.
- Weekly calendar schedules require at least one weekday and a valid `HH:mm` local time.
- Monthly calendar schedules require day `1` through `31` and a valid `HH:mm` local time.
- Enabling a schedule requires saved workflow graph and settings validation to pass.

## Testing Strategy

Add focused tests for:

- Schedule calculation for once, interval, daily, weekly, and monthly schedules.
- Monthly invalid-day behavior across short months.
- Repository CRUD for schedules.
- Repository event creation and workflow cascade delete.
- Commands for create, update, enable, disable, delete, validation errors, and workflow readiness checks.
- Scheduler engine with fake clock and fake runner:
  - due schedule starts a run;
  - active run records `skipped`;
  - missed occurrence records `missed`;
  - invalid workflow records `failed_to_start`;
  - one-time schedule disables after fired, skipped, or failed.
- UI list rendering, create/edit validation, enable failure display, and history rendering.

Expected checks during implementation:

- Focused Vitest commands for touched frontend and backend tests.
- `npx tsc --noEmit` when renderer types change.
- `npm run build:electron` when Electron backend or preload types change.

## Documentation Updates During Implementation

Implementation must update current source-of-truth docs when behavior and contracts change:

- `docs/domain/product-model.md`
- `docs/domain/workflow-lifecycle.md`
- `docs/domain/user-visible-invariants.md`
- `docs/architecture/overview.md`
- `docs/architecture/persistence.md`
- `docs/architecture/command-boundary.md` if IPC boundary behavior changes
- `docs/contracts/electron-ipc.md`
- `docs/contracts/run-state.md` only if the public run-state shape changes
- `docs/task-routes.md` to route future scheduler work

`README.md` smoke checklist should be updated only if it gains user-facing scheduler smoke steps.
