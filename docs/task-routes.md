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

Verify: `src/types/workflow.ts`, `src/lib/workflowUi.ts`, `src/features/workflows/lib/workflowStepForm.ts`, `src/features/workflows/components/StepForm.tsx`, `src-tauri/src/domain/action_config.rs`, `src-tauri/src/domain/validation.rs`, `src-tauri/src/services/run_service.rs`, `src-tauri/src/runner/actions/`, `README.md`

Checks: `npm test -- src/features/workflows/lib/workflowStepForm.test.ts`, `npm test -- src/lib/workflowApi.test.ts`, `cd src-tauri && cargo test --test domain_validation`, `cd src-tauri && cargo test --test command_api`; add runner tests when execution changes.

Update docs: action taxonomy, action config contract, workflow types, runner docs, smoke checklist if user-visible behavior changes.

## Change Workflow UI Behavior

Read: `domain/workflow-lifecycle.md`, `domain/user-visible-invariants.md`, `architecture/frontend.md`, `contracts/run-state.md` when run/test UI changes

Verify: `src/App.tsx`, `src/features/settings/`, `src/features/workflows/pages/`, `src/features/workflows/components/`, `src/lib/workflowApi.ts`, `src/lib/workflowUi.ts`

Checks: focused page/component test; `npx tsc --noEmit` when types or props change.

Update docs: workflow lifecycle, frontend architecture, run-state contract if monitoring/status changes.

## Change User-Facing Styling Or Layout

Read: `DESIGN.md`, `architecture/frontend.md`, `domain/user-visible-invariants.md`

Verify: `src/App.css`, `src/styles/`, `src/layouts/`, user-facing components under `src/features/workflows/`

Checks: focused UI tests; `npm test -- src/AppCss.test.ts` when CSS invariants change.

Update docs: frontend architecture or invariants when layout ownership/behavior changes.

## Change A Tauri Command

Read: `architecture/command-boundary.md`, `contracts/tauri-commands.md`, `contracts/workflow-types.md`

Verify: `src/lib/workflowApi.ts`, `src/lib/workflowApi.test.ts`, `src-tauri/src/commands.rs`, focused modules under `src-tauri/src/commands/`, `src-tauri/src/lib.rs`, `src-tauri/tests/command_api.rs`

Checks: `npm test -- src/lib/workflowApi.test.ts`, `cd src-tauri && cargo test --test command_api`

Update docs: command boundary, Tauri command contract, workflow types when response/payload shapes change.

## Change Domain Validation

Read: `architecture/domain.md`, `contracts/action-configs.md`, `domain/user-visible-invariants.md`

Verify: `src-tauri/src/domain/validation.rs`, `src-tauri/src/domain/action_config.rs`, `src-tauri/tests/domain_validation.rs`, affected UI error display.

Checks: `cd src-tauri && cargo test --test domain_validation`; add `cd src-tauri && cargo test --test command_api` when command-facing errors change.

Update docs: domain architecture, action config contract, user-visible invariants.

## Change SQLite Persistence

Read: `architecture/persistence.md`, `contracts/workflow-types.md`, `domain/workflow-lifecycle.md`

Verify: `src-tauri/src/repositories/workflow_repository.rs`, `src-tauri/migrations/`, `src-tauri/tests/persistence.rs`, import/export code in `src-tauri/src/commands/import_export.rs` if persisted shape changes

Checks: `cd src-tauri && cargo test --test persistence`; add command tests when command results change.

Update docs: persistence architecture, workflow types, workflow lifecycle.

## Change Runner Behavior

Read: `domain/execution-semantics.md`, `domain/cross-feature-impact-map.md`, `architecture/runner.md`, `contracts/run-state.md`

Verify: `src-tauri/src/runner/`, `src-tauri/src/services/run_service.rs`, `src-tauri/src/app_state.rs`, `src-tauri/tests/runner_spike.rs`, `src-tauri/tests/command_api.rs`

Checks: `cd src-tauri && cargo test --test runner_spike`, `cd src-tauri && cargo test --test command_api`

Update docs: execution semantics, runner architecture, run-state contract, impact map.

## Change Run Status Or Test-Step Monitoring

Read: `domain/execution-semantics.md`, `architecture/frontend.md`, `architecture/runner.md`, `contracts/run-state.md`

Verify: `src/App.tsx`, `src/features/workflows/components/TestStepMonitor.tsx`, `src/features/workflows/components/RunStatusBar.tsx`, `src/lib/workflowUi.ts`, `src-tauri/src/app_state.rs`, `src-tauri/src/services/run_service.rs`

Checks: `npm test -- src/features/workflows/components/TestStepMonitor.test.tsx`, `cd src-tauri && cargo test --test command_api`

Update docs: run-state contract, execution semantics, frontend/runner docs.

## Fix A Bug

Read: route for the affected area; `domain/cross-feature-impact-map.md` if the bug crosses layers; `maintenance/freshness-checklist.md` if docs look stale.

Verify: reproduce or isolate the failing path; inspect source files from the affected route.

Checks: add/update the smallest focused failing test first unless the bug is docs-only; then run related checks from the affected route.

Update docs: any doc that described the buggy behavior incorrectly or misses the affected invariant.

## Refactor A Module

Read: architecture doc for the module, related contract docs when public shapes or boundaries may move, `domain/user-visible-invariants.md`

Verify: current imports, callers, tests around moved logic.

Checks: existing tests for the module; typecheck or Rust compiler checks for moved boundaries.

Update docs: architecture ownership and task routes if file ownership or reading paths change.

## Update Tests Only

Read: `architecture/testing.md` and the route for the behavior under test.

Verify: test fixtures under `src/tests/` or `src-tauri/tests/support/`; source behavior the test asserts.

Checks: focused test command for the edited test.

Update docs: testing architecture or route checks only if verification expectations changed.
