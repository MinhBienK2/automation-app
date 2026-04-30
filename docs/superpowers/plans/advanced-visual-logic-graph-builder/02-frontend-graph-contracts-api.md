# Plan 2: Frontend Graph Contracts And API

## Objective

Add TypeScript graph types and Tauri wrappers so the frontend can load, save, validate, compile, and run workflow graphs through typed APIs.

## TDD Slices

1. Add failing `workflowApi` tests for the five graph commands and payload casing.
2. Add failing graph helper tests:
   - Build a linear graph from existing steps.
   - Create default nodes with stable ports.
   - Summarize graph validation issues by node.

## Implementation Notes

- Extend `src/types/workflow.ts` with graph DTOs matching Rust serde.
- Add wrappers in `src/lib/workflowApi.ts`.
- Add pure helpers under `src/features/workflows/lib/` for:
  - graph defaults
  - port definitions
  - linear graph fallback
  - issue grouping
  - node labels

## DONE Criteria

- `npm test -- src/lib/workflowApi.test.ts` passes.
- Focused graph helper tests pass.
- `npx tsc --noEmit` passes after graph types are wired.
