# Domain Architecture

## Purpose

Domain code defines workflow/action/run types and business validation.

## Key Files

- `src/types/workflow.ts` (type-only barrel)
- `src/types/workflowCore.ts` (sub-barrel over the six concern modules below)
- `electron/backend/graph/validateGraph.ts`
- `electron/backend/graph/compiler.ts`
- `electron/backend/actions/registry.ts`
- `electron/backend/actions/validation.ts`
- `electron/backend/graph/nodeConfigReaders.ts`
- `electron/backend/shared/validationMessages.ts`
- `electron/backend/commands.ts`
- `electron/backend/graph/compiler.test.ts`
- `electron/backend/actions/validation.test.ts`

## Belongs Here

- Electron IPC-compatible domain types.
- The workflow core types are split by concern behind `workflowCore.ts`: `workflowActionTypes` (the `ActionType` union), `workflowRunEnums`, `workflowRecords` (persistence DTOs), `workflowSettingsTypes` (settings + browser-profile tree), `workflowActionConfigs` (the `ActionConfig` union), and `workflowActionShapes` (element targeting, conditions, logic rules). Importers use the barrel, so adding a type means picking the module it belongs to rather than appending to one file.
- `workflowActionConfigs` is still ~1,300 lines with roughly 170 union members declared inline. It shrinks when action definitions own their Zod schema (#31) and per-action config types are inferred from those schemas — splitting the union further by hand first would be work thrown away.
- Note the direction of the frontend/backend seam: the backend derives its `ActionType` from the renderer's union by relative path, so the renderer's type modules are the backend's source of truth. The two TypeScript projects never include each other, so nothing type-checks that seam *as* a seam.
- Action capability classification for active and graph-internal action surfaces.
- Action config enums, registry metadata, and serialized action-config validation.
- Workflow graph structural and semantic validation in `electron/backend/graph/validateGraph.ts`, including one-edge-per-port rules with the explicit Merge fan-in exception, Router stable case ports, block continuation semantics, required body ports, unreachable nodes, unsupported cycles, unconfigured action drafts, and loop-control context.
- Run status/mode/error types.
- Orchestration schedule and batch request validation.
- Builder assist input/output types.
- Graph-to-action compilation and settings prelude compilation in `electron/backend/graph/compiler.ts`.
- Readers that turn a graph node's loosely-typed `config` record into structured shapes belong in `electron/backend/graph/nodeConfigReaders.ts`, not in the compiler or the node-semantics validator. Both read the same persisted shapes, so a reader defined in either one drifts.
- User-facing validation text that appears in more than one module belongs in `electron/backend/shared/validationMessages.ts`. A message authored once stays at its call site.

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
