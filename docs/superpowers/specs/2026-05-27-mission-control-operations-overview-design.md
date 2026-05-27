# Mission Control Operations Overview Design

Date: 2026-05-27

## Status

Approved design for a written specification on 2026-05-27.

This is specification 2 of the Mission Control production adoption program. It
is ready for user review before the remaining program specifications are
written. Per the approved program gate, no implementation planning or
production code changes begin until all program specifications are written and
approved.

## Goal

Add `Overview` as the default Mission Control workspace: a durable operational
dashboard that remains meaningful after the desktop app restarts.

The completed feature must:

- Make live work, successful runs, attention items, evidence production, and
  scheduled activity immediately scannable.
- Combine current active run snapshots with persisted run, evidence, and
  schedule history instead of presenting only the current app session.
- Record a durable attention event when a real manual full-run launch attempt,
  from Graph Builder or the existing workflow-list Run action, is blocked by
  graph or workflow-settings validation before browser launch.
- Provide backend-owned operational aggregation and typed IPC rather than
  calculating KPI meaning ad hoc in renderer components.
- Establish a stable run/evidence/reference read boundary that later
  `Evidence Explorer` and `Identity Lab` specifications can extend without
  prematurely exposing those workspaces.

## Program Position

The Mission Control program is specified in this order:

| Sequence | Specification | Boundary |
| --- | --- | --- |
| 1 | Mission Control Foundation And Existing Workspace Adoption | Production design system, shell, current workspaces, and Graph Builder overlays. |
| 2 | Operations Overview | Durable operations dashboard and initial read-model boundary. |
| 3 | Evidence Explorer | Standalone evidence investigation and artifact interactions. |
| 4 | Identity Lab | Standalone identity/session posture and diagnostics workspace. |
| 5 | Cross-Workspace Traceability And Polish | Final deep links, navigation consistency, compact behavior, and suite parity. |

This specification assumes the Mission Control visual system and existing
workspace adoption from specification 1. It does not authorize implementation
by itself; all five specifications are reviewed before planning and delivery.

## Existing Product Boundary

Current production code already provides:

| Source | Available Capability |
| --- | --- |
| `listRunStates()` / `RunManager` | Current app-session active and terminal run snapshots. |
| SQLite `runs` | Durable run status, start/finish timestamps, settings/graph snapshots, outputs, and errors. |
| SQLite `run_steps` | Durable step/action trace/error rows including nested executed action traces. |
| `listSchedules()` | Current schedule list and upcoming next-run metadata. |
| `listScheduleEvents()` / `workflow_schedule_events` | Durable started, skipped, missed, failed-to-start, and disabled schedule decisions. |
| Persisted run outputs | Sanitized `browser_identity`, `__action_traces`, `__evidence`, and `__evidence_model` where generated. |

Current production code does not provide:

- A renderer-facing query for persisted run history or durable evidence
  summaries.
- A durable record of a manual full-run request that validation blocks before
  a run row exists.
- An Overview route/page, durable operational aggregate, or KPI contract.

## Chosen Approach

Use **Operational Read Model + Dashboard Page**.

The Electron backend owns an operations read-model service/repository boundary
and returns a bounded, typed Overview DTO over IPC. The read model merges
persisted history, schedule decisions, new launch-block attention events, and
current active snapshots. The renderer owns display, filters, refresh and
navigation, but does not define operational metrics or dedupe rules.

This approach was selected over:

| Alternative | Reason Not Chosen |
| --- | --- |
| Dashboard-specific card aggregate with no reusable references | Ships the page quickly but forces later evidence/identity work to duplicate query semantics. |
| Generic history endpoints aggregated entirely in the renderer | Spreads KPI/attention definitions across UI code and makes auditing, limits, timezone boundaries, and dedupe rules harder to test. |
| Current-session dashboard only | Loses operational meaning after restart and does not support the approved Mission Control purpose. |

## Scope

### Included

- New `Overview` route/page in the Mission Control shell.
- `Overview` as the application default entry point after this phase is
  implemented.
- Sidebar navigation order: `Overview`, `Workflows`, `Runs`, `Schedules`,
  `Settings`.
- A backend operations read-model boundary and typed IPC request/response
  contract for durable dashboard content.
- Bounded durable queries over existing workflow, run, run-step, schedule,
  schedule-event, and sanitized evidence data.
- Durable operational-attention storage for manual full-run launch requests
  blocked before a run starts.
- Aggregation of run failures and schedule attention records into the
  read-only attention feed without duplicate presentation.
- Overview KPI, live runs, attention feed, execution activity, recent evidence
  metadata and upcoming schedules regions.
- Working navigation from Overview items to existing `Workflows`/Graph
  Builder, `Runs`, and `Schedules` destinations.
- A minimal durable run-detail receiver in `Runs` so a persisted run or
  evidence reference from Overview remains navigable after app restart.
- Local-day handling for `Today` metrics using the operator machine's local
  timezone while persisted timestamps remain ISO UTC.

### Excluded

- Standalone `Evidence` route, artifact detail drawer, artifact file opening,
  arbitrary output viewing, or evidence investigation workflow.
- Standalone `Identities` route, aggregated identity posture, or new identity
  controls.
- Attention acknowledgement, resolve, assignment, comments, escalation,
  notification delivery, or incident workflow.
- Fast-run workflow/identity selection from Overview. The page primary command
  opens `Workflows`; full run confirmation remains in Graph Builder.
- New execution rules, validation rules, scheduling semantics, graph node
  behavior, challenge handling, or runner behavior.
- General-purpose historical run browsing or artifact investigation beyond the
  bounded linked-run receiver needed for Overview navigation.
- Reporting across multiple machines or centralized server aggregation.

## Navigation And Entry Point

Once Overview is implemented, the active sidebar includes:

| Order | Navigation Label | Destination |
| --- | --- | --- |
| 1 | Overview | Durable operations dashboard and default entry point. |
| 2 | Workflows | Existing workflow list and Graph Builder entry. |
| 3 | Runs | Existing run monitor, enhanced only as needed for navigation targets approved here. |
| 4 | Schedules | Existing schedule management and event history. |
| 5 | Settings | Existing app-level settings. |

`Evidence` and `Identities` remain absent from navigation until their own
approved specifications are implemented. Overview cards cannot act as hidden
substitutes for those future workspaces.

### Overview Primary Action

The primary page command is `Open Workflows`. Workflow creation remains in its
existing working destination. Overview does not expose `Launch Run`: launching
safely requires a selected workflow and the Graph Builder `Launch Run`
confirmation approved in specification 1.

## Operational Data Model

### Overview Request

The renderer calls one typed command, conceptually:

```text
getOperationsOverview({
  day_start_utc,
  day_end_utc,
  attention_filter?,
  limits?
}) -> OperationsOverview

getOperationalRunDetail(run_id) -> OperationalRunDetail
```

The renderer determines the operator's current local calendar day and sends
validated ISO UTC boundaries for that day. The backend validates those
boundaries, applies bounded limits, and owns all queries/aggregation inside
the range.

Sending explicit UTC boundaries makes the local-time meaning visible in tests
and handles timezone offset and daylight-saving transitions without storing
local timestamps in SQLite. The response includes the applied range so the UI
can label metrics accurately.

`getOperationalRunDetail` is a bounded read-only receiver for an existing
Overview navigation target. It returns workflow/run status and timing,
sanitized error/step trace summary and safe evidence metadata for one
persisted run. It does not return arbitrary raw outputs, open files, or
introduce an evidence investigation surface.

### Operations Overview Shape

The response is a page-oriented read model with reusable entity references:

```text
OperationsOverview {
  generated_at
  range: { day_start_utc, day_end_utc, timezone_label }
  metrics: OverviewMetrics
  live_runs: { items: OverviewLiveRun[], total, has_more }
  attention: { items: OverviewAttentionItem[], total, has_more }
  activity: OverviewActivityBucket[]
  recent_evidence: { items: OverviewEvidenceItem[], total, has_more }
  upcoming_schedules: { items: OverviewUpcomingSchedule[], total, has_more }
  data_warnings: { evidence_items_skipped }
}
```

Default visible limits are eight live-run rows, twelve attention items, twelve
recent evidence items and eight upcoming schedules. Each list response
includes enough total/has-more context for the UI to link to its relevant
existing destination rather than fetch unbounded data into the dashboard.
Backend validation caps each requested dashboard list at 50 items.

### Metrics

`OverviewMetrics` includes:

| Metric | Definition |
| --- | --- |
| `active_runs` | Count of active run snapshots currently owned by the running app process. |
| `succeeded_today` | Count of durable run rows with terminal success and `finished_at` in the applied local-day UTC range. |
| `attention_today` | Count of unified attention items in the applied range after correlation/deduplication. |
| `upcoming_schedules` | Count of enabled schedules with a non-null next occurrence; the visible list is separately bounded. |

An unavailable or failed query is not equivalent to zero. Aggregate command
failure returns an error to the page rather than producing reassuring zero KPI
values from partial data.

### Live Operations

`OverviewLiveRun` is sourced from active current-process snapshots because only
the running process can report current progress accurately:

```text
{
  run_id,
  workflow_id,
  workflow_name,
  source,
  status,
  current_step_id?,
  current_step_number?,
  started_at,
  identity_display_name: string | null,
  navigation_target
}
```

The identity label is read from the persisted run settings snapshot or current
normalized settings for the live run and is returned as a display string or a
null/unavailable value when malformed. It never exposes browser storage or
credentials.

### Execution Activity

`OverviewActivityBucket` is backend-aggregated into contiguous one-hour
intervals over the applied local-day UTC range:

```text
{
  bucket_start_utc,
  bucket_end_utc,
  succeeded,
  failed,
  blocked,
  schedule_attention
}
```

An ordinary local day therefore returns 24 buckets; timezone offset changes
can return 23 or 25 buckets. The renderer formats bucket labels in local time
and must distinguish a repeated clock hour when applicable. This is an
operational timeline, not a general analytics engine.

### Upcoming Schedules

`OverviewUpcomingSchedule` returns a bounded list of enabled upcoming
schedules:

```text
{
  schedule_id,
  workflow_id,
  workflow_name,
  schedule_name,
  next_run_at,
  last_status?,
  last_reason?,
  navigation_target
}
```

It uses existing schedule rules and does not invent additional calendar or
trigger behavior.

### Linked Durable Run Detail

Overview references to a persisted run navigate into `Runs`. Because current
`Runs` state is session-only, this specification adds a bounded selected-run
detail receiver backed by `getOperationalRunDetail(run_id)`:

```text
OperationalRunDetail {
  run_id
  workflow: { id, name }
  status
  started_at
  finished_at?
  sanitized_error_summary?
  step_summaries: bounded list
  evidence_metadata: bounded safe list
}
```

`Runs` continues to monitor live session snapshots as before. When reached
with a durable run focus target, it additionally loads and renders this one
selected run summary. It does not gain unbounded run-history browsing,
artifact preview/file opening, or evidence-export capabilities in this spec.
The selected detail response caps step summaries at 100 rows and evidence
metadata at 50 items, reporting truncation/has-more state where either cap is
reached.

## Operational Attention

### Purpose

Attention captures operational attempts or outcomes that require operator
review. The Overview queue is a read-only feed; it does not create incident
management lifecycle semantics.

### Sources

The unified feed includes:

| Source | Attention Types | Durable Record |
| --- | --- | --- |
| Manual full-run launch attempt blocked before run creation, whether started from confirmed Graph Builder launch or the existing workflow-list Run action | `launch_blocked` for blocking graph/settings validation | New `operational_attention_events` row. |
| Terminal failed run | `run_failed` | Existing `runs` row/error data. |
| Scheduled occurrence that cannot or should not execute for validation or conflict reasons | `schedule_failed_to_start`, `schedule_skipped` | Existing `workflow_schedule_events` row. |

Manual `Validate` actions in Graph Builder do not create attention records.
Only an actual manual full-run launch attempt that is blocked before a run
begins writes `launch_blocked`. In Graph Builder this means the operator has
confirmed the `Launch Run` dialog; the existing saved-workflow list Run action
also represents a manual launch attempt even though it does not require that
dialog.

Scheduled validation blocks already write `workflow_schedule_events` with
`failed_to_start`. They appear as schedule-sourced attention through that
existing durable record and must not also be written as a new
`operational_attention_events` row for the same occurrence.
`missed` schedule occurrences remain visible in Schedules history but are not
classified as Overview attention in this phase.

### Attention Persistence

Add `operational_attention_events` for operational events without an existing
durable row:

```text
id TEXT PRIMARY KEY
event_type TEXT NOT NULL               -- launch_blocked in this spec
source TEXT NOT NULL                   -- manual in this spec
workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE
created_at TEXT NOT NULL
severity TEXT NOT NULL
summary TEXT NOT NULL
details_json TEXT
```

This table stores sanitized issue summaries/details adequate to explain the
block and navigate to its workflow. It must not store proxy secrets, cookies,
storage, raw arbitrary page outputs, or sensitive unbounded error payloads.
Indexes support querying by creation time and workflow/time.

This specification writes new rows only for manual launch-block events, which
by definition have no run id or schedule id. Scheduled attention keeps using
its existing schedule-event audit source, while run failures keep using their
run rows; their references exist in the unified read DTO, not in this new
table.

### Attention Item DTO

The read model maps each feed item to:

```text
OverviewAttentionItem {
  id
  source_kind: "launch_blocked" | "run_failed" | "schedule_event"
  severity: "warning" | "failure"
  occurred_at
  title
  summary
  workflow: { id, name }
  run_id?
  schedule_id?
  schedule_event_type?
  navigation_target
}
```

The feed supports bounded filters for severity and source kind inside the
applied local-day range. It is sorted most recent first. Panel filters alter
the visible queue only; `attention_today` remains the unfiltered unified count
for the applied day.

### Correlation And Deduplication

- A manual launch block from Graph Builder or workflow-list Run has no run row
  and is represented once through its operational-attention row.
- A run that starts and later fails is represented once as `run_failed`; it
  does not also create a launch-block record.
- A scheduler validation block is represented once by its
  `failed_to_start` schedule event, even though the cause is validation.
- A schedule event that starts a run is not itself attention; if that resulting
  run fails, the failed run is the attention item.
- A skipped or failed-to-start schedule event remains attention even when no
  run id exists.
- A missed or disabled schedule event remains part of schedule history and is
  not counted as Overview attention in this phase.

These rules are backend-owned and covered by focused tests.

## Evidence Summary Boundary

### Recent Evidence

Overview includes a bounded, metadata-only list of recent generated artifacts
extracted from already persisted, sanitized run outputs:

```text
OverviewEvidenceItem {
  evidence_id
  artifact_kind
  relative_path_or_label
  created_at?
  run_id
  workflow: { id, name }
  node_id?
  navigation_targets: { run?, workflow? }
}
```

The read model uses structured `__evidence` metadata and the existing evidence
model. It does not return arbitrary output values, raw browser storage,
credentials, or unsanitized file-system access.

Because existing artifact metadata does not carry a standalone id,
`evidence_id` is deterministically derived from `run_id`, artifact kind and
the safe relative artifact path; it is an opaque UI/reference id and does not
change evidence file storage.

### Allowed Overview Actions

Before Evidence Explorer exists, Recent Evidence can:

- Display artifact type, safe path/label, timestamp where available, workflow
  and run relationships.
- Navigate to the related existing `Runs` or workflow detail destination when
  the application can represent that target. A run reference uses the bounded
  linked-run detail receiver specified above.

It cannot:

- Open a local artifact file.
- Preview screenshot contents.
- Download/export/copy absolute paths.
- Open an evidence detail view or future Evidence route.

Artifact investigation is owned by specification 3.

## User Interface

### Page Header

The page uses the Mission Control system from specification 1:

- Page title `Overview`.
- Last refreshed timestamp.
- Manual refresh action.
- Primary working action `Open Workflows`, not a direct launch action.

### KPI Row

Display:

- `Active Runs`.
- `Succeeded Today`.
- `Attention Needed`.
- `Upcoming Schedules`.

Every metric has a text label and semantic context. Attention uses amber/red
where appropriate; success uses green; active execution uses cyan.

### Live Operations Panel

- Shows active current-process runs with workflow, source, current step,
  elapsed time and state.
- Empty state explains that no workflow is actively running.
- Selecting a run navigates to `Runs` with the referenced run selected or
  highlighted through renderer-owned navigation focus state. The same
  renderer-owned focus state selects a referenced schedule history target on
  `Schedules`; it does not require an additional backend query command.

### Attention Queue Panel

- Shows most recent bounded attention items with type/severity, timestamp,
  workflow and concise sanitized summary.
- Supports read-only filtering by type and severity inside the displayed
  local-day range.
- Manual launch blocks navigate to the relevant workflow Graph Builder.
- Failed run items navigate to `Runs` for the related run.
- Schedule events navigate to `Schedules`; renderer navigation focus passes
  the schedule id so the existing history interaction opens for that schedule.
- Does not include acknowledge/resolve/assignment controls.

### Execution Activity Panel

- Renders bounded time buckets for the selected local-day range.
- Distinguishes succeeded, failed, blocked and schedule-attention activity with
  readable labels and semantic color use.
- Provides no arbitrary analytics query builder.

### Recent Evidence Panel

- Shows safe metadata cards/rows only.
- Includes traceability labels for workflow/run and applicable node/artifact
  type.
- Provides only existing destination navigation.
- Provides a truthful empty state when no generated artifact metadata exists.

### Upcoming Schedules Panel

- Shows a bounded ordered list of next enabled scheduled occurrences with
  workflow and status context.
- Navigates into existing Schedules functionality.

## Refresh, Loading And Failure Handling

### Refresh Behavior

- The page loads the durable aggregate on entry.
- It supports explicit manual refresh.
- Live Operations consumes the existing `runSnapshots` active-run polling
  path, which currently refreshes active snapshot state every 250 ms; the
  durable aggregate is not queried again at that cadence.
- Durable panels refetch after relevant start/block/schedule commands complete,
  when an active run transitions terminal, or after manual refresh, once
  persistence is available through the existing lifecycle.

### Loading And Empty States

- Initial loading presents stable panel skeletons/placeholders in the Mission
  Control layout.
- Legitimate zero states are clearly distinguishable from loading and error
  states.
- Each region may present a relevant empty message, but the aggregate request
  is the authoritative source of metric correctness.

### Query And Persistence Errors

- If aggregate retrieval fails, Overview displays a readable page-level error
  and retry/refresh action; it must not present partial zeros as current truth.
- If a manual launch is blocked and writing its durable attention event fails,
  the operator still sees the validation block in Graph Builder. The additional
  audit-persistence failure is surfaced clearly as a system/audit error; it
  must not permit the run or hide the original block.
- Evidence parsing skips malformed structured metadata items, reports the
  skipped item count in `data_warnings.evidence_items_skipped`, and never
  returns their raw payload. The UI shows a restrained data-warning state when
  this count is nonzero; malformed evidence must not leak arbitrary raw
  outputs into the UI.

## Component And Technical Ownership

The intended ownership is:

| Unit | Responsibility |
| --- | --- |
| Operations repository/read-model service in Electron backend | Bounded SQL reads, joins, evidence-summary extraction, attention union/dedupe and metrics/activity aggregation. |
| Existing manual `runWorkflow` command/orchestration boundary | Record `launch_blocked` when a Graph Builder-confirmed or workflow-list manual full-run request is blocked before a run row can start. |
| Existing scheduler/event boundary | Remain the durable source for scheduled skip/failed-to-start attention. |
| IPC/preload/wrapper/type boundary | Typed `getOperationsOverview` and `getOperationalRunDetail` request/response commands with serializable errors. |
| `App.tsx` navigation/orchestration | Default Overview route, navigation targets, refreshing/polling integration. |
| New Overview page/components | Mission Control presentation, filters, region states and working navigation actions. |
| Existing `Runs` page | Display a bounded focused persisted-run detail target when navigated from Overview while preserving live session monitoring. |

This boundary deliberately does not place SQL or metric computation in the
renderer.

## Security And Auditability

- Overview data is local to the authorized desktop lab and is read from
  existing app-owned persistence.
- No data from browser storage, proxy credentials, cookies, test-account
  secrets or unredacted page outputs is newly exposed.
- Evidence regions rely on structured/sanitized evidence metadata.
- Attention details are concise sanitized explanations and preserve workflow,
  run or schedule traceability.
- The page does not provide capabilities to execute against unapproved targets
  or weaken existing domain/policy controls.

## Testing And Verification Strategy

Implementation changes persistence, IPC, user-visible behavior and layout, so
it must use test-driven development before production code changes and read
the relevant documentation routes and production `DESIGN.md`.

### Backend And Persistence Tests

Add focused coverage for:

- `operational_attention_events` schema, insert/query, workflow cascade and
  indexed created-time/workflow-time access with enforced bounded limits.
- Manual Graph Builder-confirmed or workflow-list full-run blocked by graph validation writes one
  `launch_blocked` event without creating a run.
- Manual Graph Builder-confirmed or workflow-list full-run blocked by settings validation writes one
  `launch_blocked` event without creating a run.
- Manual `Validate` without launch never writes attention.
- Scheduled validation failure appears once through `failed_to_start` and does
  not receive a duplicate new attention row.
- Started run that subsequently fails appears once as run failure.
- Aggregate KPI, timeline bucket, attention ordering/filtering/dedupe,
  upcoming schedule and safe evidence-summary query behavior.
- Local-day UTC boundary handling, including nontrivial offset/DST test cases.
- Output/evidence sanitization boundaries and bounded limits.

### IPC And Frontend Tests

Add focused coverage for:

- `getOperationsOverview` DTO/wrapper/preload/channel behavior and error
  serialization.
- `getOperationalRunDetail` returns bounded safe selected-run detail and
  renders its focused receiver state in `Runs`.
- Default route becomes `Overview`; sidebar displays the approved destinations
  in order and omits `Evidence`/`Identities`.
- Page header, refresh, KPI, panels, empty/loading/error states and filters.
- Navigation from live run, attention, evidence metadata and schedule items to
  existing supported destinations.
- Polling/refresh while active runs exist without layout-breaking state loss.
- Live snapshot refresh can update Live Operations without repeatedly invoking
  the durable aggregate query at the active-run polling cadence.

### End-To-End And Visual Verification

Add or update Electron/Playwright coverage that verifies:

- A confirmed Graph Builder full-run or existing workflow-list manual Run
  blocked before launch creates durable attention visible on Overview after
  page reload/re-entry.
- Successful and failed durable runs affect the local-day metrics/activity and
  attention correctly.
- Schedule skip/failed-to-start events appear once in Attention Queue.
- Generated screenshot/download metadata is represented read-only without
  exposing unsupported artifact actions.
- A failed persisted run remains navigable from Overview to its bounded `Runs`
  detail receiver after app restart.
- Overview is the initial page and remains usable in baseline and compact
  desktop layouts.

### Required Check Categories

The implementation plan selects exact focused commands for changed files. At
completion, expected verification includes:

- Focused backend persistence/command/scheduler tests.
- Focused renderer/page/API tests.
- `npm test -- src/AppCss.test.ts` when layout/style invariants change.
- `npx tsc --noEmit`.
- `npm run build:electron`.
- `npm test`.
- `npm run build`.
- Visual review of Overview in desktop and compact-desktop layouts.

## Documentation Updates During Implementation

The design specification is planning history; current documentation changes
only when code implementing this phase is shipped. Implementation must update:

| Documentation | Change |
| --- | --- |
| `docs/domain/product-model.md` | Overview workspace, durable operational read model and attention concept. |
| `docs/domain/user-visible-invariants.md` | Default Overview entry, visible metrics/feed behavior and launch-block attention rule. |
| `docs/domain/workflow-lifecycle.md` | Full-run blocked-launch audit persistence and Overview navigation. |
| `docs/architecture/overview.md` | New operations read-model ownership. |
| `docs/architecture/frontend.md` | Overview route/components and navigation/refresh behavior. |
| `docs/architecture/persistence.md` | Attention storage and operational query ownership. |
| `docs/architecture/command-boundary.md` | Operations aggregate command ownership. |
| `docs/contracts/electron-ipc.md` | `getOperationsOverview` and `getOperationalRunDetail` request/response commands. |
| `docs/contracts/workflow-types.md` | New DTO and attention shapes. |
| `docs/domain/execution-semantics.md` | Manual blocked-launch audit and durable operations read semantics. |
| `docs/contracts/run-state.md` | Update only if implementation changes the existing public run-state shape rather than adding separate operations DTOs. |
| `docs/task-routes.md` | Routing/checks for Overview/operational-read-model changes. |
| `README.md` | Smoke workflow for landing in Overview and observing durable attention if user-facing checklist is updated. |

## Acceptance Criteria

This specification is successfully implemented when:

- `Overview` is a real sidebar destination and the default entry point of the
  Mission Control application.
- Sidebar continues to omit `Evidence` and `Identities` until their own
  implementations exist.
- The Overview page renders working KPI, Live Operations, Attention Queue,
  Execution Activity, Recent Evidence metadata and Upcoming Schedules regions
  in the approved design system.
- Metrics and activity are based on persisted durable history plus accurate
  current-process active state, not solely on current-session terminal
  snapshots.
- `Today` means the operator's local calendar day, represented to backend
  queries through validated UTC range boundaries.
- A real manual full-run launch from confirmed Graph Builder launch or the
  existing workflow-list Run action blocked before execution creates one
  durable sanitized `launch_blocked` attention event, while manual validation
  alone creates none.
- Existing schedule failed-to-start/skipped events and failed runs integrate
  into Attention Queue without duplicates.
- Attention Queue is observation/navigation only and does not introduce
  acknowledge/resolve/assignment lifecycle.
- Recent Evidence shows only safe structured metadata and supported navigation;
  it does not implement artifact opening or Evidence Explorer functionality.
- No direct Overview `Launch Run` flow is introduced; operators navigate to
  working workflow authoring/run paths.
- The operational read model and IPC are bounded, typed, testable and provide
  stable references suitable for later approved evidence/identity work.
- Persisted run/evidence references on Overview open a bounded selected-run
  detail in `Runs` after restart without introducing broad history browsing or
  Evidence Explorer behavior.
- Required tests, builds, documentation sync and desktop/compact visual
  verification pass during implementation.

## Deferred To Following Specifications

- `Evidence Explorer` defines evidence listing/detail/preview/open/export and
  cross-run artifact investigation on top of the approved read boundary.
- `Identity Lab` defines identity catalog/posture/session diagnostics and its
  run/evidence relationships.
- `Cross-Workspace Traceability And Polish` defines final deep-link behavior,
  cross-navigation reconciliation and suite-completeness review after all
  feature workspaces have been specified.
