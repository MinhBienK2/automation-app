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
- `npm test -- src/features/workflows/lib/workflowStepForm.test.ts`
- `npx tsc --noEmit`

## Electron Backend Tests

- Command API and persistence: `electron/backend/commands.test.ts`
- Graph validation/compiler: `electron/backend/graphCompiler.test.ts`
- Runner unit coverage: `electron/backend/runner.test.ts`
- CloakBrowser launch smoke: `electron/backend/runner.smoke.test.ts`, gated by `RUN_CLOAKBROWSER_SMOKE=1`

Focused commands:

- `npm test -- electron/backend/commands.test.ts`
- `npm test -- electron/backend/graphCompiler.test.ts`
- `npm test -- electron/backend/runner.test.ts`
- `npm run test:smoke`
- `npm run build:electron`

## Desktop E2E Tests

- Test runner: Playwright Test.
- Config: `playwright.config.ts`.
- Electron fixture: `tests/e2e/support/electronFixture.ts`.
- Deterministic local fixture server: `tests/e2e/support/fixtureServer.ts`.
- Workflow graph helpers: `tests/e2e/support/workflows.ts`.
- Tests launch the Electron app against a local Vite renderer, override Electron `appData` with a per-test temporary directory, seed workflows through the exposed desktop IPC bridge, and run them through the real Electron command, SQLite, and CloakBrowser-backed runner boundary.

Focused commands:

- `npm run test:e2e -- tests/e2e/electron-isolation.e2e.ts`
- `npm run test:e2e -- tests/e2e/core-execution.e2e.ts`
- `npm run test:e2e -- tests/e2e/capture-network.e2e.ts`
- `npm run test:e2e -- tests/e2e/keyboard-dialog.e2e.ts`
- `npm run test:e2e -- tests/e2e/pointer-actions.e2e.ts`
- `npm run test:e2e -- tests/e2e/navigation-actions.e2e.ts`
- `npm run test:e2e -- tests/e2e/extended-form-actions.e2e.ts`

## Policy

- Use TDD for behavior changes.
- Run focused tests first.
- Add broader checks when touching shared contracts or cross-layer behavior.
- Docs-only changes do not require TDD.
