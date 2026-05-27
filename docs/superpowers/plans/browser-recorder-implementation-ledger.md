# Browser Recorder Implementation Ledger

Spec: `docs/superpowers/specs/2026-05-27-browser-recorder-workflow-design.md`

Current phase: Phase 6 - Record-to-Replay Stability E2E

This ledger is the continuity record for the browser recorder implementation.
Each phase must be completed with focused evidence and a commit before the next
phase starts.

## Phase Ledger

| Phase | Goal | Status | Changed files | Evidence / checks | Docs updated | Commit | Next action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | Implementation ledger and skeleton spec sync | complete | `docs/superpowers/plans/browser-recorder-implementation-ledger.md` | `git diff --check` | Ledger created; no source-of-truth behavior docs changed | `ef29df9` | Phase 1 started |
| 1 | Backend recorder session lifecycle | complete | `src/types/workflow.ts`, `src/types/electron.ts`, `src/lib/workflowApi.ts`, `src/lib/workflowApi.test.ts`, `src/tests/mocks/electron.ts`, `electron/ipc.ts`, `electron/preload.cts`, `electron/backend/commands.ts`, `electron/backend/commands.test.ts`, `electron/backend/recording/recorderSessionManager.ts`, source-of-truth docs | `npm test -- src/lib/workflowApi.test.ts`; `npm test -- electron/backend/commands.test.ts`; `npm run build:electron`; `npx tsc --noEmit`; `git diff --check` | `docs/domain/product-model.md`, `docs/architecture/overview.md`, `docs/architecture/command-boundary.md`, `docs/contracts/electron-ipc.md`, `docs/contracts/workflow-types.md`, `docs/task-routes.md` | `0f8f708` | Phase 2 started |
| 2 | Browser event capture MVP | complete | `electron/backend/recording/eventCollector.ts`, `electron/backend/recording/eventCollector.test.ts`, `electron/backend/recording/recorderSessionManager.ts`, `electron/backend/browser/sessionManager.ts`, `electron/backend/commands.ts`, `electron/backend/commands.test.ts`, source-of-truth docs | `npm test -- electron/backend/recording/eventCollector.test.ts`; `npm test -- electron/backend/commands.test.ts`; `npm test -- src/lib/workflowApi.test.ts`; `npm run build:electron`; `npx tsc --noEmit` | `docs/domain/product-model.md`, `docs/architecture/overview.md`, `docs/architecture/command-boundary.md`, `docs/architecture/runner.md`, `docs/contracts/electron-ipc.md`, `docs/contracts/workflow-types.md` | `69cfed6` | Phase 3 started |
| 3 | Locator generation and timeline normalization | complete | `src/types/workflow.ts`, `electron/backend/recording/locatorGenerator.ts`, `electron/backend/recording/locatorGenerator.test.ts`, `electron/backend/recording/timelineNormalizer.ts`, `electron/backend/recording/timelineNormalizer.test.ts`, `electron/backend/recording/eventCollector.ts`, source-of-truth docs | `npm test -- electron/backend/recording/locatorGenerator.test.ts`; `npm test -- electron/backend/recording/timelineNormalizer.test.ts`; `npm test -- electron/backend/recording/eventCollector.test.ts`; `npm test -- electron/backend/commands.test.ts`; `npm run build:electron`; `npx tsc --noEmit` | `docs/domain/product-model.md`, `docs/architecture/overview.md`, `docs/contracts/workflow-types.md` | `f4e091b` | Phase 4 started |
| 4 | Workflow graph generation | complete | `src/types/workflow.ts`, `src/types/electron.ts`, `src/lib/workflowApi.ts`, `src/lib/workflowApi.test.ts`, `src/tests/mocks/electron.ts`, `electron/ipc.ts`, `electron/preload.cts`, `electron/backend/commands.ts`, `electron/backend/commands.test.ts`, `electron/backend/recording/graphGenerator.ts`, `electron/backend/recording/graphGenerator.test.ts`, source-of-truth docs | `npm test -- electron/backend/recording/graphGenerator.test.ts`; `npm test -- src/lib/workflowApi.test.ts`; `npm test -- electron/backend/commands.test.ts`; `npm test -- electron/backend/graph/validateGraph.test.ts electron/backend/graph/compiler.test.ts`; `npm run build:electron`; `npx tsc --noEmit` | `docs/domain/product-model.md`, `docs/architecture/overview.md`, `docs/architecture/command-boundary.md`, `docs/contracts/electron-ipc.md`, `docs/contracts/workflow-types.md` | `01e976d` | Phase 5 started |
| 5 | Recorder review UI and save flow | complete | `src/types/workflow.ts`, `src/types/electron.ts`, `src/lib/workflowApi.ts`, `src/lib/workflowApi.test.ts`, `src/tests/mocks/electron.ts`, `src/tests/mocks/workflowScenarios.ts`, `electron/ipc.ts`, `electron/preload.cts`, `electron/backend/commands.ts`, `electron/backend/commands.test.ts`, `src/App.tsx`, `src/features/workflows/pages/WorkflowListPage.tsx`, `src/features/workflows/pages/WorkflowListPage.test.tsx`, `src/features/workflows/components/RecordingReviewDialog.tsx`, `src/styles/modals.css`, source-of-truth docs, `README.md` | `npm test -- src/lib/workflowApi.test.ts electron/backend/commands.test.ts src/features/workflows/pages/WorkflowListPage.test.tsx`; `npm run build:electron`; `npx tsc --noEmit`; `git diff --check` | `docs/domain/product-model.md`, `docs/architecture/overview.md`, `docs/architecture/frontend.md`, `docs/architecture/command-boundary.md`, `docs/contracts/electron-ipc.md`, `docs/contracts/workflow-types.md`, `README.md` | pending | Start Phase 6 record-to-replay E2E |
| 6 | Record-to-replay stability E2E | pending | pending | pending | pending | pending | Start after Phase 5 commit |
| 7 | Complete action coverage expansion | pending | pending | pending | pending | pending | Start after Phase 6 commit |
| 8 | Final hardening and completion audit | pending | pending | pending | pending | pending | Start after Phase 7 commit |

## Completion Checklist

| Requirement | Evidence | Status |
| --- | --- | --- |
| Recorder UI entry point exists in the workflow product UI. | `WorkflowListPage.tsx` exposes `Record Workflow` and `WorkflowListPage.test.tsx` starts a recorder from the list through `startRecordingSession`. | complete |
| Backend recording session commands exist and are typed through the bridge. | `startRecordingSession`, `getRecordingSession`, `stopRecordingSession`, `listRecordingEvents`, and `discardRecordingSession` added in `src/types/electron.ts`, `src/lib/workflowApi.ts`, `electron/ipc.ts`, `electron/preload.cts`, and `electron/backend/commands.ts`; covered by `src/lib/workflowApi.test.ts` and `electron/backend/commands.test.ts`. | complete |
| Renderer code does not import Node, Electron, Playwright, CloakBrowser, filesystem, or SQLite APIs. | pending | pending |
| Browser launch is backend-owned and uses the saved settings snapshot for `replace_current_graph` or the recorder settings draft for `new_workflow`. | `RecorderSessionManager` launches through `BrowserSessionManager` with the session's settings snapshot; command tests use a fake backend driver to verify launch and cleanup. | complete |
| New-workflow save persists the same Workflow Settings and browser identity snapshot used by the recording browser. | `saveRecordingDraft` uses the recorder session manager's internal settings snapshot for create-new saves; `commands.test.ts` verifies saved Workflow Settings keep the draft browser identity. | complete |
| Legacy prototype recorder bridge methods are removed or clearly separated from the new backend-owned session contract. | `suggestSelectors`, `normalizeRecordedEvents`, `ElementSnapshot`, `SelectorCandidate`, and `RecordedEvent` removed from production bridge/types/commands; docs updated in `docs/contracts/electron-ipc.md`. | complete |
| The user can navigate to a target page and perform a realistic linear task. | Backend can optionally navigate to `initial_url` and records navigation. Product UI and E2E proof are still pending. | partial |
| Event capture works for navigation, click, text entry, select, checkbox/radio, and scroll in the stable MVP. | `eventCollector.ts` injects page listeners for click, input, select, checkbox/radio, and throttled scroll and observes navigation; unit/command tests cover navigation, click, input, and select with fake page payloads. Checkbox/radio/scroll need explicit focused tests before final audit. | partial |
| Complete action coverage captures or warns for keyboard, wait, tab, download, upload, and screenshot-relevant behavior according to the current action contract. | pending | pending |
| Native OS file chooser activity remains a warning unless an explicit reviewed upload file path can replay locally. | pending | pending |
| Normalization collapses noisy low-level events into a small deterministic timeline. | `timelineNormalizer.ts` collapses repeated input/change events and maps raw navigation/click/input/select/checkbox/radio/scroll/basic keyboard events to `ReviewedRecordingStep` action configs; covered by `timelineNormalizer.test.ts`. | complete |
| Locator generation stores ordered structured candidates and marks weak locators with review warnings. | `locatorGenerator.ts` orders test id, role/name, label, placeholder, text, attribute, CSS, and XPath candidates and emits `weak_locator` warnings for low-confidence fallbacks; covered by `locatorGenerator.test.ts`. | complete |
| Graph generation creates a valid v2 `WorkflowGraph` with `Start`, generated action nodes, links, optional waits, and terminal success. | `graphGenerator.ts` creates deterministic left-to-right v2 graphs with optional End Success; `graphGenerator.test.ts` verifies backend validation and compilation. | complete |
| Draft generation does not persist workflows or graph replacements before review. | `generateRecordingDraft` stores an in-memory `RecordingWorkflowDraft`; `commands.test.ts` verifies no workflow rows are created during draft generation. | complete |
| Review UI displays generated steps, warnings, captured values, locator confidence, and save controls. | `RecordingReviewDialog.tsx` renders draft steps, warnings, captured value summaries, locator confidence, and Save Workflow/Discard controls; `WorkflowListPage.test.tsx` verifies captured value display and save. | complete |
| Review UI lets the user remove or edit generated steps before saving. | `RecordingReviewDialog.tsx` edits workflow name, step labels, inclusion flags, and supported action values; `WorkflowListPage.test.tsx` verifies label edit and excluding Navigate before save. | complete |
| Save creates a normal workflow or replaces the current graph only through the explicit save draft command. | `saveRecordingDraft` is added to the typed bridge/IPC/preload/backend and is the persistence path for drafts; `commands.test.ts` covers create-new and replace-graph saves. | complete |
| Run executes the generated workflow through the existing graph compiler, command layer, run manager, and CloakBrowser runner. | pending | pending |
| Record-to-replay E2E passes on a deterministic fixture and asserts the replayed task succeeds. | pending | pending |
| Source-of-truth docs are updated for every behavior, command, contract, runner, persistence, and UI change. | Phase 1 through 4 docs updated for product model, command boundary, IPC contract, workflow types, overview, task routing, and runner architecture. Later phases still pending. | partial |
| Every phase has focused tests, green verification commands, docs sync when needed, and a git commit before the next phase starts. | Phase 0 committed as `ef29df9`; Phase 1 committed as `0f8f708`; Phase 2 committed as `69cfed6`; Phase 3 committed as `f4e091b`; Phase 4 checks are green and commit is pending. Later phases pending. | partial |
| Phase ledger is complete with phase statuses, evidence, commit hashes, remaining work, known gaps, and final completion audit. | pending | pending |

## Known Gaps

| Gap | State | Notes |
| --- | --- | --- |
| Checkbox/radio/scroll capture needs explicit tests beyond script coverage. | scheduled | Add before final audit or in Phase 7 expansion if not covered earlier. |
| Record-to-replay E2E is not implemented. | scheduled | Phase 6. |

## Final Completion Audit

Pending. Phase 8 must map every requirement above to concrete source files,
test output, docs updates, and commit hashes before the feature is considered
complete.
