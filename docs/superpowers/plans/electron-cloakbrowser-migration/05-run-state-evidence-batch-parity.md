# Plan 05 - Run State Evidence And Batch Parity

Date: 2026-05-09

## Goal

Finish product-level execution parity: run state, progress mapping, outputs,
evidence, retained sessions, stop behavior, and batch execution.

## Scope

- Implement run service orchestration in TypeScript:
  - one active run at a time
  - begin/finish/fail run state transitions
  - stop/cancel behavior
  - max workflow duration timeout
  - browser retention policy
  - current/completed/failed node mapping
- Persist:
  - `runs`
  - `run_steps`
  - outputs
  - action traces
  - failure screenshots
  - fingerprint preflight evidence
- Port batch workflow execution:
  - settings defaults
  - row variable setup
  - sequential rows
  - stop-on-first-failed-row
  - concurrency above one rejected until row isolation is designed
- Keep UI polling and canvas node status behavior stable.

## Out Of Scope

- Adding a scheduler for Triggers.
- Raising batch concurrency.
- New dashboard UX for run history beyond what is needed for parity.

## TDD And Checks

- Use `.agents/skills/test-driven-development` before code changes.
- Start with tests for run state lifecycle, stop behavior, timeout behavior,
  retained/closed sessions, output capture, and batch row behavior.
- Run:
  - run service tests
  - runner integration tests
  - workflow detail/page tests for run state rendering
  - command handler tests
  - `npx tsc --noEmit`

## Docs To Update

- `docs/contracts/run-state.md`
- `docs/domain/execution-semantics.md`
- `docs/architecture/runner.md`
- `docs/architecture/frontend.md`
- `docs/domain/workflow-lifecycle.md`
- README smoke checklist

## DONE Gate

- UI shows running, success, failed, stopped states with current/completed/failed
  graph node mapping.
- Stop returns stopped state promptly and runner cancellation completes.
- Outputs and evidence are available after terminal runs.
- Browser retention behavior matches current product semantics.
- Batch execution reaches current parity.
- Focused tests and docs updates pass.
- Changes are committed.
