# Testing Architecture

## Frontend & Backend Unit Tests

Run focused unit tests using `npm test -- <path_to_test>`:
- Frontend Core: `src/lib/workflowApi.test.ts`, `src/features/workflows/pages/WorkflowDetailPage.test.tsx`, `src/features/workflows/lib/workflowStepForm.test.ts`
- Backend Core: `electron/backend/commands.test.ts`, `electron/backend/graph/compiler.test.ts`, `electron/backend/runtime/runner.test.ts`, `electron/backend/evidence/model.test.ts`
- Typecheck: `npx tsc --noEmit`

### Specialized Unit/Smoke Lanes
- `npm run test:smoke`: Launches real CloakBrowser binary against local fixtures to verify WebDriver masking, user-agent details, persistent profile cache, and canvas/timezone metrics.
- `npm run test:fingerprint`: Focused gate for identity mapping and sanitized browser evidence tests.
- `ci-cd.test.ts`: Guards GHA build configurations, packaging targets, and exact-pinning of CloakBrowser.
- `scripts/deploy/deploy-release.test.mjs`: Tests version bumping and deployment steps.

## Desktop E2E Tests

E2E testing is powered by Playwright Test using `playwright.config.ts`, `tests/e2e/support/electronFixture.ts` (manages isolated temporary app-data profile folders), and `tests/e2e/support/fixtureServer.ts` (provides local deterministic target pages).

### E2E Test Suite Map (Run via `npm run test:e2e:full -- tests/e2e/<suite>.e2e.ts`)
- `coverage-matrix`: Registry coverage matrix guard for all action types/fields.
- `electron-isolation`: App startup, data isolation, SQLite persistence.
- `core-execution`: Core clicks, inputs, checkboxes, radios, select options, element text.
- `capture-network`: Network capture, request blocking, response mocking, screenshots.
- `keyboard-dialog`: Hotkeys, clipboard/paste, alert/confirm dialogs, focus/blur.
- `human-behavior`: Trusted mouse, pointer, keyboard, and wheel event simulation sequence checks.
- `pointer-actions`: Pointer clicks, drag-and-drop (offset/percent calculations), scroll modes.
- `navigation-actions`: Navigation history, tabs/windows execution.
- `extended-form-actions`: Uploads, custom drop-downs, contenteditable fields.
- `wait-assertion-actions`: Assertion outcomes and element state waits (visible, hidden, etc.).
- `control-flow`: Graph loops, retry, switch, variables, branches.
- `browser-context-storage`: Geolocation, headers, cookies, storage.
- `run-validation-and-stop`: Allowlist block, validation errors, run cancellation.
- `batch-evidence`: Concurrency and batch execution runs, output persistence.
- `run-from-selected-real`: Run-from-selected with retained profile browsers.
- `browser-recorder`: Recording events, paste capture, review/saving.
- `workflow-package`: Zip export/import, sanitization of sensitive settings.
- `real-world-web` (via `npm run test:e2e:real-web`): Public target practice tests (excluded from CI/deterministic runs).

### E2E Execution Lanes
- `npm run test:e2e:smoke`: Fast confidence lane for Electron boot, core execution, and recorder.
- `npm run test:e2e:full`: All local deterministic desktop E2E (headless, clean teardown).
- `npm run test:e2e:visible`: Headed lane (`E2E_VISIBLE_BROWSER=1`) for visual browser observation. Pause with `E2E_OBSERVE_MS`.
- `npm run test:e2e:flake`: Repeated test runs to capture flake in interaction logic.

## Packaging and CI/CD Verification

GitHub Actions quality gates run on Node 24 (pull request and branch pushes).
- Release lane (`v*` tags) uses `internal-release` environments, producing attestation manifests, SBOM (CycloneDX), and checksums.
- Local release builds are run using `npm run deploy` (requires clean worktree, tags release, and builds targets).

## Policy

- Use TDD for behavior changes (implement test first).
- Run focused tests first, then wider checks.
- Docs-only changes do not require TDD.
