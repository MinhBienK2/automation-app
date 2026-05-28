# Mission Control UI/UX Upgrade Child Spec 08: Evidence Explorer

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
- `docs/superpowers/specs/2026-05-29-07-run-launch-monitoring-child-spec.md`

It owns the durable historical evidence workspace. Runs owns active/recent run
monitoring. Identity Lab owns identity posture. Evidence Explorer owns browsing
typed persisted evidence summaries, loading bounded detail, screenshot preview,
artifact reveal, and selected evidence export.

## Brainstorming Scope

The user asked for one-spec-at-a-time `$brainstorming` and pre-approved the
recommended choices. This spec records the evidence-specific decisions so an
implementation agent can build the screen without turning it into a file
manager, raw-output browser, or second run history page.

Evidence Explorer is security-sensitive because run outputs can contain page
observations, generated files, action traces, and browser identity metadata. The
UI must preserve the backend's typed evidence model and sanitization boundary.

## Brainstorming Decisions

### Decision 1: Product Role

Question: should Evidence Explorer be a file manager, a raw output browser, or a
typed evidence workspace?

Options considered:

- File manager.
  - Pros: familiar for screenshots/downloads.
  - Cons: exposes path thinking, duplicates OS reveal behavior, weak for
    identity/action trace evidence.
- Raw output browser.
  - Pros: maximum debugging data.
  - Cons: risks secrets, unbounded payloads, and unclear schema.
- Typed evidence workspace.
  - Pros: matches backend model, supports safe detail by evidence kind, enables
    traceability without raw output exposure.
  - Cons: requires kind-specific detail UI.

Recommended and approved: typed evidence workspace.

### Decision 2: Artifact Handling

Question: should screenshot/download files be opened directly by renderer or
through backend commands?

Options considered:

- Renderer local file paths.
  - Pros: quick preview.
  - Cons: violates Electron boundary and leaks local paths.
- Backend commands by evidence id.
  - Pros: backend validates run-scoped artifact paths; renderer stays safe.
  - Cons: requires command states.

Recommended and approved: backend commands by evidence id only.

### Decision 3: Detail Payload Depth

Question: should Evidence Detail show arbitrary JSON?

Options considered:

- Full JSON viewer.
  - Pros: debug flexibility.
  - Cons: high leakage and usability risk.
- No payload details.
  - Pros: safe.
  - Cons: insufficient for action traces and identity evidence.
- Bounded typed detail per kind.
  - Pros: useful and safe; aligns with `EvidenceDetail` union.
  - Cons: requires separate renderers.

Recommended and approved: bounded typed detail per evidence kind.

### Decision 4: Results View

Question: should the page use table-only, grid-only, or list/grid toggle?

Options considered:

- Table-only.
  - Pros: dense.
  - Cons: weak for screenshots.
- Grid-only.
  - Pros: visual.
  - Cons: weak for scanning metadata.
- List/grid toggle.
  - Pros: current UI already supports it; list for operations scanning, grid for
    screenshot-heavy review.
  - Cons: two layouts to harden.

Recommended and approved: list/grid toggle.

### Decision 5: Export Model

Question: should export operate on current filters or explicit selection?

Options considered:

- Export all filtered results.
  - Pros: fast bulk export.
  - Cons: can accidentally export more than intended.
- Export selected evidence ids.
  - Pros: explicit, backend command already expects evidence ids.
  - Cons: requires selection management.

Recommended and approved: export explicit selection only.

### Decision 6: Cross-Workspace Links

Question: should Evidence own run/workflow/identity detail inline?

Options considered:

- Inline everything.
  - Pros: fewer navigations.
  - Cons: duplicates Runs and Identity Lab.
- Links only.
  - Pros: clean ownership.
  - Cons: one click away.

Recommended and approved: show compact context and link to Runs, Workflow, and
Identity Lab.

### Decision 7: Component Split

Question: should Evidence Explorer stay one component?

Options considered:

- Keep one component.
  - Pros: simple.
  - Cons: current page already mixes toolbar, results, detail, payload renderers,
    selection, preview, export.
- Split by workspace regions and payload kind.
  - Pros: safer for agents and tests.
  - Cons: more files.

Recommended and approved: split by responsibility if implementation touches the
page substantially.

## Goal

Make Evidence Explorer the reliable historical evidence workspace for typed
persisted evidence. Operators should be able to filter evidence, select items,
inspect safe details, preview screenshots, reveal/export artifacts, and navigate
to related run/workflow/identity context.

The implementation must:

1. Keep Evidence as the only broad historical evidence browser.
2. Preserve typed evidence list/detail/preview/export command boundaries.
3. Improve filter, selection, result, and detail UX.
4. Make screenshot preview, artifact reveal, and export safe and explicit.
5. Support Overview/Runs/Search focused evidence and run filters.
6. Keep raw outputs, secrets, and arbitrary paths hidden.
7. Preserve compact desktop usability.

## Inputs And Sources Of Truth

### Required Reading Before Implementation

Follow repo workflow first:

1. `docs/README.md`
2. `docs/task-routes.md`
3. `DESIGN.md`
4. `docs/domain/user-visible-invariants.md`
5. `docs/domain/workflow-lifecycle.md`
6. `docs/domain/execution-semantics.md`
7. `docs/contracts/electron-ipc.md`
8. `docs/contracts/run-state.md`
9. `docs/contracts/workflow-types.md`
10. `docs/architecture/frontend.md`
11. Run Launch and Runs Monitoring child spec.
12. This spec.

### Visual Baseline

Use:

- `.stitch/designs/2026-05-28-12-polished-07-evidence-explorer.html`

Use it for:

- header hierarchy;
- dense filter toolbar;
- list/detail workspace;
- grid/list toggle;
- metadata density;
- safe dark operations styling.

Do not copy unsupported file-manager behavior or raw JSON browsing.

### Current Source Areas

Primary files likely touched:

- `src/features/evidence/pages/EvidenceExplorerPage.tsx`
- `src/App.tsx`
- `src/layouts/AppShell.tsx`
- `src/lib/workflowApi.ts`
- `src/types/workflow.ts`
- `src/styles/workflows.css`
- `src/styles/layout.css`
- `src/styles/responsive.css`

Backend files only if typed read model or commands must change:

- `electron/backend/evidence/model.ts`
- `electron/backend/evidence/evidenceRepository.ts`
- `electron/backend/evidence/artifacts.ts`
- `electron/backend/commands.ts`
- `electron/backend/persistence/database.ts`

Likely tests:

- add `src/features/evidence/pages/EvidenceExplorerPage.test.tsx`
- `src/App.test.tsx`
- `src/lib/workflowApi.test.ts`
- `electron/backend/evidence/model.test.ts`
- `electron/backend/commands.test.ts` if command behavior changes
- evidence repository tests if filters/detail/export behavior changes

## Current Implementation Readout

### Evidence Page

Current `EvidenceExplorerPage.tsx` already:

- shows page header;
- shows refresh;
- shows Export Selection;
- has search filter;
- has evidence type filter;
- has list/grid view mode;
- keeps explicit selected ids for export;
- prunes selected ids when current page changes;
- renders results;
- renders selected detail;
- supports screenshot preview callback;
- supports reveal artifact callback;
- supports export selected callback;
- links to Run, Workflow, Identity.

Current problem:

- The page needs richer structure, kind-specific detail requirements, better
  empty/loading/error states, safer export result treatment, active filter
  summary, and stronger sensitive-data boundaries.

### Evidence Backend Model

Current evidence model already:

- categorizes outputs;
- redacts sensitive keys;
- truncates large strings/arrays/objects;
- preserves structured browser identity and action trace evidence;
- produces `__evidence_model` manifest.

Current problem:

- UI must respect this model and not bypass it with raw output rendering.

### Evidence Repository

Current repository already:

- lists bounded evidence pages;
- supports request filters such as workflow/run/identity/search/type/time;
- returns warnings for skipped artifacts/reports/traces/manifests;
- sorts/paginates;
- returns typed details for screenshot, download, browser identity, action
  trace, and evidence manifest;
- previews screenshot by evidence id with size limit;
- reveals artifact by evidence id after path validation;
- exports evidence bundle by evidence ids.

Current problem:

- UI must expose these capabilities clearly and safely.

### App Orchestration

Current `App.tsx` already:

- stores evidence query;
- loads evidence page;
- selects focused evidence id;
- loads evidence detail;
- clears preview when detail changes;
- previews screenshot;
- reveals artifact;
- exports selected evidence;
- opens Evidence from Overview/Runs/Identity;
- routes identity evidence to historical Identity target.

Current problem:

- UI needs to make focus/filter state visible and stale states understandable.

## Scope Boundaries

### In Scope

- Evidence page header.
- Filter toolbar.
- Active filter summary.
- List/grid result presentation.
- Selection and export UX.
- Detail panel layout.
- Kind-specific payload renderers.
- Screenshot preview UX.
- Artifact reveal UX.
- Export result UX.
- Page warnings.
- Loading/empty/error/stale states.
- Cross-workspace navigation.
- Component/helper split.
- Focused tests.

### Out Of Scope

- Raw file manager.
- Raw output JSON explorer.
- Evidence deletion.
- Evidence editing.
- Artifact path editing.
- Unbounded run history.
- Full identity diagnostics.
- Schedule history editing.
- New evidence storage layout.
- Direct renderer filesystem access.

## Non-Negotiable Invariants

Preserve these:

- Evidence is a separate sidebar page between Runs and Schedules.
- Evidence is the only broad historical evidence browser.
- Overview recent evidence opens Evidence focused on selected evidence id.
- Runs selected detail opens Evidence filtered to run id.
- Evidence lists only typed persisted evidence summaries.
- Evidence detail is bounded and typed.
- Evidence does not expose raw arbitrary output browsing.
- Identity evidence opens Identity Lab as read-only historical context tied to
  evidence run.
- Screenshot preview accepts evidence id only.
- Artifact reveal accepts evidence id only.
- Evidence bundle export accepts selected evidence ids only.
- Backend validates artifact paths under run-scoped evidence directories.
- Backend never returns absolute original paths for artifact preview.
- Renderer does not import Node/Electron/filesystem APIs.
- Sensitive values are not rendered.

## Evidence Information Architecture

Evidence Explorer has four zones:

1. Header.
2. Filter/action toolbar.
3. Results region.
4. Detail region.

Header answers:

- where am I;
- when was evidence refreshed;
- what primary actions exist.

Toolbar answers:

- what evidence is currently filtered;
- how to switch list/grid;
- how to narrow results.

Results answer:

- what evidence items match;
- which items are selected for export;
- which item is selected for detail.

Detail answers:

- what is this evidence item;
- what safe payload is available;
- how to navigate to related context;
- what artifact action is available.

## Header Requirements

Header should show:

- eyebrow: `Evidence Workspace`;
- title: `Evidence Explorer`;
- last refreshed timestamp when page exists;
- loading status when first loading;
- Refresh action;
- Export Selection action.

Export Selection:

- disabled when no selected ids;
- label includes selection count when practical;
- calls `onExportSelection(selectedIds)`;
- does not export all filtered results.

Refresh:

- preserves current query;
- preserves selected evidence if still present;
- shows loading state if parent exposes it;
- does not clear previous page immediately on refresh failure unless current
  parent behavior requires it.

## Filter Toolbar Requirements

### Required Filters

Expose filters supported by current `EvidenceListRequest`:

- Search.
- Evidence type.
- Run id focus/filter when query has `run_id`.
- Workflow id filter when query has `workflow_id` or UI can safely expose it.
- Identity id filter when query has `identity_id` or UI can safely expose it.
- Date/time filters only if current request shape and backend validation support
  them.

Do not add UI controls for unsupported backend filters.

### Search

Search behavior:

- updates `query.search`;
- resets `cursor` to null;
- does not clear other filters;
- input has accessible label.

### Type Filter

Types:

- screenshot;
- download;
- browser identity;
- action trace;
- evidence manifest.

Behavior:

- all types when blank;
- setting type resets cursor;
- current UI can support one type at a time unless multi-select type filtering
  is implemented with tests.

### Active Filter Summary

Show compact removable chips or summary text for active filters:

- search;
- type;
- run id;
- workflow id;
- identity id;
- focused evidence id;
- date range if implemented.

If removable chips are not implemented, at minimum show readable context such
as `Filtered to run <id>`.

### Pagination

If `page.has_more` and `next_cursor` exist:

- show `Load more` or equivalent;
- preserve current selected ids that remain visible;
- loading next page should not reset filters.

If pagination is not implemented in the UI yet, spec requires not hiding the
fact that results are truncated. Use page warning or footer text.

## Results Requirements

### Result Item Content

Each result item shows:

- selection checkbox;
- evidence label;
- evidence kind;
- run source;
- run status;
- workflow name or unavailable marker;
- identity display name or id where available;
- timestamp;
- file state for screenshot/download if available;
- selected state.

Do not show absolute paths.

### List View

List view is the default operational scanning mode.

Requirements:

- dense rows;
- stable metadata lines or columns;
- selected item highlighted;
- checkbox selection independent from detail selection;
- row click selects detail;
- checkbox click does not accidentally open detail unless current event behavior
  is intentionally tested.

### Grid View

Grid view is for screenshot-heavy scanning.

Requirements:

- stable card dimensions;
- kind/status metadata;
- checkbox selection;
- selected detail state;
- no layout jump when labels are long.

Grid view may show screenshot thumbnail only if backend provides a safe preview
or thumbnail command. Do not use raw paths.

### Empty States

Differentiate:

- Loading evidence.
- No evidence has been recorded yet.
- No evidence matches current filters.
- Focused evidence target unavailable.

Empty state should include safe next action:

- clear filters;
- refresh;
- open Runs/Workflows only if navigation callback exists.

## Selection And Export Requirements

### Selection Model

Selection is explicit and independent from detail selection.

Rules:

- checkbox toggles export selection;
- selected ids persist only while still present in current page;
- selected ids are pruned when page changes and item disappears;
- export button disabled with zero selection;
- selection count visible when non-zero.

### Export Command

Export:

- calls `exportEvidenceBundle({ evidence_ids })` through parent callback;
- backend deduplicates and bounds selected ids;
- UI shows success/failure status.

Export result:

- show exported count if available;
- show omitted file count if available;
- show bundle directory only if current contract returns it and product accepts
  displaying it. Avoid adding unrelated raw local paths.

If path display is considered too sensitive in implementation review, show
`Evidence bundle exported` plus count and rely on native reveal/save UX.

### Export Failure

On failure:

- keep selection;
- show command-facing error;
- do not clear selected detail.

## Detail Panel Requirements

### Detail Header

Show:

- evidence label;
- evidence kind;
- created time;
- run id;
- workflow name;
- identity display name/id;
- node id when present;
- step number when present;
- file state when applicable.

Use monospace for ids.

### Detail Actions

Actions:

- Open Run.
- Open Workflow when workflow exists.
- Open Identity when identity exists.
- Reveal in Folder for screenshot/download.
- Preview for screenshot.

Do not show Reveal for non-file evidence.
Do not show Preview for non-screenshot evidence.

### Screenshot Detail

Payload:

- artifact kind;
- relative path if contract allows;
- file state.

Preview:

- button calls `getEvidenceScreenshotPreview(evidenceId)`;
- preview area shows loading state if available;
- renders image from base64 data only when returned for same evidence id;
- alt text uses evidence label;
- preview failure shown in detail error area;
- no direct filesystem path.

### Download Detail

Payload:

- artifact kind;
- relative path if contract allows;
- file state;
- size bytes if available.

Actions:

- Reveal in Folder.

Do not preview arbitrary downloads in this spec.

### Browser Identity Detail

Payload:

- safe field list from backend;
- fingerprint seed hash, not raw seed, when backend provides hash;
- persona metadata;
- timezone/locale source;
- GeoIP/WebRTC policy;
- humanization status/preset;
- CloakBrowser wrapper/binary evidence.

Do not render:

- cookies;
- localStorage/sessionStorage;
- raw profile storage;
- raw font directory paths;
- proxy password;
- test-account binding.

Open Identity action:

- opens historical identity context tied to workflow/run/evidence.

### Action Trace Detail

Payload:

- bounded trace entries;
- parent control node id when available;
- trace sequence;
- action type;
- status;
- start/end timestamps if available;
- output summary;
- evidence summary;
- sanitized failure reason.

If `has_more`, show bounded note that only first entries are shown.

Do not render raw trace JSON by default.

### Evidence Manifest Detail

Payload:

- output key;
- category;
- approximate bytes;
- redacted flag;
- truncated flag.

Use this to explain what evidence categories were captured without showing raw
values.

## Cross-Workspace Navigation

Evidence supports:

- Overview recent evidence -> focused evidence id.
- Runs selected detail -> Evidence filtered by run id.
- Search result -> focused evidence id.
- Identity Lab -> Evidence filtered by workflow/identity.
- Evidence detail -> Runs focused run.
- Evidence detail -> Workflow Detail.
- Evidence detail -> Identity Lab historical identity.

Rules:

- use typed Mission Control navigation targets;
- do not pass arbitrary route strings;
- stale targets render destination unavailable state;
- Evidence remains visible if related workflow/identity is unavailable.

## Data Flow

### Loading Page

1. App calls `listEvidenceItems(query)`.
2. Backend returns `EvidencePage`.
3. App stores page and query.
4. App selects `focus_evidence_id`, existing selected id if still present, or
   first item.
5. App loads detail for selected id.
6. Detail panel renders typed payload.

### Query Change

1. User changes filter.
2. Page calls `onQueryChange(nextQuery)`.
3. Cursor resets to null.
4. Parent reloads page.
5. Selection is pruned to visible ids.

### Selecting Detail

1. User clicks result row/card.
2. Page calls `onSelectEvidence(evidenceId)`.
3. Parent loads detail.
4. Parent clears preview.

### Preview Screenshot

1. User clicks Preview on screenshot detail.
2. Page calls `onPreviewScreenshot(evidenceId)`.
3. Parent calls backend preview command.
4. Preview renders only if returned id matches current detail.

### Reveal Artifact

1. User clicks Reveal for screenshot/download.
2. Page calls `onRevealArtifact(evidenceId)`.
3. Backend validates evidence id and artifact path.
4. Native reveal occurs if available.

### Export Selection

1. User checks items.
2. User clicks Export Selection.
3. Page sends selected ids.
4. Backend exports bounded bundle.
5. UI shows result.

## State Matrix

### Page States

| State | UI Response |
| --- | --- |
| initial loading | stable header and loading results/detail |
| loaded with items | results and selected detail |
| loaded empty no filters | empty evidence state |
| loaded empty with filters | no matches state and clear filter suggestion |
| page warning | warning near toolbar/header |
| page error | alert region, preserve useful prior data when possible |
| export success | status message with count/omitted count |
| export failure | error message, selection preserved |

### Detail States

| State | UI Response |
| --- | --- |
| no selection | select evidence empty state |
| detail loading | detail loading state |
| detail error | warning/error in detail panel |
| screenshot detail | metadata, preview/reveal actions |
| download detail | metadata, reveal action |
| browser identity detail | safe fields and identity link |
| action trace detail | bounded timeline/list |
| manifest detail | bounded manifest table |
| stale selected id | unavailable detail state |

### Selection States

| State | UI Response |
| --- | --- |
| no export selection | Export disabled |
| one selected | Export enabled, count visible |
| multiple selected | Export enabled, count visible |
| page changes | prune missing ids |
| selected detail not checked | allowed |
| checked item not selected detail | allowed |

## Error Handling

### Page Load Error

Show command-facing error.

Do not:

- clear existing selected detail if it is still useful;
- navigate away;
- show stack traces.

### Detail Error

Show near detail panel.

Do:

- keep result list visible;
- clear preview for failed detail;
- allow selecting another item.

### Preview Error

Show detail error or preview area error.

Do:

- keep detail metadata visible;
- clear stale preview;
- allow retry.

### Reveal Error

Show command-facing error.

Common messages:

- evidence item is not a file artifact;
- evidence file unavailable;
- native reveal unavailable.

### Export Error

Show command-facing error.

Keep selected ids.

## Security And Sensitive Data Boundaries

Never render:

- cookies;
- tokens;
- proxy passwords;
- proxy URL credentials;
- raw browser localStorage/sessionStorage;
- raw profile contents;
- raw font directory paths;
- arbitrary local file paths;
- unbounded raw run outputs;
- raw action trace JSON;
- arbitrary diagnostic payloads.

Allowed:

- evidence id;
- run id;
- workflow name/id;
- identity id/display name;
- node id;
- step number;
- relative run-scoped artifact path if current typed detail exposes it;
- typed sanitized fields from backend;
- truncated/redacted manifest metadata.

Renderer must not:

- import `fs`;
- construct artifact paths;
- read files;
- infer preview URLs from paths.

## Accessibility Requirements

Required:

- page has `h1`;
- filter toolbar has accessible label;
- search input has label;
- type filter has label;
- view toggle has accessible group label;
- result checkboxes have item-specific labels;
- result buttons have readable names;
- selected state not color-only;
- detail panel has accessible label;
- tables have headers;
- preview image has alt text;
- error/status regions use alert/status treatment;
- export disabled state is clear.

Keyboard:

- filters reachable by Tab;
- result rows/buttons reachable;
- checkbox toggles without requiring mouse;
- detail action buttons reachable;
- list/grid toggle reachable.

## Layout And CSS Requirements

Follow `DESIGN.md`.

### Desktop Layout

Recommended:

- header;
- filter toolbar;
- warning/status region;
- two-column workspace:
  - results;
  - detail.

Results can be wider than detail when list view is active. Detail should remain
wide enough for metadata and payload tables.

### Compact Desktop

At `1024x768`:

- toolbar wraps;
- filters do not overflow;
- results and detail stack;
- detail remains reachable after selection;
- result labels truncate/wrap safely;
- payload tables scroll or wrap;
- preview image scales to container;
- export action remains visible.

### Visual Treatment

Use:

- compact status badges;
- table/list density;
- monospace ids;
- muted metadata;
- cyan selection/focus;
- amber warnings;
- red errors;
- green success only for export/available/success states.

Do not use:

- hero layout;
- decorative cards inside cards;
- raw gradient/orb decoration.

## Component Architecture

### Recommended Split

If implementation grows, split:

```text
src/features/evidence/pages/
  EvidenceExplorerPage.tsx
  EvidenceHeader.tsx
  EvidenceFilterToolbar.tsx
  EvidenceResults.tsx
  EvidenceResultItem.tsx
  EvidenceDetailPanel.tsx
  EvidencePayloadView.tsx
  EvidenceEmptyState.tsx
  evidencePresentation.ts
  EvidenceExplorerPage.test.tsx
```

Keep `EvidenceExplorerPage` as public page component.

### Payload Renderers

`EvidencePayloadView` may split by kind:

- ScreenshotEvidenceDetail.
- DownloadEvidenceDetail.
- BrowserIdentityEvidenceDetail.
- ActionTraceEvidenceDetail.
- EvidenceManifestDetail.

Do not duplicate backend sanitization in UI. UI can format and hide fields, but
backend remains source of truth for safe payload shape.

### Presentation Helpers

Pure helpers may own:

- evidence kind label;
- file state label/tone;
- active filter summary;
- selection count label;
- warning text;
- compact date formatting.

Test helpers if added.

## Implementation Sequence

Recommended order:

1. Add page/component tests for existing behavior.
2. Add presentation helpers if needed.
3. Improve header and export selection count.
4. Improve filter toolbar and active filter summary.
5. Improve result list/grid item layout.
6. Improve detail panel by evidence kind.
7. Improve screenshot preview state.
8. Improve reveal/export status handling.
9. Harden empty/error/stale states.
10. Harden responsive CSS.
11. Run focused checks.
12. Update docs only if behavior/contracts changed.

Do not start by changing backend evidence repository unless UI tests reveal a
missing typed field required by this spec.

## Test Plan

### Helper Tests

Add tests for helpers if added:

- kind labels;
- warning text from page warnings;
- active filter summary;
- selection count label;
- result sorting assumptions if moved to helper;
- file state labels.

### Page Tests

Add `src/features/evidence/pages/EvidenceExplorerPage.test.tsx`.

Required tests:

- renders loading state;
- renders empty no-data state;
- renders no-matches state when filters active;
- search updates query and resets cursor;
- type filter updates query and resets cursor;
- list/grid toggle changes view mode;
- result click calls `onSelectEvidence`;
- checkbox toggles export selection without selecting detail unexpectedly;
- selection prunes when page changes;
- Export Selection disabled with no selected ids;
- Export Selection calls selected ids;
- page warning renders skipped counts;
- export result renders count/omitted count;
- detail loading/error states render;
- screenshot detail shows Preview and Reveal;
- screenshot preview renders only matching evidence id;
- download detail shows Reveal but not Preview;
- browser identity detail opens Identity target;
- action trace detail renders bounded entries;
- manifest detail renders rows;
- Open Run/Workflow callbacks use typed targets;
- sensitive raw fields from fixtures are not rendered.

### App Tests

Update `src/App.test.tsx` if navigation changes:

- Overview recent evidence opens focused Evidence;
- Runs detail opens Evidence filtered by run id;
- Evidence identity opens historical Identity target;
- command search evidence result opens focused Evidence.

### Backend Tests

Only if backend behavior changes:

- evidence list request validation;
- screenshot preview size/path validation;
- reveal artifact id/path validation;
- export selected evidence ids;
- sensitive field sanitization.

### Checks

Run:

- `npm test -- src/features/evidence/pages/EvidenceExplorerPage.test.tsx`
- `npm test -- src/App.test.tsx`
- `npm test -- src/lib/workflowApi.test.ts` if wrappers change
- `npm test -- electron/backend/evidence/model.test.ts`
- `npm test -- electron/backend/commands.test.ts` if commands change
- `npm test -- src/AppCss.test.ts`
- `npx tsc --noEmit`

## Manual QA Checklist

Verify:

- open Evidence from sidebar;
- refresh evidence;
- search evidence;
- filter by type;
- open list view;
- open grid view;
- select result detail;
- check multiple items for export;
- export selected;
- preview screenshot;
- reveal screenshot/download;
- open related Run;
- open related Workflow;
- open related Identity;
- open Evidence from Runs filtered to run id;
- open Evidence focused from Overview/Search;
- handle no results;
- handle missing artifact/preview error;
- resize to `1024x768`;
- confirm no raw paths/secrets appear.

## Documentation Requirements

Update docs if implementation changes current truth:

- `docs/domain/user-visible-invariants.md` for evidence UI behavior.
- `docs/architecture/frontend.md` for component ownership/navigation changes.
- `docs/contracts/electron-ipc.md` for command changes.
- `docs/contracts/workflow-types.md` for DTO changes.
- `docs/domain/execution-semantics.md` for evidence output semantics.
- `docs/task-routes.md` if checks/routes change.
- `README.md` smoke checklist if evidence smoke changes.

If implementation is UI-only and preserves behavior/contracts, state docs did
not need updates beyond this spec.

## Acceptance Criteria

Evidence Explorer is complete when:

- Evidence remains the broad historical evidence browser.
- Results are filterable, selectable, and scannable.
- Detail panel renders typed bounded payloads by evidence kind.
- Screenshot preview uses backend preview command by evidence id.
- Artifact reveal uses backend reveal command by evidence id.
- Export uses explicit selected evidence ids.
- Overview/Runs/Search/Identity navigation preserves focus/filter context.
- Empty/loading/error/stale states are explicit.
- Sensitive data and arbitrary paths are not rendered.
- Compact desktop remains usable.
- Focused tests cover changed behavior.

## Agent Handoff Notes

For the coding agent implementing this spec:

- Use TDD because this is user-visible UI behavior.
- Do not build a raw output explorer.
- Do not import filesystem APIs in renderer.
- Do not infer artifact URLs from paths.
- Keep Evidence, Runs, and Identity responsibilities separate.
- Read `DESIGN.md` before CSS changes.
- Update docs only when behavior/contracts change.

