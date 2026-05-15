# Audit Findings

Status: confirmed findings recorded through F-024.

Use this file for confirmed issues only. Do not add speculative drift without file/line evidence and a reproducer or code-path proof.

## Severity Defaults

| Severity | Meaning |
|---|---|
| P0 | Data loss, secret leak, unauthorized cross-domain/session behavior, or unsafe browser/session boundary |
| P1 | Runtime behavior wrong, silent success/failure, broken run semantics, or incorrect anti-detection mapping |
| P2 | Validation gap, docs/help drift, incomplete tests, or stealth risk without confirmed runtime break |
| P3 | Naming, copy, maintainability, or refactor-only debt |

## Finding Template

```md
## F-000 - Short Title

Severity: P1

Action/node/field: `action.config.field`

Source-of-truth drift:

- Expected source: `path/to/source.ts:line`
- Actual source: `path/to/actual.ts:line`

Expected behavior:

- ...

Actual behavior:

- ...

Evidence:

- `file:line` ...

Minimal fix plan:

- ...

Required tests:

- Red test:
- Focused checks:
- Regression checks:

Docs/README impact:

- ...
```

## Finding Ledger

| ID | Severity | Area | Status | Summary | Fix batch |
|---|---|---|---|---|---|
| F-001 | P1 | CloakBrowser WebRTC policy | open | `disabled_if_supported` is accepted and evidenced but has no UI/runtime effect | Batch A |
| F-002 | P2 | Workflow Settings user agent | open | `user_agent` is runtime-mapped but absent from Workflow Settings UI/help | Batch C |
| F-003 | P2 | Launch-time action guard tests | open | Coverage matrix overstates launch-time guard coverage for `use_profile` and compiler guard variants | Batch C |
| F-004 | P2 | Planned hidden action guard tests | open | Coverage matrix says planned actions have runner unsupported tests, but several are not in the test table | Batch C |
| F-005 | P2 | Compatibility output/subworkflow coverage | open | Coverage matrix names backend behavior tests that do not cover `transform_variable`, `assert_output`, and `run_subworkflow` compile paths | Batch C |
| F-006 | P2 | Recovery control-flow coverage | open | Coverage matrix says `try_catch` and `fallback` have backend semantics tests, but direct tests are missing | Batch C |
| F-007 | P1 | `set_viewport` runtime mapping | open | `device_scale_factor`, `mobile`, and `touch` are editable and persisted but ignored at runtime | Batch A |
| F-008 | P1 | `mock_response` URL matching | open | `url_contains` is treated as a raw route pattern, so substring/default matching can silently miss | Batch A |
| F-009 | P2 | Hidden graph utility node coverage | open | `manual_approval` and `rate_limit` coverage matrix entries point to compiler tests that do not assert their compile shapes | Batch C |
| F-010 | P1 | `assert_element` state handling | open | `attached`, `hidden`, `enabled`, and `disabled` states can silently pass because runner only checks `visible` | Batch A |
| F-011 | P2 | `set_checkbox` compatibility coverage | open | Coverage matrix claims compatibility/migration coverage, but no direct behavior or migration test was found | Batch C |
| F-012 | P2 | Structured iframe target UI | open | `ElementTarget.iframe` is supported by contract/runtime/migration but cannot be authored in the primary structured target UI | Batch C |
| F-013 | P2 | Workflow condition validation | open | Unknown `WorkflowCondition.kind` values are not rejected and evaluate false at runtime | Batch B |
| F-014 | P2 | Typed variable validation | open | Unsupported `set_variable.value_type` values fall back to text and number/boolean boundaries are not validated | Batch B |
| F-015 | P2 | Navigate field drift | open | `navigate.wait_until` is documented/executed but not editable or enum-validated | Batch B/C |
| F-016 | P2 | Screenshot help drift | open | Screenshot help describes arbitrary filesystem paths even though validation/runtime use managed artifact names | Batch C |
| F-017 | P2 | Capture timeout runtime drift | open | Data capture `timeout_ms` is type/validation-supported but ignored by runner extraction paths | Batch B |
| F-018 | P1 | Set Cookie current-host semantics | open | Blank Domain is defaulted/documented as current host but runner does not infer it | Batch A |
| F-019 | P1 | Execute JS timeout runtime drift | open | `execute_js.timeout_ms` is editable/validated but ignored during runtime evaluation | Batch A |
| F-020 | P2 | Scroll UI/runtime drift | open | Scroll UI exposes non-page modes that compiler rejects and behavior fields runner ignores | Batch B |
| F-021 | P1 | Click advanced runtime drift | open | Click advanced fields are preserved but mostly ignored by runner execution | Batch A |
| F-022 | P2 | Clear Input method drift | open | `clear_input.method` is documented/preserved but ignored at runtime | Batch B |
| F-023 | P1 | Enum validation gaps | open | Element/form assertion enum fields are not validated and malformed values can silently fall back or pass | Batch A |
| F-024 | P2 | Batch headless test gap | open | Batch headless launch mapping is implemented but lacks direct command test coverage | Batch C |

## F-001 - `disabled_if_supported` WebRTC Policy Is A Silent No-Op

Severity: P1

Action/node/field: `settings.browser_launch.webrtc_policy`

Source-of-truth drift:

- Expected source: `src/types/workflow.ts:141` includes `disabled_if_supported` as a persisted policy value.
- Expected source: `docs/domain/user-visible-invariants.md:24` says Browser Launch exposes WebRTC policy.
- Actual source: `src/features/workflows/components/WorkflowSettingsDialog.tsx:360` through `src/features/workflows/components/WorkflowSettingsDialog.tsx:703` renders Browser Launch controls but no WebRTC policy or WebRTC IP control.
- Actual source: `electron/backend/runner.ts:1625` maps only `auto_proxy_exit_ip` and `explicit_ip`; `disabled_if_supported` falls through to no CloakBrowser arg.

Expected behavior:

- Either `disabled_if_supported` should be hidden/rejected until CloakBrowser exposes a supported disable mechanism, or it should be exposed and mapped to a real supported runtime option with evidence that WebRTC is handled.

Actual behavior:

- Settings normalization accepts `disabled_if_supported` via `validWebRtcPolicy` in `electron/backend/commands.ts:2174`.
- Browser identity evidence reports the selected policy in `electron/backend/runner.ts:1713`.
- Runtime launch options do not change for `disabled_if_supported`, so operators can persist/evidence a policy that is not applied.

Evidence:

- `src/types/workflow.ts:141` defines all WebRTC policies.
- `electron/backend/commands.ts:2174` treats `disabled_if_supported` as valid.
- `electron/backend/runner.ts:1625` emits `--fingerprint-webrtc-ip=auto` only for `auto_proxy_exit_ip` and explicit IP only for `explicit_ip`.
- `node_modules/cloakbrowser/dist/geoip.js:311` only documents replacing `--fingerprint-webrtc-ip=auto`; no installed CloakBrowser source found a disable flag.
- `src/features/workflows/components/WorkflowSettingsDialog.tsx:360` through `src/features/workflows/components/WorkflowSettingsDialog.tsx:703` omits WebRTC controls.
- `docs/domain/user-visible-invariants.md:24` says the UI exposes WebRTC policy.

Minimal fix plan:

- Decide whether `disabled_if_supported` is supported by cloakbrowser@0.3.27. If unsupported, reject it in settings validation or migrate it to `default` with a migration note.
- Add Workflow Settings WebRTC controls for supported policies only, or update docs if WebRTC remains internal/API-only.
- Ensure browser identity evidence cannot imply a policy was applied when runtime did nothing.

Required tests:

- Red test: `electron/backend/commands.test.ts` should reject or migrate `disabled_if_supported` when there is no supported CloakBrowser mapping.
- Runner test: prove selected WebRTC policies produce exact expected launch args and evidence.
- UI test: prove supported WebRTC policy controls render, save, and validate.

Docs/README impact:

- Update `docs/domain/user-visible-invariants.md`, `docs/domain/product-model.md`, and `docs/architecture/runner.md` to match the chosen behavior.

## F-002 - `user_agent` Is Runtime-Mapped But Not Editable In Workflow Settings

Severity: P2

Action/node/field: `settings.browser_launch.user_agent`

Source-of-truth drift:

- Expected source: `docs/contracts/action-configs.md:29` says launch-time identity actions like `set_user_agent` must move to Workflow Settings Browser Launch.
- Expected source: `docs/architecture/runner.md:20` says Browser Launch maps user agent to CloakBrowser launch options.
- Actual source: `src/features/workflows/components/WorkflowSettingsDialog.tsx:360` through `src/features/workflows/components/WorkflowSettingsDialog.tsx:703` renders Browser Launch fields but no user-agent input.
- Actual source: `src/features/workflows/lib/workflowSettings.test.ts:83` intentionally asserts help must not contain `User agent`.

Expected behavior:

- A launch-time `set_user_agent` compatibility error should point operators to an editable Workflow Settings Browser Launch field, or docs/errors should state that user agent is compatibility/API-only and not currently user-editable.

Actual behavior:

- Runtime maps `browser_launch.user_agent` to CloakBrowser `userAgent` in `electron/backend/runner.ts:1635`.
- Backend validation warns about mobile user-agent coherence in `electron/backend/commands.ts:1186`.
- Graph validation blocks `set_user_agent` action nodes with "Configure it in Workflow Settings before launch" in `electron/backend/graphCompiler.ts:506`.
- The Settings UI has no editable user-agent field, and help alignment excludes it.

Evidence:

- `src/types/workflow.ts:170` includes `user_agent`.
- `electron/backend/runner.ts:1635` maps it to top-level CloakBrowser `userAgent`.
- `electron/backend/commands.test.ts:643` verifies mobile user-agent validation.
- `electron/backend/graphCompiler.ts:506` directs launch-time actions to Workflow Settings.
- `src/features/workflows/components/WorkflowSettingsDialog.tsx:360` through `src/features/workflows/components/WorkflowSettingsDialog.tsx:703` has no user-agent control.
- `src/features/workflows/lib/workflowSettings.test.ts:86` through `src/features/workflows/lib/workflowSettings.test.ts:100` asserts `User agent` is absent from help.

Minimal fix plan:

- If user agent should be operator-editable, add a guarded Browser Launch UI field and help text with coherence warnings.
- If user agent should stay API/import-only, update launch-time action guidance and docs so `set_user_agent` does not tell operators to use a nonexistent UI field.

Required tests:

- Component/page test for saving `browser_launch.user_agent`, or a command/compiler test asserting the compatibility guidance uses the API/import-only wording.
- Help alignment test updated to match the chosen behavior.
- Runner launch option test should include a nonblank user agent.

Docs/README impact:

- Update `docs/contracts/action-configs.md` and `docs/architecture/runner.md` if user agent remains non-visible.

## F-003 - Launch-Time Action Guard Coverage Is Not Per-Action

Severity: P2

Action/node/field: `set_download_directory`, `use_profile`, `use_proxy`, `set_user_agent`

Source-of-truth drift:

- Expected source: `docs/maintenance/action-cloakbrowser-audit/action-node-audit-matrix.md` requires hidden/planned/launch-time actions to have explicit unsupported or compatibility guard tests.
- Actual source: `tests/e2e/support/coverageMatrix.ts:101` and `tests/e2e/support/coverageMatrix.ts:118` describe launch-time coverage through settings tests, not explicit per-action compiler/runner guards.

Expected behavior:

- Every `launch_time_only` action should have explicit graph-validation and runner unsupported-guard test coverage, because saved workflows can still contain these serialized action configs.

Actual behavior:

- Graph validation has a generic launch-time guard, but `electron/backend/graphCompiler.test.ts:220` only covers `use_proxy`.
- Runner unsupported testing covers `use_proxy`, `set_user_agent`, and `set_download_directory` in `electron/backend/runner.test.ts:1746`.
- `use_profile` is not present in the runner unsupported guard tests.
- Coverage matrix entries for `use_profile`, `use_proxy`, and `set_download_directory` point to broad Workflow Settings launch coverage rather than proving saved action configs fail explicitly.

Evidence:

- `src/lib/actionCapabilities.ts:83` marks `use_proxy`, `set_user_agent`, and related browser identity actions as launch-time only.
- `electron/backend/graphCompiler.ts:506` implements a generic launch-time graph validation error.
- `electron/backend/graphCompiler.test.ts:220` exercises the compiler guard only with `use_proxy`.
- `electron/backend/runner.ts:556` calls `unsupportedInRunReason` before action dispatch.
- `electron/backend/runner.test.ts:1752` omits `use_profile` from the explicit unsupported action list.
- `tests/e2e/support/coverageMatrix.ts:118` says `use_profile` is covered through Workflow Settings browser launch tests, which does not verify in-run guard behavior.

Minimal fix plan:

- Add table-driven graph compiler tests covering all `launch_time_only` actions.
- Add `use_profile` to the table-driven runner unsupported test.
- Update `tests/e2e/support/coverageMatrix.ts` notes to distinguish launch-option coverage from saved-action guard coverage.

Required tests:

- Red test: `electron/backend/runner.test.ts` fails before adding `use_profile` to unsupported guard cases.
- Red test: `electron/backend/graphCompiler.test.ts` fails before table-driving every launch-time action.
- Coverage guard test through `npm run test:e2e:full -- tests/e2e/coverage-matrix.e2e.ts`.

Docs/README impact:

- No user-facing README impact if behavior stays unchanged; update audit matrix and testing docs if coverage categories change.

## F-004 - Planned Hidden Action Guard Coverage Is Overstated

Severity: P2

Action/node/field: `switch_frame`, `save_session`, `load_session`, `set_secret`, `fallback_selector`, `retry_step`

Source-of-truth drift:

- Expected source: `tests/e2e/support/coverageMatrix.ts:119` says planned hidden actions such as `save_session`, `load_session`, `set_secret`, `fallback_selector`, and `retry_step` have runner tests asserting unsupported in-run failure.
- Actual source: `electron/backend/runner.test.ts:1746` does not include those actions in the unsupported-action test table.

Expected behavior:

- Each `planned_hidden` action should have explicit runner unsupported coverage, because `unsupportedInRunReason` is the real guard that prevents stubbed runner branches from silently succeeding.

Actual behavior:

- `unsupportedInRunReason` rejects `planned_hidden` actions in `src/lib/actionCapabilities.ts:120`, and runner calls it before dispatch in `electron/backend/runner.ts:556`.
- The runner switch still contains legacy/stub branches for planned actions in `electron/backend/runner.ts:839`, `electron/backend/runner.ts:1041`, and `electron/backend/runner.ts:1048`; these branches would silently write outputs or no-op if the guard regressed.
- The current runner unsupported test covers `detect_challenge`, `pause_for_human`, and `checkpoint`, but not `switch_frame`, `save_session`, `load_session`, `set_secret`, `fallback_selector`, or `retry_step`.

Evidence:

- `src/lib/actionCapabilities.ts:52` marks `switch_frame` as `planned_hidden`.
- `src/lib/actionCapabilities.ts:78` marks `save_session`, `load_session`, and `set_secret` as `planned_hidden`.
- `src/lib/actionCapabilities.ts:89` marks `detect_challenge`, `pause_for_human`, `fallback_selector`, `retry_step`, and `checkpoint` as `planned_hidden`.
- `electron/backend/runner.test.ts:1752` lists unsupported test configs and omits several planned actions.
- `tests/e2e/support/coverageMatrix.ts:119` through `tests/e2e/support/coverageMatrix.ts:128` claims runner unsupported coverage for omitted actions.

Minimal fix plan:

- Convert the runner unsupported test table to include every `planned_hidden` action.
- Add a capability-driven test that verifies all `planned_hidden` actions fail before dispatch, so future actions cannot be added without guard coverage.
- Update coverage matrix notes to say coverage is capability-driven once the test is added.

Required tests:

- Red test: missing planned action in the unsupported table should fail.
- Focused check: `npm test -- electron/backend/runner.test.ts src/lib/actionCapabilities.test.ts`.
- Regression check: `npm run test:e2e:full -- tests/e2e/coverage-matrix.e2e.ts`.

Docs/README impact:

- No README impact if runtime behavior stays unchanged. Update `docs/architecture/testing.md` only if coverage terminology changes.

## F-005 - Compatibility Output And Subworkflow Coverage Is Overstated

Severity: P2

Action/node/field: `transform_variable`, `assert_output`, `run_subworkflow`

Source-of-truth drift:

- Expected source: `tests/e2e/support/coverageMatrix.ts:114` says `transform_variable` has backend runner transformation coverage.
- Expected source: `tests/e2e/support/coverageMatrix.ts:115` says `assert_output` has backend runner output assertion coverage.
- Expected source: `tests/e2e/support/coverageMatrix.ts:160` through `tests/e2e/support/coverageMatrix.ts:162` says graph-node coverage exists in both `electron/backend/runner.test.ts` and `electron/backend/graphCompiler.test.ts`.
- Actual source: direct `rg` over `electron/backend/runner.test.ts`, `electron/backend/graphCompiler.test.ts`, and `tests/e2e` found no behavior assertions for `transform_variable` or `assert_output`, and no compiler assertions for `run_subworkflow`.

Expected behavior:

- Coverage matrix entries should point to tests that assert behavior: transformation output, assertion pass/fail, subworkflow compile shape, and subworkflow runtime unsupported failure.

Actual behavior:

- Runtime source implements `transform_variable` and `assert_output` in `electron/backend/runner.ts:971`, but tests do not assert those behaviors directly.
- Compiler source emits and validates graph nodes in `electron/backend/graphCompiler.ts:413`, `electron/backend/graphCompiler.ts:424`, and `electron/backend/graphCompiler.ts:435`, but current compiler tests do not assert these compile shapes.
- `run_subworkflow` runtime unsupported behavior is covered by `electron/backend/runner.test.ts:1746`, but compiler coverage is not verified.

Evidence:

- `electron/backend/runner.ts:971` contains the output transformation and assertion implementations.
- `src/lib/actionCapabilities.ts:126` makes `run_subworkflow` explicitly unsupported at runtime.
- `electron/backend/runner.test.ts:1755` includes `run_subworkflow` in the unsupported table.
- `electron/backend/graphCompiler.ts:413` through `electron/backend/graphCompiler.ts:443` compile the three graph node types.
- `tests/e2e/support/coverageMatrix.ts:114` through `tests/e2e/support/coverageMatrix.ts:116` claim behavior coverage that is not present in the referenced tests.

Minimal fix plan:

- Add runner tests for `transform_variable` happy path and `assert_output` pass/fail paths.
- Add graph compiler tests for `transform_variable`, `assert_output`, and `run_subworkflow` emitted config shape and required-field validation.
- Update coverage matrix notes to distinguish implemented behavior coverage from unsupported placeholder coverage.

Required tests:

- Red tests in `electron/backend/runner.test.ts` for transform/assert behavior.
- Red tests in `electron/backend/graphCompiler.test.ts` for compile and validation shape.
- Coverage guard through `npm run test:e2e:full -- tests/e2e/coverage-matrix.e2e.ts`.

Docs/README impact:

- Update `docs/architecture/testing.md` if test ownership descriptions change.

## F-006 - Recovery Control-Flow Coverage Is Overstated

Severity: P2

Action/node/field: `try_catch`, `fallback_block`, graph nodes `try_catch`, `fallback`

Source-of-truth drift:

- Expected source: `tests/e2e/support/coverageMatrix.ts:109` says `try_catch` is covered by backend runner tests.
- Expected source: `tests/e2e/support/coverageMatrix.ts:110` says `fallback_block` is covered by backend runner tests.
- Expected source: `tests/e2e/support/coverageMatrix.ts:153` and `tests/e2e/support/coverageMatrix.ts:154` say graph nodes `try_catch` and `fallback` are covered by backend runner and graph compiler tests.
- Actual source: direct search of `electron/backend/runner.test.ts`, `electron/backend/graphCompiler.test.ts`, and `tests/e2e/control-flow.e2e.ts` did not find behavior assertions for `try_catch` or `fallback`.

Expected behavior:

- Recovery blocks should have tests for success branch, error branch, finally branch, empty recovery branch preserving failure behavior, fallback success, fallback failover, and empty fallback preserving failure behavior.

Actual behavior:

- Runtime implements `try_catch` and `fallback_block` in `electron/backend/runner.ts:942`, but current referenced tests do not assert those semantics.
- Compiler emits `try_catch` and `fallback_block` configs in `electron/backend/graphCompiler.ts:362` and `electron/backend/graphCompiler.ts:375`, but current referenced tests do not assert those compile shapes.

Evidence:

- `electron/backend/runner.ts:942` contains runtime try/catch/fallback execution.
- `electron/backend/graphCompiler.ts:362` and `electron/backend/graphCompiler.ts:375` compile graph recovery nodes.
- `tests/e2e/support/coverageMatrix.ts:109` through `tests/e2e/support/coverageMatrix.ts:110` claim backend runner coverage.
- `tests/e2e/support/coverageMatrix.ts:153` through `tests/e2e/support/coverageMatrix.ts:154` claim runner and compiler coverage.
- `tests/e2e/control-flow.e2e.ts:20` annotates covered nodes and does not list `try_catch` or `fallback`.

Minimal fix plan:

- Add runner tests for `try_catch` success/error/finally and empty recovery failure preservation.
- Add runner tests for `fallback_block` fallback path and empty fallback failure preservation.
- Add graph compiler tests for `try_catch` and `fallback` branch ports, nested compile paths, and continuation.
- Update coverage matrix notes after tests exist.

Required tests:

- Red tests in `electron/backend/runner.test.ts` for recovery behavior.
- Red tests in `electron/backend/graphCompiler.test.ts` for recovery compile shapes.
- Coverage guard through `npm run test:e2e:full -- tests/e2e/coverage-matrix.e2e.ts`.

Docs/README impact:

- Update `docs/architecture/testing.md` if coverage ownership descriptions change.

## F-007 - `set_viewport` Silently Ignores Device Shape Fields

Severity: P1

Action/node/field: `set_viewport.config.device_scale_factor`, `set_viewport.config.mobile`, `set_viewport.config.touch`

Source-of-truth drift:

- Expected source: `src/types/workflow.ts:738` through `src/types/workflow.ts:745` defines viewport width, height, device scale factor, mobile, and touch fields as the action contract.
- Expected source: `src/features/workflows/lib/stepHelpContent.ts:565` describes `set_viewport` as emulating viewport and device shape.
- Actual source: `electron/backend/runner.ts:997` through `electron/backend/runner.ts:1002` applies only width and height with `page.setViewportSize`.

Expected behavior:

- Either every editable `set_viewport` field should affect runtime behavior, or runtime/compiler/UI should reject or hide fields that cannot be changed after launch.
- Evidence should not report a device shape as applied when only viewport size changed.

Actual behavior:

- UI exposes `Device scale factor`, `Mobile`, and `Touch` for visible `set_viewport` actions in `src/features/workflows/components/ActionConfigSessionFields.tsx:193` through `src/features/workflows/components/ActionConfigSessionFields.tsx:234`.
- Validation accepts positive `device_scale_factor` and does not reject `mobile` or `touch` combinations in `electron/backend/graphCompiler.ts:962` through `electron/backend/graphCompiler.ts:967`.
- Runner applies only `{ width, height }` and then stores the full config in `last_set_viewport`, which makes the ignored fields appear preserved.
- Existing unit and E2E tests assert only viewport width/height, not device scale factor, mobile, or touch behavior.

Evidence:

- `src/types/workflow.ts:738` through `src/types/workflow.ts:745` defines the ignored fields.
- `src/features/workflows/components/ActionConfigSessionFields.tsx:193` through `src/features/workflows/components/ActionConfigSessionFields.tsx:234` renders the ignored fields.
- `electron/backend/runner.ts:91` exposes only `setViewportSize(viewport: { width; height })` on the driver page interface.
- `electron/backend/runner.ts:997` through `electron/backend/runner.ts:1002` sends only width and height to the driver.
- `electron/backend/runner.test.ts:1721` through `electron/backend/runner.test.ts:1728` supplies `device_scale_factor: 2`, `mobile: true`, and `touch: true`, but `electron/backend/runner.test.ts:1743` only asserts `viewport:390:844`.
- `tests/e2e/browser-context-storage.e2e.ts:33` through `tests/e2e/browser-context-storage.e2e.ts:45` checks only `window.innerWidth` and `window.innerHeight`.

Minimal fix plan:

- Decide whether device-shape changes belong only in Workflow Settings Browser Launch or should remain in the in-run action.
- If launch-only, remove/hide/reject `device_scale_factor`, `mobile`, and `touch` from the in-run action while preserving migration for saved workflows.
- If still supported in-run, extend the driver/runtime with a tested mechanism that actually changes observable device scale, mobile, and touch state, or fail explicitly when the driver cannot support it.

Required tests:

- Red test: runner test proving `device_scale_factor`, `mobile`, and `touch` are either applied through an explicit driver API or rejected before execution.
- Component/help tests updated for whichever fields remain editable.
- E2E or browser-driver smoke checking observable device-shape behavior if the fields remain supported.

Docs/README impact:

- Update `docs/domain/action-taxonomy.md`, `docs/architecture/testing.md`, and action/help docs to distinguish runtime viewport-size changes from launch-time device identity settings.

## F-008 - `mock_response.url_contains` Uses Route Pattern Semantics

Severity: P1

Action/node/field: `mock_response.config.url_contains`

Source-of-truth drift:

- Expected source: `src/types/workflow.ts:797` through `src/types/workflow.ts:798` names the field `url_contains`.
- Expected source: `src/features/workflows/components/ActionConfigReliabilityFields.tsx:233` through `src/features/workflows/components/ActionConfigReliabilityFields.tsx:239` labels the field "URL contains".
- Actual source: `electron/backend/runner.ts:1095` through `electron/backend/runner.ts:1102` passes the value directly to `context.route`.

Expected behavior:

- A field named `url_contains` should match candidate URLs by substring, like `wait_for_request` and `wait_for_response`.
- If the runtime expects a Playwright route glob/pattern instead, the contract, default, UI label, help, validation, and tests should call it a pattern.

Actual behavior:

- Runner registers `context.route(action.config.url_contains, handler)` instead of a predicate that checks `url.includes(action.config.url_contains)`.
- The default value is `/api/mock` in `src/features/workflows/lib/workflowActionDefaults.ts:347`, which reads as substring semantics.
- Current E2E uses a full fixture URL in `tests/e2e/capture-network.e2e.ts:219`, so it does not prove the documented substring/default behavior.

Evidence:

- `src/types/workflow.ts:797` through `src/types/workflow.ts:798` defines `url_contains`.
- `src/features/workflows/components/ActionConfigReliabilityFields.tsx:233` through `src/features/workflows/components/ActionConfigReliabilityFields.tsx:239` exposes the label "URL contains".
- `electron/backend/graphCompiler.ts:1031` validates the field with message "URL contains is required".
- `electron/backend/runner.ts:1095` through `electron/backend/runner.ts:1102` uses the raw field as the route selector.
- `tests/e2e/capture-network.e2e.ts:219` passes `${fixtureServer.baseUrl}/api/mock`, and `tests/e2e/capture-network.e2e.ts:244` only asserts the full-URL case.

Minimal fix plan:

- Choose one contract: substring predicate or explicit route pattern.
- If substring, change runner route registration to a predicate with `route.request().url().includes(config.url_contains)`.
- If pattern, rename/migrate the field or update labels/help/defaults/docs to pattern semantics and add examples such as `**/api/mock`.

Required tests:

- Red runner test or E2E using `url_contains: "/api/mock"` against a full fixture URL.
- Regression test for full URL matching.
- Validation/help test updated if the field semantics are renamed to pattern matching.

Docs/README impact:

- Update action help and `docs/architecture/testing.md` if semantics or coverage ownership changes.

## F-009 - Hidden Graph Utility Node Coverage Is Overstated

Severity: P2

Action/node/field: graph nodes `manual_approval`, `rate_limit`

Source-of-truth drift:

- Expected source: `tests/e2e/support/coverageMatrix.ts:163` says `manual_approval` is covered by `electron/backend/graphCompiler.test.ts`.
- Expected source: `tests/e2e/support/coverageMatrix.ts:164` says `rate_limit` is covered by `electron/backend/graphCompiler.test.ts`.
- Actual source: direct search of `electron/backend/graphCompiler.test.ts`, `electron/backend/runner.test.ts`, and `tests/e2e/control-flow.e2e.ts` found no `manual_approval` or `rate_limit` assertions.

Expected behavior:

- Hidden graph utility nodes should have tests proving their exact compile output and guard behavior: `manual_approval` should compile to a planned `pause_for_human` guard, and `rate_limit` should compile to a duration `wait` with positive delay handling.

Actual behavior:

- Compiler implements both mappings in `electron/backend/graphCompiler.ts:453` through `electron/backend/graphCompiler.ts:465`.
- Frontend tests prove hidden palette behavior and ports, but backend compiler output is not asserted.
- Coverage matrix points to backend compiler tests that do not contain the node names.

Evidence:

- `electron/backend/graphCompiler.ts:453` through `electron/backend/graphCompiler.ts:465` implements the compile mappings.
- `electron/backend/graphCompiler.ts:635` through `electron/backend/graphCompiler.ts:638` validates zero `rate_limit.delay_ms`.
- `src/features/workflows/components/WorkflowGraphEditor.test.tsx:1046` verifies both nodes are hidden from the simplified logic palette.
- `src/features/workflows/lib/workflowGraph.test.ts:123` verifies `manual_approval` ports.
- `tests/e2e/support/coverageMatrix.ts:163` through `tests/e2e/support/coverageMatrix.ts:164` claims backend compiler coverage.

Minimal fix plan:

- Add graph compiler tests for `manual_approval` emitted `pause_for_human` config and continuation.
- Add graph compiler tests for `rate_limit` emitted `wait` duration config, default delay, custom delay, and zero-delay validation.
- Update coverage matrix notes only after backend tests exist.

Required tests:

- Red tests in `electron/backend/graphCompiler.test.ts` for both graph node compile shapes.
- Focused check: `npm test -- electron/backend/graphCompiler.test.ts`.
- Coverage guard: `npm run test:e2e:full -- tests/e2e/coverage-matrix.e2e.ts`.

Docs/README impact:

- No user-facing README change if behavior stays unchanged; update `docs/architecture/testing.md` if coverage ownership changes.

## F-010 - `assert_element` Only Enforces Visible State

Severity: P1

Action/node/field: `assert_element.config.state`

Source-of-truth drift:

- Expected source: `src/types/workflow.ts:606` through `src/types/workflow.ts:612` allows `attached`, `visible`, `hidden`, `enabled`, and `disabled`.
- Expected source: `src/features/workflows/components/ActionConfigOutputFields.tsx:47` through `src/features/workflows/components/ActionConfigOutputFields.tsx:60` exposes all five states in the UI.
- Actual source: `electron/backend/runner.ts:865` through `electron/backend/runner.ts:868` only checks `visible`.

Expected behavior:

- `assert_element` should fail when the selected state is not true for `attached`, `visible`, `hidden`, `enabled`, or `disabled`.

Actual behavior:

- Runner reads locator visibility and only throws when `state === "visible"` and the element is not visible.
- For `attached`, `hidden`, `enabled`, and `disabled`, runner returns success without checking the requested state.
- Current E2E only covers the `visible` assertion path.

Evidence:

- `src/types/workflow.ts:611` defines the five allowed states.
- `src/features/workflows/components/ActionConfigOutputFields.tsx:55` through `src/features/workflows/components/ActionConfigOutputFields.tsx:59` renders the five state options.
- `electron/backend/runner.ts:865` through `electron/backend/runner.ts:868` only enforces `visible`.
- `tests/e2e/wait-assertion-actions.e2e.ts:82` through `tests/e2e/wait-assertion-actions.e2e.ts:84` tests only `state: "visible"`.
- `tests/e2e/support/coverageMatrix.ts:81` marks `assert_element` as covered by the wait/assertion E2E file, which does not cover the other states.

Minimal fix plan:

- Implement state-specific checks using locator wait/visibility/enabled semantics, matching the existing wait action behavior where possible.
- Ensure unsupported driver methods fail explicitly instead of silently passing.

Required tests:

- Red runner tests or E2E cases for `hidden`, `attached`, `enabled`, and `disabled` pass/fail behavior.
- Regression test for existing `visible` behavior.
- Focused checks: `npm test -- electron/backend/runner.test.ts` and `npm run test:e2e:full -- tests/e2e/wait-assertion-actions.e2e.ts`.

Docs/README impact:

- No README change if behavior is fixed to match the existing contract; update help only if supported states are reduced.

## F-011 - `set_checkbox` Compatibility Coverage Is Overstated

Severity: P2

Action/node/field: `set_checkbox`

Source-of-truth drift:

- Expected source: `tests/e2e/support/coverageMatrix.ts:99` says `set_checkbox` is covered by migration/compatibility tests.
- Actual source: direct search found `set_checkbox` in capability/migration/runner source, but no behavior assertion in `electron/backend/runner.test.ts`, `electron/backend/graphCompiler.test.ts`, `electron/backend/commands.test.ts`, or E2E tests.

Expected behavior:

- Hidden compatibility actions should have explicit load/migration and runner behavior coverage, because saved legacy workflows can still contain them.

Actual behavior:

- Capability registry hides `set_checkbox` from primary authoring in `src/lib/actionCapabilities.ts:20`.
- Migration keeps/drops selected fields for `set_checkbox` in `electron/backend/workflowGraphMigration.ts:33` and `electron/backend/workflowGraphMigration.ts:80`.
- Runner implements checked/unchecked behavior in `electron/backend/runner.ts:661` through `electron/backend/runner.ts:675`.
- Tests cover visible replacement actions `check`, `uncheck`, and `toggle_checkbox`, but not saved legacy `set_checkbox`.

Evidence:

- `tests/e2e/support/coverageMatrix.ts:99` claims compatibility coverage.
- `src/lib/actionCapabilities.ts:20` marks the action `compatibility_hidden`.
- `electron/backend/workflowGraphMigration.ts:33` and `electron/backend/workflowGraphMigration.ts:80` include `set_checkbox`.
- `electron/backend/runner.ts:661` through `electron/backend/runner.ts:675` implements runtime behavior.
- `tests/e2e/core-execution.e2e.ts:104` through `tests/e2e/core-execution.e2e.ts:117` cover replacement checkbox actions but not `set_checkbox`.

Minimal fix plan:

- Add a migration/load test with a saved workflow containing `set_checkbox`.
- Add a runner test for checked and unchecked compatibility behavior.
- Update coverage matrix note only after those tests exist.

Required tests:

- Red test: runner executes legacy `set_checkbox` checked/unchecked against a fake locator.
- Red test: command/migration load preserves or migrates a saved legacy `set_checkbox` workflow as intended.
- Coverage guard: `npm run test:e2e:full -- tests/e2e/coverage-matrix.e2e.ts`.

Docs/README impact:

- No README impact if compatibility behavior remains hidden; update testing docs if compatibility coverage ownership changes.

## F-012 - Iframe Target Authoring Is Not Exposed For Structured Element Targets

Severity: P2

Action/node/field: `ElementTarget.iframe`, legacy `iframe_xpath`

Source-of-truth drift:

- Expected source: `src/types/workflow.ts:839` through `src/types/workflow.ts:843` models nested `ElementTarget.iframe`.
- Expected source: `electron/backend/workflowGraphMigration.ts:156` through `electron/backend/workflowGraphMigration.ts:165` converts legacy XPath plus `iframe_xpath` into `target.iframe`.
- Expected source: `electron/backend/runner.ts:1876` through `electron/backend/runner.ts:1918` executes nested iframe targets through `frameLocator`.
- Actual source: `src/features/workflows/components/ActionConfigElementSharedFields.tsx:139` through `src/features/workflows/components/ActionConfigElementSharedFields.tsx:308` only renders first-level locator and constraint controls.

Expected behavior:

- Operators should be able to author or edit iframe-scoped element targets in the primary structured target UI, or help/docs should clearly mark iframe targets as import/API-only.

Actual behavior:

- Structured target UI preserves an existing `target.iframe`, but provides no control to create or edit it.
- Legacy `ElementOptionalFields` has an `Iframe XPath` input in `src/features/workflows/components/ActionConfigElementSharedFields.tsx:52`, but `rg` finds no component importing or rendering `ElementOptionalFields`.
- Current UI tests cover basic structured target persistence/defaults but not iframe target authoring.

Evidence:

- `src/types/workflow.ts:842` defines `ElementTarget.iframe`.
- `electron/backend/workflowGraphMigration.ts:160` through `electron/backend/workflowGraphMigration.ts:164` creates nested iframe targets from legacy `iframe_xpath`.
- `electron/backend/runner.ts:1882` through `electron/backend/runner.ts:1884` selects a frame root when `target.iframe` exists.
- `electron/backend/runner.test.ts:1945` through `electron/backend/runner.test.ts:2021` proves runtime support for iframe targets.
- `src/features/workflows/components/ActionConfigElementSharedFields.tsx:181` and `src/features/workflows/components/ActionConfigElementSharedFields.tsx:207` preserve `target?.iframe`, but no rendered field mutates it.
- `src/features/workflows/components/WorkflowGraphEditor.test.tsx:806` through `src/features/workflows/components/WorkflowGraphEditor.test.tsx:827` covers only default locator kind.

Minimal fix plan:

- Add an iframe target subsection to `StructuredTargetFields`, reusing the same locator-kind controls for `target.iframe`.
- Preserve migration behavior for legacy `iframe_xpath`; do not reintroduce legacy public fields unless deliberately chosen.
- Update step help and field guidance to describe the actual iframe target controls.

Required tests:

- Red component test that creates a click action target inside an iframe and asserts saved graph config contains `target.iframe.locators`.
- Help-content test that iframe target guidance matches visible controls.
- Focused checks: `npm test -- src/features/workflows/components/WorkflowGraphEditor.test.tsx src/features/workflows/lib/stepHelpContent.test.ts`.

Docs/README impact:

- Update workflow help/docs if iframe target authoring becomes public UI behavior.

## F-013 - `WorkflowCondition.kind` Does Not Reject Unknown Runtime Values

Severity: P2

Action/node/field: `WorkflowCondition.kind`

Source-of-truth drift:

- Expected source: `src/types/workflow.ts:845` through `src/types/workflow.ts:850` defines five allowed condition kinds.
- Actual source: `electron/backend/graphCompiler.ts:1672` through `electron/backend/graphCompiler.ts:1688` validates required fields for known kinds but has no default branch for unknown kinds.
- Actual source: `electron/backend/runner.ts:2239` through `electron/backend/runner.ts:2257` returns `false` for unknown condition kinds.

Expected behavior:

- Imported/API-provided graph conditions with a `kind` outside the contract should fail graph validation/compile with an explicit error.

Actual behavior:

- Unknown condition kinds pass `validateWorkflowCondition` without error.
- At runtime, unknown condition kinds evaluate false, which can silently route graph execution into false/else, while/repeat termination, or resume timeout behavior.
- Direct test search found no invalid-condition-kind coverage in graph compiler or command tests.

Evidence:

- `src/types/workflow.ts:845` through `src/types/workflow.ts:850` lists the allowed condition union.
- `electron/backend/graphCompiler.ts:1673` switches over known kinds and exits with no default validation error.
- `electron/backend/runner.ts:2257` returns `false` for unknown condition kinds.
- `rg` found no `invalid condition` or unknown-kind test in `electron/backend/graphCompiler.test.ts`, `electron/backend/commands.test.ts`, or frontend condition tests.

Minimal fix plan:

- Add a default branch in condition validation that rejects unsupported `condition.kind` values.
- Keep runtime fallback defensive, but ensure command validation/compile rejects malformed graph inputs before runner execution.

Required tests:

- Red graph compiler test for `{ kind: "unknown" }` on `if`, loop, and action-level `if_condition` or a shared validation helper case.
- Command validation test if imported package/graph validation currently accepts the malformed condition.
- Focused check: `npm test -- electron/backend/graphCompiler.test.ts electron/backend/commands.test.ts`.

Docs/README impact:

- No README impact; this aligns runtime validation with the existing TypeScript contract.

## F-014 - `set_variable.value_type` Is Not Validated Against The Typed Variable Contract

Severity: P2

Action/node/field: `set_variable.config.value_type`, `set_variable.config.variables[].value_type`

Source-of-truth drift:

- Expected source: `src/types/workflow.ts:95` through `src/types/workflow.ts:100` restricts variable value types to `text`, `json`, `number`, and `boolean`.
- Actual source: `electron/backend/graphCompiler.ts:827` through `electron/backend/graphCompiler.ts:837` validates only variable names for `set_variable`.
- Actual source: `electron/backend/runner.ts:2192` through `electron/backend/runner.ts:2201` falls back to text for unknown value types.

Expected behavior:

- Unknown `value_type` values should fail validation before execution.
- Number and boolean parsing should have explicit semantics and tests for invalid or boundary values.

Actual behavior:

- Imported/API-provided `set_variable` actions can carry unsupported `value_type` strings without compiler validation.
- Runtime treats unsupported types as text, stores `Number(rendered)` for number values without rejecting `NaN`, and treats any non-`"true"` boolean string as `false`.
- Current tests cover typed variable happy paths, but direct search found no invalid `value_type`, invalid number, or boolean boundary tests for action-level variables.

Evidence:

- `src/types/workflow.ts:95` defines the allowed `VariableValueType` union.
- `electron/backend/graphCompiler.ts:827` through `electron/backend/graphCompiler.ts:837` checks names only.
- `electron/backend/runner.ts:2197` through `electron/backend/runner.ts:2201` implements parsing without enum/range failure.
- `src/features/workflows/components/VariableConfigFields.tsx:70` through `src/features/workflows/components/VariableConfigFields.tsx:81` limits the visible UI select to valid types, so this is primarily an imported/API graph validation gap.

Minimal fix plan:

- Add validation for `value_type` on both legacy single-variable fields and `variables[]` rows.
- Decide and test strict parsing for invalid numbers/booleans; keep template-rendered JSON behavior if dynamic values are intended.
- Ensure error field paths point to `variables[index].value_type` or `value_type`.

Required tests:

- Red graph compiler tests for unsupported `value_type` in both single-variable and multi-row configs.
- Runner or compiler tests for invalid number and boolean parsing semantics after the intended behavior is chosen.
- Focused check: `npm test -- electron/backend/graphCompiler.test.ts electron/backend/runner.test.ts`.

Docs/README impact:

- Update field/help docs only if boolean or number parsing semantics become stricter than current UI copy implies.

## F-015 - `navigate.wait_until` Is Documented And Executed But Not Editable Or Enum-Validated

Severity: P2

Action/node/field: `navigate.config.wait_until`

Source-of-truth drift:

- Expected source: `src/types/workflow.ts:307` through `src/types/workflow.ts:312` allows `wait_until` values `load`, `dom_content_loaded`, and `network_idle`.
- Expected source: `electron/backend/runner.ts:564` through `electron/backend/runner.ts:570` forwards the value to Playwright navigation wait options.
- Actual source: `src/features/workflows/components/ActionConfigCoreFields.tsx:22` through `src/features/workflows/components/ActionConfigCoreFields.tsx:35` renders only URL for Navigate.
- Actual source: `electron/backend/graphCompiler.ts:653` through `electron/backend/graphCompiler.ts:657` validates URL and timeout only, not `wait_until`.

Expected behavior:

- Either `wait_until` should be a visible, tested Navigate editor field, or it should be documented/classified as API-only/legacy.
- Graph validation should reject unsupported `wait_until` values before runner execution.

Actual behavior:

- Help text describes Navigate `Wait until` and `Timeout ms`, but the current visible field list for Navigate returns only `URL`.
- Runtime will pass unknown imported/API `wait_until` strings through `waitUntil()` to `page.goto`, where failure behavior depends on driver implementation.
- Direct search found no invalid `navigate.wait_until` validation test.

Evidence:

- `src/types/workflow.ts:310` defines the allowed `wait_until` union.
- `electron/backend/runner.ts:568` forwards `waitUntil: waitUntil(action.config.wait_until)`.
- `src/features/workflows/components/ActionConfigCoreFields.tsx:22` through `src/features/workflows/components/ActionConfigCoreFields.tsx:35` renders only the URL input.
- `src/features/workflows/lib/stepHelpContent.ts:132` through `src/features/workflows/lib/stepHelpContent.ts:149` documents `Wait until` and `Timeout ms`.
- `src/features/workflows/lib/stepHelpContent.ts:898` through `src/features/workflows/lib/stepHelpContent.ts:899` says the actual Navigate field list is only `URL`.
- `electron/backend/graphCompiler.ts:653` through `electron/backend/graphCompiler.ts:657` does not validate `wait_until`.

Minimal fix plan:

- Add enum validation for `navigate.wait_until`, accepting only the current contract values and null/undefined.
- Decide whether Navigate advanced fields should be exposed in the UI; if they remain API-only, remove or adjust help copy so it does not describe unavailable controls.
- Add tests before changing behavior.

Required tests:

- Red graph compiler test for invalid `navigate.wait_until`.
- Component/help test that Navigate visible fields and help copy agree.
- Optional runner test that valid `dom_content_loaded` and `network_idle` map to Playwright `domcontentloaded` and `networkidle`.

Docs/README impact:

- Update action help/docs if `Wait until` and `Timeout ms` remain hidden or become visible advanced fields.

## F-016 - Take Screenshot Help Describes Filesystem Paths That Validation Rejects

Severity: P2

Action/node/field: `take_screenshot.config.path`

Source-of-truth drift:

- Expected source: `electron/backend/runner.ts:785` through `electron/backend/runner.ts:805` writes screenshots as managed evidence artifacts under the run evidence directory.
- Expected source: `electron/backend/graphCompiler.ts:798` through `electron/backend/graphCompiler.ts:803` validates screenshot path as a safe artifact name.
- Actual docs/help: `src/features/workflows/lib/stepHelpContent.ts:587` through `src/features/workflows/lib/stepHelpContent.ts:605` tells users to provide a PNG file path such as `/tmp/workflow-result.png` and says the parent folder must exist.

Expected behavior:

- Help should describe the field as a safe artifact filename/name inside managed evidence storage, or the runtime should actually support arbitrary filesystem paths.

Actual behavior:

- Validation rejects absolute paths, path separators, and file URLs through `safeArtifactNameValidation`.
- Runner ignores arbitrary parent directories and resolves the requested name through managed evidence artifact paths.
- Empty path is allowed and falls back to `screenshot`, while help implies a concrete file path.

Evidence:

- `electron/backend/graphCompiler.ts:1235` through `electron/backend/graphCompiler.ts:1252` rejects unsafe artifact names including absolute paths and separators.
- `electron/backend/runner.ts:786` through `electron/backend/runner.ts:798` resolves screenshots through `resolveEvidenceArtifact`.
- `src/features/workflows/lib/stepHelpContent.ts:600` says `Path` is a PNG file path to write.
- `src/features/workflows/lib/stepHelpContent.ts:604` gives `/tmp/workflow-result.png` as an example, which validation rejects.
- `electron/backend/graphCompiler.test.ts:609` validates rejection for `../secret.png`, but no help alignment test prevents absolute-path copy drift.

Minimal fix plan:

- Update screenshot help examples and field copy to say safe artifact filename, not arbitrary filesystem path.
- Clarify that the file is stored under run evidence artifacts and output stores the relative evidence path.
- Add a help/content test for the example so it cannot regress to absolute paths.

Required tests:

- Red help content test asserting screenshot examples do not contain absolute paths or path separators.
- Existing compiler safe-path tests should remain green.
- Focused check: `npm test -- src/features/workflows/lib/stepHelpContent.test.ts electron/backend/graphCompiler.test.ts`.

Docs/README impact:

- Update any public docs/README that describe screenshot `Path` as a filesystem path.

## F-017 - Data Capture `timeout_ms` Is Validated But Ignored At Runtime

Severity: P2

Action/node/field: `extract_text`, `extract_attribute`, `extract_input_value`, `extract_table`, `extract_list` `config.timeout_ms`

Source-of-truth drift:

- Expected source: `src/types/workflow.ts:860` through `src/types/workflow.ts:866` includes optional `timeout_ms` in shared `DataCaptureElementConfig`.
- Expected source: `electron/backend/graphCompiler.ts:1104` through `electron/backend/graphCompiler.ts:1114` validates the field as a positive timeout.
- Actual source: `electron/backend/runner.ts:749` through `electron/backend/runner.ts:783` resolves locators and extracts values without passing or waiting on `timeout_ms`.

Expected behavior:

- If capture actions accept `timeout_ms`, runner should apply it to locator readiness/extraction or fail explicitly that capture timeouts are unsupported/API-only.

Actual behavior:

- Imported/API-provided `timeout_ms` values pass validation but do not affect capture execution.
- The visible capture editor does not expose the field, so current UI users are unlikely to hit it, but saved/API workflows can contain it.
- Direct search found runner/E2E coverage for capture behavior, but not for capture timeout behavior.

Evidence:

- `src/types/workflow.ts:865` defines `timeout_ms` on `DataCaptureElementConfig`.
- `electron/backend/graphCompiler.ts:1113` validates `timeout_ms`.
- `electron/backend/runner.ts:749` through `electron/backend/runner.ts:783` does not reference `action.config.timeout_ms` for capture actions.
- `src/features/workflows/components/ActionConfigCaptureFields.tsx:99` through `src/features/workflows/components/ActionConfigCaptureFields.tsx:121` renders target and output name only for data capture fields.

Minimal fix plan:

- Decide whether capture timeout is supported API behavior.
- If supported, apply timeout to locator wait/readiness before extraction and add tests.
- If unsupported, remove or migrate the field from the contract/validation/help path and document it as legacy compatibility.

Required tests:

- Red runner test proving `timeout_ms` affects locator wait/extraction behavior or is rejected explicitly.
- Graph compiler test for the chosen contract.
- Focused check: `npm test -- electron/backend/runner.test.ts electron/backend/graphCompiler.test.ts`.

Docs/README impact:

- Update action help/docs if capture timeouts become visible or are classified as legacy/API-only.

## F-018 - Set Cookie Blank Domain Default Does Not Implement Current-Host Semantics

Severity: P1

Action/node/field: `set_cookie.config.domain`

Source-of-truth drift:

- Expected source: `src/features/workflows/lib/workflowActionDefaults.ts:270` through `src/features/workflows/lib/workflowActionDefaults.ts:272` defaults `domain` to null and `path` to `/`.
- Expected source: `src/features/workflows/components/ActionConfigSessionFields.tsx:65` through `src/features/workflows/components/ActionConfigSessionFields.tsx:73` presents blank Domain as "Current host".
- Actual source: `electron/backend/runner.ts:1023` through `electron/backend/runner.ts:1031` passes `domain: action.config.domain ?? undefined` to `context.addCookies` and never derives the current page hostname.

Expected behavior:

- Leaving Domain blank should either infer the current page host, matching the editor placeholder/default contract, or validation should require an explicit domain before run.

Actual behavior:

- The default visible `set_cookie` config has `domain: null`, passes validation when name/value are filled, and reaches runtime without a domain or URL fallback.
- Existing E2E coverage supplies an explicit hostname, so it does not prove the blank-domain default path works.

Evidence:

- `electron/backend/graphCompiler.ts:946` through `electron/backend/graphCompiler.ts:950` validates only cookie name and value.
- `electron/backend/runner.ts:1024` through `electron/backend/runner.ts:1030` creates a cookie with no `url` field and an undefined domain when the config domain is blank.
- `tests/e2e/browser-context-storage.e2e.ts:72` through `tests/e2e/browser-context-storage.e2e.ts:77` sets `domain: hostname`, so the current-host placeholder behavior is untested.
- `src/features/workflows/lib/workflowStepForm.test.ts:438` through `src/features/workflows/lib/workflowStepForm.test.ts:441` covers editing a nonblank domain, not the default blank path.

Minimal fix plan:

- Add a failing runner or E2E test for a `set_cookie` action that runs after navigation with `domain: null`.
- Either derive current hostname and pass a valid cookie domain or URL to `context.addCookies`, or require Domain in validation/UI and remove the current-host placeholder.
- Keep the fix narrowly scoped to cookie domain handling.

Required tests:

- Red runner test with `set_cookie` after navigation and `domain: null`, asserting either inferred current host or explicit validation failure depending on chosen contract.
- E2E smoke for default-palette `set_cookie` with a filled name/value but blank domain if current-host inference is kept.
- Focused check: `npm test -- electron/backend/runner.test.ts electron/backend/graphCompiler.test.ts`.

Docs/README impact:

- Update field help and UI placeholder if blank Domain becomes invalid; otherwise document current-host inference.

## F-019 - Execute JS `timeout_ms` Is Validated And Editable But Ignored At Runtime

Severity: P1

Action/node/field: `execute_js.config.timeout_ms`

Source-of-truth drift:

- Expected source: `src/types/workflow.ts:781` through `src/types/workflow.ts:782` defines optional `timeout_ms` for `execute_js`.
- Expected source: `src/features/workflows/components/ActionConfigReliabilityFields.tsx:199` through `src/features/workflows/components/ActionConfigReliabilityFields.tsx:209` exposes Timeout ms in the editor.
- Actual source: `electron/backend/runner.ts:1063` through `electron/backend/runner.ts:1070` executes `page.evaluate` without referencing `action.config.timeout_ms`.

Expected behavior:

- A configured JavaScript timeout should bound `execute_js` execution, or the field should be hidden/rejected as unsupported.

Actual behavior:

- UI and API workflows can set a positive `timeout_ms`, compiler accepts it, and runtime ignores it.
- A long-running or never-resolving script can outlive the configured field until some unrelated run-level cancellation occurs.

Evidence:

- `electron/backend/graphCompiler.ts:1011` through `electron/backend/graphCompiler.ts:1015` validates `execute_js.timeout_ms` as a positive timeout.
- `src/features/workflows/lib/workflowStepForm.test.ts:608` through `src/features/workflows/lib/workflowStepForm.test.ts:646` proves the editor preserves `timeout_ms`.
- `electron/backend/runner.ts:1063` through `electron/backend/runner.ts:1070` does not use `timeout_ms`.
- Direct search found happy-path `execute_js` output tests and strict-humanized blocking tests, but no timeout behavior test.

Minimal fix plan:

- Add a failing runner test proving `execute_js.timeout_ms` fails an unresolved/overlong script promptly.
- Implement timeout enforcement around `page.evaluate`, or remove/reclassify the field if per-action JS timeouts are not supported.
- Preserve strict-humanized blocking behavior before evaluation.

Required tests:

- Red runner test for an unresolved async script with a short `timeout_ms`.
- Regression test that a normal script with `output_name` still stores its output.
- Focused check: `npm test -- electron/backend/runner.test.ts electron/backend/graphCompiler.test.ts src/features/workflows/lib/workflowStepForm.test.ts`.

Docs/README impact:

- Update action help/docs if JS timeout remains unsupported or if timeout behavior/error text changes.

## F-020 - Scroll UI Exposes Unsupported Modes And Runtime Ignores Scroll Behavior Fields

Severity: P2

Action/node/field: `scroll.config.mode`, `scroll.config.behavior`, `scroll.config.target`, `scroll.config.max_attempts`, `scroll.config.wait_ms`, `scroll.config.block`, `scroll.config.inline`

Source-of-truth drift:

- Expected source: `src/types/workflow.ts:397` through `src/types/workflow.ts:410` models page, container, into-view, and until-visible scroll fields.
- Expected UI source: `src/features/workflows/components/ActionConfigPointerFields.tsx:23` through `src/features/workflows/components/ActionConfigPointerFields.tsx:89` exposes all scroll modes plus Behavior and target fields.
- Actual validation source: `electron/backend/graphCompiler.ts:721` through `electron/backend/graphCompiler.ts:725` rejects every mode except `page`.
- Actual runner source: `electron/backend/runner.ts:627` through `electron/backend/runner.ts:648` performs only `window.scrollBy(... behavior: "instant")`.

Expected behavior:

- Visible scroll controls should either be executable/validated consistently or hidden/disabled until supported.

Actual behavior:

- The editor lets users choose `container`, `into_view`, and `until_visible`, but compiler rejects them before run.
- Behavior can be set to `smooth`, but runner always uses `instant`.
- Target, alignment, max-attempt, and wait fields are preserved but not used by the current runner.

Evidence:

- `src/features/workflows/components/ActionConfigPointerFields.tsx:35` through `src/features/workflows/components/ActionConfigPointerFields.tsx:39` renders unsupported mode options.
- `electron/backend/graphCompiler.ts:723` through `electron/backend/graphCompiler.ts:724` returns "Only page scroll is currently supported" for non-page modes.
- `electron/backend/runner.ts:631` hard-codes scroll behavior to `instant`.
- `src/features/workflows/lib/workflowStepForm.test.ts:56` through `src/features/workflows/lib/workflowStepForm.test.ts:58` only proves the unsupported value can be written.

Minimal fix plan:

- Add a failing component/validation test proving unsupported scroll modes should not be offered or should run.
- Choose one contract: hide/disable non-page modes and behavior, or implement container/into-view/until-visible behavior.
- Keep compiler and help copy aligned with the chosen contract.

Required tests:

- Red component test for visible scroll mode options matching compiler-supported modes.
- Runner test for `behavior: "smooth"` if behavior remains supported.
- Focused check: `npm test -- src/features/workflows/components/ActionConfigEditor.test.tsx electron/backend/graphCompiler.test.ts electron/backend/runner.test.ts`.

Docs/README impact:

- Update Scroll action help if modes remain unsupported or become fully implemented.

## F-021 - Click Advanced Contract Fields Are Preserved But Mostly Ignored At Runtime

Severity: P1

Action/node/field: `click.config.mode`, `scroll_into_view`, `block`, `inline`, `position`, `offset_x`, `offset_y`, and related advanced fields

Source-of-truth drift:

- Expected source: `src/types/workflow.ts:369` through `src/types/workflow.ts:394` defines click mode, scroll alignment, position, offset, retry, and post-click fields.
- Expected docs/help: `src/features/workflows/lib/stepHelpContent.ts:275` through `src/features/workflows/lib/stepHelpContent.ts:315` describes Real/Force DOM, scroll into view, block/inline, position, offsets, wait, and timeout behavior.
- Actual runner source: `electron/backend/runner.ts:598` through `electron/backend/runner.ts:605` only passes `button`, `click_count`, and `post_click_wait_ms`; `mode`, scroll, alignment, position, and offsets are ignored.

Expected behavior:

- If the click contract accepts advanced fields, runner should honor them or validation should reject/strip them explicitly.

Actual behavior:

- Imported/API workflows can request `force_dom`, a specific click position, offsets, or scroll alignment and still receive a normal locator click.
- These fields can be silently preserved through UI update helpers and graph compile without affecting execution.
- Primary UI exposes only target fields, while detailed help describes controls that are not rendered.

Evidence:

- `electron/backend/graphCompiler.ts:699` through `electron/backend/graphCompiler.ts:705` validates only target and generic timing for click.
- `electron/backend/runner.ts:598` through `electron/backend/runner.ts:602` ignores `mode`, `scroll_into_view`, `block`, `inline`, `position`, `offset_x`, and `offset_y`.
- `src/features/workflows/lib/workflowStepForm.test.ts:74` through `src/features/workflows/lib/workflowStepForm.test.ts:93` proves advanced click fields can be updated/preserved.
- `src/features/workflows/components/ActionConfigPointerFields.tsx:21` through `src/features/workflows/components/ActionConfigPointerFields.tsx:22` renders only target fields for click.

Minimal fix plan:

- Add failing runner tests for each supported click advanced behavior, starting with `mode: "force_dom"` and `position: "offset"`.
- Either implement advanced click behavior or classify unsupported fields as legacy/API-only and reject/hide them consistently.
- Align step help visible fields with the actual editor.

Required tests:

- Red runner test showing `force_dom` uses DOM click or is rejected explicitly.
- Red runner test showing offset/position affects click options or is rejected explicitly.
- Help/content test so Click detailed help does not advertise hidden unsupported controls.
- Focused check: `npm test -- electron/backend/runner.test.ts electron/backend/graphCompiler.test.ts src/features/workflows/lib/stepHelpContent.test.ts`.

Docs/README impact:

- Update Click help/docs to reflect which advanced fields are supported and visible.

## F-022 - Clear Input `method` Field Is Documented But Ignored

Severity: P2

Action/node/field: `clear_input.config.method`

Source-of-truth drift:

- Expected source: `src/types/workflow.ts:358` through `src/types/workflow.ts:366` defines `method` as `select_all`, `backspace`, or `dom`.
- Expected docs/help: `src/features/workflows/lib/stepHelpContent.ts:245` through `src/features/workflows/lib/stepHelpContent.ts:272` describes the three methods.
- Actual runner source: `electron/backend/runner.ts:595` through `electron/backend/runner.ts:597` always calls `locator.fill("")`.

Expected behavior:

- The configured clear method should affect execution, or the field should be hidden/rejected as legacy/unsupported.

Actual behavior:

- `method` is preserved if present but has no runtime effect.
- Primary UI renders only target fields for Clear Input, while detailed help documents Method.
- Direct search found no runner test for method-specific clear behavior.

Evidence:

- `src/features/workflows/components/ActionConfigPointerFields.tsx:19` through `src/features/workflows/components/ActionConfigPointerFields.tsx:20` renders only target fields for Clear Input.
- `electron/backend/graphCompiler.ts:699` through `electron/backend/graphCompiler.ts:705` validates only target and generic timing for Clear Input.
- `electron/backend/runner.ts:596` ignores `action.config.method`.
- `src/features/workflows/lib/stepHelpContent.ts:255` and `src/features/workflows/lib/stepHelpContent.ts:269` describe method-specific behavior.

Minimal fix plan:

- Decide whether clear methods are part of the supported runtime contract.
- If supported, implement `select_all`, `backspace`, and `dom` paths and expose the field deliberately.
- If unsupported, remove/adjust help and reject non-null imported methods.

Required tests:

- Red runner tests for `select_all`, `backspace`, and `dom`, or red validation tests rejecting unsupported methods.
- Help/content test ensuring Clear Input fields match visible/supported controls.
- Focused check: `npm test -- electron/backend/runner.test.ts electron/backend/graphCompiler.test.ts src/features/workflows/lib/stepHelpContent.test.ts`.

Docs/README impact:

- Update Clear Input help/docs if method support remains hidden or changes.

## F-023 - Element/Form Assertion Enum Fields Are Not Runtime-Validated And Can Silently Fall Back

Severity: P1

Action/node/field: element action `wait_until`, `input_text.typing_mode`, `select_option.match_by`, `set_checkbox.state`, `assert_text.match_mode`, `assert_output.match_mode`

Source-of-truth drift:

- Expected source: `src/types/workflow.ts:351`, `src/types/workflow.ts:353`, `src/types/workflow.ts:418`, `src/types/workflow.ts:430`, `src/types/workflow.ts:622`, and `src/types/workflow.ts:712` define finite enum values for these fields.
- Actual validation source: `electron/backend/graphCompiler.ts:699` through `electron/backend/graphCompiler.ts:737` validates target/value/timing but not these enum values.
- Actual validation source: `electron/backend/graphCompiler.ts:853` through `electron/backend/graphCompiler.ts:858` validates assertion target/text/timeout but not `assert_text.match_mode`.

Expected behavior:

- Imported/API workflows with enum values outside the TypeScript contract should fail validation before execution.

Actual behavior:

- Element action `wait_until` values outside `attached`, `visible`, `enabled`, and `clickable` fall through readiness handling.
- `input_text.typing_mode` values other than `type` fall back to `fill`.
- `select_option.match_by` values other than `label` are treated as `value`.
- `set_checkbox.state` values other than `checked` are treated as unchecked.
- `assert_text.match_mode` values other than `equals` or `contains` execute no assertion and can pass silently.
- `assert_output.match_mode` values other than `equals` or `contains` execute no assertion and can pass silently.

Evidence:

- `electron/backend/runner.ts:586` through `electron/backend/runner.ts:591` only branches on `typing_mode === "type"`.
- `electron/backend/runner.ts:1367` through `electron/backend/runner.ts:1387` has no default rejection for unknown `wait_until` values.
- `electron/backend/runner.ts:656` through `electron/backend/runner.ts:658` treats non-`label` `match_by` as value matching.
- `electron/backend/runner.ts:661` through `electron/backend/runner.ts:674` treats non-`checked` checkbox state as uncheck.
- `electron/backend/runner.ts:874` through `electron/backend/runner.ts:879` checks only `equals` and `contains`; unknown match modes return success.
- `electron/backend/runner.ts:974` through `electron/backend/runner.ts:982` has the same equals/contains-only pattern for output assertions.
- Direct test search found happy-path enum tests and UI option-label tests, but no invalid enum validation tests for these fields.

Minimal fix plan:

- Add enum validators for these fields in `validateActionConfig`.
- Keep runner defensive after validation, but avoid silent fallback for malformed imported configs.
- Add focused invalid-value tests before changing validation.

Required tests:

- Red graph compiler tests for invalid `wait_until`, `typing_mode`, `match_by`, checkbox `state`, `assert_text.match_mode`, and `assert_output.match_mode`.
- Runner defensive tests for malformed configs if runner can still receive direct API inputs.
- Focused check: `npm test -- electron/backend/graphCompiler.test.ts electron/backend/runner.test.ts`.

Docs/README impact:

- No public docs change expected if validation is aligned with the existing TypeScript/help enum contract.

## F-024 - Batch Headless Launch Mapping Lacks Direct Test Coverage

Severity: P2

Action/node/field: `run_policy.batch_headless`, batch `request.headless`, `browser_launch.headless`

Source-of-truth drift:

- Expected source: `src/types/workflow.ts:156` through `src/types/workflow.ts:161` defines batch run policy fields.
- Expected source: `electron/backend/commands.ts:879` through `electron/backend/commands.ts:888` forces batch row browser retention to close and maps row headless mode from request override or saved batch policy.
- Current tests: `electron/backend/commands.test.ts:1640` covers sequential batch execution, concurrency rejection, stop-on-first-failed-row, and forced close, but does not assert `browser_launch.headless`.

Expected behavior:

- Batch rows should close browsers after each row and should launch with `request.headless` when provided, otherwise saved `run_policy.batch_headless`.

Actual behavior:

- Source code maps headless correctly, but no direct test fails if the mapping is removed or inverted.
- UI tests only assert batch controls are disabled/paused, not backend launch behavior.

Evidence:

- `electron/backend/commands.ts:887` maps `headless: request.headless ?? settings.run_policy.batch_headless`.
- `electron/backend/commands.test.ts:1713` and `electron/backend/commands.test.ts:1714` assert forced close for batch rows.
- Direct search found no `runnerSettings[...].browser_launch.headless` assertion in batch command tests.

Minimal fix plan:

- Add focused backend command tests that capture runner settings for batch rows.
- Assert saved `run_policy.batch_headless` is used when request omits `headless`.
- Assert request `headless` overrides saved policy when provided.

Required tests:

- Red command test for saved `batch_headless: true` causing row `browser_launch.headless: true`.
- Red command test for request override `headless: false` with saved `batch_headless: true`.
- Focused check: `npm test -- electron/backend/commands.test.ts`.

Docs/README impact:

- No docs change required unless batch UI is unpaused or public behavior changes.
