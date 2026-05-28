# Mission Control UI/UX Upgrade Baseline Audit

Date: 2026-05-29

## Scope

This audit maps the current React app to the Mission Control full-product
UI/UX upgrade master spec and child specs 01-12 before implementation changes.

Sources inspected:

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
- `docs/superpowers/specs/2026-05-29-12-cross-cutting-ui-hardening-child-spec.md`
- `docs/README.md`, `docs/task-routes.md`, `docs/agent-workflow.md`,
  `docs/domain/product-model.md`, `docs/domain/user-visible-invariants.md`,
  `docs/architecture/overview.md`, `docs/architecture/frontend.md`
- `DESIGN.md`
- Runtime UI files under `src/App.tsx`, `src/layouts/`, `src/components/ui/`,
  `src/styles/`, and `src/features/`.

## Current App Map

Current source already contains a broad Mission Control shell and workspaces:

- Shell/navigation: `src/layouts/AppShell.tsx`, `src/layouts/AppSidebar.tsx`,
  `src/App.tsx`.
- Foundation primitives: `src/components/ui/` for buttons, icon buttons,
  dialogs, inputs, labels, switches, segmented controls, scroll areas, cards,
  badges, tooltips, field groups, and unsaved-change confirmation.
- Styling: `src/App.css`, `src/styles/base.css`, `src/styles/layout.css`,
  `src/styles/modals.css`, `src/styles/responsive.css`,
  `src/styles/workflows.css`, `src/styles/workflow-graph.css`,
  `src/styles/schedules.css`.
- Workspaces: Overview, Workflows, Runs, Evidence, Schedules, Identities,
  Settings, plus workflow detail graph builder and recording/settings dialogs.
- Existing tests cover the shell, App orchestration, CSS invariants, workflow
  list/detail, graph editor/palettes, Workflow Settings, schedules, shared UI
  primitives, workflow API wrappers, Electron commands, persistence, scheduling,
  evidence, identity, recorder, runner, and graph services.

The app is not a blank implementation. The upgrade should therefore harden and
complete existing surfaces rather than replace them wholesale.

## Gap Categories

### Foundation

- Shared primitives exist, but there is no single reusable state panel pattern
  for empty/loading/error/warning/disabled/stale states across every workspace.
- Dialog anatomy exists through Radix wrappers, but destructive/maintenance
  confirmations are implemented unevenly across screens.
- Table/list/master-detail layouts exist per screen, but compact overflow and
  bounded inner scrolling need a final consistency pass.
- Button/icon button primitives exist; remaining work is adoption, tooltip/focus
  verification, disabled-reason copy, and CSS invariants.

### Workspace

- Overview already renders metrics, live runs, attention, activity, evidence,
  and schedules, but needs final polish against the Stitch hierarchy.
- Workflow Library supports create, record, import, run, stop, duplicate,
  export, edit, and delete. Gaps: selected-row preview/details panel, quick
  filters, and richer empty-state onboarding.
- Recording Review exists and supports draft editing, inclusion, warnings, and
  redaction-oriented UI. Gaps: summary strip, needs-attention filter, compact
  overflow hardening, and stronger new-vs-replacement visual distinction.
- Graph Builder has React Flow canvas, toolbar, palettes, inspector, validation,
  run issues, link waits, selection, shortcuts, and help. Gaps: final layout
  polish, health badges, mini run summary, issue quick actions consistency, and
  compact viewport verification.
- Workflow Settings already has the five sections, save flow, reset identity,
  help, run policy, browser launch, graph defaults, and environment. Gaps:
  readiness/changed-field summaries and final compact dialog hardening.
- Runs supports session snapshots, selected durable run detail, stop-by-run-id,
  stale target messaging, and cross-links. Gaps: richer timeline filters and
  launch preflight presentation.
- Evidence Explorer supports safe typed evidence list/detail, filters,
  selection export, screenshot preview, reveal, and cross-links. Gaps: saved
  filter chips, export summary, and more comparison-friendly identity payload
  presentation.
- Identity Lab supports managed/historical identity views, diagnostics, retained
  session close, reset identity, and cross-links. Gaps: health summary,
  guarded close confirmation, rotation timeline polish, and clearer blocked
  action explanations.
- Schedules supports list, create/edit, enable/disable, delete, history, and
  workflow/run navigation. Gaps: readiness preview, conflict glossary, delete
  confirmation, local-time clarity, and stale-target state polish.
- App Settings supports graph autosave, diagnostics, maintenance actions, and
  graph shortcut guidance. Gaps: guarded maintenance confirmations, safe copy
  diagnostics, readiness checklist detail, and diagnostic formatter tests.

### Behavior

- Shell search already searches bounded read models in `src/App.tsx`; verify
  result routing, stale target copy, and sensitive display across all result
  types before closing Spec 02.
- The typed Electron bridge and backend own evidence preview/reveal/export,
  identity actions, scheduling, package import/export, recorder lifecycle, and
  run monitoring. Add backend/IPC changes only when a child spec cannot be
  satisfied from existing DTOs.
- Do not introduce broad new systems for notification, theme, policy, or
  retained browser behavior; current docs explicitly keep those out of scope.
- Preserve all sensitive display guardrails: no raw cookies, tokens, proxy
  credentials, browser storage, profile contents, raw diagnostics, absolute
  local paths, raw evidence artifact paths, or arbitrary run outputs.

### Test

- Existing focused tests are present for many touched areas, but new behavior
  must be driven by failing tests first.
- Minimum final checks remain:
  `npm test -- src/App.test.tsx src/layouts/AppShell.test.tsx src/AppCss.test.ts`,
  `npx tsc --noEmit`, and `npm run build:electron`.
- Focused tests likely to change:
  `src/layouts/AppShell.test.tsx`, `src/App.test.tsx`,
  `src/AppCss.test.ts`, `src/features/workflows/pages/WorkflowListPage.test.tsx`,
  `src/features/workflows/pages/WorkflowDetailPage.test.tsx`,
  `src/features/workflows/components/RecordingReviewDialog.tsx` tests,
  `src/features/workflows/components/WorkflowGraphEditor.test.tsx`,
  `src/features/workflows/components/WorkflowGraphPalettes.test.tsx`,
  `src/features/workflows/components/WorkflowSettingsDialog.test.tsx`,
  `src/features/schedules/pages/SchedulesPage.test.tsx`, and new focused tests
  for Evidence, Identity, Runs, and Settings pages when those screens change.

### Docs

- Current docs already describe many upgraded behaviors, especially typed
  Mission Control navigation, Evidence Explorer, Identity Lab, Runs, Schedules,
  Workflow Settings, Graph Builder, and recorder flows.
- Update `docs/domain/user-visible-invariants.md`,
  `docs/domain/product-model.md`, `docs/architecture/frontend.md`,
  `docs/contracts/*`, `docs/task-routes.md`, and `README.md` only when a spec
  changes behavior, ownership, contracts, required verification, or smoke flow.
- This Phase 0 audit is docs-only and does not change product behavior.

## Spec Mapping

| Spec | Already Present Evidence | Primary Gaps |
| --- | --- | --- |
| Master | All major workspaces and typed shell route exist. `DESIGN.md` dark desktop system exists. | Complete per-spec hardening, visual checks, docs/test audit, final sensitive display audit. |
| 01 Foundation | `src/components/ui/`, `PageHeader`, `AppShell`, CSS split by base/layout/modals/responsive/workflows/graph/schedules. | Reusable state/stale patterns, compact overflow assertions, primitive adoption review. |
| 02 Shell | Sidebar order, command bar, search results, Alerts routing, typed targets in `src/App.tsx`. | Stale target panel consistency, result hierarchy, compact icon rail verification, search sensitive audit. |
| 03 Workflow Library | Workflow list has create/record/import/run/stop/duplicate/export/edit/delete and confirmation dialogs. | Filters, selected preview/detail panel, richer package/delete/duplicate consequence copy. |
| 04 Recording Review | `RecordingReviewDialog.tsx` handles draft review, warnings, inclusion, edited values, save/discard. | Summary strip, needs-attention filtering, replacement/new visual distinction, compact modal hardening. |
| 05 Graph Builder | React Flow graph editor, toolbar, palettes, inspector, issues, link waits, selection, help. | Header health badges, mini run summary, palette containment polish, compact viewport verification. |
| 06 Workflow Settings | Five-section dialog, run policy, browser launch, graph defaults, environment, help, reset, unsaved flow. | Readiness summary, changed-fields summary, launch/apply hints, compact dialog verification. |
| 07 Runs | Launch Run dialog, run issues/status, session Runs page, stale durable detail, stop by run id, links. | Preflight panel richness, timeline filters, stop confirmation/risk copy where needed. |
| 08 Evidence | Evidence list/detail, safe filters, preview/reveal/export by id, cross-links. | Saved filter chips, export summary, identity-evidence comparison layout, page tests. |
| 09 Identity | Managed/historical detail, diagnostics, reset, retained close, evidence/run/workflow links. | Health summary, close retained confirmation, blocked-action explanation polish, page tests. |
| 10 Schedules | Schedule CRUD UI, enable/disable, table/history, run/workflow links, backend scheduler tests. | Readiness preview, conflict glossary, delete confirmation, stale copy polish, compact layout check. |
| 11 App Settings | App settings page, graph autosave, diagnostics, maintenance commands, shortcut guide. | Guarded maintenance dialogs, safe copy diagnostics, readiness checklist formatting/tests. |
| 12 Hardening | Existing CSS and tests cover many invariants. | Full matrix: visual/manual desktop checks, sensitive audit, docs/README sync, final check suite. |

## Implementation Notes

- Work spec by spec in execution-goal order.
- For code-changing specs, start with the smallest failing focused test that
  proves the intended behavior.
- Prefer existing components and style files; avoid parallel one-off systems.
- Treat backend DTO additions as last resort after verifying current typed data
  cannot support the UX.
- Commit this audit separately as Phase 0 docs-only work, then commit each spec
  or coherent spec slice with the required `Co-Authored-By` trailer.
