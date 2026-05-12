# Domain Architecture

## Purpose

Domain code defines workflow/action/run types and business validation.

## Key Files

- `src/types/workflow.ts`
- `electron/backend/graphCompiler.ts`
- `electron/backend/commands.ts`
- `electron/backend/graphCompiler.test.ts`

## Belongs Here

- Electron IPC-compatible domain types.
- Action capability classification for active, launch-time, planned, and compatibility action surfaces.
- Action config enums and validation.
- Workflow graph structural and semantic validation, including one-edge-per-port rules, block continuation semantics, required body ports, unreachable nodes, unsupported cycles, unconfigured action drafts, and loop-control context.
- Run status/mode/error types.
- Orchestration schedule and batch request validation.
- Builder assist input/output types.
- Graph-to-action compilation and settings prelude compilation.

## Does Not Belong Here

- React rendering rules.
- SQL queries.
- Chromium API calls.
- Command-specific serialization wrappers unless they are domain DTOs.

## Change Checklist

- Keep TypeScript DTOs in `src/types/workflow.ts` compatible with Electron IPC payloads and persisted JSON.
- Add focused domain tests before validation changes.
- Keep validation errors field-addressable where UI can act on a field.
- Check graph compiler defaults in `electron/backend/graphCompiler.ts`.
