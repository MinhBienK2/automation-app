# Remove Owned Test Gates Design

## Status

Approved for spec-only documentation on 2026-05-14.

## Problem

Workflow Settings currently contains an `Owned Test Gates` section that configures
fingerprint preflight:

- `fingerprint_preflight_enabled`
- `fingerprint_probe_url`
- `fingerprint_profile_id`
- `fingerprint_allowed_origins`
- `fingerprint_proxy_label`
- `fingerprint_proxy_region`

When enabled, the compiler prepends fingerprint probe steps before user graph
actions. The command layer validates the probe URL, allowed origins, identity
profile, and headed browser requirement. Runner outputs can include
`fingerprint_preflight` evidence.

This feature is specialized and currently adds a large amount of UI, settings,
validation, compiler, evidence, test, and documentation surface. The requested
direction is to remove it completely from the current product.

## Goal

Delete `Owned Test Gates` and fingerprint preflight from the active product.

After implementation:

- Workflow Settings only contains `General`, `Run Policy`, `Browser Launch`, and
  `Environment`.
- The UI does not show `Owned Test Gates`.
- Workflow settings DTOs no longer expose an `owned_test_gates` section.
- Backend run validation no longer validates fingerprint preflight fields.
- Graph compilation no longer prepends fingerprint preflight steps.
- Runner/run outputs no longer document or expect `fingerprint_preflight`.
- Import/export/package settings no longer include `owned_test_gates`.
- Tests, mocks, help content, docs, and README no longer reference Owned Test
  Gates or fingerprint preflight as current behavior.

## Non-Goals

- Do not remove domain allowlist graph nodes or navigation domain policy.
- Do not remove Browser Launch profile/proxy/headless settings.
- Do not remove Environment initial variables.
- Do not remove run evidence generally, including `__action_traces`,
  `__evidence`, screenshots, downloads, and failure screenshots.
- Do not remove historical docs under `docs/superpowers/` unless a later cleanup
  explicitly targets historical archives.
- Do not add a replacement preflight gate in this change.

## Safety Boundary

Removing Owned Test Gates reduces one product-specific pre-run audit control.
The implementation must preserve the remaining safety boundaries:

- Domain allowlist graph nodes must still compile into run-scope navigation
  policy.
- Browser Launch settings must still make profile/proxy/headless behavior
  explicit.
- Runs must still persist evidence and action traces.
- Sensitive automation must remain scoped to owned or explicitly authorized
  targets through operator controls, workflow design, and documented usage.

This spec removes the fingerprint preflight mechanism, not the product's owned
target boundary.

## Current Touch Points

Types and frontend settings:

- `src/types/workflow.ts`
  - `WorkflowSettingsSectionId` includes `owned_test_gates`.
  - `WorkflowSettingsOwnedTestGates` type exists.
  - `WorkflowSettings` includes `owned_test_gates`.
  - Workflow package/settings types include the section.
- `src/features/workflows/lib/workflowSettings.ts`
  - Section metadata includes `Owned Test Gates`.
  - Defaults include `owned_test_gates`.
  - Bilingual help content includes `owned_test_gates`.
  - Browser Launch help references fingerprint preflight gates.
- `src/features/workflows/components/WorkflowSettingsDialog.tsx`
  - Renders `OwnedTestGatesSettingsSection`.
  - Imports `WorkflowSettingsOwnedTestGates`.
  - Shows fingerprint preflight fields and headed-mode warning.
- `src/features/workflows/components/WorkflowPackageOptions.tsx`
  - Labels `owned_test_gates` as `Owned Test Gates`.
- `src/App.tsx`
  - Tracks settings section save status for `owned_test_gates`.

Backend:

- `electron/backend/commands.ts`
  - `workflowSettingsSections` includes `owned_test_gates`.
  - `validateWorkflowSettings` validates fingerprint preflight configuration.
  - Legacy settings migration creates `owned_test_gates`.
  - Default settings create `owned_test_gates`.
  - Import/export selected sections can include `owned_test_gates`.
- `electron/backend/graphCompiler.ts`
  - `settingsPreludeSteps` prepends fingerprint preflight navigation and verdict
    steps.
  - `fingerprintPreflightScript` creates `fingerprint_preflight` evidence and
    blocks failed verdicts.

Tests and mocks:

- Frontend settings/page tests assert `Owned Test Gates` visibility and fields.
- Workflow settings tests assert section existence and help content.
- Workflow API/list/package tests include `owned_test_gates` settings data.
- Backend command tests validate fingerprint preflight.
- Graph compiler tests assert fingerprint preflight steps.
- Mocks include `owned_test_gates` defaults.

Docs:

- Current docs mention `Owned Test Gates` in product model, workflow lifecycle,
  execution semantics, frontend architecture, workflow types, run-state contract,
  README smoke steps, and user-visible invariants.

## Proposed Removal

### Types

Remove `owned_test_gates` from current DTO contracts:

- Delete `WorkflowSettingsOwnedTestGates`.
- Remove `owned_test_gates` from `WorkflowSettings`.
- Remove `owned_test_gates` from `WorkflowSettingsSectionId`.
- Remove `owned_test_gates` from package/settings section option types.

If package import needs to handle old package files, treat `owned_test_gates` as
an omitted/ignored legacy section with a migration note rather than storing it.

### Frontend UI

Remove the section from Workflow Settings:

- Delete the `Owned Test Gates` tab.
- Delete `OwnedTestGatesSettingsSection`.
- Remove fingerprint preflight fields.
- Remove the headed-mode warning tied to fingerprint preflight.
- Remove section help content and any browser-launch help copy that says headed
  mode is needed for fingerprint preflight.
- Remove package option label for `owned_test_gates`.

The settings dialog should still save dirty sections for the remaining sections.

### Backend Validation And Defaults

Remove active validation and defaults:

- Delete fingerprint preflight validation from `validateWorkflowSettings`.
- Remove `owned_test_gates` from the authoritative settings section list.
- Remove `owned_test_gates` from default settings creation.
- Remove migration of legacy browser fingerprint fields into active settings.
- Ignore legacy fingerprint fields during settings migration/import, with
  migration notes if the existing migration mechanism supports them.

### Compiler And Runner Plan

Remove fingerprint preflight from compilation:

- Delete fingerprint preflight setup step insertion.
- Delete `fingerprintPreflightScript`.
- Ensure settings prelude still supports Environment initial variables.
- Ensure domain allowlist policy remains unchanged.

The runner itself does not need a feature-specific action removal if the
preflight only entered through compiler-generated `navigate` and `execute_js`
steps. Tests should prove compiled run plans no longer contain
`__settings:browser:fingerprint-preflight:*` node ids.

### Persistence And Package Compatibility

Existing saved settings may contain `owned_test_gates`. The implementation should
not crash on load.

Preferred behavior:

- Load old settings.
- Drop `owned_test_gates` from the returned active settings object.
- Add or preserve migration notes saying the section was removed.
- Package import should ignore selected/serialized `owned_test_gates` from old
  packages.
- Package preview should not advertise `Owned Test Gates` as importable current
  settings.

### Docs

Update current docs in the same implementation:

- `README.md`
- `docs/domain/product-model.md`
- `docs/domain/user-visible-invariants.md`
- `docs/domain/workflow-lifecycle.md`
- `docs/domain/execution-semantics.md`
- `docs/architecture/frontend.md`
- `docs/architecture/runner.md`
- `docs/contracts/workflow-types.md`
- `docs/contracts/run-state.md`

Historical specs under `docs/superpowers/` can remain as historical records
unless the implementation explicitly performs a historical-doc cleanup.

## Expected User-Visible Behavior

- Workflow Settings tabs show exactly:
  - `General`
  - `Run Policy`
  - `Browser Launch`
  - `Environment`
- No UI text says `Owned Test Gates`.
- No UI text says `Fingerprint preflight`.
- Running a workflow starts with Browser Launch and Environment setup, then graph
  actions.
- No run output includes fingerprint preflight evidence generated by settings.
- Workflow package settings choices do not include `Owned Test Gates`.

## Testing Plan

Follow TDD for implementation.

Frontend tests:

- `WorkflowSettingsDialog` shows only the four remaining sections.
- `WorkflowSettingsDialog` does not render fingerprint preflight controls.
- Settings help exists for the four remaining sections only.
- Workflow package options do not label or render `Owned Test Gates`.
- Existing dirty-section save behavior still works for the remaining sections.

Backend tests:

- Default workflow settings do not include `owned_test_gates`.
- `validateWorkflowSettings` has no fingerprint preflight validation path.
- Legacy/imported settings containing `owned_test_gates` load without crashing
  and drop the section.
- `compileWorkflowRunPlan` does not prepend fingerprint preflight steps even when
  legacy settings data contains old fingerprint fields.
- Environment initial variables still compile before graph actions.
- Domain allowlist policy still compiles and is enforced.

Focused commands:

- `npm test -- src/features/workflows/lib/workflowSettings.test.ts`
- `npm test -- src/features/workflows/components/WorkflowSettingsDialog.test.tsx`
- `npm test -- src/features/workflows/pages/WorkflowDetailPage.test.tsx`
- `npm test -- src/features/workflows/pages/WorkflowListPage.test.tsx`
- `npm test -- src/lib/workflowApi.test.ts`
- `npm test -- electron/backend/commands.test.ts`
- `npm test -- electron/backend/graphCompiler.test.ts`
- `npm run build:electron`
- `npx tsc --noEmit`

## Rollout Notes

This is a breaking contract cleanup for current settings shape. It should be done
in one narrow implementation slice so frontend types, backend defaults,
import/export, compiler behavior, tests, and docs agree at the same commit.

The implementation should prefer deleting active code paths rather than hiding
the UI while leaving active fingerprint preflight behavior reachable through
settings JSON.
