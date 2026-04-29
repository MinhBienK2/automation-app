# Docs Sync Policy

## Requirement

`docs/` and current code must agree for every touched area before final response.

## Read Before Code Changes

Agents must read:

- `docs/README.md`
- `docs/task-routes.md`
- Route-specific docs for the task.

## Update Docs When Changing

- User-visible behavior.
- Business rules.
- Workflow lifecycle semantics.
- Action configs, defaults, labels, summaries, validation, or execution.
- Tauri command names, payloads, responses, or errors.
- TypeScript/Rust DTO shapes.
- Persistence schema, ordering, timestamps, or serialization.
- Runner progress, cancellation, failure, or browser-session behavior.
- Test expectations or verification commands.
- File ownership or architecture boundaries.

## Usually No Docs Update Needed

- Formatting-only changes.
- Comment-only changes.
- Generated output.
- Lockfile-only dependency churn with no behavior or command changes.
- Tests that only add coverage for already documented behavior.

## Final Verification

Before final response:

- Re-read touched docs or use focused search.
- Confirm named files, contracts, and checks still match code.
- State whether docs were updated.
- If docs were unchanged, state why no documented behavior/contract changed.

