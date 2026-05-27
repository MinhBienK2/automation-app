# Browser Recorder Implementation Ledger

Spec: `docs/superpowers/specs/2026-05-27-browser-recorder-workflow-design.md`

Current phase: Phase 1 - Backend Recorder Session Lifecycle

This ledger is the continuity record for the browser recorder implementation.
Each phase must be completed with focused evidence and a commit before the next
phase starts.

## Phase Ledger

| Phase | Goal | Status | Changed files | Evidence / checks | Docs updated | Commit | Next action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | Implementation ledger and skeleton spec sync | complete | `docs/superpowers/plans/browser-recorder-implementation-ledger.md` | `git diff --check` | Ledger created; no source-of-truth behavior docs changed | pending | Commit Phase 0 |
| 1 | Backend recorder session lifecycle | in_progress | pending | pending | pending | pending | Add failing IPC/session tests first |
| 2 | Browser event capture MVP | pending | pending | pending | pending | pending | Start after Phase 1 commit |
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
| Backend recording session commands exist and are typed through the bridge. | pending | pending |
| Renderer code does not import Node, Electron, Playwright, CloakBrowser, filesystem, or SQLite APIs. | pending | pending |
| Browser launch is backend-owned and uses the saved settings snapshot for `replace_current_graph` or the recorder settings draft for `new_workflow`. | pending | pending |
| New-workflow save persists the same Workflow Settings and browser identity snapshot used by the recording browser. | pending | pending |
| Legacy prototype recorder bridge methods are removed or clearly separated from the new backend-owned session contract. | pending | pending |
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
| Source-of-truth docs are updated for every behavior, command, contract, runner, persistence, and UI change. | pending | pending |
| Every phase has focused tests, green verification commands, docs sync when needed, and a git commit before the next phase starts. | pending | pending |
| Phase ledger is complete with phase statuses, evidence, commit hashes, remaining work, known gaps, and final completion audit. | pending | pending |

## Known Gaps

| Gap | State | Notes |
| --- | --- | --- |
| Recorder implementation not started. | scheduled | Phase 1 starts after this ledger commit. |

## Final Completion Audit

Pending. Phase 8 must map every requirement above to concrete source files,
test output, docs updates, and commit hashes before the feature is considered
complete.
