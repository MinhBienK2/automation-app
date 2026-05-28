# Mission Control UI/UX Upgrade Child Spec 11: App Settings, Diagnostics, And Maintenance

Date: 2026-05-29

## Status

Approved design direction, drafted for user review.

This child spec follows the master UI/UX upgrade spec and child specs 01-10.
It owns the app-level Settings workspace.

## Brainstorming Decisions

Question: should app Settings include workflow policies?

Approved answer: no. Workflow execution policy belongs in per-workflow Workflow
Settings. App Settings stays limited to app-level preferences, readiness
diagnostics, guarded maintenance, and graph shortcut guidance.

Question: should diagnostics expose raw local paths?

Approved answer: no. Diagnostics should show readiness and bounded summaries,
not raw binary/cache/profile/font paths.

Question: what should maintenance actions optimize for?

Approved answer: explicit operator control. Commands must be named, scoped, and
guarded where destructive or high-impact.

## Goal

Make app Settings a quiet operational page for global editor preferences,
environment readiness, guarded local maintenance, and shortcut reference.

The implementation must:

1. Keep app settings distinct from Workflow Settings.
2. Preserve graph autosave as an app-level setting.
3. Improve diagnostics readability.
4. Make maintenance actions scoped and safe.
5. Keep shortcut guidance available without leaving Settings.
6. Avoid unsupported policy/theme/notification systems.

## Inputs And Sources Of Truth

Read before implementation:

- `docs/README.md`
- `docs/task-routes.md`
- `DESIGN.md`
- `docs/domain/user-visible-invariants.md`
- `docs/architecture/frontend.md`
- `docs/contracts/electron-ipc.md`
- Graph Builder child spec
- Workflow Settings child spec

Visual reference:

- `.stitch/designs/2026-05-28-12-polished-08-app-settings.html`

Primary source files:

- `src/features/settings/pages/SettingsPage.tsx`
- `src/features/workflows/components/GraphShortcutGuide.tsx`
- `src/App.tsx`
- `src/lib/workflowApi.ts`
- `src/types/workflow.ts`
- `src/styles/workflows.css`
- `src/styles/layout.css`
- `electron/backend/commands.ts`
- `electron/backend/browser/localEnvironment.ts`

Likely tests:

- add `src/features/settings/pages/SettingsPage.test.tsx`
- `src/App.test.tsx`
- `src/layouts/AppShell.test.tsx` if navigation/focus changes
- `src/lib/workflowApi.test.ts` if wrappers change
- backend command tests if command behavior changes

## Scope Boundaries

### In Scope

- App Settings layout.
- Graph autosave setting.
- Environment readiness diagnostics display.
- Diagnostics refresh state.
- CloakBrowser install/check action.
- Orphaned inactive profile cleanup action.
- Maintenance success/error messages.
- Graph shortcut guide presentation.
- Compact desktop behavior.

### Out Of Scope

- Workflow run policy.
- Browser Launch identity fields.
- Theme switching.
- Notification settings.
- Retention policy systems.
- Raw diagnostic payload viewer.
- Arbitrary filesystem cleanup.

## Layout Requirements

Settings page should use simple stacked sections:

- Workflow Editing: graph autosave.
- Runtime Readiness: diagnostics grid and refresh.
- Maintenance: guarded local runtime commands.
- Graph Shortcuts: shared `GraphShortcutGuide`.

Use full-width sections, not nested cards inside cards.

Header:

- title;
- short app-level context;
- no hero treatment.

## Graph Autosave Requirements

Control:

- switch labeled `Autosave graph changes`;
- description explains enabled saves graph edits after changes and disabled uses
  manual Save.

Behavior:

- remains app-level;
- default enabled;
- should not imply Workflow Settings autosave;
- changing it should update app state immediately.

## Diagnostics Requirements

Diagnostics grid shows:

- CloakBrowser binary installed/version status;
- GeoIP availability;
- headed display readiness;
- fingerprint fonts status;
- managed profile count;
- smoke readiness.

Diagnostics should use semantic states:

- ready;
- attention;
- unavailable/error;
- neutral.

Refresh:

- refresh button shows loading state;
- errors appear in alert region;
- stale prior diagnostics may remain visible with updated error if current
  behavior supports it.

Do not show raw paths. If deeper path detail is required for debugging, it must
go through a deliberate safe copy/export command in a future spec, not this UI.

## Maintenance Requirements

Commands:

- Install CloakBrowser Binary.
- Cleanup Orphaned Profiles.

Install:

- explains it affects the local lab runtime.
- shows success/error status.
- does not block navigation.

Cleanup:

- should be guarded if implementation can delete local files.
- copy must say inactive orphaned profiles only.
- must not imply active retained sessions or workflow-owned active profiles will
  be deleted.

Maintenance message:

- show command result as status;
- keep messages compact;
- never display raw internal stack traces.

## Graph Shortcut Guide Requirements

Use the shared `GraphShortcutGuide` so Settings and Graph toolbar stay aligned.

Guide should include:

- selection;
- pan;
- box select;
- node/link editing;
- copy/paste/duplicate/delete;
- undo/redo;
- save/run shortcuts only if implemented.

Do not maintain duplicate shortcut copy in Settings.

## CSS And Responsive Requirements

Follow `DESIGN.md`.

At `1024x768`:

- readiness grid collapses without overlap;
- maintenance actions wrap;
- shortcut guide remains readable;
- no section overflows horizontally.

## Tests And Checks

Required focused tests when implemented:

- Graph autosave switch calls update callback.
- Diagnostics loading/error/data states render.
- Diagnostics do not render representative raw paths.
- Refresh calls diagnostics callback.
- Install and cleanup call correct callbacks.
- Maintenance message renders as status.
- Shortcut guide renders from shared component.
- Compact CSS invariants are covered where practical.

Run checks:

- `npm test -- src/features/settings/pages/SettingsPage.test.tsx`
- `npm test -- src/App.test.tsx`
- `npm test -- src/lib/workflowApi.test.ts` if wrappers change
- `npm test -- electron/backend/commands.test.ts` if command behavior changes
- `npm test -- src/AppCss.test.ts`
- `npx tsc --noEmit`

## Acceptance Criteria

- App Settings contains only app-level settings, diagnostics, maintenance, and
  shortcuts.
- Diagnostics are useful without exposing raw local internals.
- Maintenance commands are clearly scoped.
- Graph autosave remains understandable and distinct from workflow settings.
- Page works on compact desktop.

