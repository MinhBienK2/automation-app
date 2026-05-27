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
- Auditability by design: full governance can be phased after stable replay, but
  the data model and extension points must not block later allowlists, test
  account binding, evidence, or approval gates.

## Non-Goals For The First Stable MVP

The first stable MVP does not need to support:

- Control flow inference such as loops, branches, retries, or try/catch.
- AI self-healing locators.
- Automatic CAPTCHA, challenge, or anti-abuse friction solving.
- Pixel-perfect replay of every mouse move.
- Multi-user collaborative recording.
- Recording arbitrary browser extensions.
- Recording unsupported native OS dialogs.
- Full governance UI for domain allowlists, test accounts, evidence review, and
  operator approval.

Those capabilities remain part of the complete product roadmap where noted
below.

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
3. The backend opens a headed browser using selected Workflow Settings or a
   recorder default identity.
4. The operator enters a URL in the recorder browser and completes the task.
5. The app shows recording state, elapsed time, event count, and Stop
   Recording.
6. The operator stops recording.
7. The app displays a review draft with generated steps, labels, warnings,
   captured values, and locator confidence.
8. The operator removes noise or edits obvious labels/config values.
9. The operator saves the draft as a new workflow or replaces the current
   workflow graph, depending on the entry point.
10. The operator presses Run on the saved workflow.
11. The workflow executes through the normal saved graph run path.

The review step is required for MVP. Auto-saving a generated workflow without
review is a later option only after replay confidence is high.

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
- Browser context/page launch and cleanup.
- Page instrumentation.
- Browser lifecycle observation.
- Event stream storage in memory or temporary persisted draft form.
- Locator candidate generation.
- Event normalization and action synthesis.
- Graph generation.
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
generateWorkflowFromRecording(sessionId, options)
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

`generateWorkflowFromRecording` options:

```text
{
  workflow_name: string,
  save_mode: "create_new" | "replace_graph",
  include_reviewed_events: string[],
  edited_steps?: ReviewedRecordedStep[],
  add_terminal_success: boolean
}
```

Command errors continue to serialize as `{ message, field? }`.

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
  page_url?: string | null,
  event_count: number,
  warnings: RecordingWarning[]
}
```

### RecordedEvent

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
  target: RecordedTarget | null,
  value: RecordedValue | null,
  raw: bounded sanitized diagnostic payload,
  confidence: "high" | "medium" | "low",
  warnings: RecordingWarning[]
}
```

### RecordedTarget

```text
{
  tag_name: string,
  input_type?: string | null,
  text_sample?: string | null,
  role?: string | null,
  accessible_name?: string | null,
  iframe?: RecordedTarget | null,
  locators: LocatorCandidate[],
  bounding_box?: { x: number, y: number, width: number, height: number } | null
}
```

### LocatorCandidate

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

### RecordingWarning

```text
{
  code: string,
  message: string,
  event_id?: string | null,
  severity: "info" | "warning" | "error"
}
```

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

Event capture must sanitize and bound raw payloads. It should not store
unbounded DOM snapshots, full page HTML, cookies, localStorage, sessionStorage,
password values, or secrets from protected input fields.

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
| File chooser | `upload_file` only if local file path policy is designed and reviewed |
| Download | `wait_for_download` when the action contract can represent it |
| Dialog accept/dismiss | `accept_dialog` or `dismiss_dialog` |
| Meaningful pause | `wait` or `random_wait` only after normalization |

Unsupported captured behaviors should become review warnings, not silent graph
nodes.

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
- Mark password or secret-like fields as redacted and require review before
  saving a value.
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

## Sensitive Values

Recorder must treat sensitive values conservatively.

MVP behavior:

- Do not store values from `input[type=password]`.
- Warn on field names, labels, placeholders, or autocomplete attributes that
  suggest password, token, secret, API key, OTP, or credential material.
- Allow the generated input action to exist with a placeholder variable value
  instead of the captured secret.
- Make the warning visible in review.

Complete behavior:

- Support operator-managed variables for secrets.
- Support test account binding metadata.
- Support evidence redaction for recorded values.

## Safety And Governance Phasing

The user preference is to make stable record/replay work first, then add the
full governance layer. This spec follows that preference while preserving the
extension points.

MVP minimum:

- The recorder uses backend-owned browser launch and normal command errors.
- The generated workflow is a review draft before save.
- Secret-like values are redacted or warned.
- Unsupported events become warnings instead of hidden actions.

Complete feature:

- Domain allowlist can be inferred from initial navigation and edited before
  save.
- Test account metadata can be attached to a recording.
- Recording evidence is captured and redacted in the same evidence model as
  runs.
- Operator approval can be required before a recording draft becomes runnable.
- Generated workflows can include a `domain_allowlist` node when governance is
  enabled.

The complete governance layer must not be implemented by adding renderer-only
checks. Backend validation and saved graph/settings contracts must enforce any
blocking policy.

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

MVP can keep active recording sessions in backend memory because a stopped
recording is a draft that has not been saved as a workflow.

Persistent draft support should be added when review needs to survive app
restart or long-running interruption. If added, persisted drafts should use a
new backend-owned table such as:

```text
recording_drafts
  id TEXT PRIMARY KEY
  workflow_id TEXT
  status TEXT NOT NULL
  events_json TEXT NOT NULL
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
- Add IPC command plumbing.
- Add focused command and API wrapper tests.
- Update docs for command boundary and product model.

Checks:

- `npm test -- src/lib/workflowApi.test.ts`
- `npm test -- electron/backend/commands.test.ts`
- `npm run build:electron`
- `npx tsc --noEmit`

Exit criteria:

- Start/stop/discard commands work against fake backend browser ownership.
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
- Sanitize secret-like values.
- Add backend tests with a fake page adapter where possible.

Checks:

- Focused recording tests.
- `npm run build:electron`
- `npm run test:e2e:smoke` only if the phase includes real Electron browser
  interaction.

Exit criteria:

- Recorded event stream is deterministic enough for normalization.
- Unsupported or secret-like events produce warnings.
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

Goal: normalized steps become a valid workflow graph draft.

Work:

- Generate graph nodes and edges.
- Add terminal success.
- Position nodes deterministically.
- Run backend graph validation before save.
- Add graph generator tests.
- Add docs for workflow type/graph behavior.

Checks:

- `npm test -- electron/backend/recording/graphGenerator.test.ts`
- `npm test -- electron/backend/graph/validateGraph.test.ts electron/backend/graph/compiler.test.ts`
- `npm run build:electron`

Exit criteria:

- Generated graph compiles through existing backend graph code.
- Generated action configs are existing supported action types.
- Commit created.

### Phase 5: Recorder Review UI And Save Flow

Goal: user can start recording, stop, review generated steps, and save as a
workflow.

Work:

- Add UI entry point.
- Add recording status surface.
- Add review list with warnings and step removal.
- Add save-as-new-workflow path.
- Keep renderer free of direct browser APIs.
- Read and follow `DESIGN.md` if layout or user-facing styling changes.
- Update frontend architecture and user-visible invariants docs.

Checks:

- Focused workflow page/component tests.
- `npm test -- src/lib/workflowApi.test.ts`
- `npx tsc --noEmit`

Exit criteria:

- User-visible flow can create a saved workflow draft from recorded data.
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
- Add upload support only with explicit local file policy.
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

### Phase 8: Governance, Evidence, And Approval

Goal: complete the governance layer after stable replay is proven.

Work:

- Add domain allowlist inference and edit/review support.
- Add optional generated `domain_allowlist` node.
- Add test account metadata to recording sessions or workflow settings.
- Add recording evidence summary with redaction.
- Add operator approval before a generated workflow becomes runnable when
  governance mode is enabled.
- Add backend validation for blocking policies.
- Update docs for product model, invariants, execution semantics, command
  boundary, workflow types, run-state/evidence if changed, and README smoke.

Checks:

- Focused backend validation tests.
- UI approval flow tests.
- Runner/domain allowlist tests.
- E2E governance fixture.

Exit criteria:

- Full scope controls exist and are enforced by backend contracts.
- Commit created.

### Phase 9: Final Hardening And Completion Audit

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
| Secret values are captured | Password/secret detection, redaction, warnings, and later variable support. |
| Feature grows too large before stability | Phase gates and commit-after-test rule. |
| Agents forget remaining work | Source-controlled implementation ledger and final prompt-to-artifact audit. |
| Governance deferred too long | Extension points in data model and explicit Phase 8 completion gate. |

## Open Product Choices Fixed By This Spec

- The first saved output is a normal workflow graph, not a separate macro file.
- The first implementation prioritizes new workflow creation over replacing an
  existing graph.
- Review before save is required.
- Full governance is phased after stable replay but remains part of complete
  Done.
- Coordinate-only replay is not a primary strategy.
- The implementation must be phase-based with a commit after each tested phase.

## Final Completion Checklist

The final implementation audit must map each checklist item to concrete
evidence:

- Recorder UI entry point exists.
- Backend recording session commands exist and are typed through the bridge.
- Browser launch is backend-owned.
- Event capture works for MVP actions.
- Normalization collapses noisy events.
- Locator generation stores ordered candidates and warnings.
- Graph generation creates a valid v2 graph.
- Review UI displays generated steps and warnings.
- Save creates a normal workflow.
- Run executes the generated workflow through the existing runner path.
- Record-to-replay E2E passes on a deterministic fixture.
- Source-of-truth docs are updated.
- Phase ledger is complete with commit hashes and checks.
- Governance Phase 8 is complete for the final product, or the ledger clearly
  says the shipped scope is an MVP and final product remains incomplete.

If any item lacks evidence, the feature is not done.
