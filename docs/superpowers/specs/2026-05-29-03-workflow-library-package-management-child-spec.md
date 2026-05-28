# Mission Control UI/UX Upgrade Child Spec 03: Workflow Library And Package Management

Date: 2026-05-29

## Status

Approved design direction, drafted for user review.

This child spec follows:

- `docs/superpowers/specs/2026-05-28-mission-control-full-product-ui-ux-upgrade-master-spec.md`
- `docs/superpowers/specs/2026-05-28-01-foundation-ui-system-child-spec.md`
- `docs/superpowers/specs/2026-05-29-02-shell-navigation-search-alerts-child-spec.md`

It redesigns the Workflow Library workspace and package/lifecycle flows. It
does not redesign graph authoring, workflow settings internals, or recording
review.

## Goal

Turn Workflow Library into a dense, scan-friendly operations workspace for
finding, opening, running, duplicating, importing, exporting, and deleting saved
workflows.

The implementation must:

1. Replace the current card-list-heavy workspace with a table/list plus detail
   preview model.
2. Add operational search, filters, and sort without broad backend changes.
3. Reduce row action clutter while preserving direct Run and Stop.
4. Make lifecycle actions consequence-aware.
5. Make package import/export guided, safe, and understandable.
6. Keep Record Workflow as a clear entry point while leaving recording review to
   its own child spec.
7. Preserve every existing workflow behavior invariant.

## Inputs And Sources Of Truth

### Required Reading Before Implementation

Follow repo workflow first:

1. `docs/README.md`
2. `docs/task-routes.md`
3. `DESIGN.md`
4. `docs/architecture/frontend.md`
5. `docs/domain/user-visible-invariants.md`
6. Foundation child spec.
7. Shell Navigation Search Alerts child spec.
8. This spec.

### Visual Baseline

Use the polished Stitch workflow library screen as visual reference:

- `.stitch/designs/2026-05-28-12-polished-01-workflow-library.html`

Use it for density, command hierarchy, list/detail treatment, and action
hierarchy. Do not copy unsupported fields or behavior.

### Current Source Areas

Likely touched:

- `src/features/workflows/pages/WorkflowListPage.tsx`
- `src/features/workflows/pages/WorkflowListPage.test.tsx`
- `src/features/workflows/components/WorkflowPackageOptions.tsx`
- `src/App.tsx`
- `src/styles/workflows.css`
- `src/styles/responsive.css`

Likely added:

- `src/features/workflows/lib/workflowLibrary.ts`
- `src/features/workflows/lib/workflowLibrary.test.ts`
- `src/features/workflows/components/WorkflowLibraryTable.tsx`
- `src/features/workflows/components/WorkflowLibraryDetailPanel.tsx`
- `src/features/workflows/components/WorkflowLibraryFilters.tsx`
- `src/features/workflows/components/WorkflowPackageDialog.tsx`

Use Foundation patterns when available:

- `CommandRegion`
- `DataToolbar`
- `TableShell`
- `DetailPanel`
- `StatePanel`
- `StatusCluster`
- `ConfirmActionDialog`
- `KeyValueList`

Do not create a parallel design system inside workflow feature code.

## Scope Boundaries

### In Scope

- Workflow Library layout.
- Workflow search/filter/sort.
- Workflow selected preview panel.
- Row action reduction and More menu.
- Create workflow dialog UX.
- Rename workflow dialog UX.
- Duplicate consequence UX.
- Delete confirmation UX.
- Package import/export UX.
- Record Workflow entry point placement and basic state.
- Tests and focused helper extraction.

### Out Of Scope

- Graph Builder redesign.
- Workflow Settings internals.
- Recording Review modal redesign.
- Run Center redesign.
- Evidence, Identity, or Schedules redesign.
- Backend workflow package schema changes.
- Backend duplicate/delete semantics changes.
- New full run history/evidence/identity aggregation for workflow rows.

## Behavior Invariants To Preserve

- Workflow list and workflow detail remain separate screens.
- Create workflow opens the workflow detail/graph after success.
- Workflow list Edit opens Workflow Settings at General.
- Workflow list Run executes the saved graph and saved Workflow Settings without
  opening the detail page.
- List-started runs keep polling run snapshots until terminal state.
- Active workflow row disables Run, Duplicate, Export, and Delete only for that
  workflow row.
- Active workflow row shows row-level status and Stop scoped to that workflow
  run id.
- Duplicate creates `Copy of <workflow name>`.
- Duplicate preserves saved graph and non-storage local settings, creates a
  fresh browser identity/profile/fingerprint, and disables Run from selected.
- Delete uses in-app confirmation, not browser-native confirm.
- Delete keeps private browser profile data by default.
- Delete can optionally delete private browser profile data.
- Backend deletion rejects active run/profile/retained-session conflicts.
- Import package rejects files larger than 5 MB before reading JSON.
- Import preview always creates a new workflow on success and never overwrites.
- Export package can include Flow and selected Workflow Settings sections.
- Export package sanitizes machine-local or sensitive settings by default.
- Record Workflow starts a backend-owned new-workflow recording session.

## Architecture And Data Boundaries

### Component Split

Recommended split:

```text
src/features/workflows/pages/
  WorkflowListPage.tsx

src/features/workflows/components/
  WorkflowLibraryTable.tsx
  WorkflowLibraryDetailPanel.tsx
  WorkflowLibraryFilters.tsx
  WorkflowPackageDialog.tsx

src/features/workflows/lib/
  workflowLibrary.ts
  workflowLibrary.test.ts
```

`WorkflowListPage.tsx` should become an orchestration/composition page, not a
large file containing table filtering, row action rules, package UI, and dialog
copy inline.

### Data Inputs

Workflow Library may use:

- `WorkflowSummary[]`
- `WorkflowRunSnapshot[]`
- current `RunState`
- active workflow name, if still needed
- current schedules already loaded in `App.tsx`, if passed explicitly
- existing package preview/export/import command results
- existing callbacks for create, rename, duplicate, delete, run, stop, settings,
  open, import, export, record

Workflow Library must not fetch broad details for every workflow merely to fill
preview fields.

### Detail Data Rule

Selected workflow detail may load or use extra data only if bounded and
intentional.

Allowed:

- Use already-loaded summaries and run snapshots.
- Use existing selected workflow settings only when the selected workflow already
  opened settings or a bounded selected-only settings lookup is explicitly
  implemented and tested.

Not allowed:

- Fetch settings for every row.
- Fetch full graph for every row.
- Fetch run/evidence/identity aggregates for every row.
- Add backend aggregation without a narrow documented need.

### Missing Data Rule

If a filter or preview field lacks safe data:

- derive from existing data if reliable;
- otherwise render disabled filter with tooltip/reason;
- or omit preview field;
- do not fake data.

## Layout And Command Region

### Page Header

Use Foundation `CommandRegion` or equivalent.

Required header content:

- Title: `Workflows`.
- Context:
  - total workflow count;
  - active run count when available.
- Primary action:
  - `Create Workflow`.
- Secondary actions:
  - `Record Workflow`.
  - `Import Workflow`.
- Optional utility:
  - refresh workflows, only if wired to existing `loadWorkflows`.

### Workspace Layout

Use dense master-detail:

- Main region: workflow table/list.
- Detail region: selected workflow preview.

Large desktop:

- Table/list and detail panel can sit side by side.

Compact desktop `1024x768`:

- Detail panel may move below the table.
- Detail panel may become selected-row expandable region.
- No page-level horizontal overflow.

### Empty And Error States

Use Foundation `StatePanel`.

Required states:

- No workflows:
  - Create Workflow.
  - Record Workflow.
  - Import Workflow.
- No search/filter results:
  - Clear search/filter action.
- Load or command error:
  - short summary;
  - details only if safe and bounded.

## Search, Filters, Sort

### Search

Search by:

- workflow name.

May also search:

- description/tags only if these are already available without broad detail
  fetches.

### Filters

Required filter chips:

- `All`
- `Active run`
- `Runnable/saved`
- `Draft/needs configuration`
- `Scheduled`
- `Uses retained identity/session`

### Filter Implementation Rules

- `Active run`: derive from `WorkflowRunSnapshot[]`.
- `Runnable/saved`: derive only if current data reliably supports it. If not,
  render disabled with reason.
- `Draft/needs configuration`: derive only if current data reliably supports it.
  If not, render disabled with reason.
- `Scheduled`: use existing schedules if explicitly passed from `App.tsx`. If
  not available, disabled with reason.
- `Uses retained identity/session`: use existing selected workflow settings or
  safe summary data if available. Do not fetch every workflow's settings just
  for this filter.

### Sort

Required sort options:

- `Recent`
- `Name`
- `Run state`

Rules:

- Recent may use `updated_at` internally but raw timestamps must not be displayed
  as primary row text.
- Name sorts case-insensitively.
- Run state should prioritize active/running rows before inactive rows.

### Helper Library

Create `workflowLibrary.ts` for:

- active run map construction;
- workflow search predicate;
- filter predicates;
- sort comparators;
- action availability rules;
- selected workflow fallback.

Keep helper functions pure and tested.

## Table/List

### Columns

Required columns/regions:

- Workflow name.
- Status/runnable/active run badge.
- Active run current step if active.
- Schedule hint if safely available.
- Identity/session hint if safely available.
- Row actions.

### Row Selection

- First workflow selected by default when list has workflows.
- Preserve current selected workflow when data refreshes and workflow still
  exists.
- If selected workflow no longer exists, select first visible workflow or show
  empty detail state.
- Clicking a row selects it.
- Double click or explicit action opens graph/detail if implemented and tested.

### Row Actions

Each row exposes only:

1. `Open Graph`.
2. `Run <workflow name>` or `Stop <workflow name>`.
3. `More actions for <workflow name>`.

More menu contains:

- Settings.
- Duplicate.
- Export.
- Delete.

Rules:

- Direct list Run remains possible.
- Active row Stop remains possible.
- Stop uses exact `activeRun.run_id`.
- Duplicate, Export, Delete disabled for active workflow.
- Disabled actions explain why.
- Icon-only actions have accessible labels and tooltips.
- More menu is keyboard accessible and closes on Escape/click outside.
- Row click must not accidentally trigger More menu item.

## Detail Preview Panel

### Selection Behavior

- Show selected workflow.
- If no workflows, show empty state.
- If selected workflow becomes stale, show `StatePanel`.

### Content

Header:

- workflow name;
- status badge:
  - active;
  - runnable;
  - draft;
  - blocked, only if data supports it.

Summary:

- description/tags only if available;
- step count only if useful and not primary clutter;
- safe created/updated presentation only if formatted and not raw timestamp.

Active run:

- run status;
- current step number/id if available;
- Stop action scoped to run id;
- Open Runs action if shell navigation helper is available.

Identity/session:

- safe identity/session hint only if available;
- no profile path;
- no raw fingerprint;
- no proxy credentials.

Schedule/evidence:

- show summary only if existing data available;
- otherwise leave for Schedules/Evidence child specs.

### Actions

Primary:

- `Open Graph`.
- `Launch Run` or `Stop`.

Secondary:

- `Settings`.
- `Duplicate`.
- `Export`.
- `Delete`.

Rules:

- Detail action availability matches row action availability.
- Delete is destructive and opens confirmation.
- Disabled actions show reasons.
- Compact layout wraps actions without clipping.

## Guided Package Export

### Trigger

Export can be opened from:

- row More menu;
- detail panel.

Active workflow export is disabled.

### Dialog Content

Use shared dialog anatomy.

Required content:

- Workflow name.
- Explanation that export creates a workflow package.
- Flow checkbox.
- Settings section picker:
  - General.
  - Run Policy.
  - Browser Launch.
  - Graph.
  - Environment.
- Sanitization note:
  - proxy credentials omitted;
  - local fingerprint font directories omitted;
  - machine-local/sensitive settings sanitized;
  - native Save dialog chooses file location.
- Inline error when nothing is selected.

### Behavior

- Calls existing `exportWorkflowPackage`.
- Calls existing `saveWorkflowPackageFile`.
- Does not add backend command.
- Does not expose unsafe local paths in the renderer.
- Closes only after successful export/save or explicit cancel.

## Guided Package Import

### Trigger

Import remains available from Workflow Library command region and empty state.

The file input may remain under the hood, but it should be wrapped in a clear
button/pattern rather than appearing as a raw browser file input.

### File Handling

- Accept JSON package files.
- Reject files larger than 5 MB before calling `file.text()`.
- Parse JSON safely.
- Call existing `previewWorkflowPackage`.
- Show inline errors near import trigger/dialog.

### Preview Dialog

Required content:

- Package workflow name.
- Includes Flow yes/no.
- Available Settings sections.
- Omitted/sanitized fields.
- Clear message:
  - import always creates a new workflow;
  - import never overwrites an existing workflow;
  - failed validation leaves no partial workflow.
- Section checkboxes default from preview.
- Inline error when nothing is selected.

### Behavior

- Calls existing `importWorkflowPackage`.
- Refreshes workflow list.
- Opens imported workflow as current behavior.
- Does not add backend command.

## Create And Rename

### Create Workflow

Dialog:

- Title: `Create Workflow`.
- Description: name workflow before building graph.
- Name field.
- Autofocus name field.
- Inline validation/error near field.
- Primary: `Create Workflow`.
- Secondary: `Cancel`.

On success:

- call existing create command;
- open workflow detail/graph as current behavior.

### Rename/Edit Workflow

Dialog:

- Title should make clear this is name/metadata edit, not graph edit.
- Copy says graph/settings are not changed by rename.
- Name field.
- Inline validation/error.
- Primary: `Save Changes`.
- Secondary: `Cancel`.

On success:

- refresh list;
- update current detail name if selected, preserving current behavior.

## Duplicate Workflow

### Behavior

Keep existing backend command behavior:

- target name is `Copy of <workflow name>`;
- saved graph preserved;
- non-storage local settings preserved;
- fresh browser identity/profile/fingerprint created;
- Run from selected disabled for the copy.

### UX

Duplicate opens a lightweight confirmation or equivalent consequence surface.
Confirmation is preferred because duplicate changes identity/session state.

Required copy:

- States the new workflow name.
- States graph and non-storage local settings are copied.
- States browser identity/profile/fingerprint are fresh.
- States Run from selected starts disabled for the copy.

Active workflow duplicate is disabled.

After success:

- refresh list;
- show success feedback or select/open copied workflow if current behavior is
  intentionally changed and tested.

## Delete Workflow

### Dialog

Use Foundation `ConfirmActionDialog` if available.

Required content:

- Workflow name.
- Consequence: removes workflow from the app.
- Keep private browser profile data by default.
- Checkbox: `Delete private browser profile data`.
- Explanation:
  - keeping profile data helps manual recovery or later profile cleanup;
  - deleting profile data removes only unshared inactive profile directories;
  - backend can reject active run/profile/retained-session conflicts.

### Behavior

- No browser-native confirm.
- Active workflow delete disabled.
- Error remains inside dialog.
- Confirm calls existing delete command with `{ deleteBrowserProfile: true }`
  only when checkbox is checked.
- If deleted workflow is currently selected/open, clear selection/detail and
  return to list as current behavior.

## Record Workflow Entry Point

This spec owns only the entry point.

### Placement

Record Workflow appears:

- in Workflow Library command region as secondary action;
- in empty state beside Create and Import.

### Behavior

Keep current behavior:

- click calls `startRecordingSession({ mode: "new_workflow", workflow_name:
  "Recorded workflow" })`.

### State

- Show busy/disabled state if existing recording state supports it.
- If no clear busy state exists, do not add backend state for this spec.
- Start errors display near command region or in a `StatePanel` without raw
  backend payloads.

### Out Of Scope

Recording Review modal, stop/generate draft, redacted values, step review, and
save/discard behavior are owned by the Recording Review child spec.

## Accessibility And Responsive Requirements

- Row actions and More menu items have accessible names.
- Icon-only controls have tooltips.
- Menu can be opened with keyboard.
- Escape closes menus/dialogs.
- Dialog focus follows Radix/shared primitive behavior.
- Detail panel action order is logical.
- Filter chips and sort controls are keyboard accessible.
- Table/list and detail panel fit `1024x768`.
- No page-level horizontal overflow.
- Long workflow names wrap or truncate with accessible full labels.
- Dialog bodies scroll inside viewport.

## Security And Sanitization Requirements

Workflow Library must not expose:

- profile paths;
- proxy credentials;
- raw browser storage;
- cookies/tokens;
- raw arbitrary run outputs;
- unsafe absolute local paths.

Package dialogs must explain sanitization without showing sensitive values.

Delete and duplicate dialogs must name consequences without exposing internal
storage paths.

## Required Tests And Checks

### Page Tests

Update:

```bash
src/features/workflows/pages/WorkflowListPage.test.tsx
```

Cover:

- table/list plus detail preview render;
- default selection;
- selected workflow preservation after refresh;
- search behavior;
- filter behavior;
- sort behavior;
- active run row status;
- Stop uses correct run id;
- Run remains available from list;
- active workflow disables Duplicate, Export, Delete in More menu and detail;
- More menu routes Settings, Duplicate, Export, Delete;
- empty state includes Create, Record, Import;
- create dialog inline validation;
- rename dialog says graph/settings are unchanged;
- duplicate confirmation/feedback mentions fresh identity/profile/fingerprint;
- delete confirmation keeps profile data by default;
- delete profile checkbox passes `{ deleteBrowserProfile: true }`;
- export package options and sanitization note;
- import package preview, omitted fields, no-overwrite copy;
- oversized import rejected before `file.text()`;
- Record Workflow entry starts new-workflow recorder session.

### Helper Tests

Add:

```bash
src/features/workflows/lib/workflowLibrary.test.ts
```

Cover:

- active run map;
- search predicates;
- filter predicates;
- sort comparators;
- action availability;
- selected workflow fallback.

### Required Commands

```bash
npm test -- src/features/workflows/pages/WorkflowListPage.test.tsx
npm test -- src/features/workflows/lib/workflowLibrary.test.ts
npm test -- src/App.test.tsx
npm test -- src/AppCss.test.ts
npx tsc --noEmit
```

Run when layout/CSS/Tailwind/import structure changes:

```bash
npm run build
```

Run Electron build only if Electron-facing files are unexpectedly touched.

## Documentation Requirements

Update docs if implementation changes visible workflow behavior or ownership.

Likely docs:

- `docs/architecture/frontend.md`
  - if new Workflow Library component/helper ownership is introduced.
- `docs/domain/user-visible-invariants.md`
  - if row action behavior, duplicate/delete copy, package flow copy, or library
    state behavior changes.
- `README.md`
  - if smoke checklist steps or labels change.

Do not update IPC docs because no IPC/backend command changes are in scope.

## Acceptance Criteria

Spec 03 is complete when:

- Workflow Library uses dense table/list plus detail preview.
- Search/filter/sort works with existing safe data.
- Unsupported filters are disabled with reason rather than faked.
- Row actions are reduced to Open, Run/Stop, and More.
- Detail preview exposes full safe action set.
- Direct Run from list remains available.
- Active row Stop remains scoped to exact run id.
- Duplicate, Export, and Delete are unavailable for active workflow rows.
- Create and Rename dialogs show inline errors.
- Duplicate UX explains fresh identity/profile/fingerprint consequences.
- Delete confirmation keeps profile data by default and explains consequences.
- Import/export package flows are guided and safe.
- Record Workflow entry remains working.
- No unsafe profile paths, credentials, raw outputs, cookies, tokens, or browser
  storage appear.
- Compact `1024x768` layout does not overflow.
- Required tests/checks pass or exact blockers are documented.

## Handoff To Child Spec 04

Child Spec 04, Recording Review, owns:

- recorder session status UI;
- stop/generate draft;
- Review Recording modal layout;
- included/excluded step review;
- redacted value handling;
- weak locator warnings;
- explicit upload file path review;
- save/discard lifecycle.

Workflow Library only owns the Record Workflow entry point and high-level
start/busy/error state.
