# Mission Control Full Product UI/UX Upgrade Master Spec

Date: 2026-05-28

## Status

Drafted for user review.

This is the master specification for a full product UI/UX upgrade of Mission
Control. The scope is intentionally broad and mandatory: all 14 product and
cross-cutting UX groups listed in this document are in scope.

The implementation must be phased and system-first so one agent can work through
the program in order without treating the app as one uncontrolled patch.

## Goal

Upgrade Mission Control into a more efficient, polished, reliable desktop
operations console for authorized browser automation work.

The upgrade must improve:

1. Operator efficiency: fewer confusing decisions, clearer actions, faster
   scanning, stronger cross-workspace traceability.
2. Visual polish: consistent dark operations UI using the existing design system
   and the polished Stitch screens as visual baseline.
3. UX reliability: stable layout, clear state handling, accessible controls,
   guarded destructive actions, and resilient compact desktop behavior.

This is not a marketing redesign. Mission Control must remain a dense,
operator-first desktop workspace.

## Inputs And Sources Of Truth

### Visual Baseline

Use the generated Stitch redesign artifacts as the visual baseline:

- `.stitch/designs/2026-05-28-12-polished-01-workflow-library.html`
- `.stitch/designs/2026-05-28-12-polished-02-overview.html`
- `.stitch/designs/2026-05-28-12-polished-03-graph-builder.html`
- `.stitch/designs/2026-05-28-12-polished-04-runs.html`
- `.stitch/designs/2026-05-28-12-polished-05-identity-lab.html`
- `.stitch/designs/2026-05-28-12-polished-06-schedules.html`
- `.stitch/designs/2026-05-28-12-polished-07-evidence-explorer.html`
- `.stitch/designs/2026-05-28-12-polished-08-app-settings.html`
- `.stitch/designs/2026-05-28-12-polished-09-add-step-palette.html`
- `.stitch/designs/2026-05-28-12-polished-10-recording-review-modal.html`
- `.stitch/designs/2026-05-28-12-polished-11-app-shell-command-bar.html`
- `.stitch/designs/2026-05-28-12-polished-12-workflow-settings-dialog.html`

The Stitch screens are design references, not runtime behavior truth. If a
Stitch screen implies a control or data field that is not supported by current
code, implement it only when this spec explicitly calls for the matching product
behavior and tests.

### Behavior Source Of Truth

Current product behavior is defined by code and current docs:

- `docs/domain/product-model.md`
- `docs/domain/user-visible-invariants.md`
- `docs/architecture/overview.md`
- `docs/architecture/frontend.md`
- `docs/contracts/electron-ipc.md`
- `docs/contracts/workflow-types.md`
- `src/App.tsx`
- `src/layouts/`
- `src/features/`
- `src/lib/workflowApi.ts`
- `src/types/workflow.ts`
- `src/types/electron.ts`
- `electron/backend/`

If Stitch and code disagree, preserve the behavior invariants unless this spec
explicitly changes them.

### Design System

Follow `DESIGN.md`.

Preserve:

- Dark Supabase-inspired operations theme.
- Compact desktop density.
- `4px` and `8px` spacing rhythm.
- Max `8px` radius for controls, panels, tables, repeated cards.
- Max `12px` radius for dialogs.
- Cyan for active/primary/focus, green only for success, amber for attention,
  red for failure/destructive.
- No one-note palette, no decorative nested cards, no marketing hero layout.

## Non-Negotiable Product Boundaries

- Do not expose raw cookies, tokens, proxy credentials, browser storage,
  arbitrary run outputs, raw diagnostic payloads, or unnecessary absolute local
  paths in the renderer.
- Renderer must keep using `src/lib/workflowApi.ts` and the typed Electron
  bridge. It must not import Node/Electron/filesystem/SQLite/Playwright or
  CloakBrowser APIs directly.
- Browser identity, profile, proxy, fingerprint, locale, timezone, retention,
  and run policy remain workflow settings concerns unless an existing graph
  action already owns runtime context behavior.
- Destructive or high-impact actions must have in-app confirmation with named
  scope.
- Stale cross-workspace targets must render unavailable states instead of
  silently falling back.
- Workflow behavior cannot be weakened for visual polish.

## Mandatory Scope

All 14 groups below are required.

Within each group, `Requirements`, `UI Treatment`, `Feature Upgrades`, and
`Acceptance Criteria` are all in scope. If a feature upgrade needs additional
typed data, IPC, backend aggregation, or tests, implement the narrow supporting
change required for that UX. Do not invent broad unrelated systems to satisfy a
small UI need.

### 1. App Shell, Navigation, Search, Alerts

#### Problems To Solve

- Navigation must remain stable while the app gains richer screens.
- Search and alerts are core operator shortcuts, but they need stronger visual
  hierarchy and clearer result routing.
- Cross-workspace links must make it obvious what target opened and what to do
  if the target is stale.

#### Requirements

- Sidebar order remains: Overview, Workflows, Runs, Evidence, Schedules,
  Identities, Settings.
- Overview remains the default entry screen.
- Sidebar must support large desktop and compact `1024x768` layouts. At compact
  width, collapse to an icon rail or otherwise preserve all destinations without
  horizontal page overflow.
- The app shell command bar must search workflows, runs, schedules, evidence,
  and identities through bounded safe read models.
- Search results must be typed by destination and show compact metadata without
  exposing raw outputs, secrets, profile paths, cookies, tokens, proxy
  credentials, or browser storage.
- Alerts button opens Overview with Attention Queue focused.
- Any workspace opened from search, alerts, overview, runs, evidence, identity,
  or schedule history must show focused context where possible.
- Stale target state must be explicit: show what item was requested, why it is
  unavailable, and which safe fallback action exists.

#### UI Treatment

- Use the polished App Shell Stitch screen for navigation density, command bar
  placement, and status/action hierarchy.
- Keep app chrome quiet: sidebar, command bar, and page actions should not
  compete with the active workspace.
- Search results should use row/list treatment with icon, type, label, status,
  and destination hint.

#### Acceptance Criteria

- Operator can navigate to every workspace without layout shift.
- Search opens correct target types.
- Alerts focus Overview attention.
- Stale targets render readable unavailable states.
- No sensitive values appear in search or shell UI.

### 2. Workflow Creation And Library Management

#### Problems To Solve

- Workflow list actions are dense and need clearer hierarchy.
- Create, record, import, duplicate, run, export, delete, and settings actions
  need consistent treatment.
- Running from list must stay understandable without forcing the operator into
  detail view.

#### Requirements

- Workflow Library must support create, open, record, run, stop, duplicate,
  export, import, edit settings, and delete.
- Row actions remain accessible. Icon-only actions require labels and tooltips.
- Primary list action is the one most useful in context. Suggested hierarchy:
  `Create Workflow` or `Record Workflow` in page command bar, row-level `Run`
  for saved runnable workflows, `Stop` for active workflow rows.
- Active workflow rows must show run state, disable only actions that conflict
  with the active run, and keep row-level stop scoped to that workflow run id.
- Duplicate must communicate that the copy receives a fresh browser identity.
- Delete confirmation must ask whether to keep or delete private browser profile
  data, with keep as default.
- Import flow must preview package content and create a new workflow without
  overwriting existing workflows.
- Export package flow must make selected sections clear and show sanitization
  expectations.

#### Feature Upgrades

- Add a workflow row preview/details panel. On compact desktop it may collapse
  into a selected-row detail drawer or inline detail region.
- Add quick filters for status, runnable/draft, active run, schedule presence,
  and identity reuse when data is already available.
- Add empty-state onboarding that offers Create, Record, and Import as three
  distinct paths.

#### Acceptance Criteria

- Workflow list can be scanned quickly.
- Active rows are obvious and safe.
- Import/export/delete/duplicate communicate consequences before action.
- Empty library gives clear first steps.

### 3. Workflow Recording Flow

#### Problems To Solve

- Recording is a high-leverage authoring path and must feel safe.
- Review must clearly distinguish included/excluded steps, warnings, editable
  labels, and redacted sensitive input.

#### Requirements

- Workflow list exposes Record Workflow for new workflow recording.
- Workflow detail exposes Record Replacement for replacing the current graph.
- Recording launch must show which settings/identity context will be used.
- Recording stop and draft generation must show progress/blocked/error states.
- Review dialog must support editing workflow name, step labels, step inclusion,
  and supported safe values.
- Redacted password or secret-like values remain excluded by default and require
  operator-provided safe literal or variable.
- Replacement recording must name the target workflow and clearly say it replaces
  only the graph.
- Discarding and saving must communicate that the backend-held recording session
  is consumed or removed.

#### UI Treatment

- Use the polished Recording Review Modal as the modal baseline.
- Step rows should show action type, target summary, captured timing, inclusion
  state, warning count, and editable label.
- Long warning/error details must be collapsed by default with copy action.

#### Feature Upgrades

- Add a review summary strip: included steps, excluded steps, warnings, redacted
  fields, weak locators.
- Add a "needs attention" filter inside the review dialog.
- Add destination hints after save: open workflow, open graph, or stay in list.

#### Acceptance Criteria

- Operator can review a draft without seeing sensitive captured values.
- Replacement and new-workflow recording are visually distinct.
- Warnings are actionable and do not overflow the dialog.

### 4. Graph Authoring Flow

#### Problems To Solve

- Graph Builder is powerful but visually dense.
- Toolbars, palettes, inspector, issue panel, canvas status, and run actions
  must stop competing for attention.

#### Requirements

- Graph detail remains the only workflow authoring surface.
- New workflows start as `Start -> New node`.
- Toolbar includes undo, redo, select, pan, fit, auto arrange, arrange
  selection, shortcuts, New node, Add Action, Add Logic, Add Variable, Add End.
- Add Action uses semantic groups and user-intent labels.
- Add Logic exposes Branching, Loops, Recovery/Retry, including If, Switch,
  Router, Merge.
- Palettes must be searchable and close predictably on click-outside or
  selection.
- Inspector fields must remain readable in narrow panels.
- Node/link selection must be clear without overriding validation/failure color.
- Port tooltips must explain direction and role.
- Multi-select summary must expose bulk duplicate, copy, delete, and must never
  apply destructive edits to Start.
- Link editor must support none/fixed/random link wait.
- Validation issues show before execution.
- Runtime failures map back to graph node/link when possible.

#### UI Treatment

- Use the polished Graph Builder Stitch screen for panel proportions.
- Canvas is the primary surface. Toolbar and issue panel should be compact.
- Inspector must use grouped fields with clear labels, help, validation, and
  contained overflow.
- Issue panel should distinguish validation, runtime, and system/startup.

#### Feature Upgrades

- Add a persistent mini run summary in graph header: save state, settings state,
  runnable state, active run state.
- Add quick actions from issue rows: select node/link, copy details, revalidate.
- Add graph health badges: unsaved, validation needed, blocked, ready.

#### Acceptance Criteria

- Operator can add, configure, validate, save, and run graph without losing
  context.
- Long errors never break graph layout.
- Compact desktop keeps canvas and inspector usable.

### 5. Workflow Settings And Environment Flow

#### Problems To Solve

- Workflow Settings controls many critical run-time decisions.
- The dialog needs stronger grouping, validation, help, unsaved state, and
  consequence clarity.

#### Requirements

- Workflow Settings contains General, Graph, Run Policy, Browser Launch, and
  Environment.
- It is per-workflow and distinct from app-level Settings.
- Save Settings is one dialog-level action.
- Closing with unsaved edits asks save and close, discard, or keep editing.
- Settings opened from workflow list starts at General.
- Settings opened from workflow detail starts at Browser Launch.
- Run Policy exposes max duration, browser retention, Allow Run JavaScript, Run
  from selected enable/scope, and disabled batch defaults with pause note until
  Batch Run UI is ready.
- Browser Launch exposes stable identity id, display name, fingerprint seed,
  persona, proxy, timezone, locale, GeoIP, WebRTC, fingerprint fonts directory,
  humanize toggle/preset, headed/headless.
- Reset identity uses confirmation, saves pending settings first, preserves
  non-storage preferences, and disables Run from selected until a fresh retained
  session exists.
- Environment exposes typed initial variable rows.
- Help uses bilingual nested collapsible decision guidance.

#### UI Treatment

- Use the polished Workflow Settings Dialog as baseline.
- Prefer section navigation on the left and grouped content on the right.
- Sticky header/footer allowed when body scrolls.
- Validation warnings must sit near the relevant section and in a summary area.

#### Feature Upgrades

- Add settings readiness summary: runnable, warnings, identity posture,
  retention, GeoIP/proxy alignment.
- Add "changed fields" summary when closing with edits.
- Add inline "applies at launch" vs "applies during graph run" hints.

#### Acceptance Criteria

- Operator can understand what settings affect browser identity, graph authoring,
  run policy, and initial variables.
- Reset/delete/retention consequences are explicit.
- Dialog remains in viewport at `1024x768`.

### 6. Run Launch And Monitoring Flow

#### Problems To Solve

- Run launch must clearly explain what is about to execute.
- Run monitoring must make active, stopped, failed, succeeded, and blocked states
  easy to inspect.

#### Requirements

- Graph detail full run action is `Launch Run` and opens confirmation before
  invoking save/settings/validation/run pipeline.
- Launch confirmation names workflow, identity/session context, settings status,
  graph save status, and expected browser retention.
- Canceling launch starts no run.
- If graph/settings save fails, run does not start.
- If validation blocks launch, show issues and create sanitized launch-blocked
  attention for manual full-run launch attempts.
- Runs page monitors concurrent current-session workflow run snapshots and can
  stop a selected active run by run id.
- Selected persisted run detail can open related Workflow, Evidence, and
  Identity targets.
- Stop action must be scoped and confirmed when needed.
- Batch run state must remain globally exclusive with normal runs where current
  behavior requires it.

#### UI Treatment

- Use polished Runs screen for master-detail layout.
- Active runs should be scan-first: workflow, status, started time, identity,
  progress, current step, stop.
- Detail panel should group timeline, failure, evidence, identity, and actions.

#### Feature Upgrades

- Add run launch preflight panel: settings warnings, graph validation summary,
  identity/session posture, evidence destination.
- Add run timeline filters for failures, evidence-producing steps, and current
  branch when data exists.
- Add "Open failed node in Graph" wherever graph node id is available.

#### Acceptance Criteria

- Operator can launch safely, cancel safely, stop by run id, and inspect failure
  without hunting across screens.

### 7. Evidence Review And Export Flow

#### Problems To Solve

- Evidence is the durable investigation workspace.
- It must make screenshot, download, browser identity, action trace, and
  manifest evidence discoverable without exposing unsafe raw data.

#### Requirements

- Evidence page lists typed persisted evidence summaries only.
- Search/filter across safe metadata.
- Evidence detail loads bounded typed payloads on demand.
- Screenshots preview only through validated backend file commands.
- Downloads show metadata and are not previewed/executed in app.
- Reveal in folder uses backend validation.
- Export Selection creates sanitized manifest bundle without absolute original
  paths.
- Evidence detail can open related Run, Workflow, and Identity targets.
- Overview recent evidence and Runs selected details open Evidence focused or
  filtered to the correct target.

#### UI Treatment

- Use polished Evidence Explorer as baseline.
- Prefer master list + detail preview.
- Evidence type badges should be semantic and compact.
- Artifact actions must be explicit and safe.

#### Feature Upgrades

- Add saved filter chips for screenshots, downloads, identity, action trace,
  manifest, failed run, latest.
- Add comparison-friendly identity evidence summary when evidence type is
  browser identity.
- Add export summary before bundle export: selected count, types, redactions.

#### Acceptance Criteria

- Operator can find and export evidence safely.
- No unsafe paths or raw secrets appear.
- Screenshot previews and reveal actions are bounded by backend validation.

### 8. Identity Lab Flow

#### Problems To Solve

- Identity Lab must explain current, retained, historical, and diagnostic
  identity state without exposing private profile data.

#### Requirements

- Identity Lab lists current workflow-owned browser identities.
- Rows show workflow owner, session/profile reuse, retained session state,
  configured posture, latest observed browser identity evidence, diagnostics,
  and rotation history.
- Current identity detail can open Evidence, Last Run, Workflow, Workflow
  Settings.
- Historical identity references from evidence/rotation history open read-only
  context.
- Close Retained Session closes only the matching in-memory browser context and
  does not delete profile data or historical data.
- Reset Identity uses the guarded backend reset command with confirmation and is
  unavailable while active run or retained session blocks it.
- Profile paths, storage, cookies, tokens, proxy credentials, raw browser data,
  and local font/binary paths must not be exposed.

#### UI Treatment

- Use polished Identity Lab baseline.
- Treat identity as posture plus traceability, not as a generic settings table.
- Show block reasons directly beside disabled actions.

#### Feature Upgrades

- Add identity health summary: retained, reusable, warning, blocked, historical.
- Add "why blocked" action explanation for Reset Identity and Close Retained
  Session.
- Add rotation timeline with linked evidence/run context.

#### Acceptance Criteria

- Operator can understand identity/session posture and safely resolve retained
  session issues.

### 9. Scheduling Flow

#### Problems To Solve

- Schedules must clearly separate draft/disabled schedules from enabled
  runnable schedules.
- History must explain why schedule decisions happened.

#### Requirements

- Schedules page supports create/edit/delete/enable/disable for one-time,
  interval, daily, weekly, monthly schedules.
- Multiple schedules can exist per workflow.
- Enabled schedules require valid schedule config and runnable saved workflow.
- Disabled draft schedules can point at workflows still being authored.
- Schedules run only while Electron app process is active.
- Missed occurrences are skipped and recorded; no catch-up backlog.
- Conflict reasons include active workflow, active profile, active batch.
- One-time schedules disable after skipped opportunity.
- History records started, skipped, missed, failed-to-start, disabled.
- History entries with run ids open Runs. All entries can open owning Workflow.
- Stale schedule/run/workflow targets show unavailable states.

#### UI Treatment

- Use polished Schedules baseline.
- Separate upcoming schedules, draft/disabled schedules, and history.
- Use clear status pills and reason labels.

#### Feature Upgrades

- Add schedule readiness preview before enable.
- Add conflict reason glossary in history detail.
- Add "next run" clarity for local timezone.

#### Acceptance Criteria

- Operator can create and audit schedules without guessing why an occurrence did
  or did not run.

### 10. Settings, Diagnostics, Maintenance Flow

#### Problems To Solve

- App Settings must be clearly distinct from Workflow Settings.
- Diagnostics and maintenance must be useful but safe.

#### Requirements

- App Settings contains current app-level preferences, environment readiness,
  guarded maintenance commands, and graph shortcut guidance.
- App Settings does not introduce policy, retention, notification, or theme
  systems during this upgrade.
- Environment readiness shows sanitized CloakBrowser, GeoIP, headed display,
  font, profile-count, and smoke status.
- Maintenance includes guarded Install CloakBrowser Binary and Cleanup Orphaned
  Profiles.
- Graph autosave is app-level, enabled by default, and changes workflow detail
  save behavior between autosave on/off.
- Diagnostics must not expose raw binary/cache/profile/font paths.

#### UI Treatment

- Use polished App Settings baseline.
- Prefer grouped settings sections with readiness status and concise actions.
- Maintenance actions must name scope and risk.

#### Feature Upgrades

- Add readiness checklist with pass/warn/fail and "what to do next".
- Add safe copy diagnostics action that omits sensitive/local path details.
- Add shortcut quick reference grouped by navigation, selection, editing, run,
  and save.

#### Acceptance Criteria

- Operator can understand environment readiness and run maintenance without
  leaking sensitive local data.

### 11. Empty, Loading, Error, Warning, Disabled States

#### Problems To Solve

- State handling must be consistent across every workspace.
- Long messages must not break dense layouts.

#### Requirements

- Every workspace must define empty, loading, success/ready, warning, error, and
  disabled states.
- Empty states must include a useful primary next action when one exists.
- Loading states must preserve layout geometry where possible.
- Error states must show short readable summary first.
- Long technical details must be collapsed by default and include Copy details.
- Warnings must be amber and paired with text/icons, not color alone.
- Disabled consequential actions must explain why they are disabled.
- Stale target states must name the missing target and offer safe fallback
  navigation.

#### UI Treatment

- Create reusable state patterns in React/CSS where possible.
- Use compact panels, not oversized illustrations.

#### Acceptance Criteria

- No screen relies on raw unstructured text blocks for critical states.
- Operator always understands what happened and what action is available next.

### 12. Responsive Desktop Flow

#### Problems To Solve

- Mission Control must remain usable at compact desktop size.
- Dense panels, dialogs, tables, and graph layouts must not create page-level
  horizontal overflow.

#### Requirements

- Primary support sizes:
  - Large desktop: `1440x1024` and above.
  - Compact desktop: `1024x768`.
- Sidebar may collapse to icon rail at compact sizes.
- Page-level horizontal overflow is not allowed.
- Table interiors may scroll within bounded regions.
- Dialogs and popovers must stay inside viewport.
- Sticky headers/footers must not cover content.
- Secondary metadata should hide before primary labels/actions.
- Graph canvas and inspector must remain usable.

#### UI Treatment

- Define stable grid/flex constraints for shell, headers, panels, tables,
  dialogs, graph canvas, inspector, and modals.
- Use responsive CSS modules/files already in `src/styles/` where possible.

#### Acceptance Criteria

- `1024x768` visual check passes for all major workspaces and dialogs.
- No incoherent overlap or unreadable button text.

### 13. Accessibility And Keyboard Flow

#### Problems To Solve

- Dense operator UI needs keyboard and focus discipline.
- Icon-heavy controls need accessible labels and tooltips.

#### Requirements

- All icon-only controls have accessible labels and visible tooltip on hover or
  focus.
- Focus indicators use cyan treatment against dark surfaces.
- Dialogs trap focus and support close controls.
- Forms have labels, descriptions, errors, and helper text where needed.
- Keyboard shortcuts must not fire inside inputs, textareas, contenteditable
  areas, palettes, help dialogs, dropdowns, or popovers.
- Switches, segmented controls, selects, inputs, textareas, and buttons use
  shared primitives when available.
- State must not be color-only.

#### UI Treatment

- Use existing shared UI primitives under `src/components/ui/`.
- Avoid custom one-off controls when a shared primitive exists.

#### Acceptance Criteria

- Focus order is understandable.
- Screen-reader labels exist for icon controls.
- Keyboard shortcuts do not corrupt form editing.

### 14. Security And Sanitization UX

#### Problems To Solve

- This product handles sensitive automation context. UI must be helpful without
  leaking secrets or unsafe local details.

#### Requirements

- Search, overview, runs, evidence, identity, settings, diagnostics, package
  import/export, and error states must not show raw cookies, tokens, proxy
  credentials, browser storage, profile contents, arbitrary raw outputs, or
  unnecessary absolute paths.
- Export flows must explain what is sanitized.
- Evidence reveal/preview/export must use backend validation by id, not renderer
  path handling.
- Reset, delete, cleanup, stop, export, import, install, and retained-session
  close actions must name the affected scope.
- Error details may be copyable, but sensitive values must stay bounded by
  existing backend sanitization and renderer display rules.

#### UI Treatment

- Add safe display labels where values are intentionally withheld.
- Prefer "managed by backend", "sanitized", "hidden", or "not exposed" states
  over blank or confusing omissions.

#### Acceptance Criteria

- UI remains useful for debugging without exposing secrets or raw local data.

## System-First Implementation Order

The agent must implement in this order.

### Phase 0: Baseline Audit And Mapping

Create an implementation audit before code edits:

- Compare each polished Stitch screen to current React screen.
- Map each visual pattern to current components/CSS.
- Identify gaps for each of the 14 mandatory groups.
- Categorize every gap as:
  - `Foundation`: shell/component/CSS pattern needed across app.
  - `Workspace`: screen-specific implementation.
  - `Behavior`: requires runtime/IPC/backend/data change.
  - `Test`: requires test or smoke checklist update.

Deliverable:

- A short audit file under `docs/superpowers/` or a new implementation plan
  linked to this spec.

### Phase 1: UI Foundation

Implement shared foundation before screen-specific redesign:

- App shell layout and compact behavior.
- Page header/command bar pattern.
- Button hierarchy.
- Icon button/tooltip/focus pattern.
- Status pill/badge pattern.
- Dialog/modal/popup anatomy.
- Table/list/master-detail pattern.
- Empty/loading/error/warning/disabled state pattern.
- Overflow and long text handling.
- Responsive constraints.

Files likely touched:

- `src/App.tsx`
- `src/App.css`
- `src/styles/base.css`
- `src/styles/layout.css`
- `src/styles/modals.css`
- `src/styles/responsive.css`
- `src/components/layout/PageHeader.tsx`
- `src/components/ui/`
- `src/layouts/`

### Phase 2: Shell And Cross-Workspace Navigation

Implement mandatory group 1 and the cross-workspace parts of groups 11, 12, 13,
and 14.

Priorities:

- Sidebar compact behavior.
- Command search result treatment.
- Alerts focus state.
- Typed target focus and stale target display.
- Safe metadata rendering.

### Phase 3: Workflow Library, Recording, Import/Export

Implement groups 2 and 3.

Priorities:

- Workflow list scanability.
- Row status/action hierarchy.
- Create/Record/Import/Export/Duplicate/Delete clarity.
- Recording review modal upgrade.
- Package preview/export/sanitization messaging.

### Phase 4: Graph Builder And Workflow Settings

Implement groups 4 and 5.

Priorities:

- Graph toolbar/palette/inspector/issue panel layout.
- Node/link selection and semantic status colors.
- Help modal polish.
- Workflow Settings dialog sectioning, validation, help, unsaved state.
- Run from selected readiness visibility.

### Phase 5: Run Launch, Runs, Evidence

Implement groups 6 and 7.

Priorities:

- Launch Run confirmation/preflight.
- Runs master-detail and stop-by-run-id clarity.
- Failure and issue details.
- Evidence list/detail/preview/export.
- Cross-links among run, evidence, workflow, identity.

### Phase 6: Identity, Schedules, App Settings

Implement groups 8, 9, and 10.

Priorities:

- Identity posture and retained-session controls.
- Schedule creation/readiness/history/conflict reasons.
- Environment readiness and maintenance actions.
- App Settings vs Workflow Settings separation.

### Phase 7: Hardening Pass

Implement remaining cross-cutting polish for groups 11, 12, 13, and 14.

Required checks:

- Large desktop visual review.
- Compact `1024x768` visual review.
- Dialog/popover viewport review.
- Keyboard/focus review.
- Sensitive-value display review.
- Long error/details review.
- Empty/loading/error/disabled state review.

## Testing And Verification Plan

### Required Static And Unit Checks

Run at minimum:

```bash
npm test -- src/App.test.tsx src/layouts/AppShell.test.tsx src/AppCss.test.ts
npx tsc --noEmit
npm run build:electron
```

Add focused tests when touching each area:

- Workflow UI:
  `npm test -- src/features/workflows/pages/WorkflowListPage.test.tsx src/features/workflows/pages/WorkflowDetailPage.test.tsx`
- Graph editor:
  `npm test -- src/features/workflows/components/WorkflowGraphEditor.test.tsx src/features/workflows/components/WorkflowGraphPalettes.test.tsx`
- Workflow Settings:
  `npm test -- src/features/workflows/components/WorkflowSettingsDialog.test.tsx`
- Recording review:
  add or update tests around `RecordingReviewDialog.tsx`.
- Schedules:
  `npm test -- src/features/schedules/pages/SchedulesPage.test.tsx`
- API/IPC wrapper changes:
  `npm test -- src/lib/workflowApi.test.ts`
- Backend command changes:
  `npm test -- electron/backend/commands.test.ts`

If behavior crosses IPC/backend contracts, also run the route-specific Electron
backend tests named in `docs/task-routes.md`.

### Required Visual/Manual Checks

At minimum, verify:

- Overview at large desktop and `1024x768`.
- Workflow Library at large desktop and `1024x768`.
- Graph Builder at large desktop and `1024x768`.
- Workflow Settings dialog at `1024x768`.
- Recording Review dialog at `1024x768`.
- Runs at large desktop and `1024x768`.
- Evidence Explorer at large desktop and `1024x768`.
- Identity Lab at large desktop and `1024x768`.
- Schedules at large desktop and `1024x768`.
- App Settings at large desktop and `1024x768`.

Check for:

- No page-level horizontal overflow.
- No overlapping text.
- No button label clipping.
- Dialogs remain in viewport.
- Long errors collapse.
- Tables scroll inside bounded regions.
- Focus indicators are visible.

### README Smoke Checklist

Update `README.md` smoke checklist if the UI flow, labels, sequence, or user
visible behavior changes.

## Documentation Requirements

Before code changes, follow `docs/README.md` and `docs/task-routes.md`.

Docs likely to change:

- `docs/architecture/frontend.md`
- `docs/domain/user-visible-invariants.md`
- `docs/domain/product-model.md`
- `docs/contracts/electron-ipc.md` if IPC changes.
- `docs/contracts/workflow-types.md` if DTOs/types change.
- `docs/contracts/run-state.md` if run monitoring/status behavior changes.
- `README.md` smoke checklist.

Do not update docs only as ceremony. Update docs when behavior, contracts,
ownership, or visible workflow semantics change.

## Definition Of Done

The upgrade is complete only when all conditions below pass:

- All 14 mandatory groups have been implemented or explicitly mapped to current
  already-satisfying behavior with evidence.
- Stitch visual baseline has been reviewed against the implemented UI.
- `DESIGN.md` is followed across app shell, workspaces, dialogs, popups,
  tables, forms, status states, and compact desktop layout.
- Operator can complete the end-to-end flow:
  open app, search/navigate, create or record workflow, edit graph, configure
  settings, launch run, monitor run, inspect evidence, inspect identity,
  schedule workflow, review settings/diagnostics.
- Empty/loading/error/warning/disabled states are implemented consistently.
- Sensitive values remain hidden or sanitized.
- Large desktop and `1024x768` checks pass.
- Required unit/type/build checks pass.
- Focused tests are added or updated for changed behavior.
- Docs and README smoke checklist are updated when behavior changes.
- Final implementation summary lists tests run, docs updated, and any known
  residual risk.

## Agent Execution Rules

The implementation agent must:

- Treat this spec as the top-level scope.
- Work phase by phase in the order above.
- Use TDD for feature, bug fix, refactor, or behavior changes unless a documented
  exception applies.
- Read `DESIGN.md` before styling/layout edits.
- Preserve existing behavior invariants unless this spec explicitly changes
  them.
- Prefer existing shared UI primitives and local patterns.
- Avoid unrelated refactors.
- Never expose secrets or raw local sensitive data in UI or committed artifacts.
- Stop and ask for clarification only when a requirement conflicts with current
  product invariants or cannot be implemented safely.
