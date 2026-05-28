# Mission Control UI/UX Upgrade Child Spec 10: Schedules

Date: 2026-05-29

## Status

Approved design direction, drafted for user review.

This child spec follows:

- `docs/superpowers/specs/2026-05-28-mission-control-full-product-ui-ux-upgrade-master-spec.md`
- `docs/superpowers/specs/2026-05-28-01-foundation-ui-system-child-spec.md`
- `docs/superpowers/specs/2026-05-29-02-shell-navigation-search-alerts-child-spec.md`
- `docs/superpowers/specs/2026-05-29-03-workflow-library-package-management-child-spec.md`
- `docs/superpowers/specs/2026-05-29-04-recording-review-child-spec.md`
- `docs/superpowers/specs/2026-05-29-05-graph-builder-child-spec.md`
- `docs/superpowers/specs/2026-05-29-06-workflow-settings-child-spec.md`
- `docs/superpowers/specs/2026-05-29-07-run-launch-monitoring-child-spec.md`
- `docs/superpowers/specs/2026-05-29-08-evidence-explorer-child-spec.md`
- `docs/superpowers/specs/2026-05-29-09-identity-lab-child-spec.md`

It owns the Schedules workspace, schedule authoring dialog, enablement
readiness presentation, schedule event history, schedule-focused navigation,
and schedule-specific empty/error/loading states. Workflow Detail owns graph
editing and saved settings. Runs owns active run monitoring. Evidence Explorer
owns artifacts. Overview owns summarized upcoming schedules and attention.

## Brainstorming Scope

The user asked for one-spec-at-a-time `$brainstorming` and pre-approved the
recommended choices. This spec records the schedule-specific decisions so
implementation agents do not accidentally change scheduler semantics while
improving the UI.

Schedules is operationally sensitive because it can launch saved workflows at a
future time with retained browser identity state, proxy settings, environment
variables, and graph behavior that may differ from unsaved drafts visible in a
workflow detail tab. The UI must make timing, enablement, and auditability
obvious without becoming a calendar product or raw cron editor.

## Brainstorming Decisions

### Decision 1: Workspace Ownership

Question: should schedules live inside each workflow detail page or remain a
separate sidebar workspace?

Options considered:

- Per-workflow tab.
  - Pros: schedule is close to the workflow graph.
  - Cons: weak for cross-workflow operations, upcoming schedule scanning, and
    audit across multiple owned test targets.
- Separate sidebar workspace.
  - Pros: matches current invariant, supports multiple schedules per workflow,
    lets operators audit automation timing globally, and aligns with Overview
    upcoming schedule links.
  - Cons: create/edit dialog must provide enough workflow context.
- Hybrid full calendar plus per-workflow widgets.
  - Pros: visually rich.
  - Cons: expands scope and duplicates the table/audit model.

Recommended and approved: keep Schedules as a separate sidebar workspace.

### Decision 2: Authoring Shape

Question: should create/edit be a full-page wizard, inline editable table, or a
bounded dialog?

Options considered:

- Full-page wizard.
  - Pros: plenty of explanation room.
  - Cons: too heavy for expert operators and creates a second settings page.
- Inline editable table.
  - Pros: fast for bulk edits.
  - Cons: weak validation surfaces, poor for kind-specific fields, risky for
    enablement.
- Bounded create/edit dialog.
  - Pros: current pattern, good for kind-specific controls, safe place for
    command errors and readiness preview.
  - Cons: dialog must be carefully responsive at compact desktop size.

Recommended and approved: use a bounded create/edit dialog.

### Decision 3: Schedule Language

Question: should the UI expose raw cron, advanced recurrence, or the existing
friendly kinds?

Options considered:

- Raw cron.
  - Pros: powerful.
  - Cons: unsupported by current model, hard to validate, and easy to
    misunderstand.
- Advanced recurrence builder.
  - Pros: flexible.
  - Cons: beyond current backend semantics and not needed for this product
    phase.
- Existing friendly kinds.
  - Pros: matches `WorkflowScheduleKind`, validation, and tests; easier for
    operators to reason about.
  - Cons: less expressive than cron.

Recommended and approved: use only Once, Interval, Daily, Weekly, and Monthly.

### Decision 4: Enablement And Validation

Question: should the UI predict all schedule validation or let backend commands
own the truth?

Options considered:

- UI-only validation.
  - Pros: instant.
  - Cons: can drift from backend and creates false confidence.
- Backend-only opaque errors.
  - Pros: one source of truth.
  - Cons: weak UX if errors appear only after submit.
- Client hints plus backend source of truth.
  - Pros: immediate field guidance without changing command authority.
  - Cons: implementation must avoid claiming readiness before command success.

Recommended and approved: show client-side hints, but backend command results
remain authoritative.

### Decision 5: History Presentation

Question: should schedule history be a modal, side panel, or inline expanded
row?

Options considered:

- Inline row expansion.
  - Pros: keeps table context.
  - Cons: table height becomes unstable and harder to scan.
- Full-page detail.
  - Pros: enough room for long history.
  - Cons: creates extra navigation without current backend pagination depth.
- Focused history dialog or drawer.
  - Pros: current behavior, clear schedule scope, supports run/workflow links.
  - Cons: must handle loading, empty, and stale targets well.

Recommended and approved: use a focused history dialog or right drawer. The
implementation may choose either based on the app's modal/drawer primitives, but
the content contract in this spec is required.

### Decision 6: Timing Semantics

Question: should the UI offer catch-up, queueing, or timezone configuration?

Options considered:

- Add catch-up and queueing options.
  - Pros: may feel powerful.
  - Cons: contradicts current scheduler invariants.
- Add per-schedule timezone.
  - Pros: useful for global teams.
  - Cons: explicitly out of scope for current scheduler model.
- State current local-time semantics clearly.
  - Pros: accurate and safe.
  - Cons: less configurable.

Recommended and approved: no catch-up, no queueing, no per-schedule timezone.
The UI states local time and active-app requirement clearly.

### Decision 7: Component Split

Question: should `SchedulesPage.tsx` stay monolithic?

Options considered:

- Keep one file.
  - Pros: simple short-term edits.
  - Cons: table, form, validation preview, history, and formatting will become
    difficult to maintain.
- Split into focused subcomponents.
  - Pros: easier testing and lower risk for future agents.
  - Cons: more files.

Recommended and approved: split by responsibility during implementation.

## Goal

Turn Schedules into a reliable operations workspace for timing saved workflow
runs. Operators should be able to see what will run next, understand why a
schedule is disabled or blocked, create a valid draft safely, enable it with
confidence, and audit every scheduler decision without needing backend logs.

The implementation must:

1. Preserve every current scheduler invariant.
2. Make enabled, disabled, missed, skipped, failed, and started states readable.
3. Make local-time and active-app requirements visible without in-app tutorial
   clutter.
4. Make schedule creation/editing ergonomic for all supported kinds.
5. Route validation failures to the exact field or readiness panel when
   possible.
6. Show event history as a decision audit, not raw logs.
7. Link started events to Runs and all events to Workflow targets.
8. Handle stale or deleted targets explicitly.
9. Maintain the dark Supabase-inspired Mission Control design system.
10. Work at `1024x768` without clipped controls.

## Inputs And Sources Of Truth

### Required Reading Before Implementation

Follow repo workflow first:

1. `docs/README.md`
2. `docs/task-routes.md`
3. `docs/agent-workflow.md`

Then read the schedule-specific route:

1. `docs/domain/workflow-lifecycle.md`
2. `docs/domain/user-visible-invariants.md`
3. `docs/domain/execution-semantics.md`
4. `docs/architecture/frontend.md`
5. `docs/architecture/persistence.md`
6. `docs/architecture/command-boundary.md`
7. `docs/contracts/electron-ipc.md`
8. `docs/contracts/workflow-types.md`

Because this is UI work, also read:

1. `DESIGN.md`
2. Child spec 01 Foundation UI System
3. Child spec 02 Shell Navigation, Search, Alerts
4. Child spec 07 Run Launch And Runs Monitoring
5. Child spec 08 Evidence Explorer
6. Child spec 09 Identity Lab

### Source Files To Inspect

Primary frontend:

- `src/features/schedules/pages/SchedulesPage.tsx`
- `src/features/schedules/pages/SchedulesPage.test.tsx`
- `src/styles/schedules.css`
- `src/App.tsx`
- `src/layouts/AppShell.tsx`
- `src/layouts/AppSidebar.tsx`
- `src/features/overview/pages/OperationsOverviewPage.tsx`
- `src/lib/workflowApi.ts`
- `src/types/workflow.ts`
- `src/types/electron.ts`

Primary backend contracts:

- `electron/backend/scheduling/scheduler.ts`
- `electron/backend/scheduling/workflowScheduleRepository.ts`
- `electron/backend/commands.ts`
- `electron/ipc.ts`
- `electron/preload.cts`
- `electron/main.ts`
- `electron/backend/runtime/runManager.ts`
- `electron/backend/persistence/database.ts`

Primary tests:

- `src/features/schedules/pages/SchedulesPage.test.tsx`
- `src/lib/workflowApi.test.ts`
- `electron/backend/scheduling/scheduler.test.ts`
- `electron/backend/scheduling/workflowScheduleRepository.test.ts`
- `electron/backend/commands.test.ts`
- `src/layouts/AppShell.test.tsx`
- `src/features/overview/pages/OperationsOverviewPage.test.tsx`

## Current Implementation Readout

The current `SchedulesPage` already supports:

- Header with total schedule count.
- `New schedule` button.
- Empty state.
- Loading text.
- Global error rendering from `appError`.
- Schedule table with status, schedule, workflow, next run, last result, and
  actions.
- Row focus state through `focusedScheduleId`.
- Enable/disable action.
- Edit action.
- History action.
- Delete action.
- Create/edit dialog.
- Supported kinds:
  - `once_at`
  - `interval`
  - `calendar_daily`
  - `calendar_weekly`
  - `calendar_monthly`
- Enabled switch.
- Command error display inside the dialog.
- Schedule history dialog with events.
- Run links for events that have `run_id`.
- Workflow links for history events.

Known UI limitations to address:

- The table is functional but does not separate readiness, next action, and last
  decision strongly enough.
- Enablement errors can surface at app level rather than row/dialog context.
- Delete is immediate through the callback and needs a named confirmation.
- History currently has no loading state, focused event state, or detail parsing
  for validation failure `details_json`.
- Schedule kind controls need clearer field grouping and microcopy without
  becoming tutorial text.
- Empty state does not give workflow availability context.
- The dialog does not show an explicit next occurrence preview.
- Focused schedule navigation only marks the table row and should also open or
  emphasize relevant history when coming from Overview.
- Row actions mix text and icons in a way that can overflow on compact widths.
- Local timezone semantics are implicit.
- "Scheduled runs use latest saved workflow and settings" appears in dialog
  copy but should also be visible near readiness/enablement.

## Non-Negotiable Product Invariants

### Scheduler Runtime

- Schedules run only while the Electron app process is active.
- The app does not register OS-level wake timers.
- The app does not run a background daemon while closed.
- Missed occurrences are skipped and recorded.
- Missed occurrences do not create catch-up backlogs.
- The scheduler scans enabled schedules where `next_run_at <= now`.
- Due schedules are processed in chronological order.
- A malformed schedule or failed workflow validation must not crash the app.
- One schedule failure must not prevent other due schedules from processing.

### Workflow State

- Scheduled runs use the latest saved workflow graph at fire time.
- Scheduled runs use the latest saved Workflow Settings at fire time.
- Unsaved workflow detail drafts are never run by the scheduler.
- The UI must not imply that open graph edits are included until saved.
- A workflow can have multiple schedules.
- Schedules can point to saved workflows only.

### Conflict Handling

- If the same workflow is active, the occurrence is skipped.
- If the same persistent browser profile is active, the occurrence is skipped.
- If an active batch conflicts, the occurrence is skipped.
- Required skip reasons remain:
  - `active_workflow`
  - `active_profile`
  - `active_batch`
- Skipped occurrences are not queued.
- Isolated due schedules can start concurrently in the same tick when backend
  runtime allows it.

### Enablement

- Enabled schedules must have valid schedule config.
- Enabled schedules must point at a currently runnable saved workflow.
- Disabled draft schedules can point at workflows that are still being authored.
- Enablement validates saved graph/settings readiness through backend commands.
- The UI may show hints, but command results are authoritative.

### Schedule Kinds

- `once_at` runs once at a specific timestamp.
- `interval` repeats by `every_seconds`.
- `calendar` supports `daily`, `weekly`, and `monthly`.
- Calendar schedules use app/system local time.
- Stored timestamps use ISO UTC strings.
- Monthly schedules skip months that do not contain the configured day without
  recording a missed event.
- The UI must not expose unsupported cron syntax.

### Auditability

- Schedule event history records:
  - `started`
  - `skipped`
  - `missed`
  - `failed_to_start`
  - `disabled`
- Schedule events are independent from run evidence rows.
- `started` events may link to a run.
- Events without runs must still explain the scheduler decision.
- All schedule history entries can open the owning workflow target.
- Stale or deleted schedule/run/workflow targets must render as unavailable,
  not as broken blank screens.

### Security And Privacy

- The UI must not show proxy passwords.
- The UI must not show cookie values, local storage, session storage, tokens, or
  raw browser storage.
- The UI must not show absolute local profile paths.
- Details from `details_json` must be parsed and summarized safely.
- Raw JSON should not be the default presentation.
- Command errors should preserve useful messages without dumping sensitive
  payloads.

## Information Architecture

### Page Regions

Schedules page is a compact operations workspace with these regions:

1. Header
2. Summary strip
3. Filter/search strip, if implemented in this pass
4. Schedule table
5. Create/edit dialog
6. History dialog or drawer
7. Confirmation dialog for destructive actions

The default first viewport should show:

- The title.
- Total schedule count.
- Count of enabled schedules.
- Count of schedules needing attention.
- `New schedule`.
- The start of the schedule table.

Do not create a marketing hero or explanatory landing page.

### Header

Header content:

- Eyebrow: `Automation`
- Title: `Schedules`
- Short secondary line:
  - `Saved workflows can run automatically while Mission Control is open.`
- Primary action:
  - `New Schedule`
- Optional secondary action:
  - refresh icon button if the app has a shared refresh pattern.

Header stats:

- `total`
- `enabled`
- `attention`
- `next due`

Do not overload the header with long help copy. The purpose line is enough.

### Summary Strip

Add a compact summary strip below the header.

Cards or cells:

- `Enabled`
  - Count enabled schedules.
  - Tone: neutral/cyan.
- `Next Due`
  - Nearest `next_run_at`.
  - Tone: neutral.
- `Attention`
  - Count schedules whose last status is `skipped`, `missed`, or
    `failed_to_start`.
  - Tone: amber or red based on most severe event.
- `Drafts`
  - Count disabled schedules.
  - Tone: muted.

This strip must be dense and non-decorative.

Each summary cell can be a button only if it filters the table. If it is not
interactive, render it as a static element and do not fake button semantics.

### Filters

Filters are optional for the first implementation pass but recommended if the
table grows beyond a simple list.

Recommended filters:

- Search by schedule name or workflow name.
- Status:
  - all
  - enabled
  - disabled
  - attention
- Kind:
  - all
  - once
  - interval
  - daily
  - weekly
  - monthly

Filter behavior:

- Filters are renderer-only over loaded schedules unless backend pagination is
  introduced later.
- Empty filtered state differs from no schedules state.
- Clear filters button appears when filters are active.
- Search field label is accessible.
- Search must not search raw details or hidden sensitive payloads.

### Table Columns

Required desktop columns:

1. Status
2. Schedule
3. Workflow
4. Cadence
5. Next Run
6. Last Decision
7. Actions

Column details:

- Status shows enabled/disabled and attention marker.
- Schedule shows name and stable id suffix only if needed for disambiguation.
- Workflow shows workflow name and a compact open action.
- Cadence shows friendly kind summary.
- Next Run shows local date/time and relative hint.
- Last Decision shows status, reason, and time.
- Actions show enable/disable, edit, history, delete.

At compact width:

- Hide separate Cadence column by folding it under Schedule.
- Hide Last Decision time by folding it under Last Decision text.
- Keep Status, Schedule, Next Run, and Actions visible.
- Row actions may collapse into a menu if available in shared UI primitives.

## Schedule Table Row Contract

### Row Density

Each row must be readable in repeated operations use.

Row height target:

- Normal desktop: 60-76px.
- Compact desktop: 64-88px.

Rows must not jump height when focus, hover, or attention state changes.

### Status Cell

Status states:

- Enabled and ready:
  - Pill text: `Enabled`
  - Tone: cyan or green-neutral. Avoid pure success green unless last decision
    is successful.
- Disabled draft:
  - Pill text: `Disabled`
  - Tone: muted.
- Needs attention:
  - Pill text stays `Enabled` or `Disabled`.
  - Add second compact marker:
    - `Needs review`
    - amber for skipped/missed
    - red for failed-to-start

Do not communicate attention by color alone.

### Schedule Cell

Content:

- Schedule name.
- Cadence summary if Cadence column is hidden.
- Optional focused target marker:
  - `Selected from Overview`
  - `Selected from Search`
  - `Selected schedule target`

Name behavior:

- Truncate after two lines.
- Preserve full name in `title` attribute or tooltip if the shared tooltip
  primitive exists.
- Empty names should never occur after backend validation; if one appears,
  render `Untitled schedule` and mark as invalid data.

### Workflow Cell

Content:

- Workflow name.
- Open workflow icon button or text button depending on row layout.

Unavailable workflow:

- If backend list excludes schedules whose workflow has been deleted through
  cascade, row should not appear.
- If navigation target from stale history references a deleted workflow, show
  unavailable target message outside the table.

### Cadence Cell

Required summaries:

- Once:
  - `Once at May 29, 2026, 9:30 AM`
- Interval:
  - `Every 30 minutes`
  - `Every 2 hours`
  - `Every 1 day`
- Daily:
  - `Daily at 09:00`
- Weekly:
  - `Weekly Mon, Wed, Fri at 09:00`
- Monthly:
  - `Monthly on day 15 at 09:00`

Pluralization:

- `1 minute`
- `2 minutes`
- `1 hour`
- `2 hours`
- `1 day`
- `2 days`

Do not display `every_seconds` directly.

### Next Run Cell

States:

- Enabled with `next_run_at`:
  - show local date/time.
  - show relative helper:
    - `in 12 minutes`
    - `today`
    - `tomorrow`
    - `overdue by 3 minutes` if the loaded value is already due.
- Disabled or one-time elapsed:
  - `Not scheduled`
- Missing but enabled:
  - `Needs review`
  - treat as attention.

The relative helper must be recalculated on render or refresh. Do not add a
separate timer unless the app already uses one for similar live timestamps.

### Last Decision Cell

Map statuses:

- `started`
  - Label: `Started`
  - Tone: success.
- `skipped`
  - Label: `Skipped`
  - Tone: amber.
- `missed`
  - Label: `Missed`
  - Tone: amber.
- `failed_to_start`
  - Label: `Failed to start`
  - Tone: red.
- `disabled`
  - Label: `Disabled`
  - Tone: muted.
- `null`
  - Label: `No events yet`
  - Tone: muted.

Map common reasons:

- `active_workflow`
  - `Workflow already running`
- `active_profile`
  - `Browser profile already in use`
- `active_batch`
  - `Batch run active`
- `active_run`
  - `Run already active`
  - Use only for legacy rows if present.
- `missed_window`
  - `Missed while app was inactive`
- `validation_failed`
  - `Saved workflow is not runnable`
- `start_failed`
  - `Start command failed`
- `one_time_elapsed`
  - `One-time schedule elapsed`

Unknown reasons:

- Display a safe humanized form.
- Preserve the raw value only in a monospace secondary token if it is not
  sensitive.
- Do not display raw JSON.

### Actions Cell

Required actions:

- Enable/Disable.
- Edit.
- History.
- Delete.

Action rules:

- Enable/Disable is a text button because scope must be clear.
- Edit, History, and Delete may be icon buttons with labels/tooltips.
- Delete is destructive and requires confirmation.
- Disable does not require confirmation because it is reversible.
- Enable may show readiness validation and command errors.
- Row action labels must include the schedule name for screen readers.

Overflow behavior:

- At compact widths, move Edit, History, Delete into an overflow menu if a menu
  primitive is available.
- If no menu primitive exists, wrap row actions without clipping.
- Never let the action cell force horizontal scrolling beyond the table wrapper.

## Create/Edit Dialog

### Dialog Role

The dialog is an authoring and readiness checkpoint.

It must answer:

- Which saved workflow will run?
- What is the schedule called?
- When will it run?
- Is it enabled now?
- What happens when it fires?
- What must be fixed before it can be enabled?

### Dialog Header

Create mode:

- Eyebrow: `Schedule`
- Title: `New Schedule`
- Description:
  - `Scheduled runs use the latest saved workflow and Workflow Settings.`

Edit mode:

- Eyebrow: `Schedule`
- Title: `Edit Schedule`
- Description:
  - `Changes apply to future occurrences only.`

The description must not claim unsaved workflow detail drafts will run.

### Form Layout

Desktop dialog layout:

- Two-column interior if width permits:
  - Left: fields.
  - Right: preview/readiness panel.
- Single-column at compact width:
  - Fields first.
  - Preview/readiness below fields.

Recommended sections:

1. Target
2. Cadence
3. Enablement
4. Preview and readiness

Fields should use existing shared primitives:

- `Label`
- `Input`
- `Select`
- `SegmentedControl`
- `SwitchField`
- `Button`
- `Dialog`

### Target Section

Fields:

- Workflow selector.
- Schedule name.

Workflow selector:

- Required.
- Shows saved workflow names.
- If no workflows exist:
  - Disable schedule creation.
  - Empty state says `Create a workflow before adding schedules.`
  - Primary action may navigate to Workflows if shell callback exists.

Schedule name:

- Required.
- Placeholder:
  - `Weekday login audit`
- Recommended default:
  - Empty in create mode.
  - Existing name in edit mode.
- Validation message:
  - `Schedule name is required`

### Cadence Section

Segment options:

- `Once`
- `Interval`
- `Daily`
- `Weekly`
- `Monthly`

Segmented control requirements:

- Stable height.
- Visible selected state.
- Keyboard operable.
- Accessible `aria-label="Schedule kind"`.
- Labels do not wrap awkwardly at compact width; if needed, grid the options
  into two rows.

### Once Fields

Fields:

- `Run at`
  - HTML `datetime-local` is acceptable.

Validation:

- Empty:
  - `Use a valid date and time`
- Invalid date:
  - `Use a valid date and time`
- Enabled and past:
  - `One-time schedule must be in the future`

Preview:

- `Runs once at <local date/time>.`
- If disabled:
  - `Saved as a disabled one-time draft.`

Edge state:

- Existing one-time schedule whose timestamp elapsed and disabled:
  - Show `This one-time schedule has elapsed. Pick a future time to enable it
    again.`

### Interval Fields

Fields:

- Number input:
  - Label: `Every`
  - Minimum UI value: `1`
- Unit select:
  - `Minutes`
  - `Hours`
  - `Days`

Validation:

- Effective seconds must be at least `60`.
- Non-number:
  - `Use a positive interval`
- Too small:
  - `Interval must be at least 60 seconds`

Preview:

- `Runs every 30 minutes while Mission Control is open.`

Guardrail:

- Do not offer seconds in the UI unless backend and product docs explicitly
  change.

### Daily Fields

Fields:

- `Time`
  - HTML `time` input.

Validation:

- Must match valid `HH:mm`.
- Message:
  - `Use a valid HH:mm time`

Preview:

- `Runs daily at 09:00 local time.`

### Weekly Fields

Fields:

- Weekday toggles.
- `Time`

Weekday labels:

- `Sun`
- `Mon`
- `Tue`
- `Wed`
- `Thu`
- `Fri`
- `Sat`

Validation:

- At least one weekday.
- Valid `HH:mm`.

Preview:

- `Runs Mon, Wed, Fri at 09:00 local time.`

Toggle rules:

- Use buttons with `aria-pressed`.
- Selected weekdays have clear fill/border.
- Toggling the final selected day is allowed in disabled draft mode, but an
  enabled submit must show validation error.

### Monthly Fields

Fields:

- `Day of month`
- `Time`

Validation:

- Day must be integer `1` through `31`.
- Time must be valid `HH:mm`.

Preview:

- `Runs on day 15 at 09:00 local time.`

Important copy:

- `Months without this day are skipped.`

This copy is required for days 29-31 and optional for days 1-28.

### Enablement Section

Field:

- Switch label: `Enable schedule`

Behavior:

- Off means schedule can be saved as a draft.
- On means schedule must pass schedule input validation.
- Backend enable command validates saved workflow readiness.

Create mode:

- If enabled, submit uses `createSchedule(input)` with `enabled: true`.
- Backend computes next run and validates.

Edit mode:

- If enabling from disabled, submit/update or enable command must preserve
  backend validation.

Implementation note:

- Current code sends `enabled` through create/update and uses row
  `enableSchedule` separately. The implementation may keep this model or
  refactor it, but visible behavior must remain:
  - invalid enabled schedule stays disabled;
  - error appears in schedule context;
  - schedule list refreshes after successful command.

### Preview And Readiness Panel

The dialog should include a compact preview panel.

Panel content:

- Target workflow name.
- Cadence summary.
- Next occurrence preview when calculable.
- Local timezone note:
  - `Displayed in local time.`
- Saved-state note:
  - `Uses the latest saved workflow graph and Workflow Settings.`
- Enablement readiness:
  - `Ready to save as draft`
  - `Ready to enable`
  - `Needs schedule fields`
  - `Saved workflow must be runnable before enablement`

Client preview rules:

- Preview can be computed client-side for display.
- Preview cannot replace backend `next_run_at`.
- If preview calculation is uncertain, show:
  - `Next run will be calculated after save.`

Do not implement a separate backend preview command unless needed by a future
implementation plan.

### Dialog Footer

Create mode primary:

- `Create Schedule`

Edit mode primary:

- `Save Schedule`

Secondary:

- `Cancel`

Optional destructive action in edit mode:

- Do not put Delete in the primary footer unless the app already has a safe
  destructive footer pattern.

Footer behavior:

- Primary button disabled only for clear client-side impossibilities such as no
  workflow selected.
- For most validation, allow submit and show backend command error.
- Pending submit shows stable loading state without resizing button.

### Dialog Error Placement

Error priority:

1. Field-level error if command includes `field`.
2. Readiness panel error if it relates to workflow readiness.
3. Form-level error for command/system failure.

Examples:

- `kind.every_seconds`
  - Show near interval fields.
- `kind.timestamp`
  - Show near Run at.
- `workflow_id`
  - Show near workflow selector.
- `validation_failed`
  - Show in readiness panel with a link to Workflow or Graph if available.

Global `appError` may still show in page header for non-dialog actions, but
dialog submit errors should stay inside the dialog.

## Enable And Disable Flow

### Enable From Row

When operator clicks Enable:

1. Button enters pending state.
2. Backend `enableSchedule(scheduleId)` runs.
3. If success:
   - refresh schedules.
   - row shows enabled.
   - next run appears.
4. If error:
   - row remains disabled.
   - row-level inline error appears.
   - page-level error may mirror the message if current architecture requires.

Recommended row-level error:

- Add transient row alert below row content:
  - `Could not enable: Saved workflow is not runnable.`

If command returns field information:

- `Edit schedule` action should be visually suggested.
- For workflow readiness issues, `Open Workflow` should be visually suggested.

### Disable From Row

When operator clicks Disable:

1. Button enters pending state.
2. Backend `disableSchedule(scheduleId)` runs.
3. If success:
   - refresh schedules.
   - row shows disabled.
   - next run becomes `Not scheduled`.
4. If error:
   - show row-level command error.

No confirmation is required.

### Enable From Dialog

When `Enable schedule` switch is on and the form is submitted:

- Create mode should attempt an enabled create.
- Edit mode should attempt an enabled update.
- If backend rejects, keep dialog open.
- Keep all field values intact.
- Show error in field/readiness/form context.

### Disabled Draft

Disabled draft behavior:

- Can be saved even if workflow is still being authored.
- Still requires minimally valid persistable schedule shape:
  - workflow id exists;
  - name is non-empty;
  - kind shape is serializable.
- More permissive than enabled mode for future `once_at` timestamp.

UI copy:

- `Disabled drafts do not run until enabled.`

## Delete Flow

Delete requires confirmation.

Confirmation content:

- Title:
  - `Delete Schedule`
- Body:
  - `Delete "<schedule name>"? Future occurrences will stop. Existing runs and
    evidence remain unchanged.`
- Primary destructive:
  - `Delete Schedule`
- Secondary:
  - `Cancel`

Behavior:

- Confirmation names the schedule.
- Delete button pending state is stable.
- On success:
  - close confirmation.
  - refresh schedules.
  - clear focused schedule if it was deleted.
- On failure:
  - keep confirmation open.
  - show command error.

Do not delete run history or evidence from this action.

## History Dialog Or Drawer

### Opening History

History opens from:

- Row History action.
- Overview attention item navigation.
- Overview upcoming schedule navigation.
- Command bar schedule search result.

When opened from row:

- Load events for the schedule.
- Show schedule name and workflow name.

When opened from target navigation:

- Focus the schedule row.
- If a schedule event id is provided and exists in loaded history, highlight the
  event.
- If the event id does not exist, show unavailable event message.

### Header

Content:

- Eyebrow: `Schedule History`
- Title: schedule name.
- Description:
  - workflow name;
  - cadence summary;
  - enabled/disabled state.

Actions:

- `Open Workflow`
- Close.

Optional:

- `Open Latest Run` if latest started event has run id.

### History Loading State

Required states:

- Initial loading:
  - skeleton rows or `Loading schedule history...`
- Loaded empty:
  - `No events recorded yet.`
- Error:
  - `Could not load schedule history.`
  - Retry action if callback is available.

Do not show stale events from a previous schedule while loading a new schedule.

### Event Item Layout

Each event item shows:

- Status label.
- Scheduled for local date/time.
- Recorded at local date/time.
- Reason summary.
- Safe detail summary.
- Run link if `run_id` exists.
- Workflow link.

Event item order:

- Newest first.
- Preserve backend order if equal timestamps.

### Event Status Mapping

Started:

- Title: `Started`
- Tone: success.
- Detail:
  - `Run was started for this occurrence.`
- Action:
  - `Open Run` if `run_id` exists.

Skipped:

- Title: `Skipped`
- Tone: amber.
- Detail by reason:
  - `Workflow already running.`
  - `Browser profile already in use.`
  - `Batch run active.`
  - `Run already active.`

Missed:

- Title: `Missed`
- Tone: amber.
- Detail:
  - `Mission Control was not able to process this occurrence inside the active
    window.`

Failed to start:

- Title: `Failed to start`
- Tone: red.
- Detail:
  - If validation details exist, show count of errors and warnings.
  - If start failed, show sanitized command message.

Disabled:

- Title: `Disabled`
- Tone: muted.
- Detail:
  - `One-time schedule elapsed.`

### Details JSON Handling

`details_json` may include validation issues or start failure messages.

Rules:

- Parse safely inside try/catch.
- If invalid JSON:
  - show `Details unavailable`.
- If `{ issues: [...] }`:
  - show grouped list:
    - `Graph`
    - `Settings`
    - `Schedule`
  - show issue `message`.
  - do not show raw serialized object.
- If `{ message: "..." }`:
  - show sanitized message.
- Unknown shape:
  - show `Additional scheduler details were recorded.`
  - optional collapsed safe JSON is allowed only if keys and values are known
    non-sensitive.

Never render `details_json` as raw preformatted JSON by default.

### History Actions

Open Run:

- Visible only when `run_id` exists and `onOpenRun` callback exists.
- Navigates to Runs focused detail.
- If run target is stale, Runs page shows unavailable run state.

Open Workflow:

- Visible when `onOpenWorkflow` callback exists.
- Navigates to workflow detail.
- If workflow target is stale, app-level unavailable target message appears.

Open Evidence:

- Do not add from schedule history in this pass unless event/run data already
  contains evidence ids.

## Stale Target Behavior

### Stale Schedule

If navigation requests a schedule id that no longer exists:

- Navigate to Schedules page.
- Show header or inline alert:
  - `Schedule target is no longer available: <id>`
- Do not open an empty history dialog.
- Keep table usable.

### Stale Schedule Event

If schedule exists but event id is missing:

- Open schedule history.
- Show alert inside history:
  - `Schedule event target is no longer available: <id>`
- Keep showing available events.

### Stale Run

If history `Open Run` points to a run no longer available:

- Navigate to Runs.
- Runs page owns missing run state.
- Schedule history does not need to prevalidate the run.

### Stale Workflow

If history `Open Workflow` points to deleted workflow:

- App navigation sets unavailable target message.
- Schedules page should not crash or close unexpectedly.

## Empty States

### No Schedules

State:

- `schedules.length === 0`
- `loading === false`

Content:

- Icon: `CalendarClock`
- Title:
  - `No schedules yet`
- Body:
  - `Create a schedule to run a saved workflow automatically while Mission
    Control is open.`
- Primary action:
  - `New Schedule`

If no workflows exist:

- Body:
  - `Create a workflow before adding schedules.`
- Primary action:
  - `Open Workflows` if callback exists.
- Disable `New Schedule` or route it to workflow creation.

### Filtered Empty

Content:

- Title:
  - `No schedules match these filters`
- Body:
  - `Adjust the search or clear filters.`
- Action:
  - `Clear Filters`

### History Empty

Content:

- `No events recorded yet.`
- Secondary:
  - `Events appear after the scheduler processes an enabled schedule.`

## Loading And Pending States

### Page Loading

Required behavior:

- Show skeleton table rows or stable loading text.
- Header remains visible.
- `New Schedule` can remain enabled if workflows are loaded.
- Do not clear existing schedules during refresh if current architecture can
  preserve them.

### Row Pending

Actions with pending state:

- Enable.
- Disable.
- Delete.
- History load.

Pending rules:

- Disable only the affected row action.
- Avoid blocking unrelated schedule rows.
- Button width stays stable.
- Pending label can be:
  - `Enabling...`
  - `Disabling...`
  - `Deleting...`

### Dialog Pending

Pending submit rules:

- Disable primary submit.
- Keep cancel available only if cancelling cannot leave inconsistent state.
- If cancel is disabled during pending, show a clear stable state.
- Keep form values visible.

## Error Model

### Page-Level Errors

Use page-level error for:

- Failed `listSchedules`.
- Failed schedule target navigation.
- Failed command with no known row/dialog context.

Placement:

- Under header, `role="alert"`.
- Do not cover table.

### Row-Level Errors

Use row-level error for:

- Enable failure.
- Disable failure.
- Delete failure after confirmation closes only if confirmation cannot stay
  open.

Row-level errors should be dismissible or replaced by the next action result.

### Dialog Errors

Use dialog errors for:

- Create failure.
- Update failure.
- Field validation.
- Saved workflow readiness failure while enabling.

Dialog must remain open.

### History Errors

Use history-level error for:

- Failed `listScheduleEvents`.
- Invalid focused event target.

History error must not close the history UI unless the schedule itself is gone.

## Visual Design Requirements

Follow `DESIGN.md`.

Required tokens:

- Canvas: `#0B1016`
- Surface: `#121C26`
- Elevated surface: `#172431`
- Border: `#233240`
- Emphasized border: `#314758`
- Primary text: `#E7EEF5`
- Secondary text: `#9AAEBD`
- Muted text: `#667D8D`
- Cyan for active/focus.
- Green for successful terminal state.
- Amber for warning/skipped/missed.
- Red for failed/destructive.

Spacing:

- Use 4px and 8px increments.
- Table cells use compact padding.
- Dialog groups use 16px or 20px vertical separation.

Radius:

- Table/panel radius no larger than `8px`.
- Dialog radius up to `12px`.

Typography:

- Page title: `28-32px`.
- Section headings: `18-20px`.
- Body/control: `13-14px`.
- Metadata: `11-12px`.
- Letter spacing: `0`.

Do not introduce:

- Marketing hero sections.
- Decorative cards nested inside cards.
- Gradient orb backgrounds.
- Oversized copy blocks.
- A one-hue purple/blue/purple-blue redesign.

## Accessibility Requirements

### Keyboard

Required keyboard behavior:

- Sidebar navigation reaches Schedules.
- `New Schedule` is reachable.
- Table actions are reachable in row order.
- Dialog traps focus.
- Dialog returns focus to triggering button on close.
- Segmented schedule kind control supports keyboard operation.
- Weekday toggles support keyboard operation.
- Confirmation dialog traps focus.
- History dialog/drawer traps focus.

### Screen Reader

Required labels:

- Page section has `aria-label="Schedules"`.
- Table has an accessible label.
- Row actions include schedule name:
  - `Enable <schedule name>`
  - `Disable <schedule name>`
  - `Edit <schedule name>`
  - `View history for <schedule name>`
  - `Delete <schedule name>`
- Weekday toggles use `aria-pressed`.
- Error messages with impact use `role="alert"`.

### Color And State

Color cannot be the only state indicator.

Every semantic state needs text:

- Enabled.
- Disabled.
- Needs review.
- Started.
- Skipped.
- Missed.
- Failed to start.

### Motion

Motion should be minimal:

- Hover/focus transition allowed.
- Pending spinners allowed if shared primitive exists.
- No large animated calendar effects.

## Responsive Requirements

### Desktop Wide

At wide desktop:

- Header and summary fit on first viewport.
- Full table columns visible.
- Dialog can use two-column form plus preview.
- History can use a medium-width dialog or right drawer.

### 1024x768

At `1024x768`:

- Sidebar may collapse according to shell spec.
- Header actions wrap cleanly.
- Summary strip remains readable.
- Table wrapper handles overflow without clipping actions.
- Dialog height stays within viewport.
- Dialog content scrolls internally if needed.
- Footer remains visible or sticky.

### Narrow Desktop / Mobile-Like Width

If viewport becomes narrow:

- Table may become stacked rows.
- Actions wrap or move into overflow.
- Segment options can become two rows.
- Weekday toggles wrap.
- No text overlaps controls.
- Buttons must preserve readable labels.

## Component Architecture

Recommended split:

- `SchedulesPage`
  - owns data props, high-level page state, filter state, selected schedule,
    focused target state.
- `ScheduleSummaryStrip`
  - summary counts and nearest next run.
- `ScheduleFilters`
  - search/status/kind filters if implemented.
- `ScheduleTable`
  - table structure and empty/filtered states.
- `ScheduleRow`
  - row display and actions.
- `ScheduleStatusBadge`
  - status and attention marker.
- `ScheduleKindSummary`
  - friendly cadence display.
- `ScheduleDialog`
  - create/edit form shell.
- `ScheduleCadenceFields`
  - kind-specific fields.
- `ScheduleReadinessPanel`
  - preview, local-time note, saved-state note, readiness/error summary.
- `ScheduleHistoryDialog`
  - history shell.
- `ScheduleHistoryItem`
  - event display.
- `ScheduleDeleteDialog`
  - named destructive confirmation.
- `scheduleFormatters.ts`
  - date/time, interval, status/reason labels.
- `scheduleForm.ts`
  - form state conversion and lightweight client validation.

Do not move scheduler business logic into React. UI helpers can format and
preview; backend remains the authority for persisted next run and enablement.

## Data Flow

### Load Page

1. App screen changes to `schedules`.
2. `loadSchedules()` calls `listSchedules()`.
3. Page receives `schedules`, `loading`, `error`.
4. Page derives summary counts and filtered rows.

### Create Schedule

1. User opens dialog.
2. Form initializes:
   - first workflow id if available;
   - empty name;
   - disabled;
   - interval every 60 minutes;
   - daily/weekly/monthly defaults.
3. User edits fields.
4. UI builds `WorkflowScheduleInput`.
5. `onCreateSchedule(input)` calls backend.
6. On success:
   - dialog closes;
   - list refreshes.
7. On failure:
   - dialog stays open;
   - error appears in context.

### Edit Schedule

1. User opens dialog from row.
2. Form maps `WorkflowSchedule` to draft.
3. User edits.
4. UI builds full `WorkflowScheduleInput`.
5. `onUpdateSchedule(scheduleId, input)` calls backend.
6. On success:
   - dialog closes;
   - list refreshes.
7. On failure:
   - dialog remains open.

### Toggle Schedule

1. User clicks Enable or Disable.
2. Row enters pending.
3. `onToggleSchedule(scheduleId, enabled)` calls backend.
4. On success:
   - list refreshes.
5. On error:
   - row-level or page-level error shows.
   - row remains in previous state.

### Open History

1. User clicks History or navigation target asks for schedule.
2. Page sets selected history schedule.
3. `onLoadEvents(scheduleId)` calls `listScheduleEvents`.
4. History renders loading until events correspond to selected schedule.
5. Events render newest first.

## State Matrix

### Page States

| State | Condition | UI |
| --- | --- | --- |
| Loading initial | `loading=true`, no schedules loaded | Header plus skeleton/table loading |
| Loaded empty | `loading=false`, `schedules.length=0` | No schedules empty state |
| Loaded list | `schedules.length>0` | Summary plus table |
| Filtered empty | filters active and zero visible rows | Filter empty with clear action |
| Load error | `error` from `listSchedules` | Header alert plus retained content if any |
| Stale target | navigation id not found | Header alert plus table |

### Row States

| State | Condition | UI |
| --- | --- | --- |
| Enabled ready | `enabled=true`, no attention last status | Enabled badge, next run |
| Disabled draft | `enabled=false`, no attention | Disabled badge, not scheduled |
| Started last | `last_status=started` | Success last decision |
| Skipped last | `last_status=skipped` | Amber attention marker |
| Missed last | `last_status=missed` | Amber attention marker |
| Failed last | `last_status=failed_to_start` | Red attention marker |
| One-time elapsed | disabled and last disabled reason one_time_elapsed | Disabled plus elapsed copy |
| Pending toggle | local pending id matches row | Disable affected action |
| Row command error | command failed for row | Inline row alert |

### Dialog States

| State | Condition | UI |
| --- | --- | --- |
| Create disabled draft | mode create, enabled false | Draft readiness |
| Create enabled | mode create, enabled true | Enable readiness |
| Edit schedule | mode edit | Existing values |
| Invalid field | local or command field issue | Field error |
| Workflow not runnable | backend readiness issue | Readiness panel error |
| Submitting | submit in progress | Stable pending primary |
| Submit failed | command rejects | Dialog remains open |
| No workflows | workflows empty | Disable create, explain prerequisite |

### History States

| State | Condition | UI |
| --- | --- | --- |
| Loading | events loading for selected schedule | Skeleton or loading text |
| Empty | no events | Empty history message |
| Started event | event type started | Success item with run link |
| Skipped event | event type skipped | Amber reason item |
| Missed event | event type missed | Amber missed item |
| Failed event | event type failed_to_start | Red item with safe details |
| Disabled event | event type disabled | Muted item |
| Focused event | navigation event id matches | Emphasized border/background |
| Missing event | navigation event id absent | History alert |

## Copy Requirements

Approved copy snippets:

- `Scheduled runs use the latest saved workflow and Workflow Settings.`
- `Mission Control must be open for schedules to run.`
- `Missed occurrences are recorded and not queued.`
- `Disabled drafts do not run until enabled.`
- `Displayed in local time.`
- `Months without this day are skipped.`
- `Existing runs and evidence remain unchanged.`

Avoid:

- `Background schedule`
- `Always-on`
- `Runs even when closed`
- `Cron`
- `Queue missed runs`
- `Uses current draft`

## Testing Requirements

### Frontend Tests

Update or add tests in `src/features/schedules/pages/SchedulesPage.test.tsx`.

Required coverage:

1. Renders summary counts for total, enabled, attention, and drafts.
2. Renders table rows with status, workflow, cadence, next run, and last
   decision.
3. Maps `failed_to_start` to `Failed to start`.
4. Maps conflict reasons to human-readable labels.
5. Opens create dialog and submits interval schedule.
6. Keeps command validation error visible inside dialog.
7. Opens edit dialog and preserves existing kind values.
8. Shows one-time invalid datetime error inside dialog.
9. Weekly cadence requires at least one selected day when enabled.
10. Monthly day 29-31 shows skipped-month copy.
11. Enable row failure remains associated with row or page alert.
12. Delete action requires confirmation and names schedule.
13. History dialog shows loading, empty, and populated states.
14. History event with run id calls `onOpenRun`.
15. History event calls `onOpenWorkflow`.
16. Stale focused schedule message is visible when target missing if implemented
    in page props.
17. No-workflows empty state disables or redirects schedule creation.
18. Keyboard-accessible labels exist for icon buttons.

Preserve existing regression:

- The test that prevents reading `event.currentTarget.value` inside async
  `setForm` callbacks must remain or be replaced with a stronger behavior test.

### Backend Tests

If implementation changes scheduler behavior, update:

- `electron/backend/scheduling/scheduler.test.ts`
- `electron/backend/scheduling/workflowScheduleRepository.test.ts`
- `electron/backend/commands.test.ts`

For a UI-only pass, backend tests are not required unless command contract usage
changes.

### API Wrapper Tests

If callbacks or bridge contract changes:

- Update `src/lib/workflowApi.test.ts`.
- Update `src/types/electron.ts`.
- Update `electron/preload.cts`.

### Accessibility Tests

Required checks:

- Dialog has accessible name.
- Icon actions have labels.
- Error alerts use `role="alert"` where appropriate.
- Weekday toggles expose pressed state.
- Table can be navigated by Testing Library role queries.

### Type And Build Checks

Expected checks for implementation:

- `npm test -- src/features/schedules/pages/SchedulesPage.test.tsx`
- `npm test -- src/lib/workflowApi.test.ts` if API wrapper changes
- `npm test -- electron/backend/scheduling/scheduler.test.ts` if scheduler
  behavior changes
- `npm test -- electron/backend/scheduling/workflowScheduleRepository.test.ts`
  if repository behavior changes
- `npm test -- electron/backend/commands.test.ts` if command behavior changes
- `npx tsc --noEmit`
- `npm run build:electron` if Electron files change

## Manual QA Checklist

Run the app and verify:

1. Sidebar opens Schedules in the documented order.
2. Empty state is correct with no schedules.
3. Empty state is correct when no workflows exist.
4. Create disabled interval schedule.
5. Create enabled interval schedule.
6. Create once schedule in the future.
7. Attempt enabled once schedule in the past and confirm error stays in dialog.
8. Create daily schedule.
9. Create weekly schedule with multiple weekdays.
10. Attempt weekly schedule with no weekdays and confirm validation.
11. Create monthly schedule for day 31 and confirm skipped-month copy.
12. Edit schedule name.
13. Edit schedule kind from interval to weekly.
14. Enable disabled schedule from row.
15. Disable enabled schedule from row.
16. Trigger enable validation failure with invalid saved workflow.
17. Confirm failure explains saved workflow readiness.
18. Delete schedule and confirm named dialog.
19. Open schedule history with no events.
20. Open schedule history with started event and navigate to Run.
21. Open schedule history with skipped event and confirm reason mapping.
22. Open schedule history with failed-to-start validation details.
23. Navigate from Overview upcoming schedule to Schedules.
24. Navigate from Overview schedule attention to Schedules/history.
25. Search schedule from command bar and open target.
26. Confirm stale schedule target displays unavailable message.
27. Confirm table at `1024x768` does not clip buttons.
28. Confirm keyboard flow through dialog and history.
29. Confirm no proxy passwords, storage values, cookies, tokens, or absolute
    profile paths are rendered.

## Documentation Requirements

If implementation changes behavior or contracts, update relevant docs:

- `docs/domain/workflow-lifecycle.md`
- `docs/domain/user-visible-invariants.md`
- `docs/domain/execution-semantics.md`
- `docs/architecture/frontend.md`
- `docs/architecture/persistence.md`
- `docs/architecture/command-boundary.md`
- `docs/contracts/electron-ipc.md`
- `docs/contracts/workflow-types.md`
- `docs/task-routes.md`
- `README.md` smoke checklist

If implementation is UI-only and preserves current semantics, docs updates may
be limited to README smoke checklist only if the manual user flow changes.

## Implementation Sequence Recommendation

Implement in this order:

1. Extract formatters and form helpers from `SchedulesPage`.
2. Add tests for status/reason/cadence formatting.
3. Split table row and history item components.
4. Add delete confirmation.
5. Add dialog preview/readiness panel.
6. Improve dialog field-level error routing.
7. Add summary strip.
8. Add row-level pending/error states.
9. Improve history loading/empty/error/focused-event states.
10. Add optional filters if still within scope.
11. Harden responsive CSS.
12. Run focused tests.
13. Run typecheck.
14. Update docs if behavior or smoke checklist changed.

Do not start by restyling CSS globally. First make state and component
boundaries explicit, then apply visual polish.

## Acceptance Criteria

The spec is satisfied when:

1. Schedules page reads as a polished Mission Control operations workspace.
2. All supported schedule kinds are authorable and editable.
3. Enabled/disabled/attention states are clear in the table.
4. Next run and last decision are understandable without raw internal values.
5. Create/edit dialog explains saved-workflow semantics and local time.
6. Backend command errors remain visible in the right context.
7. Delete requires named confirmation.
8. History is a readable audit timeline with safe details.
9. History links to Runs and Workflows where available.
10. Stale schedule/event/run/workflow targets are handled explicitly.
11. Layout works at `1024x768`.
12. Icon controls have accessible labels.
13. No sensitive runtime, proxy, storage, token, cookie, or local path data is
    displayed.
14. Tests cover the changed schedule UI behavior.
15. Scheduler semantics remain unchanged unless a separate backend spec is
    approved.

## Agent Handoff Notes

Implementation agents should treat this as a UI/UX hardening spec, not a
scheduler redesign.

Important boundaries:

- Do not add cron.
- Do not add per-schedule timezone.
- Do not add catch-up queueing.
- Do not run unsaved drafts.
- Do not expose raw `details_json`.
- Do not expose sensitive identity or browser storage details.
- Do not move scheduler timing logic into React.

The best first implementation slice is:

1. Extract formatting helpers.
2. Add delete confirmation.
3. Add summary strip.
4. Add readiness panel in the dialog.
5. Improve history event rendering.
6. Then polish CSS and responsive behavior.

This keeps the pass reviewable while still delivering a complete Schedules
upgrade.
