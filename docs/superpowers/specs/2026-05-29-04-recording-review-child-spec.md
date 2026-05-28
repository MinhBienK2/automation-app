# Mission Control UI/UX Upgrade Child Spec 04: Recording Review

Date: 2026-05-29

## Status

Approved design direction, drafted for user review.

This child spec follows:

- `docs/superpowers/specs/2026-05-28-mission-control-full-product-ui-ux-upgrade-master-spec.md`
- `docs/superpowers/specs/2026-05-28-01-foundation-ui-system-child-spec.md`
- `docs/superpowers/specs/2026-05-29-02-shell-navigation-search-alerts-child-spec.md`
- `docs/superpowers/specs/2026-05-29-03-workflow-library-package-management-child-spec.md`

It redesigns the browser recording session and review experience. Workflow
Library owns only the `Record Workflow` entry point; this spec owns the modal
experience after recording starts.

## Goal

Turn Recording Review into a safe, dense review workspace for converting
backend-captured browser sessions into reviewed workflow drafts.

The implementation must:

1. Replace the simple one-column review dialog with a bounded review workspace
   modal.
2. Make live recording state understandable before draft generation.
3. Make warnings, redactions, upload-required states, and weak locators
   first-class review workflow concepts.
4. Allow only safe current edits: workflow name, step labels, include/exclude,
   and currently supported captured value fields.
5. Keep action type, locator, raw event payload, backend-held timing, and graph
   layout read-only.
6. Guard save, discard, and close behavior so the operator does not accidentally
   save unsafe steps or lose captured events.
7. Preserve the current backend recorder contract and security invariants.

## Inputs And Sources Of Truth

### Required Reading Before Implementation

Follow repo workflow first:

1. `docs/README.md`
2. `docs/task-routes.md`
3. `DESIGN.md`
4. `docs/architecture/frontend.md`
5. `docs/domain/user-visible-invariants.md`
6. Workflow Library child spec.
7. This spec.

### Visual Baseline

Use the polished Stitch recording review modal as visual reference:

- `.stitch/designs/2026-05-28-12-polished-10-recording-review-modal.html`

Use it for modal scale, summary strip, warning treatment, included/excluded step
states, sticky footer, and dense dark workspace feel. Do not copy unsupported
behavior such as editing locators or raw captured data.

### Current Source Areas

Likely touched:

- `src/features/workflows/components/RecordingReviewDialog.tsx`
- `src/features/workflows/pages/WorkflowListPage.test.tsx`
- `src/features/workflows/pages/WorkflowDetailPage.test.tsx`
- `src/App.tsx`
- `src/styles/workflows.css`
- `src/styles/modals.css`
- `src/styles/responsive.css`

Likely added:

- `src/features/workflows/components/RecordingSessionPanel.tsx`
- `src/features/workflows/components/RecordingReviewSummary.tsx`
- `src/features/workflows/components/RecordingStepList.tsx`
- `src/features/workflows/components/RecordingStepDetail.tsx`
- `src/features/workflows/components/RecordingDiscardDialog.tsx`
- `src/features/workflows/components/RecordingReviewDialog.test.tsx`
- `src/features/workflows/lib/recordingReview.ts`
- `src/features/workflows/lib/recordingReview.test.ts`

Use Foundation patterns when available:

- `Dialog`
- `ConfirmActionDialog`
- `StatePanel`
- `StatusBadge`
- `StatusCluster`
- `KeyValueList`
- `ErrorDetails`
- `DataToolbar`

## Scope Boundaries

### In Scope

- Live recording session panel.
- Stop/generate draft busy states.
- Review modal layout.
- Review summary and filters.
- Step list and selected step detail.
- Safe step edits.
- Warning/redaction/upload-required UX.
- Save gating and blocker focus.
- Guarded discard and guarded modal close.
- New-vs-replacement mode distinction.
- Component/helper split.
- Tests for helpers, component behavior, and integration flows.

### Out Of Scope

- New backend recorder APIs.
- Live event stream.
- Editing action type.
- Editing target locator or locator candidates.
- Editing source event ids.
- Editing backend-held timing.
- Reordering steps.
- Editing generated graph layout.
- Showing raw recorder events.
- Replacing graph editor functionality.

## Behavior Invariants To Preserve

- Recording sessions are backend-owned.
- New-workflow recording starts from Workflow Library.
- Replacement recording starts from Workflow Detail.
- Replacement recording saves dirty Workflow Settings before recording starts.
- Stopping a recorder drains buffered events before draft generation.
- Generated recording graphs preserve positive captured gaps through ordinary
  edge delays.
- Backend-held timing is not editable in the renderer.
- Saving a recording draft only honors reviewed labels, inclusion flags,
  supported captured value edits, and backend-held timing metadata.
- Renderer-supplied action type, locator replacement, and timing replacement are
  ignored by backend and must not be presented as editable.
- Captured password or secret-like text values must never be exposed to the
  renderer.
- Redacted input steps remain excluded or blocked until the reviewer supplies a
  safe literal or variable.
- Upload file steps require reviewer-entered explicit local file paths before
  replay.
- Discarding a recorder session removes backend-held session/draft state.
- Successfully saving a draft consumes backend-held session/draft state.

## Architecture And Component Split

Keep recording review under `src/features/workflows/`.

Recommended split:

```text
src/features/workflows/components/
  RecordingReviewDialog.tsx
  RecordingSessionPanel.tsx
  RecordingReviewSummary.tsx
  RecordingStepList.tsx
  RecordingStepDetail.tsx
  RecordingDiscardDialog.tsx

src/features/workflows/lib/
  recordingReview.ts
  recordingReview.test.ts
```

### `RecordingReviewDialog`

Owns:

- Modal shell.
- Mode switch between live session and draft review.
- Shared header.
- Sticky footer.
- Close guard.
- Wiring callbacks received from `App.tsx`.

Does not own:

- command calls;
- backend state mutation;
- helper classification logic that belongs in `recordingReview.ts`.

### `RecordingSessionPanel`

Owns live session state before draft review.

Displays:

- recording mode;
- status;
- event count;
- duration;
- safe page URL;
- safe identity summary;
- session warnings;
- stop/discard actions.

### `RecordingReviewSummary`

Owns draft summary:

- total steps;
- included steps;
- excluded steps;
- total warnings;
- needs-attention count;
- redacted/missing value count;
- upload-required count;
- weak locator count;
- filter controls.

### `RecordingStepList`

Owns compact step rows:

- row selection;
- included checkbox;
- action label;
- safe value summary;
- warning/redacted/upload/weak-locator/excluded badges;
- filtered list rendering.

### `RecordingStepDetail`

Owns selected-step review:

- include/exclude control;
- editable step label;
- editable supported value fields;
- read-only action type;
- read-only locator/target summary;
- read-only source event ids disclosure;
- read-only timing if shown;
- warnings near related fields;
- field-level save blockers.

### `recordingReview.ts`

Pure helper responsibilities:

- summarize draft;
- classify step badges;
- classify needs-attention steps;
- filter steps by review filter;
- determine save blockers;
- find first blocked step;
- format safe action labels;
- format safe value summaries;
- detect editable value field for supported action types;
- detect missing required reviewed values.

## Live Recording Session Panel

Before a draft exists, the modal displays a live recording control panel.

### Header

Eyebrow:

- `Browser Recorder`

Title:

- `Recording Workflow` for `new_workflow`.
- `Recording Replacement` for `replace_current_graph`.

Description:

- Make clear the session is capturing browser actions into a review draft.
- Make clear no workflow or graph is saved until review is saved.

### Status Summary

Show:

- Status badge:
  - starting;
  - recording;
  - stopping;
  - stopped;
  - failed;
  - discarded when relevant.
- Event count.
- Duration when derivable from `started_at` and `stopped_at` or current time.
- Current page URL only when `page_url` is available and safe.
- Recording mode:
  - new workflow;
  - replace current graph.

### Identity Summary

Show safe fields:

- display name;
- persona label when available;
- humanize on/off;
- human preset when useful;
- headed/headless.

Do not show:

- `profile_dir`;
- raw profile path;
- raw fingerprint seed;
- proxy credentials;
- local paths.

### Session Warnings

Render session warnings as compact warning list.

Rules:

- Use semantic severity tone.
- Keep messages bounded.
- Do not show raw backend payloads.

### Actions

Primary:

- `Stop Recording`

Secondary/destructive:

- `Discard`

Rules:

- Stop disabled when busy/stopping/generating.
- Discard opens guarded confirmation.
- Explain that stopping drains buffered events before generating review draft.

### Busy And Error States

Show contained busy states for:

- starting;
- stopping;
- generating draft;
- discarding.

If stop/generate fails:

- show short error in panel;
- keep session state;
- allow retry when safe.

## Draft Review Workspace

After stop/generate draft succeeds, the modal switches to review workspace.

### Modal Layout

Use large or fullscreen-ish dialog size, bounded to viewport.

Regions:

- Header.
- Workflow name and mode summary.
- Summary strip.
- Filter controls.
- Body:
  - step list;
  - selected step detail.
- Sticky footer.

At `1024x768`:

- Body remains scrollable.
- Footer remains reachable.
- Step detail can move below list or into accordion/tabs.
- No page-level horizontal overflow.

### Header

Title:

- `Review Recording`

Mode badge:

- `New Workflow`
- `Replace Graph`

Replacement mode copy must state:

- this replaces only the current workflow graph;
- it does not create a new workflow;
- workflow settings/identity remain unless backend behavior says otherwise;
- dirty settings were saved before replacement recording started.

### Workflow Name

- Editable in both modes if current behavior supports it.
- Empty name blocks save.
- Inline error near the field.

For replacement mode, if workflow name editing would be misleading or backend
does not rename in replacement mode, render workflow name as read-only and keep
replacement save focused on graph replacement. Pick one behavior explicitly in
implementation and test it.

### Summary Strip

Show:

- total steps;
- included;
- excluded;
- warnings;
- needs attention;
- redacted/missing values;
- weak locators when available.

Use semantic badges and concise labels.

### Filters

Required filters:

- All.
- Included.
- Excluded.
- Warnings.
- Needs attention.

Rules:

- Filter count should be visible or discoverable.
- Active filter is keyboard accessible.
- Empty filtered result shows a small state with clear filter reset.

## Step List

Each row shows:

- step number;
- action label;
- include checkbox;
- safe primary value summary;
- selected state;
- included/excluded state;
- badges:
  - Warning;
  - Redacted;
  - Upload required;
  - Weak locator;
  - Excluded.

Rules:

- Row click selects step.
- Include checkbox toggles inclusion without losing selection.
- Excluded rows are visually muted but still readable.
- Warning rows use amber border/accent.
- Error/blocked rows use red tone only for actual blockers.
- Long value summaries truncate/wrap safely.
- Raw event payload never appears.

## Selected Step Detail

### Editable Fields

Editable:

- step label;
- include/exclude;
- Navigate URL;
- Input text value;
- Select value;
- Scroll pixels;
- Upload file paths.

Optional only if already safely supported:

- screenshot/download output name.

Do not add new editable action categories unless they are supported by current
component logic and backend save reconciliation.

### Read-Only Fields

Read-only:

- action type;
- locator/target summary;
- locator confidence;
- source event ids;
- timing;
- raw event payload;
- generated graph layout;
- validation issue ids;
- browser identity internals.

Treatment:

- Use `KeyValueList` or technical disclosure.
- Make read-only status obvious when it could be confused for editable.
- Source event ids are collapsed by default.
- Timing, if shown, is explicitly backend-held.

### Locator And Target Summary

Show safe target summary:

- tag name;
- role/accessibility name when available;
- locator confidence;
- locator count or top safe locator label if available.

Do not render raw malformed locator candidates.

Weak locator behavior:

- Medium/low locator confidence or warning codes indicating weak locator should
  add a warning badge.
- Low locator confidence on an included step is a needs-attention item.

### Supported Value Editors

#### Navigate URL

- Text input.
- Empty URL on included navigate step blocks save.

#### Input Text

- Text input or textarea depending length.
- Redacted/secret-like input must not show captured raw value.
- Included redacted input blocks save until reviewer enters safe literal or
  accepted variable expression.

#### Select Value

- Text input for current stored select value.
- Empty value on included select step should block only when backend/action
  requires it.

#### Scroll Pixels

- Number input.
- Preserve current serialized behavior.

#### Upload File Paths

- Text input or textarea supporting comma/newline split as current behavior.
- Included upload step with no file paths blocks save.
- Copy must explain native file chooser paths are not captured and reviewer must
  enter explicit local paths.

## Warnings And Needs Attention

### Draft-Level Warnings

Draft warnings appear near summary.

Rules:

- Severity tone.
- Bounded text.
- Long messages collapse.

### Step-Level Warnings

Step warnings appear:

- as row badges;
- in selected step detail;
- near related editable field when applicable.

### Needs Attention Rules

A step needs attention when:

- it is included and has error-level warning;
- it is included and `upload_file` has no file paths;
- it is included and redacted/secret input has no safe reviewed value;
- it has warning code indicating manual review is required;
- it is included and has low locator confidence.

Implementation may add helper predicates for known warning codes, but it must
avoid broad, untested risk scoring.

### Save Blockers

Save is disabled when:

- busy;
- workflow name empty;
- no included steps if backend/save would reject;
- included step has unresolved required review issue;
- draft validation issues include blocking issue when current DTO exposes them.

Footer must show:

- concise blocker count/message;
- action to focus first needs-attention step when possible.

### No Risk Score

Do not invent numeric or vague risk score. Use concrete warning/blocker labels.

## Guarded Save, Discard, And Close

### Save

Labels:

- `Save Workflow` for `new_workflow`.
- `Replace Graph` for `replace_current_graph`.

Save sends only:

- workflow name;
- save mode;
- reviewed steps with allowed edits;
- add terminal success flag.

After save:

- clear session/draft state;
- open saved workflow as current behavior.

If save fails:

- keep draft state;
- show contained error;
- allow retry after fixes.

### Replace Graph Consequence

Replacement mode must clearly say:

- it replaces only the current workflow graph;
- it keeps workflow identity/settings unless backend behavior says otherwise;
- it does not create a new workflow;
- it cannot be undone inside the review modal.

### Discard

Discard must confirm.

Confirmation copy:

- discards backend-held session/draft;
- captured events cannot be recovered;
- no workflow/graph is saved.

After confirmed discard:

- call existing discard command;
- clear session/draft state;
- close modal.

### Close

If no active session/draft:

- close normally.

If session active or draft exists:

- show guard:
  - Keep reviewing/recording;
  - Discard recording.
- Escape/backdrop close follows same guard.
- Never silently discard.

## App State And Command Boundaries

`App.tsx` keeps:

- `recordingSession`;
- `recordingDraft`;
- `recordingWorkflowName`;
- `recordingBusy`;
- command calls:
  - `startRecordingSession`;
  - `stopRecordingSession`;
  - `generateRecordingDraft`;
  - `discardRecordingSession`;
  - `saveRecordingDraft`.

The dialog and child components receive state and callbacks.

Do not move Electron command calls into presentation components.

## Accessibility And Responsive Requirements

- Dialog has accessible title and description.
- Step list has accessible label.
- Step rows are keyboard selectable.
- Include checkboxes have clear labels.
- Filter controls are keyboard accessible.
- Save blockers are announced or visible near save action.
- Discard confirmation has accessible title/description.
- Focus remains inside modal.
- Close guard is reachable by keyboard.
- Modal fits `1024x768`.
- Body scrolls independently.
- Sticky footer does not cover content.
- Long warning/value text wraps or scrolls inside bounded areas.

## Security And Sanitization Requirements

Do not render:

- raw event payload;
- captured password/secret values;
- profile directory;
- raw fingerprint seed;
- proxy credentials;
- browser storage;
- cookies/tokens;
- unsafe local paths except reviewer-entered upload paths in the upload editor.

Reviewer-entered upload paths are allowed only in the upload file editor because
the operator explicitly supplies them for replay. Do not display captured native
file chooser paths because they are not trusted/captured.

## Required Tests And Checks

### Component Tests

Add:

```bash
src/features/workflows/components/RecordingReviewDialog.test.tsx
```

Cover:

- live session panel renders status, event count, duration, and safe identity
  summary;
- profile path and raw seed are not rendered;
- Stop Recording calls callback;
- Discard opens confirmation and calls callback only after confirm;
- draft review renders summary counts;
- filters show All/Included/Excluded/Warnings/Needs attention;
- selecting a step shows detail editor;
- include/exclude updates reviewed step;
- supported value edits update reviewed step;
- upload step blocks save until file path entered;
- redacted/secret step blocks save until safe value entered or remains
  excluded;
- Replace Graph label and consequence copy appear in replacement mode;
- close with draft/session prompts instead of silently discarding;
- save sends correct callback only when blockers resolved.

### Helper Tests

Add:

```bash
src/features/workflows/lib/recordingReview.test.ts
```

Cover:

- draft summary counts;
- step badge classification;
- needs-attention classification;
- save blocker detection;
- first blocked step selection;
- filter predicates;
- safe action labels;
- editable value field detection;
- missing upload path detection;
- redacted input detection based on warnings/action state.

### Integration Tests

Update:

```bash
src/features/workflows/pages/WorkflowListPage.test.tsx
```

Keep/extend coverage for:

- recording new workflow from list;
- stopping recording;
- reviewing draft;
- editing workflow name;
- editing step label;
- excluding a step;
- saving workflow.

Update or add:

```bash
src/features/workflows/pages/WorkflowDetailPage.test.tsx
```

Cover replacement flow if better scoped there:

- dirty settings saved before replacement recording starts;
- replacement draft save uses `replace_graph`;
- replacement copy is visible.

### Required Commands

```bash
npm test -- src/features/workflows/components/RecordingReviewDialog.test.tsx
npm test -- src/features/workflows/lib/recordingReview.test.ts
npm test -- src/features/workflows/pages/WorkflowListPage.test.tsx
npm test -- src/features/workflows/pages/WorkflowDetailPage.test.tsx
npm test -- src/AppCss.test.ts
npx tsc --noEmit
```

Run when layout/CSS/Tailwind/import structure changes:

```bash
npm run build
```

Run Electron/backend tests only if command contracts are unexpectedly touched.

## Documentation Requirements

Update docs if implementation changes visible recording behavior or ownership.

Likely docs:

- `docs/architecture/frontend.md`
  - component split and recording review ownership.
- `docs/domain/user-visible-invariants.md`
  - if visible save/discard/close behavior or redaction UX changes.
- `README.md`
  - if smoke checklist steps or labels change.

Do not update Electron IPC docs unless command payloads change, which is out of
scope for this spec.

## Acceptance Criteria

Spec 04 is complete when:

- Live recording panel clearly shows safe session status and controls.
- Draft review modal has summary, filters, step list, selected detail, and
  sticky footer.
- Warnings, redactions, upload-required, weak locator, and excluded states are
  visible and actionable.
- Save is blocked by unresolved required review issues.
- Discard and close are guarded.
- Replacement mode is visibly distinct from new workflow mode.
- Current backend command contract is preserved.
- No raw event payload, captured secret value, profile path, raw seed, proxy
  credential, token, cookie, or browser storage appears.
- Reviewer-entered upload paths work as current behavior requires.
- Required tests/checks pass or exact blockers are documented.

## Handoff To Child Spec 05

Child Spec 05, Graph Builder, owns:

- graph canvas and toolbar;
- graph palettes;
- graph inspector;
- node/link editing;
- validation issue panel;
- runtime issue mapping to graph;
- graph run highlighting.

Recording Review only produces reviewed draft graphs through existing backend
commands and opens the saved workflow afterward.
