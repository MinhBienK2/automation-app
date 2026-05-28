# Mission Control UI/UX Upgrade Child Spec 02: Shell Navigation Search Alerts

Date: 2026-05-29

## Status

Approved design direction, drafted for user review.

This child spec follows:

- `docs/superpowers/specs/2026-05-28-mission-control-full-product-ui-ux-upgrade-master-spec.md`
- `docs/superpowers/specs/2026-05-28-01-foundation-ui-system-child-spec.md`

It assumes the Foundation spec either already exists in code or is being
implemented immediately before this spec. If a Foundation pattern is missing,
extend Foundation instead of creating a parallel shell-only component system.

## Goal

Upgrade Mission Control shell navigation, command search, alerts, and stale
target UX into a coherent, AI-agent-friendly shell layer.

The implementation must:

1. Keep current behavior and typed navigation semantics.
2. Convert sidebar rendering to data-driven navigation config.
3. Replace the current flat command search dropdown with a lightweight command
   palette.
4. Extract command search and navigation helper logic out of `src/App.tsx`.
5. Add a dedicated stale target model and UI pattern.
6. Replace direct Alerts routing with a preview popover that still opens
   Overview Attention Queue.
7. Add command-ready keyboard UX without breaking inputs, dialogs, graph editor,
   or feature forms.

This spec must not add backend APIs, broaden command search beyond existing safe
read models, or create a full command center.

## Inputs And Sources Of Truth

### Required Reading Before Implementation

Follow repo workflow first:

1. `docs/README.md`
2. `docs/task-routes.md`
3. `DESIGN.md`
4. `docs/architecture/frontend.md`
5. `docs/domain/user-visible-invariants.md`
6. Foundation child spec.
7. This spec.

### Current Source Areas

Likely touched:

- `src/App.tsx`
- `src/layouts/AppShell.tsx`
- `src/layouts/AppSidebar.tsx`
- `src/layouts/AppShell.test.tsx`
- `src/App.test.tsx`
- `src/types/workflow.ts` only if a narrow type refinement is unavoidable
- `src/styles/layout.css`
- `src/styles/responsive.css`

Likely added:

- `src/lib/missionControlNavigation.ts`
- `src/lib/missionControlNavigation.test.ts`
- `src/lib/commandSearch.ts`
- `src/lib/commandSearch.test.ts`
- Optional `src/features/shell/useCommandSearch.ts` if hook extraction is
  clearer than keeping async search state in `App.tsx`.
- `src/components/patterns/CommandPalette.tsx`
- `src/components/patterns/AlertPreviewPopover.tsx`
- `src/components/patterns/StaleTargetPanel.tsx`

Do not touch:

- `electron/`
- Backend read models.
- SQLite repositories.
- Runner/browser code.
- Workflow graph data model.

## Current Behavior To Preserve

- Sidebar order remains:
  Overview, Workflows, Runs, Evidence, Schedules, Identities, Settings.
- Overview remains the default screen.
- Search covers bounded safe read models:
  workflows, current run snapshots, schedules, persisted evidence summaries,
  and Identity Lab summaries.
- Search results route through `MissionControlTarget`.
- Alerts focus Overview Attention Queue.
- Evidence and identity search must not expose raw outputs, cookies, tokens,
  proxy credentials, browser storage, profile contents, absolute local paths, or
  arbitrary diagnostic payloads.
- Stale durable run or schedule targets must not silently fall back.
- Renderer still calls backend only through typed `workflowApi` wrappers.

## Architecture And Extraction

### Target Structure

Preferred:

```text
src/layouts/
  AppShell.tsx
  AppSidebar.tsx

src/components/patterns/
  CommandPalette.tsx
  AlertPreviewPopover.tsx
  StaleTargetPanel.tsx

src/lib/
  missionControlNavigation.ts
  commandSearch.ts
```

Allowed alternative for stateful hook:

```text
src/features/shell/
  useCommandSearch.ts
```

Pure helpers belong in `src/lib/`. UI surfaces belong in
`src/components/patterns/`. `App.tsx` remains the high-level orchestrator.

### Extract From `App.tsx`

Move pure or mostly pure logic out of `App.tsx`:

- Active sidebar item mapping from current screen.
- `OperationsNavigationTarget` to `MissionControlTarget` conversion.
- Target labels and descriptions.
- Stale target descriptor construction.
- Command result formatting.
- Local workflow/run/schedule result building.
- Result grouping, dedupe, and limit logic.
- Safe context fallbacks.

### Keep In `App.tsx`

Keep side effects and feature orchestration:

- Main screen state.
- Opening workflows and workflow settings.
- Opening evidence and loading evidence details.
- Opening identities and loading Identity Lab overview.
- Opening runs and loading focused run detail.
- Opening schedules and loading schedule history.
- Calling Electron bridge wrappers.
- Wiring shell callbacks to feature pages.

### Optional `useCommandSearch`

Create a hook only if it reduces `App.tsx` complexity without hiding important
side effects.

Possible hook API:

```ts
type UseCommandSearchInput = {
  workflows: WorkflowSummary[];
  runSnapshots: RunStateSnapshot[];
  schedules: WorkflowScheduleSummary[];
  listEvidenceItems: typeof listEvidenceItems;
  getIdentityLabOverview: typeof getIdentityLabOverview;
};

type UseCommandSearchResult = {
  query: string;
  setQuery: (query: string) => void;
  groupedResults: CommandSearchResultGroup[];
  flatResults: CommandSearchResult[];
  loading: boolean;
  error: string | null;
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  clear: () => void;
};
```

If the hook is not created, equivalent state extraction must still be clear and
tested through `commandSearch.ts`.

## Data-Driven Sidebar

### Nav Item Config

Create a config similar to:

```ts
type MissionControlNavItem = {
  id:
    | "overview"
    | "workflows"
    | "runs"
    | "evidence"
    | "schedules"
    | "identities"
    | "settings";
  label: string;
  ariaLabel: string;
  icon: LucideIcon;
  target?: MissionControlTarget;
};
```

If direct target mapping is awkward for settings/workflows because existing
callbacks contain extra side effects, config can omit `target` and `AppShell`
can map `id` to `onSelect(id)`.

### Required Order

```text
Overview
Workflows
Runs
Evidence
Schedules
Identities
Settings
```

This order is an invariant.

### Behavior

- Sidebar renders from config; do not hand-code seven nearly identical buttons.
- Active state comes from current screen through extracted helper.
- Collapsed state keeps all seven destinations reachable.
- Collapsed labels are visually hidden but accessible names remain correct.
- Tooltips should appear for collapsed icon-only nav items.
- Toggle button has correct accessible label:
  - `Collapse sidebar`
  - `Expand sidebar`
- Toggle button has `aria-expanded`.
- Sidebar should not receive run/evidence/schedule data in this spec.

### Visual Treatment

- Use Foundation `Button` or `IconButton`.
- Active state uses cyan/border/surface treatment.
- Hover and focus use tokens.
- Collapse/expand must not create page-level horizontal overflow.

## Lightweight Command Palette

### Interaction Model

- Search input remains in the command bar.
- Focusing the input may open the palette.
- Query length under 2 characters:
  - do not call remote evidence/identity search;
  - show idle/hint state if palette is open.
- Query length 2 or more:
  - build local workflow/run/schedule results;
  - request remote evidence and identity results through existing wrappers;
  - show grouped results.
- Palette closes when:
  - result selected;
  - Escape pressed;
  - click outside;
  - navigation completes;
  - query cleared and implementation chooses to close on clear.

### Result Groups

Supported groups:

- Workflows
- Runs
- Evidence
- Schedules
- Identities

Every result shows:

- Type/group label.
- Primary label.
- Safe context.
- Optional safe status/tone if already available.
- Optional destination hint if helpful.

### States

Palette must support:

- Idle: explains searchable scopes.
- Loading: remote evidence/identity search pending.
- Empty: no matching safe records.
- Partial error: remote evidence or identity search failed, local results still
  render.
- Results: grouped, deduped, bounded.

### Result Limits

Keep result counts bounded.

Recommended:

- Max 5 per group.
- Max 8 to 12 visible total before scroll.
- Palette body scrolls if needed.

### Safety

Search results must not render:

- Raw outputs.
- Cookies.
- Tokens.
- Proxy credentials.
- Profile paths.
- Absolute local paths.
- Browser storage.
- Arbitrary diagnostic payloads.

Evidence and identity results must use existing sanitized read models.

### Keyboard UX

Required:

- ArrowDown moves active result down.
- ArrowUp moves active result up.
- Enter opens active result.
- Escape closes palette.
- `/` focuses command search if focus is not in an input-like or modal context.
- `Ctrl+K` or `Meta+K` focuses command search under the same guard.

Shortcut guard must avoid hijacking input inside:

- `input`
- `textarea`
- `select`
- contenteditable
- dialogs
- popovers
- graph editor text fields
- command palette input itself when shortcut would conflict with typing

Tab should remain normal browser focus behavior unless a roving focus model is
implemented and tested.

### Component Boundary

`CommandPalette` renders grouped results and state. It does not call backend.
It receives:

- query state or display query;
- grouped results;
- loading/error;
- active index;
- selection callbacks;
- close callback.

`App.tsx` or `useCommandSearch` owns async search state.

## Command Search Helper Requirements

### `commandSearch.ts`

Create pure functions such as:

- `buildWorkflowCommandResults(workflows, query)`
- `buildRunCommandResults(runSnapshots, query)`
- `buildScheduleCommandResults(schedules, query)`
- `buildEvidenceCommandResults(evidenceItems)`
- `buildIdentityCommandResults(identityOverview)`
- `groupCommandSearchResults(results)`
- `dedupeCommandSearchResults(results)`
- `limitCommandSearchResults(results, limits)`
- `formatCommandResultContext(value, fallback)`

Exact names may differ, but responsibilities must be tested.

### Search Matching

- Use bounded simple matching unless an existing fuzzy helper exists.
- Match labels and safe ids where already matched today:
  workflow name, run id, workflow name for run, schedule name, schedule workflow.
- Keep behavior predictable.
- Do not add broad raw-output search.

### Partial Failure

If evidence or identity remote search fails:

- local results remain visible;
- palette shows compact warning;
- app-level fatal error is not set for search-only failures;
- no raw backend error details appear in the palette.

## MissionControlTarget And Navigation

### Contract

`MissionControlTarget` remains the shell navigation contract.

Navigation sources:

- Sidebar.
- Command palette.
- Alerts preview.
- Overview cards.
- Runs links.
- Evidence links.
- Identity links.
- Schedule history links.
- Graph issue links.

All should route through the same app-level target navigation function or a
small family of helpers with shared target semantics.

### `missionControlNavigation.ts`

Create pure helpers such as:

- `activeItemFromScreen(screen)`
- `operationsTargetToMissionTarget(target)`
- `missionControlTargetLabel(target)`
- `missionControlTargetType(target)`
- `createStaleTargetDescriptor(target, source, reason)`
- `isInputLikeShortcutTarget(eventTarget)`

Exact names may differ, but these responsibilities must not remain scattered
through `App.tsx`.

### App-Level Side Effects

`App.tsx` still owns the actual target execution:

- set screen;
- load detail;
- open settings dialog;
- focus graph node;
- refresh schedules/runs/evidence/identity.

The target execution path should be easier to scan after extraction.

## Dedicated Stale Target UX

### Model

Create a model similar to:

```ts
type StaleTargetDescriptor = {
  targetType:
    | "workflow"
    | "run"
    | "evidence"
    | "schedule"
    | "identity"
    | "graph_issue";
  requestedId: string;
  source?:
    | "search"
    | "overview"
    | "runs"
    | "evidence"
    | "identity"
    | "schedule"
    | "alerts";
  message: string;
  fallbackActions: Array<"refresh" | "open_overview" | "open_list" | "clear_target">;
};
```

The exact type may be adjusted to fit current app state, but it must carry:

- target type;
- requested safe id;
- readable message;
- safe fallback actions.

### UI Pattern

Use Foundation `StatePanel` or implement `StaleTargetPanel` on top of it.

Panel must show:

- What target was requested.
- Why it cannot be opened.
- Safe next actions.

### Workspace Placement

Render stale state inside the relevant workspace, not only as global app error:

- Missing run target: Runs workspace detail area.
- Missing schedule or schedule event: Schedules workspace.
- Missing workflow target: Workflow list/detail context.
- Missing evidence target: Evidence workspace.
- Missing identity target: Identity Lab workspace.
- Missing graph issue target: Workflow graph context if possible, or workflow
  context if the issue is stale.

Spec 02 must at minimum establish the shared model/pattern and migrate the stale
states already visible in current shell flow:

- missing run target;
- missing schedule or schedule event target;
- missing workflow target from command/settings navigation where feasible.

Other feature-specific stale states may be completed in later child specs, but
they must use the same model.

### Fallback Actions

Supported actions:

- Refresh current workspace.
- Open list for the target type.
- Open Overview.
- Clear focused target.

Do not expose raw target payloads.

## Alerts Preview Popover

### Behavior

- Alerts button remains in command bar.
- Button shows count from `operationsOverview?.metrics.attention_today ?? 0`.
- Button uses warning/failure visual treatment when count is greater than zero.
- Click toggles preview popover.
- Escape closes popover.
- Click outside closes popover.
- Popover has primary action: `Open Attention Queue`.
- `Open Attention Queue` navigates to `{ type: "overview", focus: "attention" }`.

### Data Source

Use existing `operationsOverview?.attention.items`.

Do not add backend/API.

States:

- Loading/unknown: overview not loaded yet.
- Empty: no attention items.
- Results: show bounded preview items.

### Preview Item Content

Each item may show only safe fields:

- severity tone;
- title;
- short summary;
- workflow name if present;
- occurred time if already available and safe;
- action to open item target if `navigation_target` exists.

Limit preview item count, recommended max 5.

### Safety

Do not render raw alert payloads or raw backend error details.

## AppShell Component Responsibilities

`AppShell` should remain mostly presentational.

It may own local UI state for:

- command palette open/closed state;
- alerts popover open/closed state;
- active command result index if simpler locally.

It must not:

- call backend;
- build search results from workflows/runs/schedules;
- know feature DTO internals beyond `CommandSearchResult`;
- perform workspace loading.

Props should stay explicit and typed.

## Styling Requirements

Use Foundation styling strategy.

Shell surfaces:

- Sidebar.
- Command bar.
- Command palette.
- Alert popover.
- Stale target panel.

Rules:

- No page-level horizontal overflow.
- Command palette fits compact desktop.
- Popover body scrolls if content exceeds max height.
- Active command result is visible and keyboard-discernible.
- Focus ring uses cyan token.
- Sidebar collapsed mode remains stable.
- Do not add decorative gradients/orbs/hero styling.

## Required Tests And Checks

### `src/layouts/AppShell.test.tsx`

Add/update tests for:

- Sidebar renders from expected order.
- Active item state.
- Collapsed sidebar preserves accessible destination names.
- Toggle button label and `aria-expanded`.
- Command search input renders.
- Command palette opens and closes.
- Keyboard selection invokes selected result.
- Alerts button count renders.
- Alerts preview popover opens and closes.
- `Open Attention Queue` callback fires.

### `src/App.test.tsx`

Add/update tests for:

- Workflow command result opens workflow target.
- Run command result opens run target.
- Schedule command result opens schedule target.
- Evidence command result opens evidence target.
- Identity command result opens identity target.
- Remote evidence/identity search failure still displays local results and does
  not show raw error details.
- Alerts preview opens Overview attention.
- Missing run target renders dedicated stale state.
- Missing schedule target renders dedicated stale state.
- Missing workflow target renders dedicated stale state where feasible.

### Helper Tests

Add:

```bash
src/lib/missionControlNavigation.test.ts
src/lib/commandSearch.test.ts
```

Cover:

- `activeItemFromScreen`.
- `operationsTargetToMissionTarget`.
- stale target descriptor construction.
- shortcut target guard.
- local result builders.
- grouping/deduping/limits.
- safe fallback context formatting.
- historical identity result building from evidence if helper owns it.

### Required Commands

```bash
npm test -- src/layouts/AppShell.test.tsx src/App.test.tsx
npm test -- src/lib/missionControlNavigation.test.ts src/lib/commandSearch.test.ts
npm test -- src/AppCss.test.ts
npx tsc --noEmit
```

Run when imports/CSS/Tailwind/layout build behavior changes:

```bash
npm run build
```

No Electron build is required unless Electron-facing files are touched.

## Documentation Requirements

Update docs if implementation changes ownership or visible behavior.

Likely docs:

- `docs/architecture/frontend.md`
  - new shell helper ownership;
  - command palette;
  - stale target pattern;
  - alerts preview.
- `docs/domain/user-visible-invariants.md`
  - update Alerts behavior from direct route to preview plus Open Attention
    Queue if implemented visibly.
  - update stale target display language if behavior changes.
- `README.md`
  - update smoke checklist if the Alerts click sequence changes.

Do not update IPC docs because no IPC/backend command changes are in scope.

## Acceptance Criteria

Spec 02 is complete when:

- Sidebar is config-driven and keeps invariant order.
- Active nav item mapping is extracted and tested.
- Command search opens a lightweight command palette with grouped results.
- Command palette has idle, loading, empty, partial error, and result states.
- Arrow keys, Enter, Esc, `/`, and `Ctrl/Meta+K` keyboard behavior works with
  shortcut guards.
- Search result creation, grouping, dedupe, and limits are covered by tests.
- Alerts button opens preview popover and still supports opening Overview
  Attention Queue.
- Stale target handling has a shared descriptor model and at least current run,
  schedule, and feasible workflow stale paths use dedicated state UI.
- `App.tsx` no longer contains the bulk of command search result building or
  active item mapping.
- No backend/IPC commands are added.
- No unsafe data appears in search results, alert previews, or stale target UI.
- Required tests/checks pass or exact blockers are documented.

## Handoff To Child Spec 03

Child Spec 03, Workflow Library and Package Management, must use:

- data-driven shell navigation contract;
- `MissionControlTarget` conventions;
- command result formatting conventions;
- `StatePanel`/`StaleTargetPanel`;
- Foundation command/page patterns.

It must not reimplement search grouping, stale target model, or sidebar config.
