# Mission Control UI/UX Upgrade Execution Goal

Date: 2026-05-29

## Purpose

This file is the single execution goal for completing the full Mission Control
UI/UX upgrade described by the master spec and all child specs.

It is written for a future Codex/AI implementation agent. The agent must use
this file as the top-level handoff and must not treat the individual specs as
optional inspiration. The agent must work through the specs in order, think
deeply about each spec before touching code, implement the required behavior and
UI, verify it, commit it, and continue until the full upgrade is actually DONE.

## Top-Level Objective

Complete the entire Mission Control UI/UX upgrade from the written specs.

The work is DONE only when:

1. The master spec and child specs 01-12 have all been implemented or mapped to
   already-satisfying existing behavior with concrete evidence.
2. Every spec has its own implementation thinking pass before code changes.
3. Every spec has focused tests/checks appropriate to its risk.
4. Every completed spec or coherent implementation slice is committed.
5. The final product passes the cross-cutting hardening gates.
6. Docs and README smoke checklist are synchronized when behavior changes.
7. The final completion audit proves the objective is satisfied with real
   evidence, not intent or partial progress.

Do not stop after planning. Do not stop after a subset of screens. Do not stop
after visual polish only. Continue until the full upgrade is complete or a real
blocker makes progress impossible.

## Source Specs

Use these files as the required source of truth:

1. `docs/superpowers/specs/2026-05-28-mission-control-full-product-ui-ux-upgrade-master-spec.md`
2. `docs/superpowers/specs/2026-05-28-01-foundation-ui-system-child-spec.md`
3. `docs/superpowers/specs/2026-05-29-02-shell-navigation-search-alerts-child-spec.md`
4. `docs/superpowers/specs/2026-05-29-03-workflow-library-package-management-child-spec.md`
5. `docs/superpowers/specs/2026-05-29-04-recording-review-child-spec.md`
6. `docs/superpowers/specs/2026-05-29-05-graph-builder-child-spec.md`
7. `docs/superpowers/specs/2026-05-29-06-workflow-settings-child-spec.md`
8. `docs/superpowers/specs/2026-05-29-07-run-launch-monitoring-child-spec.md`
9. `docs/superpowers/specs/2026-05-29-08-evidence-explorer-child-spec.md`
10. `docs/superpowers/specs/2026-05-29-09-identity-lab-child-spec.md`
11. `docs/superpowers/specs/2026-05-29-10-schedules-child-spec.md`
12. `docs/superpowers/specs/2026-05-29-11-app-settings-diagnostics-child-spec.md`
13. `docs/superpowers/specs/2026-05-29-12-cross-cutting-ui-hardening-child-spec.md`

## Execution Rules

### Work One Spec At A Time

For each spec:

1. Read the spec fully.
2. Read the docs and source files named by that spec.
3. Restate the spec's objective in an implementation note.
4. Identify required decisions and choose the safest option aligned with the
   repo and spec.
5. Create a focused implementation checklist for that spec.
6. Implement only the current spec's scope, except for shared foundation work
   that is explicitly required by that spec.
7. Run focused tests/checks.
8. Update docs when behavior or contracts change.
9. Commit the completed spec slice.
10. Move to the next spec.

Do not batch multiple unrelated specs into one unreviewable commit.

### Think Deeply Before Each Spec

Before code changes for a spec, the agent must produce a short internal
implementation thinking note in the working conversation or in a temporary plan:

- What does this spec own?
- What does this spec explicitly not own?
- Which files are likely to change?
- Which tests must be added or updated?
- Which user-visible invariants could be broken?
- Which sensitive values must remain hidden?
- Which responsive and accessibility states are risky?
- What is the smallest safe implementation slice?

This thinking pass is required for every spec. Do not skip it because a spec
looks simple.

### Follow Repo Workflow

Before implementation work:

1. Read `docs/README.md`.
2. Route through `docs/task-routes.md`.
3. Follow `docs/agent-workflow.md`.
4. Read only relevant domain, architecture, and contract docs for the current
   spec.
5. For UI/style/layout changes, read `DESIGN.md`.

For code changes:

- Use `.agents/skills/test-driven-development` unless a documented exception
  applies.
- Add or update focused tests before implementation where practical.
- Use existing shared UI primitives and local patterns.
- Avoid unrelated refactors.
- Preserve current behavior unless the spec explicitly changes it.

### Commit Discipline

Commit after each completed spec or coherent spec slice.

Commit requirements:

- Commit message should name the spec or slice.
- Include the required AI trailer:
  - `Co-Authored-By: Codex <codex@openai.com>`
- Do not commit unrelated user changes.
- Do not revert user work unless explicitly asked.
- Keep commits small enough that a reviewer can connect the change to the spec.

Recommended commit shape:

- `ui: implement foundation ui system upgrade`
- `ui: implement shell navigation search alerts upgrade`
- `ui: implement workflow library package management upgrade`
- `ui: implement recording review upgrade`
- `ui: implement graph builder upgrade`
- `ui: implement workflow settings upgrade`
- `ui: implement run launch monitoring upgrade`
- `ui: implement evidence explorer upgrade`
- `ui: implement identity lab upgrade`
- `ui: implement schedules upgrade`
- `ui: implement app settings diagnostics upgrade`
- `ui: implement cross cutting ui hardening`

Use narrower commit messages when a spec is split into multiple coherent
slices.

### Compact And Long-Running Work

This upgrade is large. Use Codex context compaction when needed.

Before relying on compaction or before the context becomes crowded:

1. Write a concise progress note in the conversation.
2. State the current spec number.
3. List completed commits.
4. List files changed in the current uncommitted slice.
5. List tests already run and their result.
6. List the next concrete step.
7. Continue after compacting from the latest state rather than restarting.

Do not use compaction as a reason to stop early.

## Required Implementation Order

### Phase 0: Baseline Audit

Use the master spec Phase 0.

Required deliverable:

- A short implementation audit under `docs/superpowers/` that maps the current
  React app to the master spec and child specs.

The audit must categorize gaps as:

- `Foundation`
- `Workspace`
- `Behavior`
- `Test`
- `Docs`

Commit after the audit if it is a standalone docs deliverable.

### Phase 1: Spec 01 Foundation UI System

Source:

- `docs/superpowers/specs/2026-05-28-01-foundation-ui-system-child-spec.md`

Primary goal:

- Establish shared UI primitives, layout patterns, state patterns, dialog
  anatomy, buttons, badges, tables, forms, focus, responsive constraints, and
  design-system compliance.

Expected areas:

- `src/components/ui/`
- `src/components/layout/`
- `src/layouts/`
- `src/styles/`
- `src/App.css`
- `src/AppCss.test.ts`

Completion gate:

- Shared foundation is ready for screen-specific specs.
- No major workspace needs one-off replacements for basic buttons, dialogs,
  inputs, tooltips, state messages, or badges.

### Phase 2: Spec 02 Shell Navigation, Search, Alerts

Source:

- `docs/superpowers/specs/2026-05-29-02-shell-navigation-search-alerts-child-spec.md`

Primary goal:

- Implement polished app shell, sidebar, command search, alerts shortcut,
  focus routing, and stale target handling.

Expected areas:

- `src/App.tsx`
- `src/layouts/`
- `src/features/overview/`
- `src/lib/workflowUi.ts`
- shell and app tests.

Completion gate:

- Search opens every supported target safely.
- Alerts focus Overview attention.
- Sidebar order and compact behavior are correct.
- No sensitive values appear in shell/search.

### Phase 3: Spec 03 Workflow Library And Package Management

Source:

- `docs/superpowers/specs/2026-05-29-03-workflow-library-package-management-child-spec.md`

Primary goal:

- Upgrade workflow list, row actions, create/record/import/export/duplicate,
  delete confirmation, run/stop row states, and package management UX.

Expected areas:

- `src/features/workflows/pages/WorkflowListPage.tsx`
- workflow package components.
- `src/App.tsx`
- package import/export command wrappers and tests when needed.

Completion gate:

- Workflow library is scan-friendly.
- Active row behavior is safe.
- Duplicate/export/import/delete consequences are explicit.
- Package sanitization is explained.

### Phase 4: Spec 04 Recording Review

Source:

- `docs/superpowers/specs/2026-05-29-04-recording-review-child-spec.md`

Primary goal:

- Upgrade recording launch, stop/generate states, review modal, sensitive value
  redaction, replacement recording, warnings, and save/discard flows.

Expected areas:

- `src/features/workflows/components/RecordingReviewDialog.tsx`
- recorder-related App orchestration.
- Electron recording tests if behavior changes.

Completion gate:

- New and replacement recording flows are visually distinct.
- Redacted values remain safe.
- Review dialog fits compact desktop.
- Save/discard semantics are clear.

### Phase 5: Spec 05 Graph Builder

Source:

- `docs/superpowers/specs/2026-05-29-05-graph-builder-child-spec.md`

Primary goal:

- Upgrade Graph Builder canvas, toolbar, palettes, inspector, issue panel,
  node/link states, ports, edge waits, selection, shortcuts, validation, and run
  context.

Expected areas:

- `src/features/workflows/pages/WorkflowDetailPage.tsx`
- `src/features/workflows/components/WorkflowGraphEditor.tsx`
- `src/features/workflows/components/WorkflowGraphToolbar.tsx`
- `src/features/workflows/components/WorkflowGraphPalettes.tsx`
- `src/features/workflows/components/WorkflowGraphInspector.tsx`
- graph libs and CSS.

Completion gate:

- Operator can author, validate, save, and run from graph without layout
  confusion.
- Graph is usable at `1024x768`.
- Runtime/validation issues map back to graph where possible.

### Phase 6: Spec 06 Workflow Settings

Source:

- `docs/superpowers/specs/2026-05-29-06-workflow-settings-child-spec.md`

Primary goal:

- Upgrade per-workflow Settings dialog with five sections, one save action,
  Browser Launch identity posture, Run Policy, Environment variables, help,
  reset identity guard, and unsaved-close flow.

Expected areas:

- `src/features/workflows/components/WorkflowSettingsDialog.tsx`
- `src/features/workflows/lib/workflowSettings.ts`
- settings tests.

Completion gate:

- Settings remains per-workflow and distinct from App Settings.
- Browser identity and run-policy consequences are explicit.
- Dialog is usable at `1024x768`.

### Phase 7: Spec 07 Run Launch And Runs Monitoring

Source:

- `docs/superpowers/specs/2026-05-29-07-run-launch-monitoring-child-spec.md`

Primary goal:

- Upgrade Launch Run confirmation/preflight, run issue panel, active run
  snapshots, stop-by-run-id, Runs page, durable focused run detail, and
  cross-links to Workflow/Evidence/Identity.

Expected areas:

- `src/features/workflows/components/RunIssuePanel.tsx`
- `src/features/workflows/components/RunStatusBar.tsx`
- `src/features/runs/pages/RunCenterPage.tsx`
- `src/App.tsx`
- run-state contracts/tests if needed.

Completion gate:

- Cancel starts no run.
- Blockers show before execution.
- Stop scope is precise.
- Runs page handles concurrent and stale states.

### Phase 8: Spec 08 Evidence Explorer

Source:

- `docs/superpowers/specs/2026-05-29-08-evidence-explorer-child-spec.md`

Primary goal:

- Upgrade Evidence Explorer as typed evidence workspace with safe metadata,
  filters, list/grid, detail, preview/reveal/export, and cross-links.

Expected areas:

- `src/features/evidence/pages/EvidenceExplorerPage.tsx`
- evidence API wrappers and tests.
- backend evidence commands only if UI requirements need typed support.

Completion gate:

- Evidence is useful without raw secrets or unsafe paths.
- Screenshot/reveal/export actions use backend validation.
- Export selection explains sanitization.

### Phase 9: Spec 09 Identity Lab

Source:

- `docs/superpowers/specs/2026-05-29-09-identity-lab-child-spec.md`

Primary goal:

- Upgrade Identity Lab as identity posture, diagnostics, retained-session,
  reset, evidence, run, workflow settings, and historical-reference workspace.

Expected areas:

- `src/features/identities/pages/IdentityLabPage.tsx`
- identity API wrappers and tests.
- backend identity commands only if required.

Completion gate:

- Managed and historical identities are clearly different.
- Close retained session and reset identity are safe and guarded.
- No profile paths, storage, cookies, tokens, or proxy credentials are exposed.

### Phase 10: Spec 10 Schedules

Source:

- `docs/superpowers/specs/2026-05-29-10-schedules-child-spec.md`

Primary goal:

- Upgrade Schedules page, schedule table, create/edit dialog, enablement
  readiness, delete confirmation, event history, conflict reason mapping, and
  stale target behavior.

Expected areas:

- `src/features/schedules/pages/SchedulesPage.tsx`
- `src/styles/schedules.css`
- schedule tests.
- scheduling backend tests only if behavior changes.

Completion gate:

- All supported schedule kinds are authorable.
- Enablement explains saved workflow semantics.
- History explains started/skipped/missed/failed/disabled decisions.
- Stale schedule/run/workflow targets are explicit.

### Phase 11: Spec 11 App Settings, Diagnostics, Maintenance

Source:

- `docs/superpowers/specs/2026-05-29-11-app-settings-diagnostics-child-spec.md`

Primary goal:

- Upgrade App Settings as app-level preference, diagnostics, maintenance, and
  graph shortcut workspace.

Expected areas:

- `src/features/settings/pages/SettingsPage.tsx`
- `src/features/workflows/components/GraphShortcutGuide.tsx`
- diagnostics formatting helpers/tests.
- command wrappers only if behavior changes.

Completion gate:

- App Settings stays app-level only.
- Diagnostics are useful and sanitized.
- Maintenance actions are guarded.
- Graph autosave behavior remains clear.

### Phase 12: Spec 12 Cross-Cutting UI Hardening

Source:

- `docs/superpowers/specs/2026-05-29-12-cross-cutting-ui-hardening-child-spec.md`

Primary goal:

- Final integration gate across states, responsive desktop, accessibility,
  keyboard flow, sensitive display, traceability, docs, tests, and visual
  verification.

Expected areas:

- shared primitives;
- all touched workspaces;
- CSS and responsive files;
- app-level tests;
- README smoke checklist if flow changed.

Completion gate:

- Large desktop and `1024x768` checks pass for every major workspace.
- Empty/loading/error/warning/disabled states are consistent.
- Sensitive display audit passes.
- Required tests and docs are complete.

## Per-Spec Completion Template

For each spec, the agent must produce evidence in the final message for that
slice:

```text
Spec:
Files changed:
Main implementation decisions:
Tests/checks run:
Docs updated:
Behavior preserved:
Known residual risk:
Commit:
```

The commit can be a single spec commit or several coherent commits. The final
summary must list all commits.

## Required Test And Check Policy

Minimum after any UI implementation slice:

- Run focused Vitest tests for touched components.
- Run `npx tsc --noEmit` before considering the spec complete.
- Run `npm run build:electron` if Electron/preload/main/backend files changed.
- Run route-specific backend tests from `docs/task-routes.md` if behavior
  crosses IPC/backend contracts.

Minimum final checks:

```bash
npm test -- src/App.test.tsx src/layouts/AppShell.test.tsx src/AppCss.test.ts
npx tsc --noEmit
npm run build:electron
```

Also run every focused test relevant to changed workspaces.

Do not claim DONE if tests were skipped without a documented reason.

## Documentation Policy

Update docs when behavior, ownership, contracts, or visible workflow semantics
change.

Likely docs:

- `docs/domain/user-visible-invariants.md`
- `docs/domain/product-model.md`
- `docs/architecture/frontend.md`
- `docs/architecture/command-boundary.md`
- `docs/contracts/electron-ipc.md`
- `docs/contracts/workflow-types.md`
- `docs/contracts/run-state.md`
- `docs/task-routes.md`
- `README.md`

If docs are not updated for a code change, explain why in the final response.

## Sensitive Data Guardrails

The final UI must not expose:

- cookies;
- tokens;
- proxy passwords;
- browser storage values;
- raw profile contents;
- raw diagnostic objects;
- unnecessary absolute local paths;
- raw evidence artifact paths;
- arbitrary raw run outputs.

Any search, diagnostics, evidence, identity, run, schedule, import/export, or
error UI must use safe labels, typed summaries, backend-validated ids, and
sanitized details.

## Responsive And Accessibility Guardrails

The final UI must pass:

- large desktop review;
- compact `1024x768` review;
- dialog viewport review;
- popover/palette containment review;
- keyboard focus review;
- icon label and tooltip review;
- disabled reason review;
- color-not-alone state review.

Do not mark DONE if a major workspace has incoherent overlap, clipped primary
actions, inaccessible icon controls, or page-level horizontal overflow.

## Final Completion Audit

Before declaring the full objective complete, the agent must perform a final
audit using real evidence.

The audit must include:

1. Restated objective.
2. Checklist mapping every spec to implemented evidence.
3. Commit list.
4. Files changed summary.
5. Tests/checks run and results.
6. Docs updated or rationale for no docs update.
7. Visual/manual verification matrix.
8. Sensitive display audit result.
9. Known residual risks.
10. Confirmation that git status is clean or explanation of intended remaining
    changes.

The agent must not rely on:

- intent;
- partial progress;
- large diff size;
- passing unrelated tests;
- old screenshots;
- memory from earlier context;
- plausible final summary.

Only actual files, command output, tests, commits, and inspected UI behavior
count as completion evidence.

## Stop Conditions

Do not stop unless one of these is true:

1. The full objective is complete and audited.
2. A real blocker prevents progress, and the blocker is documented with:
   - what failed;
   - what was attempted;
   - why it blocks completion;
   - the exact next action needed from a human.

Context length, number of specs, or elapsed time is not a valid stop condition.
Use compacting and continue.

## Final Definition Of DONE

The upgrade is DONE when all of the following are true:

- Master spec mandatory scope is satisfied.
- Child specs 01-12 are satisfied.
- Every spec had a thinking pass before implementation.
- Every implemented slice has a commit.
- Focused tests pass.
- Required final checks pass.
- Docs are synchronized.
- README smoke checklist is accurate.
- Sensitive display audit passes.
- Large desktop and `1024x768` visual checks pass.
- Git status is clean or only explicitly documented non-task changes remain.
- Final audit maps every requirement to real evidence.

Until all of these are true, continue working.
