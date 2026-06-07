# Task Routes

Start here after `docs/README.md`. Pick only the route or routes matching the task.

Each route lists:

- Read: docs to read before editing.
- Verify: source files to inspect.
- Checks: focused commands to run when relevant.
- Update docs: docs likely to change if behavior/contracts change.

## Understand Product Or Plan Broad Work

Use for broad requests, unclear task boundaries, planning, or deciding which route applies.

Read: `domain/product-model.md`, `architecture/overview.md`, `domain/user-visible-invariants.md`

Verify: source files only after choosing an implementation route below.

Checks: none until code or tests change.

Update docs: task routes, product model, overview, or invariants only if the task changes current truth.

## Add Or Change An Action Type

Read: `domain/action-taxonomy.md`, `domain/cross-feature-impact-map.md`, `architecture/frontend.md`, `architecture/domain.md`, `architecture/runner.md`, `contracts/action-configs.md`, `contracts/workflow-types.md`

Verify: `src/types/workflow.ts`, `src/lib/actionCapabilities.ts`, `src/lib/workflowUi.ts`, `src/features/workflows/lib/workflowStepForm.ts`, `src/features/workflows/components/ActionConfigEditor.tsx`, `src/features/workflows/components/ActionConfig*Fields.tsx`, `electron/backend/actions/registry.ts`, `electron/backend/actions/validation.ts`, `electron/backend/actions/execution.ts`, `electron/backend/graph/validateGraph.ts`, `electron/backend/graph/compiler.ts`, `electron/backend/runtime/runner.ts`, `electron/backend/commands.ts`, `README.md`

Checks: `npm test -- src/lib/actionCapabilities.test.ts`, `npm test -- src/features/workflows/lib/workflowStepForm.test.ts`, `npm test -- src/lib/workflowApi.test.ts`, `npm test -- electron/backend/actions/registry.test.ts electron/backend/actions/validation.test.ts electron/backend/actions/execution.test.ts`, `npm test -- electron/backend/graph/validateGraph.test.ts electron/backend/graph/compiler.test.ts`, `npm test -- electron/backend/commands.test.ts`; add runner tests when execution changes.

Update docs: action taxonomy, action config contract, workflow types, runner docs, smoke checklist if user-visible behavior changes.

## Change Workflow UI Behavior

Read: `domain/workflow-lifecycle.md`, `domain/user-visible-invariants.md`, `architecture/frontend.md`, `contracts/run-state.md` when run/test UI changes

Verify: `src/App.tsx`, `src/features/settings/`, `src/features/workflows/pages/`, `src/features/workflows/components/`, `src/features/workflows/lib/workflowSettings.ts`, `src/lib/workflowApi.ts`, `src/lib/workflowUi.ts`

Checks: focused page/component test; `npx tsc --noEmit` when types or props change.

Update docs: workflow lifecycle, frontend architecture, run-state contract if monitoring/status changes.

## Change Projects, Environments, Or Subflows

Use when changing project grouping, project saved-session browser launch
selection, workflow create session choices, compatibility Project Environment
rows, subflow CRUD, Call Subflow graph nodes, or workflow package subflow
import/export.

Read: `domain/product-model.md`, `domain/workflow-lifecycle.md`,
`domain/user-visible-invariants.md`, `domain/execution-semantics.md`,
`architecture/overview.md`, `architecture/frontend.md`,
`architecture/persistence.md`, `architecture/command-boundary.md`,
`contracts/electron-ipc.md`, `contracts/workflow-types.md`,
`contracts/run-state.md`; also read `DESIGN.md` before layout or styling
changes.

Verify: `src/App.tsx`, `src/features/projects/`, `src/features/settings/`,
`src/features/workflows/pages/WorkflowListPage.tsx`,
`src/features/workflows/pages/SubflowListPage.tsx`,
`src/features/workflows/pages/SubflowDetailPage.tsx`,
`src/features/workflows/components/WorkflowGraph*`,
`src/features/workflows/lib/workflowGraph.ts`, `src/layouts/`,
`src/lib/workflowApi.ts`, `src/types/electron.ts`,
`src/types/workflow.ts`, `electron/ipc.ts`, `electron/preload.cts`,
`electron/backend/commands.ts`, `electron/backend/graph/validateGraph.ts`,
`electron/backend/graph/compiler.ts`,
`electron/backend/persistence/database.ts`,
`electron/backend/persistence/workflowRepository.ts`,
`electron/backend/services/workflowPackageService.ts`

Checks: `npm test -- electron/backend/persistence/database.test.ts electron/backend/commands.test.ts electron/backend/graph/compiler.test.ts electron/backend/graph/validateGraph.test.ts electron/backend/services/workflowPackageService.test.ts src/lib/workflowApi.test.ts`,
focused workflow/settings page tests, `npx tsc --noEmit`,
`npm run build:electron`, `npm test`, `npm run build`.

Update docs: product model, workflow lifecycle, user-visible invariants,
execution semantics, architecture overview, frontend architecture, persistence
architecture, command boundary, Electron IPC contract, workflow types,
run-state contract, README smoke checklist, and this route when ownership,
payloads, or checks change.

## Change User-Facing Styling Or Layout

Read: `DESIGN.md`, `architecture/frontend.md`, `domain/user-visible-invariants.md`

Verify: `src/App.css`, `src/styles/`, `src/layouts/`, user-facing components under `src/features/workflows/`

Checks: focused UI tests; `npm test -- src/AppCss.test.ts` when CSS invariants change.

Update docs: frontend architecture or invariants when layout ownership/behavior changes.

## Change An Electron IPC Command

Read: `architecture/command-boundary.md`, `contracts/electron-ipc.md`, `contracts/workflow-types.md`

Verify: `src/lib/workflowApi.ts`, `src/lib/workflowApi.test.ts`, `src/types/electron.ts`, `electron/preload.cts`, `electron/ipc.ts`, `electron/main.ts`, focused modules under `electron/backend/`

Checks: `npm test -- src/lib/workflowApi.test.ts`, focused Electron backend command tests, `npx tsc --noEmit`, `npm run build:electron`

Update docs: command boundary, Electron IPC contract, workflow types when response/payload shapes change.

## Change Browser Recorder

Use when changing recorder session lifecycle, browser event capture, recording
normalization, graph draft generation, review/save flow, or record-to-replay
tests.

Read: `domain/product-model.md`, `domain/workflow-lifecycle.md`, `domain/user-visible-invariants.md`, `architecture/overview.md`, `architecture/command-boundary.md`, `architecture/frontend.md` when UI changes, `architecture/runner.md` when browser launch/capture/replay changes, `contracts/electron-ipc.md`, `contracts/workflow-types.md`

Verify: `src/types/workflow.ts`, `src/types/electron.ts`, `src/lib/workflowApi.ts`, `electron/ipc.ts`, `electron/preload.cts`, `electron/backend/commands.ts`, `electron/backend/recording/`, `electron/backend/services/workflowSettingsService.ts`, `electron/backend/graph/validateGraph.ts`, `electron/backend/graph/compiler.ts`, recorder UI files under `src/features/workflows/` when present, and recorder E2E fixtures/tests when present.

Checks: `npm test -- src/lib/workflowApi.test.ts`, `npm test -- electron/backend/commands.test.ts`, focused tests under `electron/backend/recording/`, focused workflow page/component tests when UI changes, `npx tsc --noEmit`, `npm run build:electron`; run recorder E2E and smoke commands once browser capture/replay is implemented.

Update docs: product model, workflow lifecycle, user-visible invariants, frontend architecture, command boundary, Electron IPC contract, workflow types, runner docs, action config docs, README smoke checklist, and this route when the touched behavior changes those areas.

## Change Domain Validation

Read: `architecture/domain.md`, `contracts/action-configs.md`, `domain/user-visible-invariants.md`

Verify: `electron/backend/graph/validateGraph.ts`, `electron/backend/graph/compiler.ts`, `electron/backend/actions/validation.ts`, `electron/backend/commands.ts`, `electron/backend/services/workflowSettingsService.ts`, `electron/backend/services/workflowPackageService.ts`, `electron/backend/graph/validateGraph.test.ts`, `electron/backend/graph/compiler.test.ts`, affected UI error display.

Checks: `npm test -- electron/backend/graph/validateGraph.test.ts electron/backend/graph/compiler.test.ts`; add `npm test -- electron/backend/commands.test.ts` when command-facing errors change; run `npm run build:electron` when backend types change.

Update docs: domain architecture, action config contract, user-visible invariants.

## Change SQLite Persistence

Read: `architecture/persistence.md`, `contracts/workflow-types.md`, `domain/workflow-lifecycle.md`

Verify: `src/types/workflow.ts`, `src/lib/personaCatalog.ts`, `electron/backend/persistence/database.ts`, `electron/backend/persistence/workflowRepository.ts`, `electron/backend/commands.ts`, `electron/backend/services/workflowSettingsService.ts`, `electron/backend/services/workflowPackageService.ts`, repository/command tests, import/export code in the Electron backend if persisted shape changes.

Checks: `npm test -- electron/backend/commands.test.ts`, `npm run build:electron`; add narrower repository tests when repository behavior changes independently of command handlers.

Update docs: persistence architecture, workflow types, workflow lifecycle.

## Change Workflow Scheduling

Read: `domain/workflow-lifecycle.md`, `domain/user-visible-invariants.md`, `architecture/frontend.md`, `architecture/persistence.md`, `architecture/command-boundary.md`, `contracts/electron-ipc.md`, `contracts/workflow-types.md`, `domain/execution-semantics.md`

Verify: `src/App.tsx`, `src/layouts/`, `src/features/schedules/`, `src/lib/workflowApi.ts`, `src/types/electron.ts`, `src/types/workflow.ts`, `electron/ipc.ts`, `electron/preload.cts`, `electron/main.ts`, `electron/backend/persistence/database.ts`, `electron/backend/scheduling/workflowScheduleRepository.ts`, `electron/backend/scheduling/scheduler.ts`, `electron/backend/commands.ts`, `electron/backend/runtime/runManager.ts`

Checks: `npm test -- electron/backend/scheduling/scheduler.test.ts`, `npm test -- electron/backend/scheduling/workflowScheduleRepository.test.ts`, `npm test -- electron/backend/commands.test.ts`, `npm test -- src/lib/workflowApi.test.ts`, `npm test -- src/features/schedules/pages/SchedulesPage.test.tsx`, `npx tsc --noEmit`, `npm run build:electron`

Update docs: workflow lifecycle, user-visible invariants, frontend architecture, persistence architecture, command boundary, Electron IPC contract, workflow types, execution semantics, and this route when ownership or checks change.

## Change Operations Overview

Read: `domain/product-model.md`, `domain/user-visible-invariants.md`, `domain/workflow-lifecycle.md`, `domain/execution-semantics.md`, `architecture/overview.md`, `architecture/frontend.md`, `architecture/persistence.md`, `architecture/command-boundary.md`, `contracts/electron-ipc.md`, `contracts/workflow-types.md`

Verify: `src/App.tsx`, `src/features/overview/`, `src/layouts/`, `src/lib/workflowApi.ts`, `src/types/electron.ts`, `src/types/workflow.ts`, `electron/ipc.ts`, `electron/preload.cts`, `electron/backend/operations/operationsRepository.ts`, `electron/backend/persistence/database.ts`, `electron/backend/commands.ts`

Checks: `npm test -- electron/backend/persistence/database.test.ts electron/backend/commands.test.ts`, `npm test -- src/App.test.tsx src/layouts/AppShell.test.tsx`, `npm test -- src/AppCss.test.ts`, `npx tsc --noEmit`, `npm run build:electron`, `npm test`

Update docs: product model, user-visible invariants, workflow lifecycle, execution semantics, architecture overview, frontend architecture, persistence architecture, command boundary, Electron IPC contract, workflow types, README smoke checklist, and this route when Overview ownership or checks change.

## Change Mission Control Cross-Workspace Navigation

Use when changing sidebar order, app-shell navigation surfaces,
cross-workspace traceability links, stale navigation target states, compact
desktop behavior, or app-level Settings diagnostics/maintenance.

Read: `domain/product-model.md`, `domain/user-visible-invariants.md`,
`architecture/overview.md`, `architecture/frontend.md`,
`contracts/workflow-types.md`; also read `DESIGN.md` before layout or styling
changes.

Verify: `src/App.tsx`, `src/layouts/`, `src/features/projects/`, `src/features/overview/`,
`src/features/evidence/`, `src/features/identities/`,
`src/features/schedules/`, `src/features/settings/`, `src/features/workflows/`,
`src/types/workflow.ts`, `electron/backend/operations/operationsRepository.ts`

Checks: `npm test -- src/App.test.tsx src/layouts/AppShell.test.tsx src/AppCss.test.ts`,
focused page tests for touched workspaces, `npx tsc --noEmit`,
`npm run build:electron`, `npm test`, `npm run build`; use a Playwright
desktop/compact visual check when layout changes.

Update docs: product model, user-visible invariants, architecture overview,
frontend architecture, workflow types, README smoke checklist, and this route
when navigation/settings ownership or checks change.

## Change Evidence Explorer

Read: `domain/product-model.md`, `domain/user-visible-invariants.md`,
`domain/workflow-lifecycle.md`, `domain/execution-semantics.md`,
`architecture/overview.md`, `architecture/frontend.md`,
`architecture/persistence.md`, `architecture/command-boundary.md`,
`contracts/electron-ipc.md`, `contracts/workflow-types.md`,
`contracts/run-state.md`

Verify: `src/App.tsx`, `src/features/evidence/`, `src/features/overview/`,
`src/layouts/`, `src/lib/workflowApi.ts`,
`src/types/electron.ts`, `src/types/workflow.ts`, `electron/ipc.ts`,
`electron/preload.cts`, `electron/backend/evidence/evidenceRepository.ts`,
`electron/backend/persistence/database.ts`, `electron/backend/runtime/runManager.ts`,
`electron/backend/commands.ts`, `electron/main.ts`

Checks: `npm test -- electron/backend/persistence/database.test.ts electron/backend/commands.test.ts`,
`npm test -- src/lib/workflowApi.test.ts src/layouts/AppShell.test.tsx src/App.test.tsx src/AppCss.test.ts`,
`npx tsc --noEmit`, `npm run build:electron`, `npm test`, `npm run build`

Update docs: product model, user-visible invariants, workflow lifecycle,
execution semantics, architecture overview, frontend architecture, persistence
architecture, command boundary, Electron IPC contract, workflow types,
run-state contract, README smoke checklist, and this route when Evidence
ownership or checks change.

## Change Identity Lab

Read: `domain/product-model.md`, `domain/user-visible-invariants.md`,
`domain/workflow-lifecycle.md`, `domain/execution-semantics.md`,
`architecture/overview.md`, `architecture/frontend.md`,
`architecture/command-boundary.md`, `architecture/runner.md`,
`contracts/electron-ipc.md`, `contracts/workflow-types.md`,
`contracts/run-state.md`

Verify: `src/App.tsx`, `src/features/identities/`,
`src/features/evidence/`, `src/layouts/`, `src/lib/workflowApi.ts`,
`src/types/electron.ts`, `src/types/workflow.ts`, `electron/ipc.ts`,
`electron/preload.cts`, `electron/backend/identity/identityRepository.ts`,
`electron/backend/runtime/runManager.ts`, `electron/backend/runtime/runner.ts`,
`electron/backend/commands.ts`

Checks: `npm test -- electron/backend/commands.test.ts src/lib/workflowApi.test.ts src/layouts/AppShell.test.tsx src/App.test.tsx`,
`npx tsc --noEmit`, `npm run build:electron`, `npm test`, `npm run build`

Update docs: product model, user-visible invariants, workflow lifecycle,
execution semantics, architecture overview, frontend architecture, command
boundary, Electron IPC contract, workflow types, run-state contract, runner
architecture, README smoke checklist, and this route when Identity Lab
ownership or checks change.

## Change Runner Behavior

Read: `domain/execution-semantics.md`, `domain/cross-feature-impact-map.md`, `architecture/runner.md`, `contracts/run-state.md`

Verify: `src/lib/personaCatalog.ts`, `electron/backend/graph/compiler.ts`, `electron/backend/runtime/runner.ts`, `electron/backend/browser/sessionManager.ts`, `electron/backend/runtime/runManager.ts`, Electron runner/session-manager tests, command tests, `src/features/workflows/components/WorkflowGraphEditor.tsx`.

Checks: focused Electron runner/compiler/session-manager tests, `npm run test:fingerprint` for browser identity evidence changes, `npm test -- electron/backend/commands.test.ts`, `npm run build:electron`; run `npm run test:smoke` only for real CloakBrowser smoke changes.

Update docs: execution semantics, runner architecture, run-state contract, impact map.

## Change Run Status Or Test-Step Monitoring

Read: `domain/execution-semantics.md`, `architecture/frontend.md`, `architecture/runner.md`, `contracts/run-state.md`

Verify: `src/App.tsx`, `src/features/workflows/pages/`, `src/features/workflows/components/WorkflowGraphEditor.tsx`, `src/features/workflows/components/RunStatusBar.tsx`, `src/features/workflows/components/RunIssuePanel.tsx`, `src/lib/workflowApi.ts`, `src/lib/workflowUi.ts`, `electron/backend/commands.ts`, `electron/backend/runtime/runManager.ts`, `electron/backend/runtime/runner.ts`

Checks: `npm test -- src/features/workflows/pages/WorkflowListPage.test.tsx src/features/workflows/pages/WorkflowDetailPage.test.tsx`, `npm test -- src/lib/workflowApi.test.ts`, `npm test -- electron/backend/commands.test.ts`

Update docs: run-state contract, execution semantics, frontend/runner docs.

## Fix A Bug

Read: route for the affected area; `domain/cross-feature-impact-map.md` if the bug crosses layers; `maintenance/freshness-checklist.md` if docs look stale.

Verify: reproduce or isolate the failing path; inspect source files from the affected route.

Checks: add/update the smallest focused failing test first unless the bug is docs-only; then run related checks from the affected route.

Update docs: any doc that described the buggy behavior incorrectly or misses the affected invariant.

## Refactor A Module

Read: architecture doc for the module, related contract docs when public shapes or boundaries may move, `domain/user-visible-invariants.md`

Verify: current imports, callers, tests around moved logic.

Checks: existing tests for the module; add focused service tests for extracted backend services; typecheck or Electron backend build checks for moved boundaries. For Electron backend ownership moves, run `npm test -- ci-cd.test.ts` to keep the top-level backend layout guarded.

Update docs: architecture ownership and task routes if file ownership or reading paths change.

## Update Tests Only

Read: `architecture/testing.md` and the route for the behavior under test.

Verify: test fixtures under `src/tests/` or `electron/backend/`; source behavior the test asserts.

Checks: focused test command for the edited test.

Update docs: testing architecture or route checks only if verification expectations changed.

## Change Desktop Packaging Or CI/CD

Use when changing Electron package targets, release artifacts, GitHub Actions,
or release verification.

Read: `architecture/overview.md`, `architecture/testing.md`

Verify: `package.json`, `package-lock.json`, `.github/`, `README.md`,
`docs/release-governance.md`

Checks: `npm test -- ci-cd.test.ts`, `npm run build`, `npm run release:sbom`,
`npm run release:manifest`, and a focused package command such as
`npm run electron:pack:linux` when the local OS supports it.

Update docs: README development commands, this route, and any release or
verification notes affected by the packaging workflow.

Common E2E commands:

- Smoke: `npm run test:e2e:smoke`
- Full local desktop: `npm run test:e2e:full`
- Visible local browser review/debug: `npm run test:e2e:visible`
- Flake detection: `npm run test:e2e:flake`
- Opt-in public real-web workflow checks: `npm run test:e2e:real-web`
