# Domain Architecture

## Purpose

Domain code defines workflow/action/run types and business validation.

## Key Files

- `src/types/workflow.ts`
- `electron/backend/graph/validateGraph.ts`
- `electron/backend/graph/compiler.ts`
- `electron/backend/actions/registry.ts`
- `electron/backend/actions/validation.ts`
- `electron/backend/commands.ts`
- `electron/backend/graph/compiler.test.ts`
- `electron/backend/actions/validation.test.ts`

## Belongs Here

- Electron IPC-compatible domain types.
- Action capability classification for active and graph-internal action surfaces.
- Action config enums, registry metadata, and serialized action-config validation.
- Workflow graph structural and semantic validation in `electron/backend/graph/validateGraph.ts`, including one-edge-per-port rules with the explicit Merge fan-in exception, Router stable case ports, block continuation semantics, required body ports, unreachable nodes, unsupported cycles, unconfigured action drafts, and loop-control context.
- Run status/mode/error types.
- Orchestration schedule and batch request validation.
- Builder assist input/output types.
- Graph-to-action compilation and settings prelude compilation in `electron/backend/graph/compiler.ts`.

## Does Not Belong Here

- React rendering rules.
- SQL queries.
- Chromium API calls.
- Command-specific serialization wrappers unless they are domain DTOs.

## Change Checklist

- Keep TypeScript DTOs in `src/types/workflow.ts` compatible with Electron IPC payloads and persisted JSON.
- Add focused domain tests before validation changes.
- Keep validation errors field-addressable where UI can act on a field.
- Check graph compiler defaults in `electron/backend/graph/compiler.ts`.
- Keep graph validation coverage in `electron/backend/graph/validateGraph.ts` runnable independently of compilation.
- Keep action validation coverage in `electron/backend/actions/validation.ts` aligned with `electron/backend/actions/registry.ts`.
