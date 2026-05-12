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

## Policy

- Use TDD for behavior changes.
- Run focused tests first.
- Add broader checks when touching shared contracts or cross-layer behavior.
- Docs-only changes do not require TDD.
