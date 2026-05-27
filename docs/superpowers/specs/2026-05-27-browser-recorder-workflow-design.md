# Browser Recorder Workflow Design

Date: 2026-05-27

## Status

Design direction approved for a written spec on 2026-05-27.

This spec is ready for user review before implementation planning. It defines
the full target feature and an incremental execution contract so future agents
can complete one verified phase, commit it, and then continue to the next phase
without losing the end goal.

## Goal

Add a Browser Recorder feature that lets an operator create a workflow by using
a real browser instead of manually building every graph node.

The finished feature must:

- Open a recorder browser from the Electron app.
- Let the operator enter a URL and perform normal browser actions.
- Capture the meaningful browser actions as structured recording events.
- Normalize noisy browser events into stable workflow actions.
- Generate an editable workflow graph from the recorded session.
- Let the operator review and adjust the generated graph before saving.
- Save the generated graph as a normal workflow.
- Replay the saved workflow through the existing run path so pressing Run
  performs the same browser task with the same workflow settings, graph
  validation, run state, cancellation, and evidence conventions as manually
  authored workflows.
- Grow from a stable linear MVP into the complete recorder without requiring a
  rewrite.

The product outcome is not a raw macro recorder. The product outcome is a graph
authoring assistant that turns observed browser behavior into the existing
workflow graph contract.

## Final Definition Of Done

The complete feature is done only when all of the following are true:

- A user can start a recorder session from the workflow product UI.
- The backend launches and owns the recording browser; renderer code does not
  import Node, Electron, Playwright, CloakBrowser, filesystem, or SQLite APIs.
- The user can navigate to a target page and perform a realistic linear task.
- The recorder captures navigation, click, text entry, select, checkbox/radio,
  scroll, keyboard, wait, tab, download, upload, and screenshot-relevant
  behavior where the current action contract supports it.
- The normalizer collapses noisy low-level events into a small set of workflow
  actions.
- The locator generator stores ordered structured locator candidates and marks
  weak locators with review warnings.
- The graph generator creates a valid `WorkflowGraph` with `Start`, generated
  action nodes, links, optional waits, and terminal success.
- The review UI shows the generated steps, warnings, captured values, locator
  confidence, and save controls.
- The user can remove or edit generated steps before saving.
- The saved workflow runs through the existing graph compiler, command layer,
  run manager, and CloakBrowser runner.
- An end-to-end test records a workflow against a deterministic local fixture,
  saves it, runs it, and asserts that the replayed browser task succeeds.
- Current source-of-truth docs are updated for every behavior, command,
  contract, runner, persistence, and UI change.
- Each implementation phase has focused tests, green verification commands,
  docs sync when needed, and a git commit before the next phase starts.
- The implementation ledger records phase status, evidence, commit hashes,
  remaining work, and final completion audit.

## Product Principles

- Graph-first: the saved visual graph remains the workflow authoring source of
  truth. Recording produces graph nodes, not hidden scripts.
- Backend-owned automation: all browser automation stays behind Electron IPC.
- Stable replay over pixel replay: selectors, waits, and semantic actions are
  preferred over cursor coordinates.
- Review before save: generated workflows are drafts until the operator saves
  them.
- Incremental reliability: start with a narrow action surface and expand only
  after record-to-run stability is proven.
- Testable phases: every phase must leave the product in a coherent state with
  focused tests.

## Non-Goals For The First Stable MVP

The first stable MVP does not need to support:

- Control flow inference such as loops, branches, retries, or try/catch.
- AI self-healing locators.
- Automatic CAPTCHA, challenge, or anti-abuse friction solving.
- Pixel-perfect replay of every mouse move.
- Multi-user collaborative recording.
- Recording arbitrary browser extensions.
- Recording unsupported native OS dialogs.

Anything outside record-to-graph-to-replay requires a separate spec and must not
be added to this implementation plan.

## Chosen Approach

Use a backend-owned recorder that launches a controlled browser, injects
page-side event capture scripts, observes browser lifecycle events through the
Playwright-compatible page/context APIs, and converts the captured stream into
the existing workflow graph contract.

This approach fits the existing architecture:

- The renderer already talks to backend commands through typed IPC wrappers.
- The backend already owns CloakBrowser launch, browser identity, workflow
  settings, graph compilation, run management, and persistence.
- Existing action configs already describe the target replay surface.
- Existing graph validation and runner tests can be extended instead of adding
  a parallel replay engine.

Rejected alternatives:

| Alternative | Reason not chosen |
| --- | --- |
| Raw script recorder | Fast to prototype but bypasses graph validation, action contracts, run policy, and review UX. |
| Pixel-coordinate macro recorder | Fragile across viewport, layout, data, and account state changes. It should only be a fallback for unsupported surfaces. |
| Browser DevTools trace import only | Useful for diagnostics but too low-level for user-editable workflow authoring. |

## User Experience

The user-facing flow is:

1. Operator opens the workflow product and chooses `Record Workflow`.
2. The app creates a recording session through the backend.
3. The backend opens a headed browser using saved Workflow Settings for
   `replace_current_graph`, or an unsaved Workflow Settings draft with a new
   backend-generated browser identity for `new_workflow`.
4. The operator enters a URL in the recorder browser and completes the task.
5. The app shows recording state, elapsed time, event count, and Stop
   Recording.
6. The operator stops recording.
7. The app calls `generateRecordingDraft` and displays a review draft with
   generated steps, labels, warnings, captured values, and locator confidence.
8. The operator removes noise or edits obvious labels/config values.
9. The operator saves the reviewed draft as a new workflow or replaces the
   current workflow graph, depending on the entry point.
10. The operator presses Run on the saved workflow.
11. The workflow executes through the normal saved graph run path.

The review step is required for MVP. Auto-saving a generated workflow without
review is a later option only after replay confidence is high.

### Recorder Workflow Settings And Identity

Recording and replay must use the same workflow settings baseline.

For `new_workflow`, starting a recorder session creates a backend-owned
unsaved Workflow Settings draft. The draft uses the same default settings
normalization as a newly created workflow and includes a new browser identity,
profile directory, fingerprint seed, persona, browser launch settings, run
policy, graph defaults, and environment defaults. The recorder browser launches
from that settings draft. When the reviewed recording is saved, the backend
creates the workflow and persists that exact settings draft before saving the
generated graph. If the recording is discarded before save, the backend cleans
up any unused recording-only profile resources that are safe to remove.

For `replace_current_graph`, the recorder launches from the current workflow's
saved Workflow Settings. If the detail screen has dirty settings, the UI must
save them before starting recording or block recording with a readable message.
Replacing a graph must not silently switch to recorder defaults.

## UI Entry Points

Initial UI entry points:

- Workflow list: `Record Workflow` creates a new workflow from a recording.
- Workflow detail: `Record Into Workflow` creates a draft graph for the current
  workflow and requires Save before replacing the existing saved graph.

The first implementation can ship only the workflow-list entry point if that is
the smallest stable slice. The design should not prevent the workflow-detail
entry point from being added later.

## Architecture

```text
React renderer
  -> recorder UI and review state
  -> src/lib/workflowApi.ts typed calls
  -> window.workflowApi through preload
Electron preload / IPC
  -> recorder command channels
Electron backend
  -> recording session service
  -> recorder browser launch through existing browser/session patterns
  -> recorder Workflow Settings draft and browser identity snapshot
  -> event capture collector
  -> locator generator
  -> timeline normalizer
  -> graph generator
  -> workflow repository save
SQLite
  -> normal workflows and optional temporary recording drafts
Runner
  -> unchanged replay through saved graph compilation and BrowserWorkflowRunner
```

### Renderer Ownership

Renderer code owns:

- Start/stop recording controls.
- Recording status display.
- Review UI for generated steps and warnings.
- Save-as-workflow or replace-current-workflow flow.
- Calling typed workflow API wrappers.

Renderer code does not own:

- Browser launch.
- Event capture injection.
- Filesystem persistence.
- Graph validation authority.
- Replay logic.

### Backend Ownership

Backend code owns:

- Recording session lifecycle.
- Recorder Workflow Settings draft and browser identity lifecycle.
- Browser context/page launch and cleanup.
- Page instrumentation.
- Browser lifecycle observation.
- Event stream storage in memory or temporary persisted draft form.
- Locator candidate generation.
- Event normalization and action synthesis.
- Graph generation.
- Review draft generation before persistence.
- Save transaction for generated workflow graph and settings.
- Command errors and validation.

### New Backend Modules

Recommended module layout:

```text
electron/backend/recording/
  recorderSessionManager.ts
  recorderTypes.ts
  eventCollector.ts
  locatorGenerator.ts
  timelineNormalizer.ts
  graphGenerator.ts
  recordingDraftRepository.ts
  recorderSessionManager.test.ts
  locatorGenerator.test.ts
  timelineNormalizer.test.ts
  graphGenerator.test.ts
```

`recordingDraftRepository.ts` is optional in the first phase. In-memory drafts
are acceptable for MVP if the UI clearly treats a stopped recording as an
unsaved draft and tests cover cleanup. Persisted drafts become useful once
recording review can survive renderer reload or app restart.

## IPC Contract

Add typed renderer-facing commands in `src/lib/workflowApi.ts`,
`src/types/electron.ts`, `electron/preload.cts`, `electron/ipc.ts`, and
`electron/backend/commands.ts`.

Proposed command names:

```text
startRecordingSession(input)
stopRecordingSession(sessionId)
getRecordingSession(sessionId)
listRecordingEvents(sessionId)
generateRecordingDraft(sessionId, options)
getRecordingDraft(draftId)
saveRecordingDraft(draftId, input)
discardRecordingSession(sessionId)
```

`startRecordingSession` input:

```text
{
  workflow_id?: string | null,
  workflow_name?: string | null,
  initial_url?: string | null,
  browser_launch_overrides?: limited recorder-safe overrides,
  mode: "new_workflow" | "replace_current_graph"
}
```

`generateRecordingDraft` options:

```text
{
  include_event_ids?: string[] | null,
  add_terminal_success: boolean
}
```

`saveRecordingDraft` input:

```text
{
  workflow_name: string,
  save_mode: "create_new" | "replace_graph",
  reviewed_steps: ReviewedRecordingStep[],
  add_terminal_success: boolean
}
```

`generateRecordingDraft` must not persist a workflow or replace a graph. It only
normalizes events, creates a review draft, runs graph validation, and returns
the draft for the renderer review UI. `saveRecordingDraft` is the only recorder
command that creates a workflow or replaces the current graph. This preserves
the required review-before-save boundary.

Command errors continue to serialize as `{ message, field? }`.

### Legacy Prototype API Migration

The current codebase already has prototype recorder-adjacent bridge surface:
`RecordedEvent`, `normalizeRecordedEvents`, and `suggestSelectors`. That surface
does not represent backend-owned recording sessions and must not be extended as
the new recorder contract.

Before adding the new session contract, implementation must remove the
prototype bridge methods and update the Electron IPC docs, or keep them
temporarily only under clearly deprecated names outside the recorder session
surface. New session DTOs use the `Recording*` prefix so they cannot be
confused with the legacy `RecordedEvent` helper type. The preferred
implementation path is to retire `normalizeRecordedEvents` once
`generateRecordingDraft` covers normalization, and to move selector suggestion
behavior behind the new `locatorGenerator` module when still needed.

## Recording Data Model

### RecorderSession

```text
{
  id: string,
  workflow_id: string | null,
  mode: "new_workflow" | "replace_current_graph",
  status: "starting" | "recording" | "stopping" | "stopped" | "failed" | "discarded",
  started_at: string,
  stopped_at?: string | null,
  browser_identity: sanitized browser identity metadata,
  workflow_settings_snapshot: sanitized Workflow Settings draft or saved settings snapshot,
  page_url?: string | null,
  event_count: number,
  warnings: RecordingWarning[]
}
```

### RecordingEvent

```text
{
  id: string,
  session_id: string,
  sequence: number,
  timestamp: string,
  kind:
    | "navigation"
    | "click"
    | "input"
    | "change"
    | "select"
    | "checkbox"
    | "radio"
    | "scroll"
    | "keyboard"
    | "download"
    | "dialog"
    | "tab"
    | "wait_marker",
  frame_url: string | null,
  page_url: string | null,
  target: RecordingTarget | null,
  value: RecordingValue | null,
  raw: bounded sanitized diagnostic payload,
  confidence: "high" | "medium" | "low",
  warnings: RecordingWarning[]
}
```

### RecordingTarget

```text
{
  tag_name: string,
  input_type?: string | null,
  text_sample?: string | null,
  role?: string | null,
  accessible_name?: string | null,
  iframe?: RecordingTarget | null,
  locators: RecordingLocatorCandidate[],
  bounding_box?: { x: number, y: number, width: number, height: number } | null
}
```

### RecordingLocatorCandidate

```text
{
  kind: "test_id" | "role" | "label" | "placeholder" | "text" | "css" | "xpath" | "attribute",
  value: string,
  name?: string | null,
  attribute?: string | null,
  score: number,
  reason: string
}
```

### RecordingValue

```text
{
  text?: string | null,
  checked?: boolean | null,
  selected_value?: string | null,
  selected_label?: string | null,
  key?: string | null,
  keys?: string[] | null,
  scroll?: { x: number, y: number } | null,
  file_names?: string[] | null
}
```

### RecordingWarning

```text
{
  code: string,
  message: string,
  event_id?: string | null,
  severity: "info" | "warning" | "error"
}
```

### RecordingWorkflowDraft

```text
{
  id: string,
  session_id: string,
  workflow_id: string | null,
  mode: "new_workflow" | "replace_current_graph",
  status: "draft" | "saving" | "saved" | "discarded",
  generated_at: string,
  workflow_settings_snapshot: sanitized Workflow Settings draft or saved settings snapshot,
  steps: ReviewedRecordingStep[],
  graph: WorkflowGraph,
  validation_issues: GraphValidationIssue[],
  warnings: RecordingWarning[]
}
```

### ReviewedRecordingStep

```text
{
  id: string,
  source_event_ids: string[],
  action: ActionConfig,
  label: string,
  included: boolean,
  locator_confidence?: "high" | "medium" | "low" | null,
  warnings: RecordingWarning[]
}
```

The renderer may edit `ReviewedRecordingStep` labels, inclusion, and supported
action config values during review. The backend remains authoritative: saving a
draft regenerates and validates the final graph from reviewed steps before any
workflow or graph persistence happens.

## Event Capture Strategy

Capture both page-side interaction events and backend-observed lifecycle events.

Page-side capture should observe:

- `click`, `dblclick`, `contextmenu`.
- `input`, `change`, `beforeinput` where useful for grouping.
- `keydown` for hotkeys and non-text keys.
- `submit`.
- `scroll` with throttling.
- Relevant focus/blur only when they become meaningful workflow actions.

Backend observation should capture:

- Main-frame navigation.
- New page/tab creation.
- Downloads.
- Dialogs.
- Page load and network idle markers where useful for wait inference.
- Browser close or crash.

Event capture should store only the fields needed for replay and debugging. It
must not store unbounded DOM snapshots or full page HTML.

## Action Mapping

| Recorded behavior | Generated action |
| --- | --- |
| Main-frame navigation | `navigate` |
| Click element | `click` |
| Double click | `double_click` |
| Right click | `right_click` |
| Text input final value | `input_text` |
| Clear input | `clear_input` when confidently detected, otherwise `input_text` with clear-before-input |
| Native select changed | `select_option` |
| Checkbox checked | `check` |
| Checkbox unchecked | `uncheck` |
| Radio selected | `select_radio` |
| Page scroll | `scroll` with `mode: "page"` |
| Element-focused scroll | `scroll` with `mode: "into_view"` when target is clear |
| Enter/Escape/Tab or hotkey | `press_key` or `hotkey` |
| Form submit | `submit_form` when a stable submit target exists, otherwise click/press sequence |
| File chooser | `upload_file` only when selected files are captured through an explicit app-owned, reviewed file input path that can replay locally; otherwise a review warning |
| Download | `wait_for_download` when the action contract can represent it |
| Dialog accept/dismiss | `accept_dialog` or `dismiss_dialog` |
| Meaningful pause | `wait` or `random_wait` only after normalization |

Unsupported captured behaviors should become review warnings, not silent graph
nodes.

Native OS file chooser dialogs are not recordable for MVP. Upload support must
not depend on scraping a native dialog path. Until the app provides a reviewed,
operator-controlled file selection path that can be saved into an `upload_file`
config, file chooser activity remains an unsupported captured behavior with a
review warning.

## Timeline Normalization

The raw event stream is not the workflow. The normalizer converts it into a
small, stable timeline.

Normalization rules:

- Collapse multiple input events on the same field into one `input_text` action
  with the final value.
- Ignore pointer movement noise.
- Ignore hover unless it changes state needed by the next action.
- Throttle scroll into meaningful page scroll actions.
- Add a wait after navigation when lifecycle timing proves the page changed.
- Merge focus plus typing into one input action.
- Prefer the last value before blur, enter, submit, click-away, or stop.
- Preserve event sequence so generated graph order is deterministic.

## Graph Generation

Graph generation creates a standard v2 `WorkflowGraph`.

Default graph shape:

```text
Start
  -> generated action 1
  -> generated action 2
  -> ...
  -> End Success
```

Rules:

- Use existing graph node and edge shapes from `src/types/workflow.ts`.
- Use visible action node labels from `src/lib/workflowUi.ts`.
- Generate stable node ids inside the graph draft.
- Position nodes left-to-right using the same visual expectations as current
  graph authoring.
- Add edge waits only when the normalizer has a clear wait signal.
- Do not generate control-flow nodes during MVP.
- Validate generated graph through backend graph validation before save.
- Surface validation issues in review UI.

## Locator Generation

The locator generator is the most important replay stability component.

It must:

- Produce ordered locator candidates for each target.
- Prefer stable semantic locators over CSS/XPath.
- Prefer `data-testid` when available.
- Use role/name for accessible controls when stable.
- Use labels and placeholders for form fields.
- Use constrained text locators only when text is short and stable.
- Use CSS only when it avoids brittle generated classes.
- Keep XPath fallback for compatibility with existing target defaults.
- Include iframe target information when the action occurred inside a frame.
- Assign confidence and warnings.

Generated `ElementTarget` values should use existing structured target bundles:

```text
{
  locators: [
    { kind: "test_id", value: "submit-order" },
    { kind: "role", role: "button", name: "Submit" },
    { kind: "xpath", value: "..." }
  ],
  constraints: { visible: true, enabled: true },
  iframe: null
}
```

Low-confidence locators do not block draft generation, but they must be visible
in review and covered by replay tests.

## Recorder Scope Boundary

This spec is only for turning recorded browser usage into a normal workflow
graph and replaying that graph reliably.

The recorder must:

- Use backend-owned browser launch and normal command errors.
- Keep the generated workflow as a review draft before save.
- Convert unsupported captured behavior into review warnings.
- Avoid adding unrelated requirements to this implementation.

## Error Handling

Expected readable errors:

- Recorder browser failed to launch.
- Recording browser was closed before stop.
- Page instrumentation failed for a frame.
- Unsupported browser event captured.
- No meaningful actions recorded.
- Generated graph failed validation.
- Workflow save failed.
- Replay failed at a generated step.

Errors must use the existing command error shape `{ message, field? }` at the
IPC boundary. Runtime replay failures must use the existing run-state issue
surface.

## Persistence

MVP can keep active recording sessions and generated review drafts in backend
memory because a stopped recording is a draft that has not been saved as a
workflow.

Persistent draft support should be added when review needs to survive app
restart or long-running interruption. If added, persisted drafts should use a
new backend-owned table such as:

```text
recording_drafts
  id TEXT PRIMARY KEY
  workflow_id TEXT
  status TEXT NOT NULL
  events_json TEXT NOT NULL
  workflow_settings_snapshot_json TEXT NOT NULL
  reviewed_steps_json TEXT
  generated_graph_json TEXT
  warnings_json TEXT NOT NULL
  created_at TEXT NOT NULL
  updated_at TEXT NOT NULL
```

Saved workflows continue to use existing workflow and graph persistence.

## Testing Strategy

Testing must scale by phase. The goal is to prove the current slice, not to
pretend the complete feature is done early.

Test categories:

- Unit tests for recorded event validation.
- Unit tests for locator generation.
- Unit tests for timeline normalization.
- Unit tests for graph generation.
- Backend command tests for recorder session lifecycle.
- Backend command tests proving draft generation does not persist workflows and
  save draft does persist the reviewed graph/settings transactionally.
- Backend tests proving new-workflow recordings persist the same Workflow
  Settings and browser identity snapshot used by the recorder browser.
- IPC wrapper tests for renderer bridge contract.
- UI tests for start, stop, review, warnings, edit, and save flows.
- Electron backend build checks when backend/preload types change.
- Renderer typecheck when renderer types change.
- E2E record-to-replay fixture when the MVP spans the browser.

Target commands by phase:

```text
npm test -- electron/backend/recording/locatorGenerator.test.ts
npm test -- electron/backend/recording/timelineNormalizer.test.ts
npm test -- electron/backend/recording/graphGenerator.test.ts
npm test -- electron/backend/commands.test.ts
npm test -- src/lib/workflowApi.test.ts
npm test -- src/features/workflows/pages/WorkflowListPage.test.tsx
npm test -- src/features/workflows/pages/WorkflowDetailPage.test.tsx
npx tsc --noEmit
npm run build:electron
npm run test:e2e:smoke
```

The actual focused command list for each commit must match the files touched in
that phase and the routes in `docs/task-routes.md`.

## Implementation Phases

Each phase is a small goal. A phase is not complete until tests pass, docs are
updated when needed, and a git commit exists.

### Phase 0: Implementation Ledger And Skeleton Spec Sync

Goal: create the continuity mechanism before behavior work starts.

Work:

- Create `docs/superpowers/plans/browser-recorder-implementation-ledger.md`.
- Copy the phase table from this spec into the ledger.
- Add columns for status, evidence, commit, docs updated, and next action.
- Add a completion checklist that mirrors this spec's Definition Of Done.
- Record the current implementation phase as Phase 1.

Checks:

- `git diff --check`

Exit criteria:

- Ledger exists.
- Ledger points back to this spec.
- Commit created for Phase 0.

### Phase 1: Backend Recorder Session Lifecycle

Goal: backend can create, report, stop, and discard a recording session without
yet generating a workflow.

Work:

- Add recorder types.
- Add session manager with in-memory session state.
- Add recorder Workflow Settings draft and browser identity snapshot creation
  for `new_workflow`.
- Add IPC command plumbing.
- Retire or clearly deprecate the existing prototype `RecordedEvent` /
  `normalizeRecordedEvents` bridge surface so it cannot conflict with the new
  backend-owned session contract.
- Add focused command and API wrapper tests.
- Update docs for command boundary and product model.

Checks:

- `npm test -- src/lib/workflowApi.test.ts`
- `npm test -- electron/backend/commands.test.ts`
- `npm run build:electron`
- `npx tsc --noEmit`

Exit criteria:

- Start/stop/discard commands work against fake backend browser ownership.
- New-workflow recorder sessions expose a sanitized settings/identity snapshot
  that can later be persisted unchanged at save time.
- The legacy prototype recorder bridge surface is removed or explicitly
  separated from the new session contract.
- No browser behavior is claimed as recordable yet.
- Commit created.

### Phase 2: Browser Event Capture MVP

Goal: headed recorder browser captures raw navigation, click, input, select,
checkbox/radio, and scroll events from a deterministic local page.

Work:

- Launch recorder browser through backend-owned browser/session patterns.
- Inject bounded page-side event capture.
- Observe main-frame navigation.
- Collect raw events in sequence.
- Add backend tests with a fake page adapter where possible.

Checks:

- Focused recording tests.
- `npm run build:electron`
- `npm run test:e2e:smoke` only if the phase includes real Electron browser
  interaction.

Exit criteria:

- Recorded event stream is deterministic enough for normalization.
- Unsupported events produce warnings.
- Commit created.

### Phase 3: Locator Generation And Timeline Normalization

Goal: raw events become stable normalized workflow-intent steps.

Work:

- Implement locator candidate scoring.
- Convert recorded targets to existing `ElementTarget` structures.
- Collapse input noise.
- Throttle scroll.
- Infer navigation waits.
- Add confidence and warnings.
- Add unit tests for common and weak locator cases.

Checks:

- `npm test -- electron/backend/recording/locatorGenerator.test.ts`
- `npm test -- electron/backend/recording/timelineNormalizer.test.ts`
- `npm run build:electron`

Exit criteria:

- Normalized timeline contains meaningful action-intent steps.
- Weak selectors are visible as warnings, not hidden failures.
- Commit created.

### Phase 4: Workflow Graph Generation

Goal: normalized steps become a valid review-only workflow graph draft.

Work:

- Generate graph nodes and edges.
- Add terminal success.
- Position nodes deterministically.
- Run backend graph validation before save.
- Add `generateRecordingDraft` command behavior that returns the draft without
  creating a workflow or replacing an existing graph.
- Add graph generator tests.
- Add docs for workflow type/graph behavior.

Checks:

- `npm test -- electron/backend/recording/graphGenerator.test.ts`
- `npm test -- electron/backend/graph/validateGraph.test.ts electron/backend/graph/compiler.test.ts`
- `npm run build:electron`

Exit criteria:

- Generated graph compiles through existing backend graph code.
- Generated action configs are existing supported action types.
- Generating a draft does not persist workflow rows, settings rows, or graph
  replacements.
- Commit created.

### Phase 5: Recorder Review UI And Save Flow

Goal: user can start recording, stop, review generated steps, and save as a
workflow.

Work:

- Add UI entry point.
- Add recording status surface.
- Add review list with warnings and step removal.
- Add `saveRecordingDraft` path for save-as-new-workflow.
- Persist the same Workflow Settings snapshot and browser identity used during
  recording before saving the generated graph.
- Keep renderer free of direct browser APIs.
- Read and follow `DESIGN.md` if layout or user-facing styling changes.
- Update frontend architecture and user-visible invariants docs.

Checks:

- Focused workflow page/component tests.
- `npm test -- src/lib/workflowApi.test.ts`
- `npx tsc --noEmit`

Exit criteria:

- User-visible flow can create a reviewed draft and save it as a normal
  workflow from recorded data.
- UI tests cover warnings and save behavior.
- Commit created.

### Phase 6: Record-To-Replay Stability E2E

Goal: one deterministic local fixture proves record once, save, run, and assert
the replayed task.

Work:

- Add a deterministic fixture page for recorder E2E.
- E2E starts recorder, performs a small task, saves generated workflow, runs it,
  and asserts final browser/output state.
- Add failure assertions for weak locator warnings or no-action recordings.
- Update README smoke checklist if the workflow behavior changes.

Checks:

- Focused E2E command for recorder test.
- `npm run test:e2e:smoke` when stable enough for smoke.
- `npm run build:electron`

Exit criteria:

- Record-to-run path passes locally.
- Generated workflow uses normal run state and graph progress.
- Commit created.

### Phase 7: Complete Action Coverage Expansion

Goal: expand beyond MVP actions while preserving stable replay.

Work:

- Add keyboard/hotkey support.
- Add tab support.
- Add download/dialog handling.
- Add upload support only for explicit app-owned, reviewed file paths that can
  replay reliably.
- Keep native OS file chooser capture as an unsupported warning until an
  explicit reviewed file input path exists.
- Add screenshot/action evidence integration where relevant.
- Add tests per action family.

Checks:

- Focused tests for each added action family.
- Relevant runner/compiler/command tests.
- Typecheck/build checks for touched layers.

Exit criteria:

- Each supported recorded behavior maps to a tested existing action type.
- Unsupported behaviors remain warnings.
- Commit created after each action-family slice.

### Phase 8: Final Hardening And Completion Audit

Goal: prove the full Definition Of Done and close the implementation ledger.

Work:

- Run the complete prompt-to-artifact checklist.
- Verify every phase has a commit hash and evidence.
- Verify docs and code agree.
- Run focused and broad checks required by touched areas.
- Mark the ledger complete only after real evidence covers every final
  requirement.

Checks:

- All focused test commands named by the final touched routes.
- `npx tsc --noEmit`
- `npm run build:electron`
- Recorder E2E.
- Broader E2E smoke when stable.

Exit criteria:

- Ledger status is complete.
- Final commit created.
- No unchecked final requirements remain.

## Agent Continuity Mechanism

Future implementation agents must not rely on memory. They must use a
source-controlled ledger.

Required ledger path:

```text
docs/superpowers/plans/browser-recorder-implementation-ledger.md
```

Required ledger sections:

- Spec link.
- Current phase.
- Phase table with status: `pending`, `in_progress`, `blocked`, `complete`.
- For every phase: changed files, tests run, docs updated, commit hash, and next
  action.
- Prompt-to-artifact checklist mapping each explicit requirement in this spec to
  evidence.
- Known gaps and whether each gap is accepted, blocked, or scheduled for a
  later phase.
- Final completion audit.

Required agent loop:

1. Read `AGENTS.md`, `docs/README.md`, `docs/task-routes.md`, this spec, and
   the ledger.
2. Select exactly one current phase.
3. Use `.agents/skills/test-driven-development` before code behavior changes.
4. Read the route-specific docs and source files for that phase.
5. Write or update failing tests first unless the phase is docs-only.
6. Implement the smallest phase slice.
7. Run focused checks.
8. Update source-of-truth docs when behavior or contracts changed.
9. Update the ledger with exact test commands and results.
10. Commit the phase after tests pass.
11. Move the ledger to the next phase.
12. Repeat until all phases are complete or a real blocker is recorded.

Stop rule:

- Do not start a later phase until the current phase has a commit.
- Do not mark the final feature complete unless the ledger's final
  prompt-to-artifact checklist has concrete evidence for every requirement.
- Passing tests are not enough unless those tests cover the requirement being
  claimed.

Commit rule:

- Each AI-authored phase commit must include:

```text
Co-Authored-By: Codex <codex@openai.com>
```

## Documentation Updates During Implementation

Update current docs in the same change when code affects their area.

Likely docs:

- `docs/domain/product-model.md`
- `docs/domain/workflow-lifecycle.md`
- `docs/domain/user-visible-invariants.md`
- `docs/domain/action-taxonomy.md`
- `docs/domain/execution-semantics.md`
- `docs/architecture/overview.md`
- `docs/architecture/frontend.md`
- `docs/architecture/command-boundary.md`
- `docs/architecture/runner.md`
- `docs/architecture/persistence.md`
- `docs/contracts/electron-ipc.md`
- `docs/contracts/workflow-types.md`
- `docs/contracts/action-configs.md`
- `docs/contracts/run-state.md`
- `docs/task-routes.md`
- `README.md` smoke checklist when user-visible workflow behavior changes.

Docs-only phase changes can skip TDD. Runtime behavior changes cannot.

## Risk Register

| Risk | Mitigation |
| --- | --- |
| Weak locators cause flaky replay | Ordered locator candidates, confidence scoring, review warnings, and record-to-replay E2E. |
| Event stream captures too much noise | Timeline normalization and tests that assert small generated action count. |
| Renderer accidentally owns browser logic | IPC-only contract tests and architecture review. |
| Generated graphs bypass validation | Backend graph validation before save and compiler tests. |
| Feature grows too large before stability | Phase gates and commit-after-test rule. |
| Agents forget remaining work | Source-controlled implementation ledger and final prompt-to-artifact audit. |

## Open Product Choices Fixed By This Spec

- The first saved output is a normal workflow graph, not a separate macro file.
- The first implementation prioritizes new workflow creation over replacing an
  existing graph.
- Review before save is required.
- Anything outside record-to-graph-to-replay needs a separate spec.
- Coordinate-only replay is not a primary strategy.
- The implementation must be phase-based with a commit after each tested phase.

## Final Completion Checklist

The final implementation audit must map each checklist item to concrete
evidence:

- Recorder UI entry point exists in the workflow product UI.
- Backend recording session commands exist and are typed through the bridge.
- Renderer code does not import Node, Electron, Playwright, CloakBrowser,
  filesystem, or SQLite APIs.
- Browser launch is backend-owned and uses the saved settings snapshot for
  `replace_current_graph` or the persisted recorder settings draft for
  `new_workflow`.
- New-workflow save persists the same Workflow Settings and browser identity
  snapshot used by the recording browser.
- Legacy prototype recorder bridge methods are removed or clearly separated
  from the new backend-owned session contract.
- The user can navigate to a target page and perform a realistic linear task.
- Event capture works for navigation, click, text entry, select,
  checkbox/radio, and scroll in the stable MVP.
- Complete action coverage captures or warns for keyboard, wait, tab, download,
  upload, and screenshot-relevant behavior according to the current action
  contract.
- Native OS file chooser activity remains a warning unless an explicit reviewed
  upload file path can replay locally.
- Normalization collapses noisy low-level events into a small deterministic
  timeline.
- Locator generation stores ordered structured candidates and marks weak
  locators with review warnings.
- Graph generation creates a valid v2 `WorkflowGraph` with `Start`, generated
  action nodes, links, optional waits, and terminal success.
- Draft generation does not persist workflows or graph replacements before
  review.
- Review UI displays generated steps, warnings, captured values, locator
  confidence, and save controls.
- Review UI lets the user remove or edit generated steps before saving.
- Save creates a normal workflow or replaces the current graph only through the
  explicit save draft command.
- Run executes the generated workflow through the existing graph compiler,
  command layer, run manager, and CloakBrowser runner.
- Record-to-replay E2E passes on a deterministic fixture and asserts the
  replayed task succeeds.
- Source-of-truth docs are updated for every behavior, command, contract,
  runner, persistence, and UI change.
- Every phase has focused tests, green verification commands, docs sync when
  needed, and a git commit before the next phase starts.
- Phase ledger is complete with phase statuses, evidence, commit hashes,
  remaining work, known gaps, and final completion audit.

If any item lacks evidence, the feature is not done.
