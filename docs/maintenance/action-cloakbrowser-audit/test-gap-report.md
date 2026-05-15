# Test Gap Report

Status: action/node field matrix and CloakBrowser launch/session/batch coverage reviewed; residual test gaps are linked to findings.

## Current Coverage Sources

- Unit/backend: `electron/backend/runner.test.ts`, `commands.test.ts`, `graphCompiler.test.ts`
- Frontend: `src/features/workflows/components/*test.tsx`, `src/features/workflows/lib/*test.ts`, workflow page tests
- E2E registry: `tests/e2e/support/coverageMatrix.ts`
- E2E guard: `tests/e2e/coverage-matrix.e2e.ts`
- Local desktop suites: `tests/e2e/*.e2e.ts`
- Staging opt-in: `tests/e2e/staging-owned-targets.e2e.ts`

## Required Strategy

Add or verify these tests during the audit:

| Area | Required coverage | Current evidence to read first | Gap status |
|---|---|---|---|
| `buildLaunchOptions` | top-level CloakBrowser option mapping, args, context options | `electron/backend/runner.test.ts` | reviewed for launch mapping; missing `disabled_if_supported` and stronger user-agent UI coverage |
| Persistent vs temporary context | `launchPersistentContext` with `userDataDir`; temporary not reusable | `electron/backend/runner.test.ts` | reviewed in runner/command tests; desktop stale-session E2E still missing |
| Proxy parse/sanitize | URL credentials, separate credentials, conflict rejection, package/evidence redaction | `runner.test.ts`, `commands.test.ts`, `workflow-package.e2e.ts` | reviewed for unit/backend; malformed URL boundary table still useful |
| Timezone/locale/geoip | top-level mapping, explicit precedence over geoip, no context emulation | `runner.test.ts`, `commands.test.ts` | reviewed for top-level mapping; explicit precedence/missing mmdb behavior still needs table |
| Retained session lifecycle | retain/close, stale session, active profile guard | `runner.test.ts`, `commands.test.ts`, `WorkflowDetailPage.test.tsx` | reviewed in unit/page tests; desktop E2E stale-session gap remains |
| Run from selected | eligibility, stale retained state, selected main-path compile | `commands.test.ts`, `runner.test.ts`, `WorkflowDetailPage.test.tsx` | reviewed for command/runner gating and selected continuation; desktop stale-session E2E remains useful |
| Browser identity evidence | no raw seed, no proxy secrets, metadata present | `runner.test.ts`, `commands.test.ts` | reviewed for runner/package/diagnostics; package E2E covers proxy password redaction, broader evidence redaction table still useful |
| Preflight allowlist/verdict | allowlist, malformed verdict, blocked verdict, sanitized outputs | `runner.test.ts`, `commands.test.ts` | reviewed in runner/commands; headed-mode E2E guard gap remains |
| Settings-before-run E2E | dirty settings saved before run and launch settings used | `workflow-user-journeys.e2e.ts`, `WorkflowDetailPage.test.tsx` | page test covers visible save payload; runtime mapping remains unit-level only |
| Batch mode close/headless policy | forced close, saved/request headless, concurrency gate, stop-on-first-failed-row | `commands.test.ts`, `WorkflowSettingsDialog.test.tsx`, `batch-evidence.e2e.ts` | reviewed for forced close/concurrency/stop-on-first-failed-row; F-024: direct headless mapping assertion missing |
| Optional staging-only | owned detection page smoke with allowlisted target and named accounts | `staging-owned-targets.e2e.ts` | opt-in only |
| Launch-time action guards | each `launch_time_only` action fails graph validation and runner execution explicitly | `graphCompiler.test.ts`, `runner.test.ts`, `coverageMatrix.ts` | F-003: `use_profile` runner guard and per-action compiler cases missing |
| Planned-hidden action guards | each `planned_hidden` action fails before runner dispatch | `actionCapabilities.ts`, `runner.test.ts`, `coverageMatrix.ts` | F-004: several planned actions omitted from runner unsupported table |
| Compatibility output/subworkflow nodes | transform output, assert pass/fail, subworkflow compile shape, subworkflow unsupported runtime | `runner.test.ts`, `graphCompiler.test.ts`, `coverageMatrix.ts` | F-005: matrix references behavior/compiler coverage not found in direct tests |
| Recovery control flow | try/catch success/error/finally, empty recovery failure preservation, fallback success/failure, compiler branch shapes | `runner.test.ts`, `graphCompiler.test.ts`, `coverageMatrix.ts` | F-006: matrix references recovery semantics tests not found in direct tests |
| Browser context runtime actions | cookie set/clear, headers, permissions, geolocation, viewport size and device shape | `runner.test.ts`, `graphCompiler.test.ts`, `browser-context-storage.e2e.ts` | reviewed for cookie/header/permission/geolocation and viewport width/height; F-007: `set_viewport` device shape fields are not applied or asserted; F-018: blank-domain `set_cookie` current-host path is untested |
| Advanced network/storage actions | JS output, strict-humanized guard, request/response wait, route block/mock, web storage | `runner.test.ts`, `graphCompiler.test.ts`, `capture-network.e2e.ts`, `browser-context-storage.e2e.ts` | reviewed for listed behavior; F-008: `mock_response.url_contains` substring/default case is not covered; F-019: `execute_js.timeout_ms` has no runner timeout test |
| Graph utility nodes | start/action dispatch, terminal nodes, variables, manual approval, rate limit | `control-flow.e2e.ts`, `graphCompiler.test.ts`, `runner.test.ts`, `WorkflowGraphEditor.test.tsx` | reviewed for start/action/terminals/variables; F-009: `manual_approval` and `rate_limit` compiler output assertions missing |
| Navigation and waits | navigation, duration/random/element/text/URL/page-load waits, history, reload, tab switching and close failures | `core-execution.e2e.ts`, `wait-assertion-actions.e2e.ts`, `navigation-actions.e2e.ts`, `runner.test.ts`, `graphCompiler.test.ts` | reviewed for current visible behavior; F-015: `navigate.wait_until` validation/UI/help drift |
| Capture/download/dialog actions | extract text/attribute/input/list/table, screenshots, downloads, accept/dismiss dialog | `capture-network.e2e.ts`, `keyboard-dialog.e2e.ts`, `runner.test.ts`, `graphCompiler.test.ts` | reviewed for current visible behavior; F-016: screenshot path help contradicts safe artifact validation; F-017: capture `timeout_ms` is ignored |
| Element/form/pointer/keyboard/assertion actions | text input, click, pointer, form, checkbox, keyboard, clipboard, assertions | `core-execution.e2e.ts`, `extended-form-actions.e2e.ts`, `pointer-actions.e2e.ts`, `keyboard-dialog.e2e.ts`, `wait-assertion-actions.e2e.ts`, `runner.test.ts`, `graphCompiler.test.ts` | reviewed for visible behavior; F-010: `assert_element` non-visible states not enforced/tested; F-011: legacy `set_checkbox` compatibility coverage missing; F-020/F-021/F-022: scroll/click/clear advanced fields have UI/runtime/help drift; F-023: malformed enum values lack invalid-path tests |
| Structured element targets | locator kinds, constraints, nested iframe targets, legacy XPath migration | `WorkflowGraphEditor.test.tsx`, `workflowGraphMigration.test.ts`, `runner.test.ts` | reviewed for contract/runtime/migration; F-012: primary UI cannot author or edit nested iframe targets |
| Workflow conditions | condition kind validation, output/text/url/element variants, nested target migration | `graphCompiler.test.ts`, `runner.test.ts`, `WorkflowGraphEditor.test.tsx` | reviewed for known variants; F-013: unsupported condition kinds are not rejected |
| Typed variables | `set_variable` rows, typed parsing, JSON flattening, environment seed variables | `runner.test.ts`, `graphCompiler.test.ts`, `workflowSettings.test.ts`, `control-flow.e2e.ts` | reviewed for happy paths; F-014: unsupported `value_type` and number/boolean boundaries are not validated |

## Command Notes

- Use `npm run test:e2e:full -- tests/e2e/coverage-matrix.e2e.ts` for the coverage matrix guard.
- `npm test -- tests/e2e/coverage-matrix.e2e.ts` is not valid because Vitest excludes `.e2e.ts` files; Playwright owns that suite.
- Use `npm run test:e2e:staging` only with `E2E_STAGING_TARGETS_FILE` and `E2E_STAGING_ACCOUNTS_FILE` for owned/authorized staging targets.

## Coverage Review Rule

The coverage matrix is a routing index, not proof. For every matrix entry:

- Open the referenced test file.
- Find the specific action/node/field behavior assertion.
- Mark as `covered` only when the assertion checks the behavior, failure mode, and boundary required by the audit item.
- If the file only exercises adjacent behavior or smoke navigation, record a finding in `findings.md`.
