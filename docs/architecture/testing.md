# Testing Architecture

## Frontend Tests

- Test runner: Vitest.
- Testing utilities: Testing Library and local helpers.
- Setup: `src/tests/setup.ts`
- Mocks: `src/tests/mocks/`
- Render helper: `src/tests/utils/renderApp.tsx`

Focused commands:

- `npm test -- src/lib/workflowApi.test.ts`
- `npm test -- src/features/workflows/pages/WorkflowDetailPage.test.tsx`
- `npm test -- src/features/workflows/components/TestStepMonitor.test.tsx`
- `npm test -- src/features/workflows/lib/workflowStepForm.test.ts`
- `npx tsc --noEmit`

## Rust Tests

- Command API: `src-tauri/tests/command_api.rs`
- Domain validation: `src-tauri/tests/domain_validation.rs`
- Persistence: `src-tauri/tests/persistence.rs`
- Runner spike: `src-tauri/tests/runner_spike.rs`
- Support helpers: `src-tauri/tests/support/`

Focused commands:

- `cd src-tauri && cargo test --test command_api`
- `cd src-tauri && cargo test --test domain_validation`
- `cd src-tauri && cargo test --test persistence`
- `cd src-tauri && cargo test --test runner_spike`

## Policy

- Use TDD for behavior changes.
- Run focused tests first.
- Add broader checks when touching shared contracts or cross-layer behavior.
- Docs-only changes do not require TDD.

