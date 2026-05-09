# Plan 06 - Remove Tauri And Final Verification

Date: 2026-05-09

## Goal

Remove the old Tauri/Rust production runtime after Electron/Node/CloakBrowser
parity is proven, then complete documentation and verification.

## Scope

- Remove Tauri-specific dependencies, scripts, configs, and source files from
  the production app.
- Delete `src-tauri/` only after all replacement tests and smoke checks pass.
- Remove Tauri frontend dependencies and plugin usage.
- Update package scripts for Electron development, build, package, and tests.
- Update docs and agent instructions to reflect Electron/Node commands.
- Run broad verification.
- Commit the final cleanup separately from runner parity work.

## Out Of Scope

- New product features.
- Cross-platform packaging beyond Linux.
- Old database/package migration.

## TDD And Checks

- TDD is not required for deleting unreachable runtime code, but use focused
  tests before cleanup to prove Electron parity is already covered.
- Run:
  - full frontend test suite
  - backend/domain/runner test suite
  - `npx tsc --noEmit`
  - Electron package/build command
  - packaged Linux smoke checklist
  - GitNexus detect changes before commit

## Docs To Update

- `README.md`
- `AGENTS.md`
- `docs/README.md` if workflow changes
- `docs/task-routes.md`
- all architecture and contract docs still naming Tauri/Rust as current runtime
- smoke checklist

## DONE Gate

- No production script requires Tauri or Cargo.
- No runtime source imports Tauri APIs.
- Rust runner and Tauri command docs are removed or clearly marked historical.
- Electron package runs on Linux.
- Full focused verification passes.
- Current docs and code agree.
- Changes are committed.
