# Mission Control UI/UX Upgrade Child Spec 08: Evidence Explorer

Date: 2026-05-29

## Status

Approved design direction, drafted for user review.

This child spec follows the master UI/UX upgrade spec and child specs 01-07.
It owns the durable historical evidence browser.

## Brainstorming Decisions

Question: should Evidence Explorer become a file manager?

Approved answer: no. It should be an evidence workspace backed by typed evidence
read models. Artifact reveal/export stays behind backend commands that validate
run-scoped paths.

Question: should detail show raw run outputs?

Approved answer: no. Show typed, bounded, sanitized detail only. Raw outputs,
cookies, tokens, browser storage, proxy credentials, and arbitrary diagnostic
payloads must not be rendered.

Question: what is the main workflow?

Approved answer: filter evidence, select an item, inspect safe detail/preview,
then navigate to related Run/Workflow/Identity or export selected evidence.

## Goal

Make Evidence Explorer the reliable historical evidence workspace for screenshots,
downloads, browser identity evidence, action traces, and manifests.

The implementation must:

1. Keep Evidence as the only broad historical evidence browser.
2. Improve filters, result density, selection, preview, and detail hierarchy.
3. Make screenshot preview and artifact reveal/export safe and command-backed.
4. Support focused evidence and run filters from Overview/Runs.
5. Provide clear empty/loading/error/stale states.
6. Preserve evidence sanitization boundaries.

## Inputs And Sources Of Truth

Read before implementation:

- `docs/README.md`
- `docs/task-routes.md`
- `DESIGN.md`
- `docs/domain/user-visible-invariants.md`
- `docs/domain/workflow-lifecycle.md`
- `docs/domain/execution-semantics.md`
- `docs/contracts/electron-ipc.md`
- `docs/contracts/run-state.md`
- `docs/architecture/frontend.md`
- Run Launch and Runs Monitoring child spec

Visual reference:

- `.stitch/designs/2026-05-28-12-polished-07-evidence-explorer.html`

Primary source files:

- `src/features/evidence/pages/EvidenceExplorerPage.tsx`
- `src/App.tsx`
- `src/layouts/AppShell.tsx`
- `src/lib/workflowApi.ts`
- `src/types/workflow.ts`
- `src/styles/workflows.css`
- `src/styles/layout.css`
- `electron/backend/evidence/evidenceRepository.ts`
- `electron/backend/evidence/artifacts.ts`
- `electron/backend/evidence/model.ts`
- `electron/backend/commands.ts`

Likely tests:

- add `src/features/evidence/pages/EvidenceExplorerPage.test.tsx`
- `src/App.test.tsx`
- `src/lib/workflowApi.test.ts`
- `electron/backend/commands.test.ts` if command behavior changes
- evidence repository/model tests if read model changes

## Scope Boundaries

### In Scope

- Evidence page layout.
- Filter toolbar.
- List/grid view polish.
- Selection and bulk export UX.
- Detail panel hierarchy.
- Screenshot preview UX.
- Safe artifact reveal/export feedback.
- Cross-workspace links.
- Empty/loading/error/stale states.

### Out Of Scope

- Raw filesystem browser.
- Editing evidence.
- Deleting evidence.
- Unbounded raw output inspection.
- New artifact storage layout.
- Identity reset or run stop controls.

## Layout Requirements

Evidence Explorer should use a three-part workspace:

- Header: title, refresh, export selected, active filter summary.
- Toolbar: search, type, workflow/run/source/time filters where data supports
  them, view toggle.
- Workspace: results list/grid plus selected detail panel.

The detail panel should remain visible on desktop. At compact desktop, results
and detail can stack, but selecting an item must scroll/focus detail.

## Filter Requirements

Required filters:

- text search;
- evidence type;
- run id when focused from Runs;
- selected evidence id when focused from Overview;
- source/status/time filters only when current request shape supports them.

Filter behavior:

- Changing filters resets cursor/page position.
- Active filters are summarized as removable chips where practical.
- Empty result state distinguishes no data from no matches.
- Refresh preserves current filters.

Do not add unsupported backend filters in the UI unless the matching typed
request field and tests are added.

## Results Requirements

Each result shows:

- evidence label;
- kind;
- workflow name or unavailable marker;
- run source/status;
- identity display name/id when safe;
- timestamp when available;
- selection checkbox for export.

List view:

- best for dense scanning;
- rows show key metadata in stable columns/lines.

Grid view:

- best for screenshot-heavy browsing;
- cards keep fixed dimensions and do not reflow text unpredictably.

Selection:

- row click selects detail;
- checkbox toggles export selection without changing detail unexpectedly;
- selected rows remain selected after refresh only if still in current page.

## Detail Requirements

Detail header:

- evidence kind;
- label;
- status/source;
- safe ids in monospace;
- related workflow/run/identity links.

Detail body:

- typed metadata sections;
- screenshot preview section for screenshot evidence;
- download/artifact actions for artifact-backed evidence;
- action trace summary for action trace evidence;
- browser identity summary for identity evidence;
- manifest summary for evidence manifest.

For long structured details:

- show bounded key-value sections;
- collapse lower-priority details;
- never render arbitrary raw JSON blobs by default;
- recursive sensitive redaction remains backend-owned.

## Preview, Reveal, And Export Requirements

Screenshot preview:

- call `getEvidenceScreenshotPreview(evidenceId)`;
- show loading state in the preview area;
- show failure message without clearing the rest of detail;
- do not infer local file paths in renderer.

Reveal artifact:

- call `revealEvidenceArtifact(evidenceId)`;
- show command success/failure status;
- backend must validate evidence id and artifact path.

Export selected:

- disabled when no selection.
- calls `exportEvidenceBundle(evidenceIds)`.
- shows export result in a safe message.
- If backend returns a path, show only what existing contract allows; avoid
  adding arbitrary path rendering beyond current command result.

## Cross-Workspace Navigation

Evidence must support:

- Overview recent evidence -> focused evidence detail.
- Runs selected run -> Evidence filtered by run id.
- Evidence detail -> Runs selected run.
- Evidence detail -> Workflow Detail.
- Evidence identity evidence -> Identity Lab historical or managed target.

Stale related targets:

- show unavailable marker in detail;
- keep evidence detail visible;
- do not silently navigate to a default workspace.

## Security And Sanitization Requirements

Do not render:

- cookies;
- tokens;
- proxy credentials;
- browser local/session storage;
- raw profile contents;
- raw diagnostic payloads;
- arbitrary local file paths;
- unbounded run outputs.

The renderer must only consume typed evidence list/detail/preview/export command
responses.

## CSS And Responsive Requirements

Follow `DESIGN.md`.

At `1024x768`:

- filter toolbar wraps without overflow;
- detail panel remains reachable;
- list rows truncate safely;
- grid cards keep stable aspect/height;
- export action remains visible when selection exists.

## Tests And Checks

Required focused tests when implemented:

- Search/type filters call `onQueryChange` and reset cursor.
- Selection checkboxes manage export selection independently of detail select.
- Export is disabled without selection and calls selected ids when enabled.
- Detail preview calls preview callback only for selected evidence.
- Detail links call typed navigation callbacks.
- Loading, empty, error, and stale states render correctly.
- Sensitive raw fields are not rendered from representative detail fixtures.

Run checks:

- `npm test -- src/features/evidence/pages/EvidenceExplorerPage.test.tsx`
- `npm test -- src/App.test.tsx`
- `npm test -- src/lib/workflowApi.test.ts` if wrappers change
- `npm test -- electron/backend/commands.test.ts` if command behavior changes
- `npm test -- electron/backend/evidence/model.test.ts`
- `npx tsc --noEmit`

## Acceptance Criteria

- Operators can find and inspect evidence without touching raw files.
- Screenshot preview, reveal, and export are command-backed and scoped by
  evidence id.
- Cross-workspace links keep run/workflow/identity context.
- Empty/error/stale states are explicit.
- Sensitive data boundaries remain intact.

