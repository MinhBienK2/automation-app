# Mission Control UI/UX Upgrade Child Spec 06: Workflow Settings

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

It redesigns the per-workflow Workflow Settings dialog. App-level Settings,
diagnostics, graph autosave, and maintenance are out of scope for this spec.

## Brainstorming Scope

The user asked for a one-spec-at-a-time `$brainstorming` process and
pre-approved the recommended decisions. This spec records the questions,
alternatives, and approved recommendations for Workflow Settings so future
implementation agents do not guess product intent.

Workflow Settings is high-risk because it controls browser identity, profile
reuse, run policy, JavaScript execution permission, edge timing defaults, and
initial runtime variables. The UI must become clearer without weakening any
guardrails or mixing app-level settings into workflow-level settings.

## Brainstorming Decisions

### Decision 1: Dialog Or Page

Question: should Workflow Settings remain a dialog or become a full workspace
page?

Options considered:

- Full page.
  - Pros: more space for complex settings.
  - Cons: adds navigation context switch, duplicates app-level Settings mental
    model, makes list/detail entry points heavier.
- Drawer.
  - Pros: keeps some graph context.
  - Cons: too narrow for Browser Launch and Environment fields.
- Large bounded dialog.
  - Pros: current behavior, contextual, enough width for dense settings, easy to
    protect unsaved changes.
  - Cons: must be carefully responsive at `1024x768`.

Recommended and approved: keep a large bounded dialog.

### Decision 2: Save Model

Question: should each section have its own save button or should the dialog keep
one `Save Settings` action?

Options considered:

- Per-section save.
  - Pros: aligns with backend section commands.
  - Cons: users may believe only one section is dirty/saved; creates partial
    save confusion.
- Auto-save every field.
  - Pros: low friction.
  - Cons: unsafe for identity/proxy/run policy edits and makes undo/close guard
    unclear.
- One dialog-level save.
  - Pros: clear operator mental model; matches current invariant; preserves
    unsaved-close guard.
  - Cons: implementation still needs track dirty sections internally.

Recommended and approved: one dialog-level `Save Settings` action.

### Decision 3: Section Model

Question: should the redesign add or rename sections?

Options considered:

- Add many specific sections such as Identity, Proxy, Runtime, Variables.
  - Pros: shorter pages.
  - Cons: breaks existing invariant and makes settings harder to find.
- Keep five current sections.
  - Pros: stable product model and docs alignment.
  - Cons: each section needs strong grouping.
- Merge Graph into Run Policy.
  - Pros: fewer sections.
  - Cons: graph authoring defaults are not runtime policy.

Recommended and approved: keep exactly General, Graph, Run Policy, Browser
Launch, and Environment.

### Decision 4: Browser Identity Treatment

Question: should Browser Launch show raw storage/profile implementation details?

Options considered:

- Show all profile fields.
  - Pros: maximum technical transparency.
  - Cons: exposes internals and invites unsafe manual reasoning about paths.
- Hide identity details.
  - Pros: simple.
  - Cons: operators need auditability and reproducibility.
- Show bounded identity posture.
  - Pros: identity id, display name, seed, persona, profile reuse mode, proxy,
    timezone/locale, GeoIP, fonts, humanization, and headless state are visible
    without exposing raw storage internals.

Recommended and approved: show bounded identity posture. Do not show
`profile_dir` as a standalone field.

### Decision 5: Reset Identity UX

Question: should Reset Identity be a simple button, a separate flow, or a
guarded in-dialog action?

Options considered:

- Simple button.
  - Pros: fast.
  - Cons: too consequential; identity/profile/fingerprint changes must be named
    and confirmed.
- Separate page.
  - Pros: more room.
  - Cons: unnecessary context switch.
- Guarded in-dialog action.
  - Pros: current settings context, confirmation can name workflow and identity,
    backend guard remains source of truth.

Recommended and approved: guarded in-dialog action that saves pending settings
before calling backend reset.

### Decision 6: Run From Selected

Question: should Run from selected be configured in graph UI or Workflow
Settings?

Options considered:

- Graph-only toggle.
  - Pros: close to selected node.
  - Cons: this is a run policy plus session-retention capability.
- Workflow Settings only.
  - Pros: matches current invariant and makes prerequisites explicit.
  - Cons: graph UI must explain disabled reason later.
- Both places editable.
  - Pros: convenient.
  - Cons: creates divergence.

Recommended and approved: editable only in Workflow Settings Run Policy. Graph
Builder only shows/runs the action based on saved settings and run state.

### Decision 7: Help Content

Question: should section help be simplified or remain deep?

Options considered:

- Remove help.
  - Pros: cleaner UI.
  - Cons: settings are complex and safety-sensitive.
- Single paragraph per section.
  - Pros: compact.
  - Cons: insufficient for proxy, identity, GeoIP, Run JavaScript, and variables.
- Collapsible bilingual decision help.
  - Pros: already supported; keeps detail available without overwhelming.
  - Cons: requires careful layout.

Recommended and approved: keep bilingual collapsible help and make it easier to
scan.

### Decision 8: Component Split

Question: should implementation split the dialog into section components?

Options considered:

- Keep one `WorkflowSettingsDialog.tsx`.
  - Pros: fewer files.
  - Cons: file is already dense and likely to grow.
- Split every field.
  - Pros: tiny components.
  - Cons: noisy abstractions.
- Split by section and shared subpanels.
  - Pros: clear ownership and tests.
  - Cons: requires careful prop design.

Recommended and approved: split by section if implementation touches enough
code to justify it. Do not split mechanically.

## Goal

Turn Workflow Settings into a dense, safe, well-grouped per-workflow
configuration dialog for metadata, graph defaults, run policy, browser launch
identity, and environment variables.

The implementation must:

1. Preserve the five current sections.
2. Preserve one dialog-level `Save Settings` action.
3. Preserve unsaved-close protection.
4. Make each section scannable through grouped controls.
5. Make Browser Launch identity posture clear without exposing raw profile
   storage internals.
6. Make Reset Identity guarded and understandable.
7. Make Run Policy consequences clear before launch.
8. Make Environment initial variables easy to edit as typed rows.
9. Preserve bilingual help.
10. Keep app-level settings out of this dialog.

## Inputs And Sources Of Truth

### Required Reading Before Implementation

Follow repo workflow first:

1. `docs/README.md`
2. `docs/task-routes.md`
3. `DESIGN.md`
4. `docs/domain/user-visible-invariants.md`
5. `docs/domain/workflow-lifecycle.md`
6. `docs/domain/execution-semantics.md`
7. `docs/contracts/workflow-types.md`
8. `docs/contracts/electron-ipc.md`
9. `docs/architecture/frontend.md`
10. Graph Builder child spec.
11. This spec.

### Visual Baseline

Use:

- `.stitch/designs/2026-05-28-12-polished-12-workflow-settings-dialog.html`

Use it for:

- large dialog scale;
- left section navigation;
- dense grouped field treatment;
- stable header save action;
- compact help affordance;
- dark operations theme.

Do not copy unsupported settings or visual-only fields that are not in current
contracts.

### Current Source Areas

Primary files likely touched:

- `src/features/workflows/components/WorkflowSettingsDialog.tsx`
- `src/features/workflows/lib/workflowSettings.ts`
- `src/features/workflows/components/VariableConfigFields.tsx`
- `src/components/ui/settings-field-group.tsx`
- `src/components/ui/unsaved-changes-dialog.tsx`
- `src/components/ui/switch.tsx`
- `src/components/ui/segmented-control.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/select.tsx`
- `src/components/ui/dialog.tsx`
- `src/lib/workflowApi.ts`
- `src/types/workflow.ts`
- `src/styles/modals.css`
- `src/styles/workflows.css`
- `src/styles/responsive.css`

Backend files should be touched only if existing command behavior is missing for
a required UI state:

- `electron/backend/services/workflowSettingsService.ts`
- `electron/backend/commands.ts`
- `electron/backend/browser/sessionManager.ts`

Likely tests:

- `src/features/workflows/components/WorkflowSettingsDialog.test.tsx`
- `src/features/workflows/lib/workflowSettings.test.ts`
- `src/features/workflows/pages/WorkflowDetailPage.test.tsx`
- `src/features/workflows/pages/WorkflowListPage.test.tsx`
- `src/lib/workflowApi.test.ts`
- `electron/backend/services/workflowSettingsService.test.ts` if behavior changes
- `electron/backend/commands.test.ts` if command behavior changes

## Current Implementation Readout

### Dialog Shell

Current `WorkflowSettingsDialog.tsx` already has:

- `open`;
- `settings`;
- `activeSection`;
- `error`;
- `hasUnsavedChanges`;
- `onOpenChange`;
- `onActiveSectionChange`;
- `onSettingsChange`;
- `onSaveSettings`;
- `onResetBrowserIdentity`;
- `onDiscardChanges`;
- `UnsavedChangesDialog`.

It currently renders a large dialog with:

- header;
- settings icon;
- title;
- `Save Settings` button;
- left nav;
- section content;
- section help button.

Current problem:

- The structure is correct, but it needs stronger spec-level contracts for
  section grouping, warnings, reset flow, accessibility, and compact layout.

### Section Metadata

Current `workflowSettingsSections` includes:

- `general`;
- `graph_defaults`;
- `run_policy`;
- `browser_launch`;
- `environment`.

Current problem:

- Section ids are correct and must not change. The UI labels and section
  summaries can be polished, but section identity must remain stable for
  routing from Workflow List and Workflow Detail.

### Help Content

Current help already supports:

- English/Vietnamese language toggle;
- localized help object;
- best-for;
- not-for;
- precedence;
- field guide;
- workflow examples;
- related graph actions;
- common mistakes;
- safety notes;
- nested collapsible items through `HelpDisclosure`.

Current problem:

- The help is strong but can feel heavy. The redesign should make it scan
  better without removing depth.

### Tests

Current tests already assert:

- batch controls are paused and disabled;
- Browser Identity does not restore removed Owned Test Gates;
- profile directory is not shown;
- fingerprint seed is always visible;
- graph link wait defaults are grouped;
- sections are grouped by related controls;
- browser launch groups exist;
- environment group exists;
- help is bilingual and collapsible in current test coverage.

Current problem:

- Tests need to grow around unsaved close, reset confirmation, validation
  warnings, compact layout invariants, and dirty-save semantics if changed.

## Scope Boundaries

### In Scope

- Workflow Settings dialog shell.
- Section navigation.
- General section.
- Graph section.
- Run Policy section.
- Browser Launch section.
- Environment section.
- Section help.
- Unsaved close guard.
- Reset identity confirmation entry point.
- Error/warning presentation.
- Responsive dialog behavior.
- Component/helper split.
- Focused tests.

### Out Of Scope

- App Settings.
- Graph autosave setting.
- Environment readiness diagnostics.
- CloakBrowser install/cleanup maintenance.
- Theme switching.
- Notification settings.
- Retention/history policy systems beyond existing Run Policy fields.
- Creating identities outside workflows.
- Deleting browser profile data.
- Editing raw profile directory.
- Moving browser identity into graph action nodes.
- Batch Run execution UI.

## Non-Negotiable Invariants

Preserve these:

- Workflow Settings is per-workflow.
- Workflow Settings is distinct from app-level Settings.
- Workflow list Edit opens Workflow Settings at General.
- Workflow Detail Settings opens Workflow Settings at Browser Launch.
- Settings contains General, Graph, Run Policy, Browser Launch, Environment.
- Related controls are grouped inside each section.
- Settings are saved through one dialog-level `Save Settings` action.
- Closing with unsaved edits asks Save and close, Discard changes, or Keep
  editing.
- Dirty settings are saved before graph launch.
- If saving dirty settings fails before run, run does not start.
- Graph section owns default edge wait for newly created links only.
- Changing default edge wait does not rewrite existing links.
- Browser Launch owns browser identity, proxy, timezone, locale, GeoIP,
  fingerprint fonts, humanize, and headless controls.
- `profile_dir` remains internal and is not shown as a separate field.
- Identity id and fingerprint seed are visible and read-only.
- Reset identity delegates to backend command.
- Reset identity preserves non-storage preferences where backend contract says
  so.
- Reset identity disables Run from selected until a fresh retained session
  exists.
- Reuse login session off clears persistent profile use while keeping identity
  seed stable.
- Run from selected enablement/scope is in Run Policy.
- Batch controls remain visible but disabled until Batch Run UI is ready.
- Environment exposes initial variables as typed rows.
- Set Viewport remains an in-run action; Browser Launch does not expose viewport
  width/height/device scale/mobile/touch controls.

## Dialog Information Architecture

The dialog has four zones:

1. Header.
2. Section navigation.
3. Section content.
4. Unsaved/confirmation overlays.

Header answers:

- what settings object is open;
- whether there are errors/dirty state;
- how to save.

Section navigation answers:

- which purpose area is being edited.

Section content answers:

- what fields matter for that purpose;
- what warnings block or caution the operator.

Overlays answer:

- whether closing/resetting has consequences.

Do not put app-level diagnostics, graph shortcut guide, or maintenance actions
inside this dialog.

## Dialog Header Requirements

Header should show:

- eyebrow: `Workflow`;
- title: `Workflow Settings`;
- optional workflow name/context if available from settings;
- dirty state indicator when `hasUnsavedChanges`;
- command error summary when `error`;
- primary `Save Settings` button.

`Save Settings`:

- is always in the header when settings are loaded;
- can show pending state if parent exposes it;
- calls `onSaveSettings`;
- does not close the dialog by default unless invoked through Save and close in
  unsaved dialog.

If save fails:

- keep dialog open;
- keep edited values;
- show error;
- do not clear dirty state unless parent state says saved.

## Section Navigation Requirements

Use a stable section nav with role/tab semantics:

- General;
- Graph;
- Run Policy;
- Browser Launch;
- Environment.

Requirements:

- active tab uses `aria-selected`;
- active state not color-only;
- keyboard focus visible;
- changing tab does not save automatically;
- changing tab does not discard unsaved fields;
- route entry points can set active section:
  - list Edit -> General;
  - detail Settings -> Browser Launch.

Compact desktop:

- left nav can become horizontal tabs or compact rail;
- all five sections must remain reachable;
- active section title remains visible.

## General Section Requirements

### Purpose

General identifies the workflow for humans and package metadata. It does not
change graph execution, browser launch, run policy, or environment variables.

### Fields

Fields:

- Workflow name.
- Description.
- Tags.
- Notes.
- Created/updated timestamps as read-only metadata if currently available.

### Field Rules

Workflow name:

- required;
- blank names are rejected;
- changes update workflow summary metadata when saved;
- field should be first in the section.

Description:

- short multi-line text;
- optional;
- should not be used for secrets.

Tags:

- comma-separated input if current UI uses it;
- normalized to lowercase and deduplicated through existing helpers;
- optional.

Notes:

- larger textarea;
- optional;
- for human handoff context;
- not a secret store.

### Grouping

Group fields under `Workflow details`.

Recommended order:

1. Workflow name.
2. Description.
3. Tags.
4. Notes.
5. Created/updated metadata.

### Warnings

Show warning only if needed:

- blank name;
- unusually long names if they break layout;
- notes/tags should not store secrets if a general helper copy is included.

Do not create a policy engine for secrets in this spec.

## Graph Section Requirements

### Purpose

Graph settings own authoring defaults for graph behavior. The current required
setting is default link wait copied to newly created graph links.

### Fields

Field group: `New link wait`.

Controls:

- Mode: none, fixed, random.
- Fixed duration ms when mode fixed.
- Random minimum wait ms when mode random.
- Random maximum wait ms when mode random.

### Field Rules

None:

- `default_edge_delay` is null.

Fixed:

- duration must be a number;
- duration must be zero or positive;
- recommended default when selected can stay existing current UI default.

Random:

- min must be a number;
- max must be a number;
- min and max must be zero or positive;
- max must be greater than or equal to min.

### Required Copy

Graph section must explain:

- this wait is copied only to newly created links;
- existing links keep their own wait;
- link waits are duration-only transition delays before the target node;
- page-state waits should use Wait or Random Wait actions.

### Do Not Add

Do not add:

- graph layout settings;
- graph autosave setting;
- validation strictness setting;
- run ordering setting;
- browser identity setting.

Graph autosave is app-level Settings.

## Run Policy Section Requirements

### Purpose

Run Policy controls workflow execution policy before and during runner
execution. It should make consequences visible without turning into a launcher.

### Field Groups

Recommended groups:

1. Run lifecycle.
2. Run from selected.
3. Batch defaults.

### Run Lifecycle Fields

Fields:

- Max workflow duration ms.
- Browser retention.
- Allow Run JavaScript.

Max workflow duration:

- optional numeric input;
- null means no configured max duration;
- positive value cancels/fails overlong runs through backend semantics;
- UI should not imply it is a per-step timeout.

Browser retention:

- values follow current contract, such as `retain` and `close`;
- retention is default terminal behavior unless terminal nodes explicitly close.

Allow Run JavaScript:

- enabled by default for authorized workflows;
- when off, `execute_js` action fails before script evaluation;
- label should avoid vague wording such as "unsafe mode";
- helper copy should explain direct DOM scripting is still an authorized testing
  capability but can be disabled per workflow.

### Run From Selected Group

Fields:

- Enable Run from selected.
- Scope.

Scope values:

- `selected_only`: run only the selected node.
- `from_selected`: run selected node through downstream main path.

Required explanation:

- the action appears in Graph Builder only when enabled here;
- it requires Reuse login session;
- it requires browser retention `retain`;
- it requires a matching retained browser session;
- it runs from exactly one supported selected main-path node;
- stale retained browser sessions do not silently relaunch.

UI behavior:

- scope select appears when enabled;
- disabling Reuse login session in Browser Launch should disable
  `run_from_selected_enabled` in UI state, matching current behavior;
- if browser retention is not `retain`, show warning/helper that graph action
  will remain unavailable.

### Batch Defaults Group

Fields:

- Batch concurrency limit.
- Batch headless.
- Stop batch on first failed row.

Current required UI:

- visible;
- disabled;
- includes pause note: Batch controls are paused until Batch Run UI is ready.

Do not remove these fields because backend contract still contains batch
defaults. Do not build Batch Run UI in this spec.

## Browser Launch Section Requirements

### Purpose

Browser Launch controls the browser identity and launch context resolved before
run starts. It must be audit-friendly without exposing internal storage details.

### Field Groups

Recommended groups:

1. Session & identity.
2. Proxy.
3. Location.
4. Fingerprint.
5. Humanization.
6. Launch.

### Session & Identity Fields

Fields:

- Reuse login session.
- Identity id.
- Identity display name.
- Fingerprint seed.
- Persona metadata summary.
- Reset identity action.

Reuse login session:

- when on, runs use persistent browser profile tied to identity;
- when off, runs use temporary browser storage while keeping the same identity
  seed;
- turning off disables Run from selected.

Identity id:

- read-only;
- visible;
- monospace;
- long values wrap or truncate safely;
- backend-generated ids use high entropy for newly generated identities.

Identity display name:

- editable;
- renaming does not change profile storage, persona, or fingerprint seed.

Fingerprint seed:

- read-only;
- visible;
- no hidden reveal/copy flow required;
- changing identity through reset creates a new seed through backend command.

Persona metadata:

- show label/id/rationale when available;
- show OS/browser bucket and font bundle metadata if current typed data provides
  it safely;
- do not add a persona editor in this spec.

Reset identity:

- button in Session & identity group;
- requires confirmation;
- delegates to parent `onResetBrowserIdentity`;
- parent saves pending settings first before reset command;
- backend rejects while active workflow/profile/retained session blocks reset;
- UI shows blocking reason when available;
- UI explains reset does not delete historical runs or evidence.

### Proxy Fields

Fields:

- Proxy enabled.
- Proxy server.
- Proxy username.
- Proxy password.
- Proxy bypass.

Rules:

- Proxy password field may be password input if current UI supports it;
- do not show proxy label/provider/region/test account binding unless contract
  supports it;
- do not display credentials embedded in proxy URL outside the editable field;
- package export sanitizes proxy password and proxy URL credentials.

Warnings:

- if proxy enabled and GeoIP off but timezone/locale blank, warn that explicit
  timezone/locale are required.

### Location Fields

Fields:

- GeoIP location.
- Timezone.
- Locale.
- Detected local machine timezone/locale.

Rules:

- New workflows enable GeoIP by default.
- Blank legacy timezone/locale normalize back to GeoIP.
- Running with GeoIP off requires explicit timezone and locale.
- Detected local machine timezone/locale are read-only context.

Warnings:

- GeoIP off plus blank timezone/locale;
- proxy-enabled identity without explicit timezone/locale and GeoIP off.

### Fingerprint Fields

Fields:

- Fingerprint fonts directory.
- Fingerprint seed display lives in Session & identity.
- Persona font bundle metadata if safe.

Rules:

- fingerprint fonts directory is operator-entered and may be visible as an
  editable field;
- diagnostics details live in app Settings/diagnostics or backend diagnostics,
  not this dialog;
- warn when configured fonts directory can create stable font hash across
  identities if current validation exposes that warning.

Do not add:

- fingerprint platform;
- hardware concurrency;
- device memory;
- storage quota;
- viewport width;
- viewport height;
- device scale factor;
- mobile viewport;
- touch input.

Set Viewport is an in-run graph action.

### Humanization Fields

Fields:

- Humanize browser input.
- Humanize preset.

Rules:

- humanize is enabled by default;
- preset supports current values such as `default` and `careful`;
- do not add unsupported behavior fidelity controls.

### Launch Fields

Fields:

- Headless browser.

Rules:

- headless controls launch mode only;
- headed Linux display readiness belongs to diagnostics/app settings or command
  error handling, not a broad preflight system in this dialog.

## Environment Section Requirements

### Purpose

Environment owns initial runtime variables applied before the first graph step.
It is not app settings and not a secrets vault.

### Fields

Field group: `Initial variables`.

Use existing typed row editor:

- name;
- value type;
- value;
- add row;
- remove row;
- reorder if currently supported.

Value types:

- text;
- number;
- boolean;
- json.

### Rules

Variable names:

- should not be blank;
- should support dot paths where current helpers support them;
- should be visually scannable.

Values:

- number parses to number when possible;
- boolean maps from true/false;
- json validates parse where current helper supports it;
- arrays remain arrays where current helper supports them;
- objects flatten into dotted variable names through current helper behavior.

Copy:

- explain variables become graph template/runtime context;
- do not imply secure secret storage;
- do not show raw command outputs.

## Help Requirements

Workflow Settings help should remain deep but collapsible.

### Help Entry

Each section header has a Help button.

Help button:

- visible but secondary;
- accessible name references current section;
- opens dialog with current section help;
- does not change settings values.

### Help Dialog

Help dialog includes:

- title;
- summary;
- EN/VI segmented language toggle;
- best-for;
- not-for;
- precedence;
- field guide;
- workflow examples;
- related graph actions;
- common mistakes;
- safety notes.

Sections render only when content exists.

### Collapsible Behavior

Use nested collapsible sections:

- parent sections can open/close;
- field/example/mistake items can open/close individually;
- field guide may default open because it is the most useful section;
- long examples should not force the dialog past viewport.

### Content Rules

Help should answer:

- what the field controls;
- when to use it;
- what it does not control;
- how it interacts with graph actions;
- what mistakes are common.

Help should not:

- include secrets;
- include raw profile paths;
- become marketing copy;
- introduce unsupported settings.

## Unsaved Changes Requirements

Closing the dialog when `hasUnsavedChanges` is true opens
`UnsavedChangesDialog`.

Actions:

- Save and close.
- Discard changes.
- Keep editing.

Save and close:

- calls `onSaveSettings`;
- if save returns false or throws/sets error, keep settings dialog open;
- close only after successful save.

Discard changes:

- calls `onDiscardChanges`;
- closes unsaved dialog;
- settings dialog closes through parent open state or current callback pattern.

Keep editing:

- closes unsaved dialog;
- keeps settings dialog open.

Edge cases:

- switching sections does not trigger unsaved dialog;
- pressing Escape/backdrop close should trigger unsaved guard;
- save error does not discard local edits.

## Reset Identity Requirements

Reset identity is a high-impact action.

### Confirmation Content

Confirmation should name:

- workflow name or settings general name;
- current identity id;
- what will change:
  - identity id;
  - profile directory;
  - fingerprint seed;
- what is preserved:
  - non-storage preferences such as proxy, locale, fingerprint fonts directory
    where backend contract preserves them;
  - historical runs;
  - evidence;
  - workflow graph.

It should explain:

- pending settings are saved before reset;
- Run from selected is disabled until a fresh retained session exists;
- active run/profile/retained session can block reset.

### Disabled And Error States

If parent/backend reports reset unavailable:

- disable action or show blocking reason;
- explain active run/profile/retained session blockers;
- do not hide Reset entirely unless the command is unavailable.

If reset fails:

- dialog remains open;
- error displayed near Browser Launch/reset group;
- edited settings are not lost.

### Security Boundaries

Do not expose:

- raw profile path;
- cookies;
- browser storage;
- proxy password;
- raw diagnostics.

## Error And Warning Presentation

### Error Types

Section field errors:

- blank name;
- invalid duration;
- invalid min/max wait;
- invalid JSON variable;
- command-facing field error if backend returns `field`.

Dialog command errors:

- save failure;
- validation failure;
- reset identity failure;
- settings load failure if parent passes it.

Warnings:

- GeoIP off missing timezone/locale;
- proxy enabled with location mismatch risk;
- fingerprint fonts directory reuse risk;
- Run from selected prerequisites missing;
- paused batch controls;
- reset blocked by active run/session.

### Treatment

Errors:

- red;
- near field where possible;
- otherwise near section header or dialog header.

Warnings:

- amber;
- non-blocking unless backend validation says blocking;
- include short action/fix.

State must not rely on color alone.

## Dialog Layout And CSS Requirements

Follow `DESIGN.md`.

### Desktop Layout

Default:

- max width suitable for complex settings;
- max height inside viewport;
- header remains visible;
- left section nav;
- right scrollable content;
- section content has grouped fieldsets;
- help dialogs scroll internally.

Suggested structure:

```text
Dialog
  Header: title + Save Settings
  Body
    Section nav
    Section content
      Section header + Help
      Error/warning region
      Field groups
```

### Compact Desktop

At `1024x768`:

- dialog width fits viewport;
- max height fits viewport;
- body scrolls internally;
- section nav can become horizontal tabs or compact top nav;
- fields stack;
- identity id and seed wrap/truncate safely;
- help dialog fits viewport;
- action buttons wrap without overlap;
- no horizontal overflow.

### Field Density

Use:

- 4px/8px spacing rhythm;
- compact labels;
- grouped sections;
- subdued helper copy;
- no nested decorative cards;
- no hero typography;
- no gradient/orb backgrounds.

## Component Architecture

### Current Acceptable Baseline

It is acceptable to keep implementation in `WorkflowSettingsDialog.tsx` if the
change is small.

### Recommended Split For Larger Work

If implementation grows, split by responsibility:

```text
src/features/workflows/components/settings/
  WorkflowSettingsDialogShell.tsx
  WorkflowSettingsSectionNav.tsx
  GeneralSettingsSection.tsx
  GraphDefaultsSettingsSection.tsx
  RunPolicySettingsSection.tsx
  BrowserLaunchSettingsSection.tsx
  EnvironmentSettingsSection.tsx
  WorkflowSettingsHelpDialog.tsx
  ResetIdentityConfirmDialog.tsx
  settingsWarnings.ts
```

Keep public `WorkflowSettingsDialog` export as the component used by existing
pages. The shell can compose internal components.

### Prop Ownership

Dialog shell owns:

- open/close guard;
- active section;
- save action;
- error summary;
- unsaved changes dialog;
- reset confirm open state if implemented locally.

Section components own:

- field rendering;
- local field grouping;
- section-specific warnings;
- calling `onChange` with updated section value.

Helpers own:

- warning derivation;
- wait validation messages;
- run-from-selected prerequisite text;
- identity display labels.

## Data Flow

### Editing

1. Parent loads `WorkflowSettings`.
2. Dialog receives full aggregate.
3. Section component edits one nested section.
4. Dialog creates next aggregate.
5. Dialog calls `onSettingsChange(nextSettings)`.
6. Parent tracks dirty state.

Do not mutate `settings` in place.

### Saving

1. User clicks Save Settings.
2. Dialog calls `onSaveSettings`.
3. Parent persists dirty sections through existing command path.
4. Save success updates dirty state.
5. Save failure returns false/sets error and dialog remains open.

### Closing

1. User requests close.
2. If dirty, dialog opens unsaved changes prompt.
3. Save/discard/keep editing follows unsaved flow.
4. If not dirty, close immediately.

### Reset Identity

1. User clicks Reset identity.
2. Confirmation opens.
3. User confirms.
4. Parent saves pending settings first.
5. Parent calls `resetWorkflowBrowserIdentity`.
6. Backend returns updated persisted settings.
7. Parent updates dialog settings.
8. Run from selected is disabled in returned settings.

Renderer must not generate identity ids or fingerprint seeds.

## State Matrix

### Dialog States

| State | UI Response |
| --- | --- |
| settings null | render no content or loading placeholder from parent |
| loaded clean | Save Settings visible, no dirty warning |
| loaded dirty | dirty indicator, close guard active |
| saving | Save button pending/disabled if parent exposes state |
| save failed | error visible, edits preserved |
| unsaved close requested | unsaved changes dialog |
| reset confirm open | reset confirmation dialog |
| reset pending | confirmation action pending/disabled |
| reset failed | error near reset group/dialog |

### Section States

| Section | Empty/Default State | Error/Warning State |
| --- | --- | --- |
| General | name, blank optional fields | blank name |
| Graph | no default edge wait | invalid duration/min/max |
| Run Policy | retain, JS allowed, run-from-selected off | missing prerequisites, paused batch note |
| Browser Launch | persistent profile, GeoIP on, humanize on | GeoIP off missing timezone/locale, reset blocked |
| Environment | no initial variables | blank/invalid variable rows |

## Security And Sensitive Data Boundaries

Do not render:

- cookies;
- tokens;
- proxy passwords outside password field;
- proxy credentials as metadata;
- raw browser storage;
- raw profile contents;
- raw profile path;
- arbitrary diagnostics;
- local fingerprint font contents.

Allowed:

- identity id;
- fingerprint seed;
- identity display name;
- operator-entered proxy server/username/password fields;
- operator-entered fingerprint fonts directory field;
- timezone/locale;
- persona label/rationale;
- bounded validation/command messages.

Package export sanitization remains backend/package flow responsibility.

## Accessibility Requirements

Required:

- dialog has accessible title `Workflow Settings`;
- section nav uses tab semantics or equivalent accessible navigation;
- active section is conveyed through `aria-selected` or equivalent;
- all fields have labels;
- grouped fields use `fieldset`/role group where practical;
- switches have accessible names;
- segmented controls have accessible names;
- help button has accessible name;
- help language toggle is keyboard usable;
- unsaved changes dialog has clear buttons;
- reset confirmation is keyboard accessible;
- error messages use alert/status treatment where appropriate;
- focus remains inside dialogs through shared dialog primitive.

Keyboard:

- Tab moves through nav, fields, help, and save predictably;
- Escape/backdrop close triggers unsaved guard when dirty;
- section switch does not lose focus unexpectedly;
- disabled controls communicate reason through text, not only disabled styling.

## Implementation Sequence

Recommended order:

1. Add/adjust tests for required behavior.
2. Refine section warning helper functions if needed.
3. Improve dialog shell header/dirty/error treatment.
4. Improve section nav responsiveness.
5. Refine General grouping.
6. Refine Graph link wait validation/copy.
7. Refine Run Policy grouping and Run from selected prerequisites.
8. Refine Browser Launch identity/proxy/location/fingerprint/humanization/launch
   groups.
9. Add or refine Reset Identity confirmation.
10. Refine Environment row presentation.
11. Refine help dialog scanning.
12. Harden compact CSS.
13. Run focused checks.

Do not start by changing Electron backend commands unless UI tests reveal a
missing command-facing state that cannot be represented otherwise.

## Test Plan

### Helper Tests

Add/update helper tests for:

- tags parsing/deduplication;
- variable rows from JSON;
- variables JSON from rows;
- link wait default shape;
- browser identity default generation;
- warning derivation if helpers are added;
- run-from-selected prerequisite copy if helpers are added.

Likely file:

- `src/features/workflows/lib/workflowSettings.test.ts`

### Component Tests

Add/update tests for:

- dialog renders five sections in correct order;
- Workflow List Edit can open General through parent tests;
- Workflow Detail Settings can open Browser Launch through parent tests;
- section nav changes active section;
- Save Settings calls save callback;
- dirty close opens unsaved dialog;
- Save and close keeps dialog open when save returns false;
- Discard changes calls discard callback;
- Keep editing keeps dialog open;
- General blank name/field state;
- Graph none/fixed/random link wait editing;
- invalid random min/max warning if implemented in UI;
- Run Policy max duration and browser retention editing;
- Allow Run JavaScript switch editing;
- Run from selected enable/scope editing;
- batch controls visible, disabled, and explained;
- Browser Launch identity id and seed read-only and visible;
- profile directory not rendered;
- Reuse login session disables run-from-selected in UI state;
- proxy/location/fingerprint/humanization/launch groups render;
- GeoIP off missing timezone/locale warning;
- Reset identity opens confirmation and calls callback on confirm;
- Reset failure leaves dialog open;
- Environment variables edit typed rows;
- Help language toggle switches EN/VI;
- help sections are collapsible;
- sensitive fields are not rendered as metadata.

Likely files:

- `src/features/workflows/components/WorkflowSettingsDialog.test.tsx`
- `src/features/workflows/pages/WorkflowDetailPage.test.tsx`
- `src/features/workflows/pages/WorkflowListPage.test.tsx`

### CSS Tests

Add/update `src/AppCss.test.ts` if CSS invariants change:

- workflow settings dialog max width/height;
- internal scroll;
- compact nav behavior;
- no fixed min-width causing overflow;
- help dialog max height.

### Run Checks

Run:

- `npm test -- src/features/workflows/components/WorkflowSettingsDialog.test.tsx`
- `npm test -- src/features/workflows/lib/workflowSettings.test.ts`
- `npm test -- src/features/workflows/pages/WorkflowDetailPage.test.tsx`
- `npm test -- src/features/workflows/pages/WorkflowListPage.test.tsx`
- `npm test -- src/AppCss.test.ts`
- `npx tsc --noEmit`

If IPC or backend behavior changes:

- `npm test -- src/lib/workflowApi.test.ts`
- `npm test -- electron/backend/services/workflowSettingsService.test.ts`
- `npm test -- electron/backend/commands.test.ts`
- `npm run build:electron`

## Manual QA Checklist

Verify:

- open Workflow Settings from Workflow List Edit and land on General;
- open Workflow Settings from Workflow Detail Settings and land on Browser
  Launch;
- edit each section without saving;
- switch sections and confirm edits remain;
- close dirty dialog and choose Keep editing;
- close dirty dialog and choose Discard;
- close dirty dialog and choose Save and close;
- save failure preserves edits;
- Graph link wait none/fixed/random works;
- Run from selected enable/scope works;
- Reuse login session off disables Run from selected;
- Browser Launch does not show profile directory;
- Reset Identity confirmation names scope and preserves guard copy;
- Environment variables add/remove/edit;
- help opens in EN and VI;
- dialog fits `1024x768`;
- no horizontal overflow.

## Documentation Requirements

Update docs if implementation changes current truth:

- `docs/domain/user-visible-invariants.md` for user-visible settings behavior.
- `docs/domain/workflow-lifecycle.md` for save/run/reset behavior.
- `docs/architecture/frontend.md` for ownership/component split.
- `docs/contracts/workflow-types.md` for settings shape changes.
- `docs/contracts/electron-ipc.md` for command changes.
- `docs/task-routes.md` if checks/routes change.
- `README.md` smoke checklist if workflow settings smoke changes.

If implementation only changes presentation and preserves documented behavior,
state that docs did not need updates beyond this spec.

## Acceptance Criteria

Workflow Settings is complete when:

- It remains a per-workflow large dialog.
- It contains exactly General, Graph, Run Policy, Browser Launch, Environment.
- Section navigation is accessible and stable.
- One `Save Settings` action owns saving.
- Unsaved close is guarded.
- General metadata is clear and does not imply runtime behavior.
- Graph default link wait is clear and does not rewrite existing links.
- Run Policy clearly exposes max duration, retention, JavaScript permission,
  Run from selected, and paused batch defaults.
- Browser Launch clearly exposes identity, session reuse, proxy, location,
  fingerprint, humanization, and headless launch controls.
- Browser Launch does not expose `profile_dir` as a field.
- Reset Identity is guarded, scoped, and backend-owned.
- Environment variables are typed rows and not presented as secret storage.
- Help is bilingual, collapsible, and useful.
- Compact desktop remains usable.
- Sensitive data boundaries remain intact.
- Focused tests cover changed behavior.

## Agent Handoff Notes

For the coding agent implementing this spec:

- Use TDD because this is user-visible UI behavior.
- Read `DESIGN.md` before CSS changes.
- Do not add app-level settings here.
- Do not expose profile directory.
- Do not generate identity ids or fingerprint seeds in renderer.
- Keep one Save Settings action.
- Prefer section component splits only where they reduce complexity.
- Preserve docs and tests with any behavior or contract change.

