# Mission Control UI/UX Upgrade Child Spec 10: Schedules

Date: 2026-05-29

## Status

Approved design direction, drafted for user review.

This child spec follows the master UI/UX upgrade spec and child specs 01-09.
It owns cross-workflow schedule creation, editing, auditing, and traceability.

## Brainstorming Decisions

Question: should schedules live inside each workflow detail page?

Approved answer: no. Schedules remains a separate sidebar workspace because it
audits automation timing across workflows.

Question: should enabling a schedule auto-fix invalid workflows?

Approved answer: no. Enabling validates current saved workflow readiness and
surfaces readable errors. Operators fix the workflow/settings explicitly.

Question: what must be clearest?

Approved answer: when the schedule will fire next, what workflow it uses, why a
run was skipped/missed/failed, and where related runs/workflows can be opened.

## Goal

Make Schedules a reliable automation calendar and audit workspace for creating,
enabling, disabling, editing, deleting, and inspecting workflow schedules.

The implementation must:

1. Preserve schedule semantics: schedules use latest saved graph/settings at
   fire time and run only while the Electron app is active.
2. Support one-time, interval, daily, weekly, and monthly authoring.
3. Make enabled/draft/invalid states obvious.
4. Make skip/miss/fail history readable and traceable.
5. Preserve stale target handling.

## Inputs And Sources Of Truth

Read before implementation:

- `docs/README.md`
- `docs/task-routes.md`
- `DESIGN.md`
- `docs/domain/user-visible-invariants.md`
- `docs/domain/workflow-lifecycle.md`
- `docs/domain/execution-semantics.md`
- `docs/contracts/workflow-types.md`
- `docs/contracts/electron-ipc.md`
- `docs/architecture/frontend.md`
- Run Launch and Runs Monitoring child spec

Visual reference:

- `.stitch/designs/2026-05-28-12-polished-06-schedules.html`

Primary source files:

- `src/features/schedules/pages/SchedulesPage.tsx`
- `src/features/schedules/pages/SchedulesPage.test.tsx`
- `src/App.tsx`
- `src/lib/workflowApi.ts`
- `src/types/workflow.ts`
- `src/styles/schedules.css`
- `electron/backend/scheduling/scheduler.ts`
- `electron/backend/scheduling/workflowScheduleRepository.ts`
- `electron/backend/commands.ts`

## Scope Boundaries

### In Scope

- Schedule list layout.
- Create/edit schedule dialog.
- Schedule kind fields.
- Enable/disable/delete actions.
- History dialog/panel.
- Focused schedule target state.
- Form validation presentation.
- Cross-links to Workflow and Runs.
- Empty/loading/error states.

### Out Of Scope

- Background service outside Electron app lifetime.
- Catch-up backlog execution.
- Calendar month view.
- Cron expression editor unless existing contract supports it.
- Batch scheduling UI.
- Workflow graph editing inside Schedules.

## Schedule List Requirements

Header:

- title;
- total schedules;
- enabled count if easy from current data;
- `New schedule` primary action.

Table columns:

- status;
- schedule name and kind summary;
- workflow;
- next run;
- last result;
- actions.

Row actions:

- Enable/Disable text action.
- Edit icon action with tooltip.
- History icon action with tooltip.
- Delete icon action with tooltip and confirmation if added by Foundation.

Focused schedule target:

- row highlight;
- small "selected schedule target" marker;
- if target missing, show stale target state with requested id.

## Create/Edit Dialog Requirements

Dialog fields:

- workflow select;
- schedule name;
- enabled switch;
- kind segmented control or select;
- kind-specific fields;
- description/help text that scheduled runs use latest saved graph/settings.

Schedule kinds:

- `once_at`: local date/time.
- `interval`: every N minutes/hours/days.
- `calendar_daily`: local time.
- `calendar_weekly`: weekdays plus local time.
- `calendar_monthly`: month day plus local time.

Validation:

- workflow required;
- name required;
- date/time required for selected kind;
- interval value positive;
- at least one weekday for weekly;
- month day valid for monthly;
- command errors shown without closing dialog.

Enabled draft behavior:

- Disabled draft schedules can point to workflows still being authored.
- Enabling validates saved workflow readiness through backend command behavior.
- Enable failure keeps schedule visible and shows readable error.

## History Requirements

History should show schedule events:

- started;
- skipped;
- missed;
- failed-to-start;
- disabled.

Each event row shows:

- timestamp;
- status;
- reason;
- related run id when present;
- related workflow action.

Traceability:

- run id opens Runs focused target.
- workflow id opens Workflow Detail.
- stale run/workflow target shows unavailable state in destination.

History is audit context, not raw logs. Do not render backend stack traces or raw
diagnostic payloads.

## Scheduler Semantics To Preserve

- Schedules run only while Electron app process is active.
- Missed occurrences are skipped and recorded; no catch-up backlog.
- If same workflow/profile/batch conflict exists, occurrence is skipped with
  reason `active_workflow`, `active_profile`, or `active_batch`.
- One-time schedules are disabled after their opportunity, including skipped
  opportunities.
- Isolated schedules can start concurrently.
- Scheduled runs use saved graph/settings, not unsaved detail drafts.

## Error And Empty States

Empty state:

- explain schedules automate saved workflows;
- offer New schedule.

Loading:

- preserve page geometry.

Errors:

- page-level load errors in alert region;
- dialog command errors near footer/header;
- row action errors do not clear table.

## CSS And Responsive Requirements

Follow `DESIGN.md`.

At `1024x768`:

- table hides less important metadata first;
- row actions wrap without overlap;
- create/edit dialog stays inside viewport;
- weekday controls do not overflow;
- history list scrolls internally.

## Tests And Checks

Required focused tests when implemented:

- Empty/loading/error states.
- Create dialog opens with default form.
- Each schedule kind renders correct fields.
- Form submits expected `WorkflowScheduleInput`.
- Invalid form shows errors and does not submit.
- Edit dialog loads schedule values.
- Enable/disable/delete call correct callbacks.
- History opens and calls `onLoadEvents`.
- History run/workflow links call callbacks.
- Focused schedule row is highlighted.

Run checks:

- `npm test -- src/features/schedules/pages/SchedulesPage.test.tsx`
- `npm test -- src/App.test.tsx` if navigation changes
- `npm test -- src/lib/workflowApi.test.ts` if wrappers change
- `npm test -- electron/backend/scheduling/scheduler.test.ts` if semantics change
- `npm test -- electron/backend/scheduling/workflowScheduleRepository.test.ts` if persistence changes
- `npm test -- electron/backend/commands.test.ts` if command behavior changes
- `npx tsc --noEmit`

## Acceptance Criteria

- Operators can create, edit, enable, disable, delete, and audit schedules.
- Next run and last result are scannable.
- Schedule history explains skipped/missed/failed decisions.
- Related runs/workflows are traceable.
- Existing scheduler semantics remain intact.

