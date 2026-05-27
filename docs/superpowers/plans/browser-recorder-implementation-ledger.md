# Browser Recorder Implementation Ledger

Spec: `docs/superpowers/specs/2026-05-27-browser-recorder-workflow-design.md`

Current phase: Phase 2 - Browser Event Capture MVP

This ledger is the continuity record for the browser recorder implementation.
Each phase must be completed with focused evidence and a commit before the next
phase starts.

## Phase Ledger

| Phase | Goal | Status | Changed files | Evidence / checks | Docs updated | Commit | Next action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | Implementation ledger and skeleton spec sync | complete | `docs/superpowers/plans/browser-recorder-implementation-ledger.md` | `git diff --check` | Ledger created; no source-of-truth behavior docs changed | `ef29df9` | Phase 1 started |
| 1 | Backend recorder session lifecycle | complete | `src/types/workflow.ts`, `src/types/electron.ts`, `src/lib/workflowApi.ts`, `src/lib/workflowApi.test.ts`, `src/tests/mocks/electron.ts`, `electron/ipc.ts`, `electron/preload.cts`, `electron/backend/commands.ts`, `electron/backend/commands.test.ts`, `electron/backend/recording/recorderSessionManager.ts`, source-of-truth docs | `npm test -- src/lib/workflowApi.test.ts`; `npm test -- electron/backend/commands.test.ts`; `npm run build:electron`; `npx tsc --noEmit`; `git diff --check` | `docs/domain/product-model.md`, `docs/architecture/overview.md`, `docs/architecture/command-boundary.md`, `docs/contracts/electron-ipc.md`, `docs/contracts/workflow-types.md`, `docs/task-routes.md` | pending backfill | Start Phase 2 with failing capture tests |
| 2 | Browser event capture MVP | in_progress | pending | pending | pending | pending | Add failing event-capture tests first |
| 3 | Locator generation and timeline normalization | pending | pending | pending | pending | pending | Start after Phase 2 commit |
| 4 | Workflow graph generation | pending | pending | pending | pending | pending | Start after Phase 3 commit |
| 5 | Recorder review UI and save flow | pending | pending | pending | pending | pending | Start after Phase 4 commit |
| 6 | Record-to-replay stability E2E | pending | pending | pending | pending | pending | Start after Phase 5 commit |
| 7 | Complete action coverage expansion | pending | pending | pending | pending | pending | Start after Phase 6 commit |
| 8 | Final hardening and completion audit | pending | pending | pending | pending | pending | Start after Phase 7 commit |

## Completion Checklist

| Requirement | Evidence | Status |
| --- | --- | --- |
| Recorder UI entry point exists in the workflow product UI. | pending | pending |
| Backend recording session commands exist and are typed through the bridge. | `startRecordingSession`, `getRecordingSession`, `stopRecordingSession`, `listRecordingEvents`, and `discardRecordingSession` added in `src/types/electron.ts`, `src/lib/workflowApi.ts`, `electron/ipc.ts`, `electron/preload.cts`, and `electron/backend/commands.ts`; covered by `src/lib/workflowApi.test.ts` and `electron/backend/commands.test.ts`. | complete |
| Renderer code does not import Node, Electron, Playwright, CloakBrowser, filesystem, or SQLite APIs. | pending | pending |
| Browser launch is backend-owned and uses the saved settings snapshot for `replace_current_graph` or the recorder settings draft for `new_workflow`. | Phase 1 creates backend-owned session/settings snapshots in `electron/backend/recording/recorderSessionManager.ts`; actual browser launch is still pending Phase 2. | partial |
| New-workflow save persists the same Workflow Settings and browser identity snapshot used by the recording browser. | pending | pending |
| Legacy prototype recorder bridge methods are removed or clearly separated from the new backend-owned session contract. | `suggestSelectors`, `normalizeRecordedEvents`, `ElementSnapshot`, `SelectorCandidate`, and `RecordedEvent` removed from production bridge/types/commands; docs updated in `docs/contracts/electron-ipc.md`. | complete |
| The user can navigate to a target page and perform a realistic linear task. | pending | pending |
| Event capture works for navigation, click, text entry, select, checkbox/radio, and scroll in the stable MVP. | pending | pending |
| Complete action coverage captures or warns for keyboard, wait, tab, download, upload, and screenshot-relevant behavior according to the current action contract. | pending | pending |
| Native OS file chooser activity remains a warning unless an explicit reviewed upload file path can replay locally. | pending | pending |
| Normalization collapses noisy low-level events into a small deterministic timeline. | pending | pending |
| Locator generation stores ordered structured candidates and marks weak locators with review warnings. | pending | pending |
| Graph generation creates a valid v2 `WorkflowGraph` with `Start`, generated action nodes, links, optional waits, and terminal success. | pending | pending |
| Draft generation does not persist workflows or graph replacements before review. | pending | pending |
| Review UI displays generated steps, warnings, captured values, locator confidence, and save controls. | pending | pending |
| Review UI lets the user remove or edit generated steps before saving. | pending | pending |
| Save creates a normal workflow or replaces the current graph only through the explicit save draft command. | pending | pending |
| Run executes the generated workflow through the existing graph compiler, command layer, run manager, and CloakBrowser runner. | pending | pending |
| Record-to-replay E2E passes on a deterministic fixture and asserts the replayed task succeeds. | pending | pending |
| Source-of-truth docs are updated for every behavior, command, contract, runner, persistence, and UI change. | Phase 1 docs updated for product model, command boundary, IPC contract, workflow types, overview, and task routing. Later phases still pending. | partial |
| Every phase has focused tests, green verification commands, docs sync when needed, and a git commit before the next phase starts. | Phase 0 committed as `ef29df9`; Phase 1 checks are green and commit is pending. Later phases pending. | partial |
| Phase ledger is complete with phase statuses, evidence, commit hashes, remaining work, known gaps, and final completion audit. | pending | pending |

## Known Gaps

| Gap | State | Notes |
| --- | --- | --- |
| Browser event capture is not implemented. | scheduled | Phase 2 starts after the Phase 1 commit. |
| Graph draft generation and save flow are not implemented. | scheduled | Phases 4 and 5. |
| Record-to-replay E2E is not implemented. | scheduled | Phase 6. |

## Final Completion Audit

Pending. Phase 8 must map every requirement above to concrete source files,
test output, docs updates, and commit hashes before the feature is considered
complete.
