# Plan 7: Docs Sync And Final Verification

## Objective

Update source-of-truth docs to describe the graph editor, graph commands, persistence shape, contracts, user-visible behavior, and verification commands.

## TDD Slices

This is docs and verification focused. TDD does not apply to docs-only edits, but all code from prior plans must already have passing tests.

## Docs To Update

- `docs/domain/product-model.md`
- `docs/domain/workflow-lifecycle.md`
- `docs/domain/user-visible-invariants.md`
- `docs/architecture/overview.md`
- `docs/architecture/frontend.md`
- `docs/architecture/persistence.md`
- `docs/architecture/command-boundary.md`
- `docs/contracts/tauri-commands.md`
- `docs/contracts/workflow-types.md`
- `docs/contracts/run-state.md` if graph metadata changes run state.
- `README.md` smoke checklist if user-visible workflow authoring changes.

## DONE Criteria

- Docs match the implemented graph feature.
- `npm test -- src/lib/workflowApi.test.ts` passes.
- Focused graph UI tests pass.
- `npm test -- src/features/workflows/components/StepBuilder.test.tsx` passes.
- `npm test -- src/features/workflows/pages/WorkflowDetailPage.test.tsx` passes.
- `npx tsc --noEmit` passes.
- `cd src-tauri && cargo test --test persistence` passes.
- `cd src-tauri && cargo test --test domain_validation` passes.
- `cd src-tauri && cargo test --test command_api` passes.
- `cd src-tauri && cargo fmt --check` passes.
