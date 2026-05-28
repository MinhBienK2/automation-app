# Mission Control UI/UX Upgrade Child Spec 06: Workflow Settings

Date: 2026-05-29

## Status

Approved design direction, drafted for user review.

This child spec follows the master UI/UX upgrade spec and child specs 01-05.
It owns the per-workflow settings dialog, not the app-level Settings page.

## Brainstorming Decisions

Question: should Workflow Settings become a full page or remain a dialog?

Approved answer: keep it as a large bounded dialog. Settings are contextual to
the selected workflow, and operators should return to the graph/list without a
navigation context switch.

Question: should each section save independently?

Approved answer: no visible per-section save buttons. Keep one dialog-level
`Save Settings` action while implementation may continue using section-level
backend commands internally.

Question: should the dialog add new policy systems?

Approved answer: no. It should expose current workflow settings clearly:
General, Graph, Run Policy, Browser Launch, and Environment.

## Goal

Turn Workflow Settings into a clear, safe, sectioned configuration workspace for
everything that affects how a workflow is identified, authored, launched, and
run.

The implementation must:

1. Preserve the five existing sections.
2. Make section navigation stable and keyboard accessible.
3. Group related controls so operators do not scan one long form.
4. Make Browser Launch identity posture understandable without exposing raw
   private storage paths.
5. Make Run Policy consequences explicit before launch.
6. Make Environment variable rows easy to add/edit without JSON-only thinking.
7. Protect unsaved edits on close.
8. Keep app-level settings out of this dialog.

## Inputs And Sources Of Truth

Read before implementation:

- `docs/README.md`
- `docs/task-routes.md`
- `DESIGN.md`
- `docs/domain/user-visible-invariants.md`
- `docs/domain/workflow-lifecycle.md`
- `docs/domain/execution-semantics.md`
- `docs/architecture/frontend.md`
- `docs/contracts/workflow-types.md`
- `docs/contracts/electron-ipc.md`
- Graph Builder child spec

Visual reference:

- `.stitch/designs/2026-05-28-12-polished-12-workflow-settings-dialog.html`

Primary source files:

- `src/features/workflows/components/WorkflowSettingsDialog.tsx`
- `src/features/workflows/lib/workflowSettings.ts`
- `src/features/workflows/components/VariableConfigFields.tsx`
- `src/components/ui/settings-field-group.tsx`
- `src/components/ui/unsaved-changes-dialog.tsx`
- `src/components/ui/switch.tsx`
- `src/components/ui/segmented-control.tsx`
- `src/lib/workflowApi.ts`
- `src/types/workflow.ts`
- `src/styles/modals.css`
- `src/styles/workflows.css`

Likely tests:

- `src/features/workflows/components/WorkflowSettingsDialog.test.tsx`
- `src/features/workflows/lib/workflowSettings.test.ts`
- `src/features/workflows/pages/WorkflowDetailPage.test.tsx`
- `src/features/workflows/pages/WorkflowListPage.test.tsx`
- `src/lib/workflowApi.test.ts` if wrappers change

## Scope Boundaries

### In Scope

- Dialog layout.
- Section sidebar/tabs.
- Header and footer save actions.
- Field grouping.
- Inline validation and warnings.
- Help language toggle and collapsible help treatment.
- Unsaved close guard.
- Reset identity confirmation entry point.
- Disabled paused batch controls with explanation.
- Compact desktop dialog behavior.

### Out Of Scope

- App-level settings.
- New schedule policy.
- New notification policy.
- New retention/history system.
- Theme switching.
- Raw profile directory display.
- Renderer-generated identity ids or fingerprint seeds.

## Dialog Architecture

Keep `WorkflowSettingsDialog.tsx` as the dialog shell and orchestration point,
but split sections if the file becomes hard to navigate.

Recommended split:

```text
src/features/workflows/components/settings/
  WorkflowSettingsDialogShell.tsx
  WorkflowSettingsSectionNav.tsx
  GeneralSettingsSection.tsx
  GraphDefaultsSettingsSection.tsx
  RunPolicySettingsSection.tsx
  BrowserLaunchSettingsSection.tsx
  EnvironmentSettingsSection.tsx
  WorkflowSettingsHelpPanel.tsx
```

Use this split only if it reduces real complexity. Preserve public props used
by `WorkflowDetailPage`, `WorkflowListPage`, and `App.tsx`.

## Layout Requirements

Dialog shell:

- Width suitable for desktop settings, with max height inside viewport.
- Header contains workflow context, title, dirty indicator, and `Save Settings`.
- Body has left section nav and right scrollable section content.
- Footer repeats primary save/cancel behavior only if needed for long sections.
- Section content scrolls internally; dialog header remains stable.

Section nav:

- General
- Graph
- Run Policy
- Browser Launch
- Environment

The nav must use current section ids:

- `general`
- `graph_defaults`
- `run_policy`
- `browser_launch`
- `environment`

At compact desktop, nav may become horizontal tabs or a select, but section
identity must remain visible.

## Section Requirements

### General

Owns workflow identity metadata:

- workflow name;
- description/notes if currently supported;
- tags if currently supported;
- created/updated metadata as read-only when available.

Requirements:

- Blank workflow names remain rejected.
- Name edits clearly affect workflow list and header labels.
- Metadata fields use compact inputs and do not stretch the dialog vertically.

### Graph

Owns graph authoring defaults only:

- default link wait copied to newly created graph edges.

Requirements:

- Explain that changing default link wait does not rewrite existing links.
- Support none, fixed milliseconds, and random min/max milliseconds.
- Validate min/max constraints in UI before save when possible.
- Keep page-state waits as graph actions, not settings.

### Run Policy

Owns execution policy:

- maximum workflow duration;
- browser retention;
- Allow Run JavaScript;
- Run from selected enablement and scope;
- visible paused batch controls.

Requirements:

- `Run from selected` group shows prerequisites in compact copy:
  Reuse login session, browser retention retain, matching retained session.
- Scope select supports `selected_only` and `from_selected`.
- Batch concurrency, batch headless, and stop-on-first-failed-row remain visible
  but disabled with a pause note until Batch Run UI is ready.
- Turning off a prerequisite should make the disabled consequence obvious.

### Browser Launch

Owns identity and launch context:

- stable read-only identity id;
- editable display name;
- fixed fingerprint seed;
- persona metadata;
- Reuse login session;
- proxy URL/credentials/bypass;
- GeoIP;
- timezone/locale;
- detected local timezone/locale;
- fingerprint fonts directory;
- humanize input toggle;
- humanize preset;
- headless controls;
- Reset identity.

Requirements:

- Do not show `profile_dir` as a separate storage field.
- Do not expose raw private browser profile paths.
- Seed is visible and read-only.
- Reset identity opens an in-app confirmation and delegates to backend command.
- Reset identity saves pending settings first through existing orchestration.
- Reuse login session off clears persistent profile usage but keeps identity
  seed stable.
- Warnings for GeoIP off without explicit timezone/locale must be visible near
  the related controls.
- Font directory warnings must explain stable fingerprint risk without exposing
  sensitive raw path data beyond allowed operator-entered field display.

### Environment

Owns initial runtime variables:

- typed variable rows;
- text/number/boolean/json values;
- add/remove/reorder if supported by the existing row editor;
- JSON import/export helpers only if existing helpers support it.

Requirements:

- Make variables feel like run context, not app secrets storage.
- Do not imply secrets are securely stored if current contract does not provide
  secret management.
- Variable names should be scannable and validate empty/duplicate names where
  current helpers support it.

## Help Requirements

Section help must remain bilingual English/Vietnamese.

Requirements:

- Compact language toggle.
- Nested collapsible sections for best fit, non-goals, precedence, field guide,
  examples, related graph actions, mistakes, and safety notes when present.
- Individual field/example/mistake items are collapsible.
- Help content should explain decision impact, not restate labels.

## Unsaved Changes Requirements

Closing with dirty settings opens the shared unsaved changes dialog.

Actions:

- Save and close.
- Discard changes.
- Keep editing.

If save fails, dialog remains open and the error is shown without losing edits.

## Error And Warning Requirements

Errors:

- command errors appear near the dialog header or relevant field;
- field errors stay close to the field;
- failed identity reset does not close the dialog.

Warnings:

- GeoIP/timezone/locale mismatch;
- fingerprint fonts directory reuse risk;
- run-from-selected prerequisites missing;
- paused batch controls;
- active run or retained session blocking identity reset.

Warnings must use amber treatment and never rely on color alone.

## CSS And Responsive Requirements

Follow `DESIGN.md`.

Dialog constraints:

- max height fits `1024x768`;
- internal scrolling;
- no horizontal overflow;
- labels do not overlap controls;
- long identity ids and seeds use monospace and wrap/truncate safely;
- button text remains readable.

## Tests And Checks

Required focused tests when implemented:

- Section nav switches content and maintains accessible selected state.
- `Save Settings` calls the save callback once.
- Unsaved close prompts and supports all three choices.
- Graph link wait controls preserve none/fixed/random shape.
- Run from selected prerequisites are explained and scope control is shown only
  when relevant.
- Browser Launch hides profile directory and shows identity id/seed.
- Reset identity opens confirmation and respects disabled/blocking states.
- Environment variable rows update settings.
- Help language toggle switches content.
- Compact CSS invariants are covered where possible.

Run checks:

- `npm test -- src/features/workflows/components/WorkflowSettingsDialog.test.tsx`
- `npm test -- src/features/workflows/lib/workflowSettings.test.ts`
- `npm test -- src/features/workflows/pages/WorkflowDetailPage.test.tsx`
- `npm test -- src/features/workflows/pages/WorkflowListPage.test.tsx`
- `npm test -- src/AppCss.test.ts`
- `npx tsc --noEmit`

## Acceptance Criteria

- Operators can identify which settings affect graph authoring, launch context,
  run policy, and environment setup.
- One dialog-level save flow protects all dirty sections.
- Browser identity controls are understandable and guarded.
- Run from selected prerequisites are explicit before the operator needs them.
- The dialog remains usable on compact desktop.
- No app-level policies or unsupported settings are introduced.

