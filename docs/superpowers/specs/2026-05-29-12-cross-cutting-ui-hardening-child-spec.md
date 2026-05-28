# Mission Control UI/UX Upgrade Child Spec 12: Cross-Cutting UI Hardening

Date: 2026-05-29

## Status

Approved design direction, drafted for user review.

This child spec follows and closes the UI/UX specification set:

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
- `docs/superpowers/specs/2026-05-29-10-schedules-child-spec.md`
- `docs/superpowers/specs/2026-05-29-11-app-settings-diagnostics-child-spec.md`

It owns the final hardening pass across all workspaces: shared state patterns,
responsive desktop behavior, keyboard and accessibility flow, security and
sanitization UX, visual consistency, docs synchronization, and implementation
verification. It does not introduce a new user-facing workspace.

## Brainstorming Scope

The user asked for one-spec-at-a-time `$brainstorming` and pre-approved the
recommended choices. This spec records the final cross-cutting decisions so the
implementation agent can finish the redesign as one coherent product instead
of a set of unrelated polished screens.

Cross-cutting hardening is where UI/UX projects often fail. A screen can look
good in isolation while dialogs clip at `1024x768`, disabled buttons do not
explain why, icon controls lack labels, stale deep links fall through, or
diagnostic screens leak local paths. This spec defines the final pass that must
catch those system-level issues.

## Brainstorming Decisions

### Decision 1: Hardening Role

Question: should this spec add another feature area or act as the final system
quality gate?

Options considered:

- Add another feature area.
  - Pros: more visible functionality.
  - Cons: expands scope and distracts from consistency.
- Treat it as polish-only CSS.
  - Pros: simpler.
  - Cons: misses state, accessibility, security, and traceability issues.
- Treat it as a final system quality gate.
  - Pros: closes every workspace against shared standards and master spec
    groups 11-14.
  - Cons: requires disciplined checklist work.

Recommended and approved: final system quality gate.

### Decision 2: Shared Patterns vs Screen-Specific Fixes

Question: should hardening be implemented screen-by-screen or through shared
patterns first?

Options considered:

- Screen-by-screen only.
  - Pros: direct.
  - Cons: inconsistent states and repeated CSS.
- Shared patterns only.
  - Pros: consistency.
  - Cons: may miss unique Graph/Evidence/Schedule states.
- Shared patterns first, then screen-specific verification.
  - Pros: consistent foundation plus real workspace coverage.
  - Cons: requires ordered implementation.

Recommended and approved: shared patterns first, then workspace verification.

### Decision 3: Responsive Target

Question: should the pass optimize for mobile or compact desktop?

Options considered:

- Full mobile support.
  - Pros: broad device support.
  - Cons: not the current product requirement and risky for graph/canvas.
- Desktop only above 1440px.
  - Pros: easiest.
  - Cons: fails current compact desktop requirement.
- Large desktop plus `1024x768`.
  - Pros: matches master spec and operational desktop use.
  - Cons: requires careful table/dialog constraints.

Recommended and approved: large desktop plus compact `1024x768`.

### Decision 4: Accessibility Scope

Question: should accessibility focus on high-level compliance or practical
operator flow?

Options considered:

- Minimal labels only.
  - Pros: fast.
  - Cons: misses keyboard traps and shortcut conflicts.
- Full formal audit.
  - Pros: strongest.
  - Cons: larger than current implementation scope.
- Practical operator flow audit.
  - Pros: covers labels, focus, keyboard, state text, dialogs, and form errors.
  - Cons: does not replace a later formal audit.

Recommended and approved: practical operator flow audit.

### Decision 5: Security Review

Question: should sensitive display review be left to backend tests or verified
in UI too?

Options considered:

- Backend-only.
  - Pros: source of truth.
  - Cons: UI can still accidentally render returned raw fields.
- UI-only.
  - Pros: catches display bugs.
  - Cons: does not prove data source safety.
- Backend sanitization plus renderer display audit.
  - Pros: defense in depth.
  - Cons: more tests/checklists.

Recommended and approved: renderer display audit is required in addition to
backend sanitization.

### Decision 6: Completion Evidence

Question: what should prove the hardening pass is complete?

Options considered:

- Developer memory and final summary.
  - Pros: quick.
  - Cons: weak handoff.
- One giant manual checklist only.
  - Pros: visible.
  - Cons: easy to skip and hard to automate.
- Tests, visual/manual matrix, docs diff, and residual-risk note.
  - Pros: strongest for future agents.
  - Cons: more work.

Recommended and approved: completion requires tests/checks, visual/manual
matrix, docs synchronization, and residual-risk note.

### Decision 7: File Organization

Question: should hardening create new broad folders or use existing structure?

Options considered:

- New large UI framework layer.
  - Pros: centralized.
  - Cons: overkill and destabilizing.
- Existing shared primitives and styles.
  - Pros: consistent with current repo and easier for agents.
  - Cons: some legacy CSS may need careful cleanup.
- Screen-local patches only.
  - Pros: low ceremony.
  - Cons: long-term drift.

Recommended and approved: use existing shared primitives and style files,
adding focused helpers only when they remove repeated state/rendering logic.

## Goal

Ensure the full Mission Control UI/UX upgrade ships as a coherent, usable,
accessible, secure desktop operations console.

The implementation must:

1. Standardize empty, loading, ready, warning, error, disabled, pending, stale,
   and success states.
2. Verify all major workspaces at large desktop and `1024x768`.
3. Keep dialogs, popovers, drawers, tables, and graph panels inside viewport.
4. Ensure icon controls have accessible labels and tooltip treatment.
5. Ensure keyboard shortcuts do not fire while users edit text or interact with
   overlays.
6. Ensure destructive/high-impact actions name scope and require confirmation.
7. Ensure sensitive values remain hidden or sanitized across all screens.
8. Ensure docs, tests, and smoke checklist reflect actual behavior.
9. Create completion evidence that future agents can audit.

## Inputs And Sources Of Truth

### Required Reading Before Implementation

Follow repo workflow first:

1. `docs/README.md`
2. `docs/task-routes.md`
3. `docs/agent-workflow.md`

Then read:

1. `DESIGN.md`
2. Master UI/UX upgrade spec.
3. Child specs 01-11.
4. `docs/domain/user-visible-invariants.md`
5. `docs/architecture/frontend.md`
6. `docs/architecture/command-boundary.md`
7. `docs/contracts/electron-ipc.md`
8. `docs/contracts/workflow-types.md`
9. `docs/contracts/run-state.md`
10. `README.md` smoke checklist.

### Source Files To Inspect

Shared shell and primitives:

- `src/App.tsx`
- `src/App.css`
- `src/layouts/AppShell.tsx`
- `src/layouts/AppSidebar.tsx`
- `src/components/layout/PageHeader.tsx`
- `src/components/ui/button.tsx`
- `src/components/ui/icon-button.tsx`
- `src/components/ui/dialog.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/textarea.tsx`
- `src/components/ui/select.tsx`
- `src/components/ui/segmented-control.tsx`
- `src/components/ui/switch.tsx`
- `src/components/ui/tooltip.tsx`
- `src/components/ui/unsaved-changes-dialog.tsx`

Workspace files:

- `src/features/overview/pages/OperationsOverviewPage.tsx`
- `src/features/workflows/pages/WorkflowListPage.tsx`
- `src/features/workflows/pages/WorkflowDetailPage.tsx`
- `src/features/workflows/components/RecordingReviewDialog.tsx`
- `src/features/workflows/components/WorkflowGraphEditor.tsx`
- `src/features/workflows/components/WorkflowGraphToolbar.tsx`
- `src/features/workflows/components/WorkflowGraphPalettes.tsx`
- `src/features/workflows/components/WorkflowGraphInspector.tsx`
- `src/features/workflows/components/RunIssuePanel.tsx`
- `src/features/workflows/components/RunStatusBar.tsx`
- `src/features/workflows/components/WorkflowSettingsDialog.tsx`
- `src/features/runs/pages/RunCenterPage.tsx`
- `src/features/evidence/pages/EvidenceExplorerPage.tsx`
- `src/features/identities/pages/IdentityLabPage.tsx`
- `src/features/schedules/pages/SchedulesPage.tsx`
- `src/features/settings/pages/SettingsPage.tsx`

Styles:

- `src/styles/base.css`
- `src/styles/layout.css`
- `src/styles/workflows.css`
- `src/styles/workflow-graph.css`
- `src/styles/modals.css`
- `src/styles/schedules.css`
- `src/styles/responsive.css`

Tests:

- `src/App.test.tsx`
- `src/AppCss.test.ts`
- `src/AppShellStatic.test.ts`
- `src/layouts/AppShell.test.tsx`
- workspace tests for each touched screen.

## Current Implementation Readout

The app already has useful foundations:

- `App.css` is a small import entrypoint.
- Shared UI primitives exist for buttons, icon buttons, dialogs, inputs,
  labels, selects, segmented controls, switches, textareas, tooltips, and
  unsaved changes dialog.
- `IconButton` wraps accessible label and tooltip.
- `Dialog` uses Radix primitives and includes a labeled close control.
- CSS tokens exist for the dark operations theme.
- `AppCss.test.ts` already asserts several key UI constraints:
  - design tokens;
  - no viewport font scaling;
  - contained graph overlays;
  - dense error surfaces;
  - visible React Flow connection/edge styling;
  - selected issue/failure colors stay dominant.
- Workspace pages exist for Overview, Workflows, Runs, Evidence, Schedules,
  Identities, and Settings.
- README smoke checklist already covers many full-product flows.

Known hardening gaps to close during implementation:

- State presentation still varies across screens.
- Some pages use local one-off empty/loading/error markup.
- Some destructive or high-impact actions need consistent confirmation shape.
- Some row/action pending states are not localized.
- Some stale target states exist in `App.tsx` but need consistent destination
  rendering.
- Long error/details handling needs consistent collapsed/copy treatment.
- Responsive behavior must be verified across every major workspace, not just
  CSS unit assertions.
- Security display rules must be tested from UI render paths, not only backend
  model assumptions.

## Non-Negotiable Hardening Invariants

### Design System

- Preserve dark Supabase-inspired operations theme.
- Use `DESIGN.md` color roles.
- Use cyan for focus, selection, active controls, and primary actions.
- Use green only for successful terminal states.
- Use amber for warning, validation, stale, skipped, and attention states.
- Use red for failure and destructive actions.
- Never use color alone to communicate state.
- Controls, panels, tables, and repeated cards use radius no larger than `8px`.
- Dialogs can use radius up to `12px`.
- Letter spacing remains `0`.
- Font sizes do not scale with viewport width.
- Avoid marketing hero layout, gradient orbs, bokeh blobs, decorative nested
  cards, and one-note palettes.

### Renderer Boundary

Renderer must not import:

- Node filesystem APIs.
- SQLite.
- Electron main process APIs.
- Playwright.
- CloakBrowser.
- Backend repositories.

Renderer must use:

- `src/lib/workflowApi.ts`.
- Typed Electron bridge.
- Sanitized read models.
- Opaque ids for backend-owned artifacts and profiles.

### Sensitive Display

No screen may display:

- raw cookies;
- tokens;
- proxy passwords;
- browser storage values;
- raw browser profile contents;
- arbitrary unbounded run outputs;
- raw diagnostic objects;
- unnecessary absolute local paths;
- raw evidence artifact paths;
- credentials embedded in proxy URLs.

If a value is intentionally withheld, show a safe label:

- `Hidden`
- `Sanitized`
- `Managed by backend`
- `Not exposed`
- `Available through validated action`

### Confirmation Scope

Actions requiring confirmation:

- Delete workflow.
- Delete schedule.
- Reset identity.
- Close retained session, if product chooses confirmation rather than strongly
  scoped inline action.
- Cleanup orphaned profiles.
- Replace graph from recording.
- Discard recording draft.
- Import package when it creates new workflow from external content.
- Export bundle/package when scope and sanitization must be confirmed.
- Stop run if multiple active runs or retained browser consequences make scope
  ambiguous.

Each confirmation must name:

- affected object;
- what changes;
- what is preserved;
- destructive or irreversible consequences;
- cancel action.

### Compact Desktop

At `1024x768`:

- No page-level horizontal overflow.
- Sidebar preserves all destinations.
- Header actions wrap without overlapping title.
- Tables either hide secondary columns or scroll inside bounded containers.
- Dialogs fit viewport.
- Dialog body scrolls internally when content is tall.
- Sticky footers do not cover final fields.
- Popovers/palettes fit inside viewport.
- Graph canvas remains usable.
- Inspector/palette can collapse, stack, or become drawer as specified.
- Long button labels do not clip.
- Long words and ids wrap safely.

## Shared State Patterns

### Empty State

Every workspace must define an empty state.

Required anatomy:

- compact icon or semantic marker;
- title;
- one short body sentence;
- primary next action when available;
- optional secondary action;
- no oversized illustration.

Examples:

- Workflows:
  - Create, Record, Import.
- Runs:
  - Open Workflows or Launch Run from a workflow.
- Evidence:
  - Run a workflow to collect evidence.
- Schedules:
  - New Schedule or Create Workflow when none exist.
- Identities:
  - Create or open workflows with Browser Launch settings.
- Settings:
  - diagnostics loading/empty is not a product empty page.

### Loading State

Required behavior:

- Preserve layout geometry where possible.
- Use skeletons for tables/cards if existing patterns support them.
- Do not flash empty state during refresh.
- Keep previously loaded data visible during background refresh when safe.
- Loading labels must be specific:
  - `Loading schedules...`
  - `Loading evidence...`
  - `Refreshing diagnostics...`

### Ready State

Ready state must show:

- primary data;
- current status;
- primary action;
- any attention summary.

Ready does not mean visually green everywhere. Use neutral surface and semantic
status markers.

### Warning State

Warnings include:

- validation warnings;
- stale targets;
- skipped schedules;
- missing diagnostics;
- unsafe or incomplete settings;
- evidence file unavailable;
- run launch blockers that are not runtime failures.

Warning UI:

- amber tone;
- icon or label;
- text reason;
- next action when available.

### Error State

Errors include:

- command failure;
- run failure;
- backend validation failure;
- failed diagnostics refresh;
- failed evidence preview/reveal/export;
- failed schedule enablement;
- failed package import/export.

Error UI:

- short summary first;
- affected scope;
- next action;
- details collapsed by default;
- copy details action when details exist;
- no raw sensitive payload.

### Disabled State

Disabled controls must explain why when consequence is not obvious.

Examples:

- Run disabled:
  - active run owns workflow;
  - graph invalid;
  - unsaved settings failed;
  - Run from selected unavailable.
- Delete disabled:
  - active run owns workflow/profile.
- Reset identity disabled:
  - active run or retained session blocks backend command.
- Export disabled:
  - no selected evidence/package sections.

Allowed presentation:

- inline disabled reason;
- tooltip on disabled wrapper;
- adjacent help text;
- issue panel row.

Do not leave disabled high-impact controls unexplained.

### Pending State

Pending state should be localized.

Rules:

- Disable only affected command where possible.
- Keep layout stable.
- Use precise labels:
  - `Saving...`
  - `Validating...`
  - `Launching...`
  - `Stopping...`
  - `Exporting...`
  - `Installing...`
  - `Cleaning up...`
- Avoid global app blocking unless command truly blocks app use.

### Stale Target State

Stale targets must be explicit.

Required anatomy:

- requested target type;
- requested id or safe label;
- unavailable reason if known;
- safe fallback action.

Examples:

- `Run target is no longer available: run_123`
- `Schedule event target is no longer available: evt_123`
- `Evidence item is no longer available`
- `Graph node target was not found in this workflow`

Do not silently open the default page without explanation.

## Dialog, Popup, And Overlay Standards

### Dialog Anatomy

Every dialog must have:

- accessible title;
- optional description;
- close control with label;
- body;
- footer or clear primary/secondary actions;
- focus trap;
- escape/cancel behavior when safe;
- viewport-bounded max width and max height.

Dialog body must scroll internally if content exceeds viewport.

### Confirmation Dialog

Required anatomy:

- title naming action;
- body naming affected object;
- preserved data statement;
- destructive primary if destructive;
- secondary cancel;
- pending state;
- error state inside dialog if command fails.

### Popover And Palette

Required behavior:

- close on selection when appropriate;
- close on outside click;
- close on `Esc`;
- keep focus behavior predictable;
- stay inside viewport;
- search input focuses when opened if search is primary action;
- no page-level overflow.

### Tooltip

Icon-only controls require tooltip.

Tooltip requirements:

- visible on hover and focus;
- text matches or expands accessible label;
- does not hide important state;
- not the only place a disabled reason exists for critical commands unless the
  disabled element is still reachable through an accessible wrapper.

## Keyboard And Shortcut Standards

### Focus Order

Focus order should follow visual/task order:

1. shell navigation;
2. page header actions;
3. filters/search;
4. primary content;
5. row/detail actions;
6. dialogs/popovers when open.

Opening a dialog:

- focus moves into dialog;
- closing returns focus to triggering control.

Opening a drawer/popover:

- focus either moves into interactive content or remains on trigger with clear
  keyboard path, depending on primitive behavior.

### Shortcut Guard

Keyboard shortcuts must not fire inside:

- inputs;
- textareas;
- contenteditable;
- selects;
- segmented controls;
- dropdowns;
- palettes with search focused;
- dialogs;
- help popovers;
- confirmation dialogs;
- evidence export dialog;
- recording review editable fields;
- workflow settings fields.

Graph shortcuts are graph-scoped, not global text-editing shortcuts.

### Icon Controls

Every icon-only button must have:

- `aria-label`;
- tooltip;
- visible focus state;
- stable hit area;
- no hidden text overflow dependency.

Prefer `IconButton` when possible.

## Responsive Standards By Surface

### Shell

Large desktop:

- sidebar full;
- command bar visible;
- page content uses stable max/min widths.

Compact desktop:

- sidebar may collapse to icon rail;
- all destinations remain available;
- command search may reduce width but not overlap title/actions;
- app content does not horizontally overflow viewport.

### Headers

Headers must:

- wrap actions below title if needed;
- keep primary action visible;
- avoid oversized copy;
- avoid hero-scale text.

### Tables

Tables must:

- hide/fold secondary metadata first;
- keep name/status/actions visible;
- use bounded horizontal scroll only inside table wrapper;
- keep row actions reachable;
- avoid clipped buttons.

### Master Detail

Master-detail screens must:

- show selected state;
- allow return to list on compact widths;
- keep detail actions accessible;
- handle stale selected target.

### Graph

Graph workspace must:

- keep canvas primary;
- keep inspector usable;
- allow palette/inspector drawer or stacked behavior at compact width;
- preserve port hit targets;
- prevent toolbar overflow;
- keep issue panel readable.

### Dialogs

Dialogs must:

- use `max-height` based on `100dvh`;
- scroll body internally;
- keep close control visible;
- keep footer visible where possible;
- avoid content behind sticky footer.

### Cards And Panels

Cards/panels must:

- not nest decorative cards inside cards;
- keep text wrapping;
- avoid variable-height hover shifts;
- maintain stable dimensions for status badges and icon buttons.

## Security And Sanitization Audit

### Workspaces To Audit

Audit these surfaces:

- Shell search results.
- Overview metrics, attention, evidence, upcoming schedules.
- Workflow Library rows and package preview/export.
- Recording Review warnings/details.
- Graph Builder issue panels and inspector error details.
- Workflow Settings Browser Launch and Environment.
- Run launch confirmation.
- Runs list/detail.
- Evidence list/detail/preview/export.
- Identity Lab list/detail/history.
- Schedules table/history.
- App Settings diagnostics/maintenance.
- All command/global error surfaces.

### Prohibited Display Values

Search for accidental display of:

- `proxy_password`
- `password`
- `cookie`
- `cookies`
- `localStorage`
- `sessionStorage`
- `Authorization`
- `Bearer`
- `token`
- `secret`
- `profile_dir` as raw path
- `binary_path`
- `cache_dir`
- `download_url`
- `profile_root`
- raw `details_json`
- raw outputs from action execution

Important nuance:

- Some words appear in labels or safe descriptions. The audit must inspect
  context, not blindly remove all text containing those words.

### Safe Display Substitutions

Use:

- `Proxy credentials hidden`
- `Storage value hidden`
- `Cookie value hidden`
- `Managed browser profile`
- `Validated artifact action`
- `Sanitized export`
- `Local runtime path hidden`
- `Details copied from sanitized command output`

### Export And Reveal Actions

Rules:

- Renderer passes evidence id or workflow/package data to backend command.
- Renderer does not construct file paths.
- Reveal in folder uses backend validation.
- Export summaries explain sanitization.
- Exported manifests omit absolute original paths unless explicitly designed as
  app-local safe paths.

## Cross-Workspace Traceability Standards

### Target Types

Supported target types:

- overview focus;
- workflow list;
- workflow detail;
- workflow settings section;
- graph node/link;
- run;
- evidence;
- identity current/historical;
- schedule;
- schedule event.

### Navigation Requirements

Every cross-link must:

- use typed target object;
- avoid raw payload transport;
- show focused context on destination;
- show stale state if missing;
- preserve safe historical context where needed.

### Focused Context Examples

- Overview attention -> Runs detail, Evidence, Schedule history, or Workflow.
- Evidence item -> Run detail and Identity Lab historical reference.
- Run failure -> Graph node selection.
- Schedule event -> Schedule history focused item.
- Identity rotation event -> read-only historical identity.
- Workflow list settings -> Workflow Settings General.
- Workflow detail settings -> Workflow Settings Browser Launch.

## Workspace Hardening Matrix

### Overview

Must verify:

- KPI cards do not overflow.
- Attention queue differentiates blocked launch, failed run, and schedule
  attention.
- Activity chart labels fit.
- Recent Evidence links open Evidence.
- Upcoming Schedules links open Schedules.
- Alerts button focuses Attention Queue.
- Empty/loading/error states preserve dashboard geometry.
- No raw evidence details or sensitive values appear.

### Shell

Must verify:

- Sidebar order is Overview, Workflows, Runs, Evidence, Schedules, Identities,
  Settings.
- Search results are typed and bounded.
- Search can open every supported target.
- Stale search targets display unavailable states.
- Icon rail at compact width remains accessible.
- Command bar does not expose raw outputs or secrets.

### Workflow Library

Must verify:

- Empty state offers Create, Record, Import.
- Rows show active run status and scoped Stop.
- Duplicate copy explains fresh identity.
- Delete confirmation includes keep/delete profile data and default keep.
- Import preview is safe.
- Export package sanitization is clear.
- Row action overflow works at compact width.

### Recording Review

Must verify:

- Review dialog fits `1024x768`.
- Included/excluded steps are visible.
- Redacted values stay hidden.
- Warnings collapse.
- Replacement graph copy names target workflow.
- Discard/save states consume or clear session correctly.

### Graph Builder

Must verify:

- Canvas, toolbar, palettes, inspector, issue panel remain usable.
- Add Action/Logic/Variable/End palettes close predictably.
- Port tooltips and edge labels do not overlap incoherently.
- Node/link selection does not override validation/failure color.
- Long errors collapse and can be copied.
- Shortcuts do not fire in inputs or dialogs.
- Run issue panel routes to graph/settings where possible.

### Workflow Settings

Must verify:

- Dialog section navigation works.
- Five sections only: General, Graph, Run Policy, Browser Launch, Environment.
- Dialog-level Save Settings.
- Unsaved close guard.
- Reset identity confirmation and backend guards.
- Browser Launch does not show raw `profile_dir`.
- Help is collapsible and bounded.
- Dialog fits compact desktop.

### Run Launch And Runs

Must verify:

- Launch confirmation names workflow and browser identity/session context.
- Cancel starts no run.
- Save/validation blockers appear before run starts.
- Stop targets run id.
- Runs page supports concurrent snapshots.
- Focused persisted run detail handles stale run.
- Run details link to Evidence, Workflow, Identity.
- Long failure details are collapsed.

### Evidence

Must verify:

- List/grid filters use safe metadata.
- Detail loads bounded typed payload.
- Screenshots preview through backend action.
- Downloads do not preview/execute in app.
- Reveal in folder uses evidence id.
- Export Selection summarizes selected evidence and sanitization.
- Missing artifact states are explicit.
- No absolute artifact paths or raw sensitive values are displayed.

### Identity Lab

Must verify:

- Current identities differ from historical references.
- Historical references are read-only.
- Close Retained Session scope is explicit.
- Reset Identity is confirmed and blocked when backend rejects.
- Profile paths/storage/cookies/tokens/proxy credentials are hidden.
- Open Evidence, Last Run, Workflow, Workflow Settings links work.
- Stale identity targets are safe.

### Schedules

Must verify:

- Table shows enabled/disabled/attention states.
- Create/edit supports all supported kinds.
- Enablement readiness explains saved workflow semantics.
- Delete confirmation names schedule.
- History maps started/skipped/missed/failed-to-start/disabled.
- Conflict reasons are human-readable.
- History links to Run and Workflow.
- Stale schedule/event/run targets are explicit.

### App Settings

Must verify:

- App-level only; no workflow policy/theme/notification/retention systems.
- Graph autosave toggle affects Graph Builder behavior.
- Diagnostics are sanitized.
- Maintenance install/cleanup are guarded.
- Cleanup copy says active/managed profiles, workflows, evidence, and settings
  are preserved.
- Graph shortcut guide matches Graph Builder.

## CSS And Layout Audit

### Token Audit

Check that new CSS uses tokens or approved colors:

- `var(--app-bg)`
- `var(--app-surface)`
- `var(--app-surface-elevated)`
- `var(--app-border)`
- `var(--app-border-hover)`
- `var(--app-text)`
- `var(--app-text-secondary)`
- `var(--app-text-muted)`
- `var(--app-accent)`
- success/attention/failure token equivalents.

Avoid introducing broad new palettes.

### Overflow Audit

Check for:

- `min-width` too large for compact desktop.
- flex children missing `min-width: 0`.
- grid columns lacking `minmax(0, 1fr)`.
- buttons with unwrapped long labels.
- tables without bounded wrapper.
- dialogs without viewport max height.
- popovers wider than viewport.
- pre/code blocks without wrapping or scroll containment.

### Typography Audit

Check:

- no `font-size` with `vw`, `vh`, `vmin`, or `vmax`;
- no negative letter spacing;
- compact headings inside panels;
- no hero-scale type in workspaces;
- monospace only for ids, timestamps, hashes, safe technical values.

### State Color Audit

Check:

- green used only for success/ready terminal state;
- amber used for warnings/attention;
- red used for failure/destructive;
- cyan used for focus/active/primary;
- state labels exist with colors.

## Test Strategy

### Static CSS Tests

Extend `src/AppCss.test.ts` when cross-cutting CSS changes.

Required areas:

- App.css stays import-only.
- No viewport-scaled font sizes.
- Dialogs have viewport-bounded dimensions.
- Tables and graph overlays have containment rules.
- Icon focus/tooltip primitives remain styled.
- Sensitive raw path class names are not introduced as visible labels.

### Shell Tests

Use `src/layouts/AppShell.test.tsx` and related app tests.

Coverage:

- sidebar destinations;
- command search placeholder/results;
- alerts action;
- compact navigation labels/tooltips if testable.

### Workspace Tests

Add or update focused tests when touching a workspace:

- Overview:
  - `OperationsOverviewPage.test.tsx` if present or new focused test.
- Workflow Library:
  - `WorkflowListPage.test.tsx`.
- Workflow Detail/Graph:
  - `WorkflowDetailPage.test.tsx`;
  - `WorkflowGraphEditor.test.tsx`;
  - `WorkflowGraphPalettes.test.tsx`.
- Workflow Settings:
  - `WorkflowSettingsDialog.test.tsx`.
- Recording:
  - create/update `RecordingReviewDialog.test.tsx` if changed.
- Runs:
  - create/update `RunCenterPage.test.tsx` if changed.
- Evidence:
  - create/update `EvidenceExplorerPage.test.tsx` if changed.
- Identity:
  - create/update `IdentityLabPage.test.tsx` if changed.
- Schedules:
  - `SchedulesPage.test.tsx`.
- App Settings:
  - create/update `SettingsPage.test.tsx`.

### Accessibility Tests

Where Testing Library can cover it:

- query dialogs by role and name;
- query buttons by accessible name;
- query switches by role and label;
- assert errors with `role="alert"`;
- assert statuses with `role="status"`;
- assert weekday toggles with `aria-pressed`;
- assert icon-only buttons have names.

### Sensitive Display Tests

Add representative tests for:

- search result does not show raw output/secrets;
- Evidence does not show absolute path;
- Identity does not show profile path;
- Settings diagnostics does not show raw binary/cache/profile/font paths;
- package export copy explains sanitization;
- run/evidence error details are collapsed and safe.

### Required Check Commands

At minimum after hardening implementation:

```bash
npm test -- src/App.test.tsx src/layouts/AppShell.test.tsx src/AppCss.test.ts
npx tsc --noEmit
npm run build:electron
```

Run additional focused tests for every touched workspace.

If Electron contracts or backend behavior change, run route-specific tests from
`docs/task-routes.md`.

## Visual Verification Matrix

Manual or screenshot verification must cover:

| Surface | Large Desktop | 1024x768 | Required Result |
| --- | --- | --- | --- |
| Overview | yes | yes | dashboard readable, no overflow |
| Shell search | yes | yes | results bounded and safe |
| Workflow Library | yes | yes | row actions reachable |
| Recording Review | yes | yes | dialog in viewport |
| Graph Builder | yes | yes | canvas/inspector usable |
| Workflow Settings | yes | yes | dialog in viewport |
| Launch Run dialog | yes | yes | scope visible |
| Runs | yes | yes | list/detail usable |
| Evidence | yes | yes | list/detail or drawer usable |
| Identity Lab | yes | yes | list/detail usable |
| Schedules | yes | yes | table/history usable |
| App Settings | yes | yes | diagnostics and actions readable |

Record residual visual risks in the implementation summary.

## Documentation Synchronization

Update docs when behavior, ownership, contracts, commands, or user-visible flow
changes.

Likely docs:

- `docs/domain/user-visible-invariants.md`
- `docs/domain/product-model.md`
- `docs/architecture/frontend.md`
- `docs/architecture/command-boundary.md`
- `docs/contracts/electron-ipc.md`
- `docs/contracts/workflow-types.md`
- `docs/contracts/run-state.md`
- `docs/task-routes.md`
- `README.md` smoke checklist.

Do not update docs as ceremony. If only CSS or markup changed without behavior
change, final response must state docs did not need updates and why.

## Implementation Sequence Recommendation

Implement this hardening pass after the workspace specs are implemented.

Recommended order:

1. Run baseline tests and inspect current failures.
2. Create a short UI hardening audit file or implementation checklist.
3. Normalize shared state patterns.
4. Normalize dialog/confirmation behavior.
5. Normalize icon button tooltip/label usage.
6. Normalize long error/details collapse/copy pattern.
7. Fix responsive shell/header/table/dialog constraints.
8. Verify Graph-specific compact behavior.
9. Audit sensitive display across workspaces.
10. Add missing focused tests.
11. Update docs and README smoke checklist only where behavior changed.
12. Run required check commands.
13. Perform manual/visual matrix.
14. Write final implementation summary with residual risks.

Do not start by broad CSS rewrites. Make the smallest shared improvements that
remove repeated inconsistencies, then verify each workspace.

## Acceptance Criteria

This spec is satisfied when:

1. Every workspace has explicit empty/loading/error/warning/disabled handling.
2. High-impact actions name scope and are confirmed.
3. Icon-only controls have accessible labels and tooltips.
4. Keyboard focus order is understandable.
5. Graph shortcuts do not fire inside editing/overlay contexts.
6. Large desktop visual review passes.
7. `1024x768` visual review passes.
8. Dialogs and popovers remain inside viewport.
9. Tables and master-detail screens avoid page-level horizontal overflow.
10. Long errors/details are contained, collapsed where needed, and copyable.
11. Stale cross-workspace targets render explicit unavailable states.
12. Sensitive values remain hidden or sanitized in every workspace.
13. Tests cover the shared patterns and changed workspaces.
14. Docs and README are synchronized when behavior changes.
15. Final implementation summary lists tests run, docs updated, and residual
    risk.

## Agent Handoff Notes

Implementation agents should treat this as the final integration gate, not as a
license to redesign product semantics.

Do:

- use existing shared primitives;
- add focused helpers when they reduce repeated state handling;
- keep CSS scoped to existing style files;
- add tests near touched components;
- preserve documented behavior;
- verify compact desktop;
- audit sensitive display.

Do not:

- add new product categories;
- add unsupported settings;
- expose raw paths or secrets;
- rewrite backend semantics for visual polish;
- introduce broad visual themes;
- remove existing tests to make UI pass;
- rely on color alone for status;
- leave disabled consequential actions unexplained.

The best implementation outcome is boring in the right way: every screen feels
like the same product, every state is understandable, every high-risk action
names its scope, and every sensitive value stays behind the approved backend
boundary.
