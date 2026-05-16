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

`npm run test:smoke` launches the real CloakBrowser binary against a local
fixture, so it is intentionally separate from the normal unit suite. It verifies
`navigator.webdriver === false`, UA/headless masking, `window.chrome` and plugin
baseline signals, persistent localStorage across two launches of the same
profile, fixed-seed canvas stability, timezone/locale, viewport/screen
coherence, and CloakBrowser wrapper/binary evidence. A fresh machine may download
the CloakBrowser binary before the smoke test runs.

## Desktop E2E Tests

- Test runner: Playwright Test.
- Config: `playwright.config.ts`.
- Electron fixture: `tests/e2e/support/electronFixture.ts`.
- Deterministic local fixture server: `tests/e2e/support/fixtureServer.ts`.
- Workflow graph helpers: `tests/e2e/support/workflows.ts`.
- Tests launch the Electron app against a local Vite renderer, override Electron `appData` with a per-test temporary directory, seed workflows through the exposed desktop IPC bridge, and run them through the real Electron command, SQLite, and CloakBrowser-backed runner boundary.

Focused commands:

- `npm run test:e2e:full -- tests/e2e/electron-isolation.e2e.ts`
- `npm run test:e2e:full -- tests/e2e/core-execution.e2e.ts`
- `npm run test:e2e:full -- tests/e2e/capture-network.e2e.ts`
- `npm run test:e2e:full -- tests/e2e/keyboard-dialog.e2e.ts`
- `npm run test:e2e:full -- tests/e2e/pointer-actions.e2e.ts`
- `npm run test:e2e:full -- tests/e2e/navigation-actions.e2e.ts`
- `npm run test:e2e:full -- tests/e2e/extended-form-actions.e2e.ts`
- `npm run test:e2e:full -- tests/e2e/wait-assertion-actions.e2e.ts`
- `npm run test:e2e:full -- tests/e2e/control-flow.e2e.ts`
- `npm run test:e2e:full -- tests/e2e/browser-context-storage.e2e.ts`
- `npm run test:e2e:full -- tests/e2e/run-validation-and-stop.e2e.ts`
- `npm run test:e2e:full -- tests/e2e/batch-evidence.e2e.ts`
- `npm run test:e2e:full -- tests/e2e/workflow-user-journeys.e2e.ts`
- `npm run test:e2e:full -- tests/e2e/workflow-package.e2e.ts`
- `npm run test:e2e:full -- tests/e2e/coverage-matrix.e2e.ts`
- `npm run test:e2e:staging` with staging env files

Desktop coverage map:

- `coverage-matrix.e2e.ts`: guardrail that keeps visible action coverage, hidden-action coverage decisions, graph-node coverage, and workflow journey coverage aligned with the current type/capability registry.
- `electron-isolation.e2e.ts`: Electron launch, temp app-data isolation, SQLite-backed desktop state.
- `core-execution.e2e.ts`: `navigate`, `click`, `wait(text_visible)`, `input_text`, `clear_input`, `select_option`, `check`, `uncheck`, `toggle_checkbox`, `select_radio`, `submit_form`, `extract_text`, `extract_input_value`.
- `capture-network.e2e.ts`: `extract_text`, `extract_attribute`, `extract_input_value`, `extract_list`, `extract_table`, `take_screenshot`, `wait_for_download`, `execute_js`, `wait_for_request`, `wait_for_response`, `block_request`, `mock_response`.
- `keyboard-dialog.e2e.ts`: `focus_element`, `blur_element`, `press_key`, `hotkey`, `set_clipboard`, `paste_clipboard`, `type_sequence`, `accept_dialog`, `dismiss_dialog`.
- `pointer-actions.e2e.ts`: `click`, `double_click`, `right_click`, `hover`, `drag_and_drop`, `scroll`.
- `navigation-actions.e2e.ts`: `navigate`, `go_back`, `go_forward`, `reload`, `open_new_tab`, `switch_tab`, `close_tab`.
- `extended-form-actions.e2e.ts`: `upload_file`, `select_custom_option`, `set_contenteditable`.
- `wait-assertion-actions.e2e.ts`: `wait(duration)`, `wait(element_visible)`, `wait(text_visible)`, `wait(url_contains)`, `random_wait`, visible `assert_element`, `assert_text` pass and failure run-state paths. Non-visible `assert_element` states and invalid element/form/assertion enum paths are covered in `electron/backend/runner.test.ts` and `electron/backend/graphCompiler.test.ts`.
- `control-flow.e2e.ts`: graph-visible `set_variable`, `set_json_variables`, `if`, `switch`, `repeat_times`, `repeat_for_each`, `while`, `repeat_until`, `retry`, `break_loop`, `continue_loop`, `end_success`, `end_failure`, and `stop_workflow`.
- `browser-context-storage.e2e.ts`: runtime `set_viewport` width/height behavior, `set_geolocation`, `grant_permission`, `set_extra_headers`, `set_cookie`, `clear_cookies`, `set_local_storage`, `set_session_storage`. Set Viewport launch-time device-shape rejection is covered by runner/compiler/component/help tests.
- `run-validation-and-stop.e2e.ts`: unconfigured graph run blocking, domain allowlist navigation blocking, and stop during a running wait.
- `batch-evidence.e2e.ts`: graph-backed batch execution, row variable interpolation, persisted SQLite `runs`/`run_steps`, screenshot evidence files, and `__evidence` metadata.
- `workflow-user-journeys.e2e.ts`: user-facing workflow create, graph/settings affordances, list-run status, and delete confirmation.
- `workflow-package.e2e.ts`: workflow package export, preview, import-as-new-workflow, flow preservation, and sensitive setting sanitization through the Electron bridge.
- `staging-owned-targets.e2e.ts`: opt-in authorized staging smoke workflows against allowlisted owned targets and named test accounts.

E2E lanes:

- `npm run test:e2e:smoke`: fast desktop confidence lane for Electron boot, core run, user journeys, and coverage matrix.
- `npm run test:e2e:full`: all local deterministic desktop E2E except staging unless `E2E_STAGING=1`.
- `npm run test:e2e:flake`: repeat high-risk interaction suites to catch timing and humanized pointer regressions.
- `npm run test:e2e:staging`: opt-in staging lane. Requires `E2E_STAGING_TARGETS_FILE` and `E2E_STAGING_ACCOUNTS_FILE`; targets must be allowlisted and accounts named. Example schemas live in `tests/e2e/fixtures/staging-targets.example.json` and `tests/e2e/fixtures/staging-accounts.example.json`.

Lower-level or compatibility-only coverage:

- Launch-time-only actions such as `use_profile`, `use_proxy`, `set_user_agent`, and `set_download_directory` are hidden from visible in-run authoring and covered by runner/settings tests.
- Planned or compatibility-hidden actions such as `switch_frame`, `save_session`, `load_session`, `set_secret`, `detect_challenge`, `pause_for_human`, `resume_when_condition`, `try_catch`, `fallback`, and subworkflow/output assertion internals remain outside primary visible-node E2E until they return to the visible authoring surface. `domain_allowlist` has desktop E2E coverage for navigation policy because it is a safety boundary.
- Additional wait condition variants and numeric validation edges remain covered in runner, graph compiler, and form validation suites unless a desktop regression exposes a user-facing gap.

## Policy

- Use TDD for behavior changes.
- Run focused tests first.
- Add broader checks when touching shared contracts or cross-layer behavior.
- Docs-only changes do not require TDD.
