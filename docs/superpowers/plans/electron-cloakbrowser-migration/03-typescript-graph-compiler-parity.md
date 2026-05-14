# Plan 03 - TypeScript Graph Compiler Parity

Date: 2026-05-09

## Goal

Port graph validation and compilation semantics from Rust to TypeScript so the
Node runner receives the same executable action plan the current Rust runner
expects.

## Scope

- Port graph validation:
  - node configuration checks
  - port connection constraints
  - start-only and unconfigured action blocking
  - loop control reachability
  - missing required branch errors
- Port graph compilation:
  - action nodes
  - if/switch
  - repeat times
  - repeat for each
  - while and repeat-until
  - retry
  - try/catch/finally
  - fallback
  - break/continue
  - transform variable
  - assert output
  - run subworkflow
  - domain allowlist
  - stop workflow
- Port settings prelude compilation:
  - environment defaults
  - initial variables
  - fingerprint preflight steps
  - execution timeout/default behavior
  - wait-between-nodes insertion
- Add fixture comparisons for representative saved graphs.

## Out Of Scope

- Browser action dispatch.
- CloakBrowser launch.
- SQLite schema changes beyond storing compiler-related snapshots if needed.

## TDD And Checks

- Use `.agents/skills/test-driven-development` before code changes.
- Start with failing graph compiler tests based on current graph fixtures and
  known control-flow examples.
- Run:
  - graph validation/compiler unit tests
  - affected workflow graph UI tests
  - command handler tests for validate/compile IPC
  - `npx tsc --noEmit`

## Docs To Update

- `docs/domain/execution-semantics.md`
- `docs/contracts/action-configs.md`
- `docs/contracts/workflow-types.md`
- `docs/architecture/domain.md`
- `docs/domain/cross-feature-impact-map.md`

## DONE Gate

- TypeScript validation blocks the same user-visible invalid graph states.
- TypeScript compiler supports all current graph-native control semantics.
- Settings prelude compilation is represented in TypeScript.
- Fixture tests cover representative branches, loops, retries, variables,
  fingerprint preflight, waits, and terminal nodes.
- Docs match the new TypeScript ownership.
- Changes are committed.
