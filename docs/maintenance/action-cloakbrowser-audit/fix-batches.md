# Audit Fix Batches

Status: Batch A complete; F-001, F-007, F-008, F-010, F-018, F-019, F-021, and F-023 fixed.

Do not implement fixes from this file without first adding or updating failing tests. Docs-only corrections are exempt from TDD.

## Batch A - Correctness And Runtime P0/P1

Entry criteria:

- Finding has P0 or P1 severity.
- Runtime behavior is wrong, unsafe, silently stubbed, or mapped to CloakBrowser incorrectly.

Required loop:

1. Add the smallest failing unit, runner, command, or E2E test.
2. Apply the smallest code fix.
3. Run targeted tests.
4. Run broader regression checks for the touched route.
5. Update docs when behavior or contract changes.

Likely checks:

- `npm test -- electron/backend/runner.test.ts`
- `npm test -- electron/backend/commands.test.ts`
- `npm test -- electron/backend/graphCompiler.test.ts`
- `npm run build:electron`
- `npm run test:e2e:smoke` when desktop behavior changes

Current findings: none.

Completed findings:

- F-001: `disabled_if_supported` WebRTC policy is rejected by backend settings validation and legacy persisted values normalize to `default`; supported WebRTC policy launch args/evidence are covered by runner tests.
- F-007: `set_viewport` active authoring now exposes only width/height, and graph validation plus runner execution reject launch-time device-shape fields when non-default values are present.
- F-008: `mock_response.url_contains` now uses substring matching through a URL predicate while preserving route-pattern behavior for `block_request.url_patterns`.
- F-010: `assert_element` now checks all supported states and fails explicitly when `attached`, `visible`, `hidden`, `enabled`, or `disabled` is false.
- F-018: `set_cookie` now infers the current page host when Domain is blank and records the resolved domain in runtime output.
- F-019: `execute_js.timeout_ms` now wraps page evaluation and fails overlong scripts with a clear timeout error.
- F-021: Click now honors `force_dom`, scroll alignment, and offset/named position options instead of silently falling back to a normal locator click.
- F-023: Element/form assertion enum fields now fail graph validation and defensive runner execution instead of silently falling back or passing.

## Batch B - Validation, Compiler, And Field Drift P1/P2

Entry criteria:

- Field shape, default, validation, compiler preservation, migration, or runner consumption is inconsistent.
- Issue does not require broad product redesign.

Required tests:

- Backend validation rejects missing, wrong type, wrong range, and unsupported combinations.
- Compiler preserves supported fields and drops/migrates legacy fields intentionally.
- Runner tests prove fields affect execution or fail explicitly.

Current findings:

- F-013: `WorkflowCondition.kind` values outside the TypeScript contract are not rejected during graph validation and silently evaluate false at runtime.
- F-014: `set_variable.value_type` is not validated and unsupported types fall back to text at runtime.
- F-015: `navigate.wait_until` is not enum-validated before runner execution.
- F-017: data capture `timeout_ms` is type/validation-supported but ignored by runner extraction paths.
- F-020: Scroll UI exposes non-page modes that compiler rejects and behavior fields runner ignores.
- F-022: `clear_input.method` is documented/preserved but ignored at runtime.

## Batch C - UI, Help, Docs, And Coverage P2/P3

Entry criteria:

- User-visible editor, help, docs, README, or coverage registry is stale or incomplete.

Required tests:

- Component tests for visible controls and disabled/hidden states.
- Help content tests for field coverage.
- E2E coverage matrix updates only after reading the referenced behavior tests.

Current findings:

- F-002: `user_agent` is runtime-mapped but absent from Workflow Settings UI/help.
- F-003: launch-time action guard coverage is not per-action.
- F-004: planned hidden action guard coverage is overstated.
- F-005: compatibility output/subworkflow coverage is overstated.
- F-006: recovery control-flow coverage is overstated.
- F-009: `manual_approval` and `rate_limit` coverage is overstated.
- F-011: `set_checkbox` compatibility coverage is overstated.
- F-012: structured iframe targets are supported by contract/runtime/migration but cannot be authored in the primary UI.
- F-015: Navigate help describes `Wait until`/`Timeout ms` controls that the visible editor does not render.
- F-016: Take Screenshot help describes arbitrary filesystem paths even though runtime/validation use managed evidence artifact names.
- F-024: Batch headless launch mapping is implemented but lacks direct command test coverage.

## Batch D - Refactor And Debt

Entry criteria:

- No behavior change is required.
- Refactor reduces repeated field definitions, repeated visibility logic, or audit complexity.

Guardrails:

- No unrelated visual restyling.
- No action/config additions unless a finding requires it.
- Preserve serialized compatibility unless a migration is explicitly added and tested.
