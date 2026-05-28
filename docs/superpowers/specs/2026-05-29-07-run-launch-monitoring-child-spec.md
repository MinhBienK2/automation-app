# Mission Control UI/UX Upgrade Child Spec 07: Run Launch And Runs Monitoring

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

It owns manual run launch UX, run preflight/blocking presentation, run status
surfaces, row-level/list-level run actions, and the Runs workspace. Evidence
Explorer owns artifacts. Identity Lab owns identity posture. Schedules owns
schedule authoring and schedule event history.

## Brainstorming Scope

The user asked for one-spec-at-a-time `$brainstorming` and pre-approved the
recommended choices. This spec records the decisions for run launch and run
monitoring so implementation agents do not blur the boundaries between Graph
Builder, Runs, Evidence, Identity, and Schedules.

Runs are a safety-critical UI surface because the app can run multiple isolated
workflows, stop a specific run by id, reuse retained browser sessions, and
persist evidence. The UX must make scope explicit.

## Brainstorming Decisions

### Decision 1: Launch Flow Shape

Question: should manual launch become a multi-step wizard, a lightweight
confirmation, or direct run with inline blockers?

Options considered:

- Multi-step wizard.
  - Pros: can explain every preflight item.
  - Cons: slows expert operators and duplicates settings/validation screens.
- Direct run with no confirmation.
  - Pros: fastest.
  - Cons: weak scope confirmation for browser identity, retained sessions, and
    save-before-run behavior.
- Lightweight confirmation/preflight.
  - Pros: confirms scope, keeps speed, leaves detailed fixes in issue panel and
    settings.
  - Cons: must avoid becoming a hidden wizard.

Recommended and approved: lightweight confirmation/preflight for Graph Builder
launch; direct row run remains available from Workflow Library using saved
state.

### Decision 2: Runs Page Role

Question: should Runs be a full historical run browser or a live/session monitor?

Options considered:

- Full historical run browser.
  - Pros: one place for all run records.
  - Cons: overlaps Evidence Explorer and requires broader retention/history
    features.
- Session monitor only.
  - Pros: focused and matches current `list_run_states`.
  - Cons: cannot show Overview-targeted durable details.
- Session monitor plus one focused durable detail.
  - Pros: matches current code; supports Overview/Evidence navigation without
    becoming unbounded history.
  - Cons: requires clear stale target handling.

Recommended and approved: Runs is a session monitor plus one bounded focused
persisted run detail.

### Decision 3: Stop Scope

Question: should Stop be workflow-scoped, latest-run scoped, or run-id scoped?

Options considered:

- Stop latest run.
  - Pros: simple.
  - Cons: unsafe when multiple runs are active.
- Stop workflow.
  - Pros: understandable from list/detail.
  - Cons: backend cancellation is run-id scoped and multiple workflows can run.
- Stop run id.
  - Pros: precise and matches contract.
  - Cons: UI must show enough run context.

Recommended and approved: Stop always targets `run_id` when known. Omitted
`runId` remains only for legacy/single-active fallback where current backend
allows it.

### Decision 4: Blocked Launch Presentation

Question: should launch blockers appear as toasts, modal errors, or graph/run
issue panel items?

Options considered:

- Toasts only.
  - Pros: quick.
  - Cons: easy to miss and weak for multiple validation issues.
- Modal error only.
  - Pros: interruptive.
  - Cons: blocks graph fixing.
- Run issue panel plus graph/setting routing.
  - Pros: keeps fix context visible and routes to affected object.
  - Cons: needs consistent issue modeling.

Recommended and approved: use `RunIssuePanel` and graph/settings routing for
fixes. The launch dialog should not become the main error surface.

### Decision 5: Evidence Boundary

Question: should Runs show screenshots/downloads directly?

Options considered:

- Inline artifact previews in Runs.
  - Pros: convenient.
  - Cons: duplicates Evidence Explorer and risks raw path leakage.
- Only links to Evidence.
  - Pros: clear ownership and safe backend artifact commands.
  - Cons: extra click for artifacts.

Recommended and approved: Runs links to Evidence. Evidence owns previews,
artifact reveal, and bundle export.

### Decision 6: Identity Boundary

Question: should Runs show full identity diagnostics?

Options considered:

- Full identity detail inside Runs.
  - Pros: context-rich.
  - Cons: duplicates Identity Lab.
- Compact identity reference with link.
  - Pros: traceable and bounded.
  - Cons: needs Identity target routing.

Recommended and approved: Runs shows compact identity context and links to
Identity Lab.

### Decision 7: Component Split

Question: should Runs remain one component or be split?

Options considered:

- Keep one `RunCenterPage`.
  - Pros: simple.
  - Cons: table/detail/preflight/stale states can grow.
- Split into table, detail, empty/stale panels.
  - Pros: testable and readable.
  - Cons: more files.

Recommended and approved: split by responsibility if implementation grows.

## Goal

Make run launch and run monitoring safe, scoped, and traceable across Workflow
Detail, Workflow Library, Overview, Runs, Evidence, Identity, and Schedules.

The implementation must:

1. Preserve saved-graph and saved-settings execution semantics.
2. Make manual Graph Builder launch confirmation clear but lightweight.
3. Make blocked launch issues actionable.
4. Keep Stop scoped to the correct run id.
5. Keep Workflow Library row-run behavior understandable.
6. Make Runs a dense monitor for active/recent session runs.
7. Support a bounded persisted run detail when navigated from Overview or other
   workspaces.
8. Link to Evidence, Workflow, and Identity without exposing raw outputs.
9. Preserve scheduler/source provenance.
10. Avoid unbounded run history and artifact browsing in Runs.

## Inputs And Sources Of Truth

### Required Reading Before Implementation

Follow repo workflow first:

1. `docs/README.md`
2. `docs/task-routes.md`
3. `DESIGN.md`
4. `docs/domain/user-visible-invariants.md`
5. `docs/domain/workflow-lifecycle.md`
6. `docs/domain/execution-semantics.md`
7. `docs/contracts/run-state.md`
8. `docs/contracts/electron-ipc.md`
9. `docs/architecture/frontend.md`
10. Graph Builder child spec.
11. Workflow Settings child spec.
12. This spec.

### Visual Baseline

Use:

- `.stitch/designs/2026-05-28-12-polished-04-runs.html`
- `.stitch/designs/2026-05-28-12-polished-03-graph-builder.html` for launch
  entry point hierarchy.
- `.stitch/designs/2026-05-28-12-polished-01-workflow-library.html` for row-run
  and active row treatment.

Use Stitch as layout reference, not as contract truth.

### Current Source Areas

Primary files likely touched:

- `src/App.tsx`
- `src/features/runs/pages/RunCenterPage.tsx`
- `src/features/workflows/pages/WorkflowDetailPage.tsx`
- `src/features/workflows/pages/WorkflowListPage.tsx`
- `src/features/workflows/components/RunIssuePanel.tsx`
- `src/features/workflows/components/RunStatusBar.tsx`
- `src/features/workflows/components/WorkflowGraphEditor.tsx`
- `src/lib/workflowApi.ts`
- `src/lib/workflowUi.ts`
- `src/types/workflow.ts`
- `src/styles/workflows.css`
- `src/styles/layout.css`
- `src/styles/responsive.css`

Backend files only if behavior changes:

- `electron/backend/commands.ts`
- `electron/backend/runtime/runManager.ts`
- `electron/backend/runtime/runner.ts`

Likely tests:

- add `src/features/runs/pages/RunCenterPage.test.tsx`
- `src/features/workflows/pages/WorkflowDetailPage.test.tsx`
- `src/features/workflows/pages/WorkflowListPage.test.tsx`
- `src/lib/workflowUi.test.ts`
- `src/lib/workflowApi.test.ts`
- `electron/backend/commands.test.ts` only if command behavior changes

## Current Implementation Readout

### Workflow Detail Launch

Current `WorkflowDetailPage.tsx` already:

- shows `Launch Run`;
- opens a launch confirmation dialog;
- shows graph save state;
- shows browser identity label;
- shows browser session label;
- calls `onRunGraph` after confirm;
- shows `Stop` while running;
- includes `Run from selected` when props say to show it.

Current problem:

- The launch confirmation needs stronger scope/preflight language and better
  relationship to issue panel. It should confirm, not become the place where all
  validation logic is displayed.

### Run Issue Panel

Current `RunIssuePanel.tsx` already:

- groups issues;
- shows first issue;
- shows blocking/runtime/system severity;
- supports stale `Needs recheck`;
- supports Validate again, Run again, Save again;
- supports Select node/link;
- collapses details;
- copies details.

Current problem:

- It needs stronger spec-level rules for launch blockers, validation versus
  command errors, first-issue priority, stale issues, and routing.

### Run Status Bar

Current `RunStatusBar.tsx` already:

- derives `runStatusLabel`;
- shows failed step reason;
- shows app error.

Current problem:

- It can be too verbose in compact header. The spec should clarify where status
  is summarized versus where details live.

### Runs Page

Current `RunCenterPage.tsx` already:

- sorts run snapshots by `started_at` descending;
- shows active count;
- shows session run count;
- shows missing run target;
- shows focused persisted run detail;
- links to Evidence, Workflow, Identity;
- shows run table;
- stops running rows by run id.

Current problem:

- The page is functionally right but needs denser layout, clearer selected
  detail, status/source treatment, empty/error states, and sensitive-data
  boundaries.

### App Orchestration

Current `App.tsx` already:

- tracks `runSnapshots`;
- polls `listRunStates` while any snapshot is running;
- falls back to legacy `getRunState`;
- loads focused persisted run detail through `getOperationalRunDetail`;
- routes Runs targets;
- calls `runWorkflow`;
- calls `runWorkflowFromNode`;
- calls `stopRun`;
- passes run snapshots into Workflow List, Detail, and Runs.

Current problem:

- UI needs to keep run-id scoping and target routing explicit as the visuals get
  richer.

## Scope Boundaries

### In Scope

- Graph Builder launch confirmation/preflight copy.
- Graph Builder blocked launch UX.
- `RunIssuePanel` polish and routing.
- `RunStatusBar` compact status usage.
- Workflow Library active row run/stop presentation if needed for consistency.
- Runs page header, table, detail, stale target, empty/loading/error states.
- Stop by run id clarity.
- Cross-workspace links from Runs to Evidence/Workflow/Identity.
- Tests for run UI behavior.

### Out Of Scope

- Backend runner rewrite.
- New run-state shape unless absolutely required.
- Batch Run UI.
- Unbounded run history browser.
- Artifact preview/reveal/export.
- Evidence bundle export.
- Identity diagnostics detail.
- Schedule create/edit/history UI.
- Raw output viewer.

## Non-Negotiable Invariants

Preserve these:

- Graph Builder run saves visible graph before execution.
- Graph Builder run saves dirty Workflow Settings before execution.
- If graph save fails, run does not start.
- If settings save fails, run does not start.
- Graph validation issues are shown before execution.
- Start-only graph cannot start runner execution.
- Unconfigured action node blocks validation/compile/run.
- Full runs use persisted Workflow Settings as run baseline.
- Workflow List Run executes saved graph and saved settings without opening
  detail or saving detail drafts.
- List Run disabled only for workflow with active run.
- Row Stop is scoped to that workflow run id.
- Different workflows can run concurrently when they do not share profile.
- Same workflow/profile conflicts are rejected with readable errors.
- Batch remains globally exclusive.
- Stop returns stopped state immediately for targeted run id.
- `list_run_states` is the source for session run snapshots.
- `get_run_state` remains fallback only.
- Runs displays all session run snapshots and can stop selected active run by id.
- Runs focused durable detail is bounded and safe.
- Evidence owns artifact previews/reveal/export.
- Identity Lab owns identity posture/diagnostics.
- Sensitive values are not rendered.

## Run Launch Information Architecture

Manual launch has four visible layers:

1. Header command.
2. Lightweight launch confirmation.
3. Run issue panel.
4. Canvas/inspector issue location.

Responsibilities:

- Header command starts launch intent.
- Confirmation confirms scope and save-before-run pipeline.
- Issue panel explains blockers/failures.
- Canvas/inspector shows where to fix graph objects.

Do not move full validation issue lists into the launch confirmation.

## Graph Builder Launch Requirements

### Launch Button

`Launch Run`:

- is primary text action;
- disabled while running;
- opens confirmation before run;
- should not be icon-only;
- should not be hidden because graph has known issues. Let confirmation or
  issue panel explain blockers.

### Launch Confirmation

Confirmation should show:

- workflow name;
- graph save state;
- browser identity label if available;
- session/retention label if available;
- note that current visible graph will be saved;
- note that dirty Workflow Settings will be saved;
- note that validation and browser launch checks run before execution.

If known blocking issues exist:

- show compact warning;
- primary action may remain available if current backend validation will block,
  but warning should direct to Validate/issue panel;
- implementation may disable confirm only if doing so does not hide the
  canonical validation path.

Confirmation actions:

- Cancel;
- Launch Run.

Do not add:

- graph editor controls;
- settings form;
- artifact preview;
- raw run output.

### Launch Pending

While launch/save/validation/run command is pending:

- prevent duplicate launches;
- keep confirmation or page status stable;
- show command-facing error if failed;
- do not clear graph selection or issue context.

## Workflow Library Row Run Requirements

Workflow Library row Run:

- runs saved graph and saved Workflow Settings;
- does not open detail;
- does not save detail-page draft;
- shows active row status;
- disables only conflicting row actions: Run, Duplicate, Export, Delete;
- leaves View Details available unless current app state blocks it for a reason;
- exposes Stop scoped to active row run id.

Row Stop:

- names workflow or run scope;
- calls `stopRun(runId)`;
- does not stop a different active run.

If row run fails before creating a run:

- show readable command error;
- do not mark row as running;
- if backend writes operational attention for launch_blocked, Overview owns
  attention display.

## Run From Selected Requirements

Run from selected:

- lives in Workflow Detail only;
- appears only when enabled in Workflow Settings Run Policy;
- saves visible graph first;
- saves dirty settings first;
- requires one supported selected main-path node;
- requires Reuse login session;
- requires browser retention `retain`;
- requires matching retained session;
- does not launch a new browser when retained session is stale;
- disabled reason is available in title/tooltip/helper copy.

Run from selected launch confirmation:

- may reuse lightweight confirmation if current flow supports it;
- must make selected node scope clear;
- must distinguish `selected_only` versus `from_selected`.

## Blocked Launch Requirements

Blocked launch causes:

- graph save failure;
- dirty settings save failure;
- graph validation issue;
- settings validation issue;
- workflow conflict;
- profile conflict;
- active batch conflict;
- retained session prerequisite failure for Run from selected;
- browser launch prerequisite failure;
- missing headed display;
- unsupported graph semantics.

Presentation:

- one clear headline;
- short summary;
- affected node/link/settings context when available;
- action to validate/save/open settings/select node/select link;
- raw details collapsed.

Do not use toast-only blockers.

## Run Issue Panel Requirements

### Severity Priority

Priority order:

1. blocking validation issues;
2. system/startup/save errors that prevent run start;
3. runtime failure;
4. stale issues after edit.

If runtime failure and stale validation issues both exist, show the one most
relevant to the current command context. Preserve access to the other in the
issue list if available.

### Blocking Issue

Blocking issue should show:

- `Run blocked`;
- count of blocking issues;
- first issue title/message;
- Validate again;
- Select node/link when mapped.

### System Issue

System issue should show:

- `Could not start run` or equivalent;
- save/settings/command context;
- Save again or Open Settings where useful;
- Details collapsed.

### Runtime Failure

Runtime failure should show:

- failed step number;
- step name;
- action type;
- short reason;
- Select failed node when mapped;
- Run again;
- Details collapsed;
- Copy details.

### Stale Issue

Stale issue should show:

- `Needs recheck`;
- explanation that graph/settings changed after issue was produced;
- Validate again.

### Details Safety

Long error details:

- collapsed by default;
- copyable;
- should not render as unbounded page text;
- rely on backend sanitization but do not add new raw output display.

## Run Status Bar Requirements

RunStatusBar should answer only:

- current status label;
- failed step summary if terminal failed;
- app error summary if present.

It should not become:

- full issue list;
- raw output viewer;
- artifact viewer.

In compact header:

- keep status one line where possible;
- move details to issue panel if too long.

## Runs Workspace Information Architecture

Runs page has three zones:

1. Header summary.
2. Focused run detail or stale target state.
3. Session run table.

The page answers:

- what is running now;
- what ran recently in this app session;
- what run target was opened from another workspace;
- where to inspect evidence/workflow/identity.

It does not answer:

- all historical runs;
- artifact preview;
- full identity diagnostics;
- schedule editing.

## Runs Header Requirements

Header should show:

- eyebrow: `Execution`;
- title: `Runs`;
- active run count;
- session run count;
- refresh/loading state if exposed by parent;
- page-level error.

Counts:

- active count is snapshots with `state.status === "running"`;
- session count is `runSnapshots.length`.

Error:

- page-level command/load errors appear without clearing existing table.

## Session Run Table Requirements

### Sorting

Sort by `started_at` descending.

If timestamp parse is unreliable, preserve current string compare or add helper
with tests.

### Columns

Columns:

- Workflow;
- Source;
- Status;
- Step;
- Started;
- Issue;
- Actions.

Optional additional metadata only if data already exists safely:

- run id;
- current step id;
- retained session marker.

### Workflow Cell

Shows:

- workflow name;
- run id as monospace small text;
- stale/unavailable workflow marker if needed.

Run id can be truncated visually, but full run id should remain accessible if
safe through title or copy only if current component pattern supports it.

### Source Cell

Values:

- manual;
- schedule.

Display should be user-friendly, but serialized value must remain clear.

### Status Cell

Use semantic status:

- running: cyan active;
- success: green;
- failed: red;
- stopped: neutral or amber according to current status helper;
- idle should not normally appear in run table but must not break layout.

Do not rely on color alone.

### Step Cell

Show:

- current step number when running;
- dash if unavailable;
- optional current step id only if helpful and safe.

Do not show raw run output.

### Issue Cell

Show compact first-line issue summary:

- first line only;
- truncate safely;
- no raw multiline stack display;
- failed run detail can show bounded sanitized summary.

### Actions Cell

Running rows:

- show Stop button;
- Stop calls `onStopRun(run.run_id)`.

Terminal rows:

- no Stop;
- optional Open Evidence/Open Workflow only if table design supports it without
  clutter. Focused detail is preferred for cross-links.

## Focused Durable Run Detail Requirements

Focused detail is shown when `focusedRunDetail` exists.

Show:

- `Persisted Run` eyebrow;
- workflow name;
- status;
- run id;
- source if available;
- started time;
- finished time if available;
- sanitized error summary;
- identity summary if available;
- step summary list;
- actions.

Actions:

- Open Evidence;
- Open Workflow;
- Open Identity when identity id exists.

Step summary list:

- step number;
- action type;
- status;
- sanitized error summary or node id;
- no raw trace JSON by default.

### Missing Run Target

When `missingRunId` exists and no focused detail:

- show `Run target unavailable`;
- show requested run id;
- show stale target badge;
- explain durable run history no longer has that run;
- keep session run table visible.

Do not silently fall back to newest run.

## Cross-Workspace Navigation

Runs must support typed navigation:

- Overview attention/recent activity -> Runs focused run detail.
- Evidence detail -> Runs focused run detail.
- Schedule history -> Runs focused run detail.
- Runs detail -> Evidence filtered by run id.
- Runs detail -> Workflow Detail.
- Runs detail -> Identity Lab managed/historical target where available.

Rules:

- use typed Mission Control navigation target;
- do not pass raw strings as arbitrary route names;
- stale target renders explicit unavailable state.

## Data Flow

### Session Run Polling

1. App starts or run command returns snapshot.
2. Parent stores normalized snapshot in `runSnapshots`.
3. While any snapshot is running, parent polls `listRunStates`.
4. Parent normalizes snapshots.
5. Runs, Workflow Library, and Workflow Detail render snapshots.
6. When all terminal, polling can stop.

Fallback:

- `getRunState` remains legacy/latest-state fallback when older test bridge
  omits `listRunStates`.

### Manual Full Run

1. User confirms Launch Run in Graph Builder.
2. Parent saves graph.
3. Parent saves dirty settings.
4. Parent calls run command.
5. Backend validates graph/settings and conflicts.
6. Backend creates run snapshot/row if start succeeds.
7. Parent adds snapshot to session list.
8. Polling updates progress.

If any pre-run save fails, run command is not called.

### Workflow List Run

1. User clicks row Run.
2. Parent calls `runWorkflow(workflow.id)` directly against saved state.
3. Returned snapshot is stored.
4. Row status and Stop use snapshot run id.
5. User remains on Workflow Library.

### Run From Selected

1. User selects supported node.
2. User clicks Run from selected.
3. Parent saves graph/settings.
4. Parent calls `runWorkflowFromNode(workflowId, nodeId)`.
5. Backend rejects if retained session prerequisites fail.
6. Returned snapshot updates session list.

### Stop

1. User clicks Stop in row/detail/Runs.
2. UI calls `stopRun(runId)` when known.
3. Backend returns stopped snapshot.
4. Parent updates matching snapshot.
5. Polling eventually confirms terminal cleanup.

Do not use latest active run when a run id is available.

## State Matrix

### Launch States

| State | UI Response |
| --- | --- |
| idle clean | Launch Run enabled |
| graph dirty | launch notes graph will save first |
| settings dirty | launch notes settings will save first |
| save pending | launch/confirm disabled or pending |
| graph save failed | run not started; issue/system error shown |
| settings save failed | run not started; settings error shown |
| validation blocked | issue panel with blocking issues |
| conflict blocked | command error with readable scope |
| launching | duplicate clicks blocked |
| running | Stop visible; Launch disabled |
| terminal success | status success; Evidence link available where relevant |
| terminal failed | failure issue panel and graph failed node |
| stopped | stopped status |

### Runs Page States

| State | UI Response |
| --- | --- |
| no snapshots | empty state |
| active snapshots | active count and Stop actions |
| terminal snapshots | table rows without Stop |
| focused detail | detail panel plus session table |
| missing target | stale target panel plus session table |
| load error | error region, preserve existing data |
| stop pending | row action pending if state exposed |
| stop failed | error region, preserve row |

## Security And Sensitive Data Boundaries

Runs and launch UI must not render:

- cookies;
- tokens;
- proxy passwords;
- proxy URL credentials;
- browser local/session storage;
- raw profile contents;
- arbitrary local file paths;
- raw run outputs;
- raw action trace JSON;
- unbounded diagnostic payloads.

Allowed:

- run id;
- workflow name/id;
- source;
- status;
- step number;
- action type;
- sanitized error summary;
- identity id/display name if typed read model includes it;
- evidence/run/workflow target ids.

Evidence artifacts must be opened through Evidence Explorer backend commands,
not Runs.

## Accessibility Requirements

Required:

- Runs page has `h1` title.
- Run summary has accessible label.
- Run table has headers.
- Stop buttons have scoped accessible names.
- Focused run detail has accessible label.
- Missing target state has accessible label.
- Error region uses alert treatment.
- Status is not color-only.
- Buttons are keyboard reachable.
- Long run ids and issue summaries do not trap focus or overflow.

Graph launch:

- launch dialog has title and description;
- Cancel and Launch buttons are keyboard reachable;
- pending/disabled state is clear;
- issue panel buttons have accessible names.

## Layout And CSS Requirements

Follow `DESIGN.md`.

### Runs Page Desktop

Layout:

- header at top;
- focused detail above table or side-by-side if width supports it;
- session table in stable panel;
- no nested decorative cards;
- dense table rows.

### Runs Page Compact

At `1024x768`:

- table wrapper scrolls horizontally only if unavoidable;
- preferably hide secondary metadata first;
- Stop button text does not overflow row;
- focused detail stacks above table;
- step summaries scroll internally if long;
- run ids wrap/truncate safely.

### Graph Launch Compact

Launch dialog:

- fits viewport;
- content scrolls internally if needed;
- buttons remain visible;
- long workflow names wrap.

## Component Architecture

### Recommended Runs Split

If `RunCenterPage.tsx` grows, split into:

```text
src/features/runs/pages/
  RunCenterPage.tsx
  RunCenterHeader.tsx
  RunSessionTable.tsx
  FocusedRunDetail.tsx
  MissingRunTargetPanel.tsx
  runCenterPresentation.ts
  RunCenterPage.test.tsx
```

Keep `RunCenterPage` as public page component.

### Recommended Helpers

`runCenterPresentation.ts` can own:

- sorted run snapshots;
- active count;
- compact issue summary;
- status tone;
- source label;
- stop button label;
- stale target copy.

Keep helpers pure and tested.

### Existing Shared Helpers

Continue using:

- `runStatusLabel`;
- `normalizeRunState`;
- `normalizeRunSnapshot`;
- `buildRunIssues`;
- `commandMessage`.

Do not duplicate run-state normalization in the page.

## Error Handling

### Command Errors

Command errors should:

- show `commandMessage(error)`;
- preserve existing run snapshots;
- not clear focused detail;
- not navigate away.

### Stop Errors

Stop errors should:

- show page or row-level error;
- keep row visible;
- keep Stop available unless backend state says terminal;
- avoid pretending stop succeeded before command returns if no stopped snapshot
  is returned.

### Missing Data

Missing workflow in focused run detail:

- show unavailable workflow marker;
- keep run detail visible.

Missing identity:

- hide Open Identity or show unavailable marker;
- do not create fake identity target.

Missing evidence:

- Open Evidence can still filter by run id; Evidence page owns empty state.

## Implementation Sequence

Recommended order:

1. Add/adjust run presentation helper tests if new helpers are needed.
2. Improve RunIssuePanel copy/state while preserving callbacks.
3. Improve Graph Builder launch confirmation copy/state.
4. Add/adjust Workflow Detail launch tests.
5. Improve RunCenterPage layout and split components if needed.
6. Add RunCenterPage tests.
7. Verify Workflow Library row run/stop scoping still passes.
8. Harden responsive CSS.
9. Run focused checks.
10. Update docs only if behavior/contracts changed.

Do not start by editing backend runner.

## Test Plan

### Helper Tests

Add or update tests for:

- active run count;
- sorting by started time;
- compact issue summary first-line truncation;
- status tone/label mapping;
- stop label includes workflow/run scope;
- missing target copy.

Likely files:

- `src/lib/workflowUi.test.ts`
- new `src/features/runs/pages/runCenterPresentation.test.ts` if helper added.

### Runs Page Tests

Add `RunCenterPage.test.tsx` if not present.

Required tests:

- renders empty state when no session runs;
- renders active/session counts;
- sorts runs descending by started time;
- renders source/status/current step/issue;
- running row Stop calls `onStopRun(run_id)`;
- terminal row does not show Stop;
- focused run detail renders sanitized summary;
- focused run detail Open Evidence passes run id;
- focused run detail Open Workflow passes workflow id;
- focused run detail Open Identity passes typed target;
- missing run target renders stale state;
- error renders without clearing table;
- raw outputs from fixture are not rendered.

### Workflow Detail Tests

Required tests:

- Launch Run opens confirmation;
- confirmation calls `onRunGraph`;
- Launch disabled while running;
- Stop calls current run stop callback;
- known blocking issues are shown in issue panel;
- issue panel Select node/link emits selection request;
- graph save failure blocks run if parent test can simulate it;
- settings save failure blocks run if parent test can simulate it.

### Workflow Library Tests

Required tests:

- row Run calls saved workflow command;
- row Stop calls `stopRun` with row run id;
- active row disables only conflicting actions;
- list-started run stays visible and polling updates snapshot.

### Checks

Run:

- `npm test -- src/features/runs/pages/RunCenterPage.test.tsx` if added
- `npm test -- src/features/workflows/pages/WorkflowDetailPage.test.tsx`
- `npm test -- src/features/workflows/pages/WorkflowListPage.test.tsx`
- `npm test -- src/lib/workflowUi.test.ts`
- `npm test -- src/lib/workflowApi.test.ts` if wrappers change
- `npm test -- src/AppCss.test.ts`
- `npx tsc --noEmit`

If command behavior changes:

- `npm test -- electron/backend/commands.test.ts`
- `npm test -- electron/backend/runtime/runManager.test.ts`
- `npm run build:electron`

## Manual QA Checklist

Verify:

- open Workflow Detail;
- click Launch Run;
- confirm launch dialog copy;
- cancel launch;
- launch when graph/settings dirty in a test path;
- see blocked validation issue;
- use issue Select node/link;
- start a run from Workflow Library row;
- verify row Stop targets that run;
- open Runs;
- see active count;
- stop a running row from Runs;
- open Runs focused from Overview or direct target;
- see focused run detail;
- open Evidence from run detail;
- open Workflow from run detail;
- open Identity from run detail when identity exists;
- navigate to stale/missing run target;
- resize to `1024x768`;
- confirm no overflow.

## Documentation Requirements

Update docs if implementation changes current truth:

- `docs/contracts/run-state.md` for run-state shape or lifecycle changes.
- `docs/domain/execution-semantics.md` for run/stop/cancel behavior changes.
- `docs/domain/workflow-lifecycle.md` for launch/save/polling behavior changes.
- `docs/architecture/frontend.md` for ownership/component split changes.
- `docs/contracts/electron-ipc.md` for command changes.
- `docs/task-routes.md` if checks/routes change.
- `README.md` smoke checklist if run workflow smoke changes.

If implementation is UI-only and preserves behavior/contracts, state docs did
not need updates beyond this spec.

## Acceptance Criteria

Run Launch and Runs Monitoring is complete when:

- Graph Builder launch is clear, scoped, and lightweight.
- Save-before-run and settings-save-before-run behavior are preserved.
- Blocked launches produce actionable issue/system states.
- Stop always targets the intended run id when known.
- Workflow Library row Run/Stop remains saved-state and run-id scoped.
- Run from selected prerequisites remain explicit.
- Runs page monitors active/recent session snapshots.
- Runs page shows one bounded focused durable run detail.
- Missing run target state is explicit.
- Runs links to Evidence, Workflow, and Identity without duplicating those
  workspaces.
- Raw outputs/artifacts/sensitive data are not rendered.
- Compact desktop is usable.
- Focused tests cover changed behavior.

## Agent Handoff Notes

For the coding agent implementing this spec:

- Use TDD because this is user-visible behavior.
- Keep backend runner semantics unchanged unless tests prove a missing contract.
- Do not build run history or artifact preview here.
- Do not use latest run as fallback when a run id is available.
- Preserve `listRunStates` polling as the main session monitor path.
- Keep Evidence and Identity boundaries clean.
- Read `DESIGN.md` before CSS changes.

