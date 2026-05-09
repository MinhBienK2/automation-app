# Electron CloakBrowser Migration Plan Index

Date: 2026-05-09

Design spec: `docs/superpowers/specs/2026-05-09-electron-cloakbrowser-migration-design.md`

This migration replaces the production Tauri/Rust runtime with an Electron,
Node/TypeScript, SQLite, CloakBrowser, and Playwright runtime while preserving
the existing React workflow UI as much as possible.

## Execution Rule

Do not start the next mini-plan until the current mini-plan reaches its DONE
gate. For each mini-plan:

1. Read the current docs route for the touched area.
2. For behavior-changing code, use `.agents/skills/test-driven-development`
   before implementation.
3. Run GitNexus impact analysis before editing symbols.
4. Implement only that plan's scope.
5. Run the listed focused checks.
6. Update current docs when behavior, architecture, contracts, commands,
   storage, or verification expectations change.
7. Run `gitnexus_detect_changes()` before committing.
8. Commit the finished scope.

## Plan Order

1. [Plan 01 - Electron Shell And IPC Foundation](01-electron-shell-ipc-foundation.md)
2. [Plan 02 - Node Domain Storage And Command Parity](02-node-domain-storage-command-parity.md)
3. [Plan 03 - TypeScript Graph Compiler Parity](03-typescript-graph-compiler-parity.md)
4. [Plan 04 - CloakBrowser Runner Parity](04-cloakbrowser-runner-parity.md)
5. [Plan 05 - Run State Evidence And Batch Parity](05-run-state-evidence-batch-parity.md)
6. [Plan 06 - Remove Tauri And Final Verification](06-remove-tauri-final-verification.md)

## Overall DONE Gate

The migration is complete only when:

- The app packages and runs as an Electron desktop app on Linux.
- The existing React workflow UI remains usable and recognizable.
- Tauri/Rust is not required at runtime.
- SQLite storage is initialized and used by the Node/TypeScript backend.
- Workflow CRUD, settings, graph save/load/validation, import/export, run state,
  runner execution, retained sessions, outputs, evidence, and batch behavior
  reach full current parity.
- CloakBrowser and Playwright execute browser actions through Node/TypeScript.
- CloakBrowser `humanize` is enabled by default for all runs.
- Named profiles persist under Electron app data.
- Temporary runs clean up temporary state unless browser retention keeps the
  session open.
- Automated focused checks and the packaged Linux smoke checklist pass.
