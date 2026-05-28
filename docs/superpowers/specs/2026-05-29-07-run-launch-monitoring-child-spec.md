# Mission Control UI/UX Upgrade Child Spec 07: Run Launch And Runs Monitoring

Date: 2026-05-29

## Status

Approved design direction, drafted for user review.

This child spec follows the master UI/UX upgrade spec and child specs 01-06.
It owns manual launch UX, blocked launch presentation, active run monitoring,
and the Runs workspace.

## Brainstorming Decisions

Question: should launch become a multi-step wizard?

Approved answer: no for normal launch. Use inline preflight and clear blocked
states. A modal/wizard is justified only for future batch/per-run input flows,
not for the current manual full-run path.

Question: should Runs become a historical evidence browser?

Approved answer: no. Runs monitors active/recent session runs and can show one
bounded persisted run detail. Historical artifacts belong in Evidence Explorer.

Question: what must be most visible?

Approved answer: which run is active, whether Stop targets the right run id, why
a launch is blocked, and where to open related Workflow/Evidence/Identity.

## Goal

Make run launch and monitoring feel safe, scoped, and traceable across Workflow
Detail, Workflow Library, Overview links, Schedules, Evidence, Identity, and the
Runs page.

The implementation must:

1. Preserve saved-graph/saved-settings execution semantics.
2. Make pre-run save/validate failures readable and non-destructive.
3. Keep Stop scoped by `run_id`.
4. Show active and terminal session runs in a dense monitor.
5. Show selected durable run detail when opened from Overview/Evidence.
6. Link safely to Workflow, Evidence, and Identity.
7. Avoid raw outputs, raw local paths, cookies, tokens, proxy credentials, and
   browser storage.

## Inputs And Sources Of Truth

Read before implementation:

- `docs/README.md`
- `docs/task-routes.md`
- `DESIGN.md`
- `docs/domain/user-visible-invariants.md`
- `docs/domain/workflow-lifecycle.md`
- `docs/domain/execution-semantics.md`
- `docs/contracts/run-state.md`
- `docs/contracts/electron-ipc.md`
- `docs/architecture/frontend.md`
- Graph Builder child spec
- Workflow Settings child spec

Visual reference:

- `.stitch/designs/2026-05-28-12-polished-04-runs.html`
- Graph Builder and Workflow Library polished screens for launch entry points.

Primary source files:

- `src/App.tsx`
- `src/features/runs/pages/RunCenterPage.tsx`
- `src/features/workflows/pages/WorkflowDetailPage.tsx`
- `src/features/workflows/pages/WorkflowListPage.tsx`
- `src/features/workflows/components/RunIssuePanel.tsx`
- `src/features/workflows/components/RunStatusBar.tsx`
- `src/lib/workflowApi.ts`
- `src/lib/workflowUi.ts`
- `src/types/workflow.ts`
- `src/styles/workflows.css`
- `src/styles/layout.css`

Likely backend files only if command behavior must change:

- `electron/backend/commands.ts`
- `electron/backend/runtime/runManager.ts`

## Scope Boundaries

### In Scope

- Launch button states.
- Preflight/readiness presentation.
- Blocked launch issue routing.
- Runs page table/detail redesign.
- Stop by run id clarity.
- Active/recent session run polling presentation.
- Durable focused run detail presentation.
- Cross-workspace links.
- Stale missing-run state.

### Out Of Scope

- Runner lifecycle rewrite.
- Batch Run UI.
- Unbounded run history page.
- Raw run output viewer.
- Artifact preview or export; those belong to Evidence Explorer.
- Schedule editing; that belongs to Schedules.

## Launch UX Requirements

Workflow Detail launch flow:

- `Launch Run` is the primary command.
- Before launch, UI saves visible graph and dirty Workflow Settings.
- If graph save fails, run does not start and the error is shown as a system
  issue.
- If settings save fails, run does not start and the relevant settings path is
  described.
- If validation blocks run, focus the first blocking issue in the graph issue
  panel.
- While launch is pending, avoid duplicate launch clicks.
- While running, replace launch with `Stop` for that run and show run status.

Workflow Library launch flow:

- Row Run executes saved graph and saved Workflow Settings only.
- It does not open detail and does not save any detail-page draft.
- Active row shows the run snapshot and Stop scoped to that run id.
- Duplicate, Export, Delete, and Run are disabled only for the active workflow
  row while conflicting.

Run from selected:

- Appears only in Workflow Detail and only when enabled in Workflow Settings.
- Saves graph/settings first.
- Requires one supported selected node and a matching retained session.
- Disabled reason is visible through tooltip/helper copy.

## Preflight And Blocked States

Use compact preflight state, not a full wizard.

Preflight checks shown to the user should map to current capabilities:

- graph save;
- settings save;
- graph validation;
- settings validation/run readiness;
- workflow/profile/batch conflict;
- retained-session prerequisite for Run from selected;
- browser launch prerequisite errors.

Blocked launch presentation:

- headline: one clear reason;
- body: short explanation;
- primary fix action where possible;
- secondary actions: Validate again, Save again, Open Settings, Select node/link;
- raw details collapsed.

## Runs Page Layout

Runs page should be a monitoring workspace:

- Header with active count, session run count, and refresh/error state.
- Left/main table of session run snapshots.
- Right/top selected run detail when a durable run target is focused.
- Empty state that says runs appear after workflows start.
- Stale target state when a requested durable run is missing.

Run table columns:

- workflow;
- source (`manual` or `schedule`);
- status;
- current step;
- started;
- issue summary;
- actions.

Rows:

- Active running rows use cyan active status.
- Failed rows use red status.
- Stopped rows use neutral/amber depending on existing status mapping.
- Run id uses monospace and truncates safely.
- Stop button names the workflow/run scope and calls `stopRun(runId)`.

## Focused Durable Run Detail

When opened from Overview or another workspace, the detail region shows:

- workflow name;
- run id;
- status;
- source;
- started/finished times when available;
- sanitized error summary;
- step summary list;
- identity summary if available;
- buttons to Open Evidence, Open Workflow, Open Identity.

Do not show raw outputs or artifact paths. Use Evidence Explorer for artifacts.

## Cross-Workspace Navigation

Runs must accept typed navigation targets from the app shell.

Required links:

- Run -> Workflow Detail.
- Run -> Evidence filtered to run id.
- Run -> Identity Lab managed or historical target when identity metadata exists.
- Missing run target -> safe fallback message, not silent default view.

## Error Handling

Command errors:

- show command-facing message;
- keep the selected run context;
- do not clear session run table.

Stop errors:

- show row/global error;
- keep row active until polling confirms terminal state or command returns a
  stopped snapshot.

Polling:

- Continue polling `list_run_states` while any snapshot is running.
- Do not assume the latest run is the target when a run id is known.

## CSS And Responsive Requirements

At `1024x768`:

- Runs table hides secondary metadata before critical status/actions.
- Detail region can stack below table.
- Stop buttons do not overflow row.
- Run ids truncate with tooltip/title only if safe and not sensitive.

Follow `DESIGN.md` for status colors and density.

## Tests And Checks

Required focused tests when implemented:

- Detail launch saves graph before calling run.
- Detail launch does not start if graph/settings save fails.
- Blocking validation focuses first issue.
- Workflow list row Run uses saved workflow state and row Stop uses run id.
- Runs page sorts session snapshots by started time.
- Runs page Stop calls `onStopRun` with the selected row run id.
- Focused durable run detail links to Evidence, Workflow, and Identity.
- Missing run target renders stale state.
- No raw outputs are rendered in run detail.

Run checks:

- `npm test -- src/features/runs/pages/RunCenterPage.test.tsx` if added
- `npm test -- src/features/workflows/pages/WorkflowDetailPage.test.tsx`
- `npm test -- src/features/workflows/pages/WorkflowListPage.test.tsx`
- `npm test -- src/lib/workflowUi.test.ts`
- `npm test -- src/lib/workflowApi.test.ts` if wrappers change
- `npm test -- electron/backend/commands.test.ts` if command behavior changes
- `npx tsc --noEmit`

## Acceptance Criteria

- Manual launch is clear and hard to double-trigger.
- Blocked launch explains the first fixable problem.
- Stop always targets the intended run id.
- Runs page can monitor active session runs and focused durable run detail.
- Evidence and Identity remain the destinations for artifacts and identity
  posture.
- Sensitive raw data is not surfaced.

