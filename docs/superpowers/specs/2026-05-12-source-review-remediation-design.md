# Source Review Remediation Design

Date: 2026-05-12

## Status

Draft from full-source review on 2026-05-12. This spec captures the
remediation work for the flow, logic, security, reliability, and maintainability
issues found across the Electron workflow UI, IPC boundary, command handlers,
SQLite persistence, graph compiler, and CloakBrowser runner.

## Summary

The app has a coherent graph-first architecture and a useful test base. The
main risk is not type safety; TypeScript and backend build checks pass. The
gaps are runtime-truth and safety gaps:

- workflows can navigate before any owned-domain guard runs;
- evidence screenshot paths can write outside the app evidence directory;
- several user-visible actions currently pass without performing the behavior
  their labels promise;
- batch execution is not owned by the same run lifecycle as normal workflow
  runs;
- import can leave orphan workflows after partial failure;
- evidence and smoke-test behavior are not reliable enough for audit use;
- high-churn files combine command orchestration, validation, runner dispatch,
  package import/export, and lifecycle concerns.

The remediation should be staged by risk. Security and truthful runtime
behavior should land first, followed by lifecycle consistency, evidence
integrity, import atomicity, Electron hardening, and targeted modularization.

## Goals

- Enforce authorized target scope before browser navigation or network-sensitive
  actions run.
- Constrain evidence writes to app-owned evidence directories.
- Make every action exposed in the primary UI either execute correctly or fail
  explicitly as unsupported.
- Put normal runs and batch runs under one lifecycle model for active-run
  ownership, stop/cancel behavior, progress state, and persistence.
- Make workflow package import atomic.
- Preserve evidence per run without overwriting previous artifacts.
- Harden the Electron renderer environment where compatible with preload needs.
- Reduce future defect risk by splitting large files along existing ownership
  boundaries.
- Keep docs and tests aligned with changed behavior.

## Non-Goals

- Do not redesign the UI visual style.
- Do not add new bypass capabilities or expand scope beyond owned or explicitly
  authorized targets.
- Do not implement parallel batch rows until browser/profile/session isolation
  is designed and tested.
- Do not rewrite the entire graph compiler or runner in one pass.
- Do not remove compatibility fields or legacy commands unless a workstream
  explicitly says they are inactive and safe to hide.

## Recommended Approach

Use staged remediation by blast radius.

Option A: patch each finding directly in the existing files. This is fastest,
but keeps `commands.ts` and `runner.ts` overloaded and makes future action
semantics harder to reason about.

Option B: large runtime rewrite. This could create cleaner boundaries, but it
would touch UI, IPC, persistence, compiler, runner, and tests in one risky pass.

Option C: staged remediation with small boundary extractions while fixing each
class of defect. This is recommended. It addresses the highest-risk behavior
first and only extracts modules where the extraction supports the fix being
made.

## Workstream 1: Run-Scope Domain Guard

### Problem

The current `domain_allowlist` action checks the page hostname only when that
node runs. A workflow can already navigate to a disallowed domain before the
allowlist node executes, or omit the node entirely. This conflicts with the
product requirement that sensitive automation remains bounded to owned or
explicitly authorized targets.

### Design

Introduce a run-scope domain policy resolved before runner execution.

- Add an active allowlist source in Workflow Settings, or promote existing
  `domain_allowlist` graph nodes into a preflight policy during compilation.
- Before any navigation-like action, enforce the resolved policy:
  - `navigate`
  - `open_new_tab`
  - future download navigation helpers
  - request mocking/routing patterns when they can affect external domains
- Check the rendered URL after template interpolation and before `page.goto`.
- Continue to support graph-level `domain_allowlist` as an in-flow assertion,
  but do not rely on it as the only scope guard.
- Treat empty policy as explicit operator choice only for non-sensitive local
  workflows. For sensitive run modes, require a policy before launch.
- Include blocked hostname, action type, node id, and allowed domains in the run
  error.

### Acceptance Criteria

- A workflow with a disallowed `navigate` URL fails before `page.goto`.
- `open_new_tab` enforces the same policy.
- Template-rendered URLs are checked after variable substitution.
- Existing `domain_allowlist` nodes still work as runtime assertions.
- Run issues identify the blocked node and hostname.

### Tests

- Runner test: allowed hostname proceeds.
- Runner test: disallowed hostname blocks before fake page records `goto`.
- Compiler/command test: policy is included in run plan when graph/settings
  declare it.
- UI run issue test: blocked hostname appears as a runtime issue.

## Workstream 2: Evidence Filesystem Boundary

### Problem

`take_screenshot` accepts an absolute path or `file:` URL and writes a screenshot
there. This creates an arbitrary file-write surface under the app process
account. Failure screenshots also use stable names and can overwrite evidence
from previous runs.

### Design

Create an evidence path resolver that always writes under app-owned evidence
roots.

- `take_screenshot.path` should be treated as a relative artifact name, not an
  arbitrary filesystem path.
- Reject:
  - absolute paths;
  - `file:` URLs;
  - parent traversal;
  - empty names when no generated artifact name is available;
  - names with platform path separators after sanitization.
- Store screenshots under a run-specific directory:

```text
evidence/
  runs/
    <run_id>/
      screenshots/
        <step_number>-<node_id>-<slug>.png
```

- Failure screenshots should use the same run directory and include node id or
  `workflow` plus timestamp/counter to avoid overwrite.
- Persist artifact paths in outputs as app-local evidence paths. Package export
  should sanitize machine-local paths by default.

### Acceptance Criteria

- `take_screenshot` cannot write outside `appPaths.screenshotsDir` or the new
  run evidence directory.
- Absolute and `file:` paths fail with a field-addressable validation error.
- Two failed runs for the same node produce two distinct screenshot files.
- Saved run outputs reference the generated evidence path.

### Tests

- Runner test for rejected absolute path.
- Runner test for rejected `../` traversal.
- Runner test for generated run-scoped screenshot path.
- Command persistence test for evidence output retention.

## Workstream 3: Runtime Truth For Exposed Actions

### Problem

Several actions are visible in the main action palette or graph palettes but the
runner currently no-ops, stubs, or approximates them while reporting success.
This makes run evidence untrustworthy.

### Action Semantics To Fix

| Action | Current issue | Required behavior |
| --- | --- | --- |
| `drag_and_drop` | Hovers source and target only | Use Playwright drag/drop or mouse down/move/up. Fail if unsupported. |
| `switch_frame` | No-op | Resolve a frame locator and route subsequent element actions through it, or mark unsupported. |
| `accept_dialog` / `dismiss_dialog` | No-op | Register dialog handler and apply prompt text when provided. |
| `set_download_directory` | Writes output only | Either update effective download path before downloads or mark as unsupported after launch. |
| `wait_for_download` | Returns default downloads dir only | Wait for Playwright download event and store saved path. |
| `run_subworkflow` | Writes `last_subworkflow_id` only | Execute the referenced compiled workflow with mappings, or fail unsupported until recursion and lifecycle are designed. |
| `pause_for_human` | Returns immediately | Pause with timeout/cancellation and expose waiting state, or fail unsupported. |
| `checkpoint` | Returns immediately | Capture configured checkpoint evidence, or hide/fail unsupported. |
| `use_profile`, `save_session`, `load_session`, `set_secret`, `use_proxy`, `set_user_agent` | Output stubs | Apply at a valid lifecycle point or fail clearly because these are launch-time settings. |

### Design

Add an action capability contract:

- Each action type is one of:
  - `implemented`;
  - `launch_time_only`;
  - `planned_hidden`;
  - `unsupported_visible_error`.
- Main palettes must not expose actions classified as `planned_hidden`.
- Runner must throw explicit unsupported errors for visible actions that cannot
  be executed correctly.
- Optional method calls such as `locator.type?.()` or `setInputFiles?.()` must
  fail if the method is required for the selected action and absent from the
  driver.
- Tests should assert both successful behavior and unsupported fallback errors.

### Acceptance Criteria

- No primary-palette action can return success without performing its promised
  behavior or throwing an explicit unsupported error.
- Hidden/planned actions remain loadable for compatibility but are not promoted
  as active user choices.
- Run traces identify unsupported actions as failed with clear reasons.

### Tests

- Runner tests for `drag_and_drop`, dialogs, downloads, and unsupported method
  failures.
- Palette tests that planned-hidden actions are not shown in primary pickers.
- Graph compiler tests for `run_subworkflow` behavior or explicit unsupported
  compile/runtime error.

## Workstream 4: Unified Run Lifecycle For Batch

### Problem

Normal `runWorkflow` has active-run ownership, cancellation, progress state, and
run persistence. `runBatchWorkflow` runs rows sequentially but does not use
`currentRunAbortController`, does not update `currentRunState`, and cannot be
stopped by `stopRun`.

### Design

Introduce a shared run lifecycle controller used by both normal and batch runs.

- One active top-level execution may exist at a time.
- `runWorkflow` and `runBatchWorkflow` both acquire the lifecycle lock.
- `stopRun` aborts whichever top-level execution is active.
- Batch state should expose:
  - mode `run_workflow` or a new `run_batch_workflow` if the contract is
    updated;
  - current row index;
  - current node id and step number within that row;
  - succeeded/failed row counts in outputs or a typed batch state extension.
- Batch rows remain sequential until isolation supports concurrency above 1.
- `batch_stop_on_first_failed_row` remains honored.
- Each row persists a separate run row, and the batch summary should make clear
  whether unexecuted rows were skipped due to stop-on-first-failed-row or manual
  stop.

### Acceptance Criteria

- Starting batch while a normal run is active fails.
- Starting normal run while batch is active fails.
- `stopRun` stops an active batch before the next row and returns stopped state.
- UI polling sees batch progress instead of idle state.
- Persisted rows accurately reflect success, failure, stopped, and skipped
  outcomes.

### Tests

- Command tests for active-run exclusion across normal and batch.
- Command test for `stopRun` aborting batch between rows.
- Command test for batch progress state.
- Runner/command test for stopped batch persistence.

## Workstream 5: Atomic Workflow Package Import

### Problem

Package import creates a workflow before saving imported flow/settings. If later
validation fails, the command can leave a new partial workflow behind.

### Design

Make package import transactional.

- Validate package shape and selected sections before creating a workflow.
- Validate selected settings against defaults merged for the new workflow name.
- Validate imported flow shape and compile-blocking errors if the import option
  requires runnable flow. Draft graphs may remain importable if explicitly
  allowed.
- Use a SQLite transaction for create workflow, save graph, and save settings.
- Roll back on any error.

### Acceptance Criteria

- Invalid package settings do not create a workflow row.
- Invalid flow import does not create a workflow row unless draft import is
  explicitly allowed and documented.
- Successful import behavior is unchanged: imports always create a new workflow
  and never overwrite existing workflows.

### Tests

- Command test for invalid package leaving workflow count unchanged.
- Command test for settings validation rollback.
- Command test for successful selected-section import.

## Workstream 6: Electron Renderer Hardening

### Problem

The BrowserWindow uses `contextIsolation: true` and `nodeIntegration: false`,
but `sandbox` is disabled. The bridge is narrow, so sandboxing should be
evaluated and enabled if compatible.

### Design

- Enable `webPreferences.sandbox: true` if the preload can still expose the
  existing bridge.
- Keep renderer code free of direct Node/Electron imports.
- Keep IPC channel surface typed and narrow.
- Add a small main/preload test that asserts sandbox remains enabled.
- If sandbox cannot be enabled due to a specific CloakBrowser/Electron
  limitation, document the blocker in `docs/architecture/command-boundary.md`
  and add a regression test that preserves the safer available settings.

### Acceptance Criteria

- Renderer sandbox is enabled in production windows, or a documented blocker
  explains why it cannot be enabled yet.
- Existing IPC bridge tests still pass.
- No renderer code imports Node/Electron APIs.

### Tests

- `electron/main.test.ts` source invariant for sandbox.
- `src/lib/workflowApi.test.ts`
- `npm run build:electron`

## Workstream 7: Evidence And Output Integrity

### Problem

Run outputs are useful for audit, but evidence paths and failure artifacts are
not yet consistently tied to run ids. Some output stubs can also claim evidence
that was never collected.

### Design

- Add run id to runner request so the runner can write run-scoped artifacts.
- Store artifact metadata with:
  - run id;
  - node id;
  - step number;
  - action type;
  - relative evidence path;
  - timestamp;
  - artifact kind.
- Keep compact paths in `outputs` for compatibility, but prefer structured
  evidence entries under a reserved output key such as `__evidence`.
- Export should sanitize local absolute paths.

### Acceptance Criteria

- Every generated screenshot/download/checkpoint artifact is traceable to a run
  and step.
- No evidence artifact from a later run overwrites an earlier run.
- Outputs do not claim downloads/checkpoints that did not occur.

### Tests

- Runner test for `__evidence` entry after screenshot.
- Command persistence test for evidence metadata in `outputs_json`.
- Export sanitization test for local evidence paths.

## Workstream 8: Test Reliability For CloakBrowser Smoke

### Problem

The full test suite can fail on a fresh machine because the CloakBrowser smoke
test downloads Chromium during a 60 second test timeout. After the browser is
cached, the same test passes.

### Design

Choose one deterministic CI strategy:

- Preinstall CloakBrowser Chromium before running smoke tests.
- Or mark the smoke test behind an environment flag and keep unit tests as the
  default `npm test` path.
- Or increase the smoke timeout and separate smoke from normal unit tests.

Recommended path:

- Keep `npm test` deterministic and fast.
- Move real CloakBrowser smoke to an explicit command, for example
  `npm run test:smoke`.
- Document first-run browser download behavior in README.

### Acceptance Criteria

- `npm test` passes on a fresh machine without relying on a 206 MB download.
- A separate smoke command verifies real CloakBrowser launch.
- README smoke checklist names the command and notes first-run setup.

### Tests And Checks

- `npm test`
- `npm run test:smoke`
- `npm run build:electron`

## Workstream 9: Targeted Module Boundaries

### Problem

Large files now hold several unrelated reasons to change:

- `electron/backend/commands.ts`: command handlers, settings validation,
  run lifecycle, package import/export, run persistence helpers.
- `electron/backend/runner.ts`: driver types, launch option mapping, action
  dispatch, control-flow execution, evidence writing, template/output helpers.
- `electron/backend/graphCompiler.ts`: graph validation, compilation, settings
  prelude, execution defaults, helper schemas.
- `src/App.tsx`: app routing, workflow CRUD, package import/export dialogs,
  graph save/autosave, settings save, run polling.

### Design

Split only along boundaries touched by remediation work.

Suggested backend modules:

- `electron/backend/runLifecycle.ts`: active execution lock, abort controller,
  timeout handling, stop behavior.
- `electron/backend/runPersistence.ts`: `beginRun`, `finishRun`, run step rows,
  evidence metadata persistence.
- `electron/backend/packageService.ts`: package validation, sanitization,
  import/export, transaction handling.
- `electron/backend/settingsValidation.ts`: settings validation and defaults.
- `electron/backend/runner/actions/*`: action groups such as navigation,
  element interaction, downloads, storage, browser context, variables/control
  flow.
- `electron/backend/runner/evidence.ts`: safe artifact path resolution and
  evidence records.

Suggested frontend modules:

- `src/features/workflows/hooks/useWorkflowDetailState.ts`
- `src/features/workflows/hooks/useGraphPersistence.ts`
- `src/features/workflows/hooks/useWorkflowRunPolling.ts`
- `src/features/workflows/components/WorkflowPackageDialogs.tsx`

### Acceptance Criteria

- Public IPC command behavior remains unchanged except for fixes described in
  this spec.
- Extracted modules have focused tests or retain existing coverage through
  command/runner tests.
- Imports remain acyclic and ownership is reflected in docs task routes when
  file ownership changes.

### Tests

- Existing command and runner tests.
- `npx tsc --noEmit`
- `npm run build:electron`
- Focused frontend tests for moved UI state where applicable.

## Workstream 10: Import And File Size Guardrails

### Problem

The workflow package import UI reads the whole selected file into memory before
parsing JSON. There is no size guard.

### Design

- Add a package size limit before `file.text()`.
- Recommended initial limit: 5 MB, unless product workflows prove they need
  more.
- Show a command-style user error when the file is too large.
- Keep backend package validation authoritative.

### Acceptance Criteria

- Oversized package files are rejected before JSON parse.
- Normal package import behavior is unchanged.

### Tests

- Workflow list/page test for oversized package rejection.
- Package preview command tests remain unchanged.

## Workstream 11: Documentation Alignment

### Docs To Update During Implementation

Update these docs only when the corresponding implementation slice changes
current behavior:

- `docs/domain/product-model.md`
- `docs/domain/user-visible-invariants.md`
- `docs/domain/execution-semantics.md`
- `docs/domain/action-taxonomy.md`
- `docs/domain/cross-feature-impact-map.md`
- `docs/architecture/command-boundary.md`
- `docs/architecture/runner.md`
- `docs/architecture/persistence.md`
- `docs/architecture/testing.md`
- `docs/contracts/action-configs.md`
- `docs/contracts/electron-ipc.md`
- `docs/contracts/run-state.md`
- `docs/contracts/workflow-types.md`
- `docs/task-routes.md`
- `README.md` smoke checklist

## Implementation Order

1. Evidence filesystem boundary and run-scoped artifacts.
2. Run-scope domain guard.
3. Runtime truth for visible actions, starting with actions currently in the
   primary palettes.
4. Unified run lifecycle for batch and normal runs.
5. Atomic package import.
6. Electron sandbox hardening.
7. Smoke test split or setup fix.
8. Targeted module extraction while touching each area.
9. Package import size guard.

## Verification Matrix

Run focused checks per workstream, then the full suite before merging:

```text
npm test -- electron/backend/runner.test.ts
npm test -- electron/backend/commands.test.ts
npm test -- electron/backend/graphCompiler.test.ts
npm test -- src/lib/workflowApi.test.ts
npm test -- src/features/workflows/pages/WorkflowListPage.test.tsx
npm test -- src/features/workflows/pages/WorkflowDetailPage.test.tsx
npx tsc --noEmit
npm run build:electron
npm test
```

If real CloakBrowser smoke is separated:

```text
npm run test:smoke
```

## Open Decisions

- Whether run-scope allowlists live in Workflow Settings, compiler-derived
  graph policy, or both.
- Whether `run_subworkflow` should be implemented now or hidden/fail explicitly
  until recursive lifecycle semantics are designed.
- Whether batch run state should extend `RunState` with typed batch fields or
  use reserved outputs for row progress.
- Whether launch-time action types should be hidden from the action palette or
  transformed into Workflow Settings shortcuts.
