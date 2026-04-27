# Rust Workflow Automation MVP Plan Index

Date: 2026-04-27

This file is the plan index. The original long implementation plan has been split into smaller plans so each chunk can be implemented, reviewed, tested, and committed independently.

## Rule For Execution

Do not start the next mini-plan until the current mini-plan reaches its DONE gate.

For each mini-plan:

1. Implement only that plan's scope.
2. For behavior changes, start with `.agents/skills/test-driven-development` and include RED/GREEN verification in the task notes or final summary.
3. Run the listed checks.
4. Fix failures inside the same scope.
5. Commit the finished scope.
6. Move to the next plan only after the DONE gate is satisfied.

## Plan Order

1. [Plan 01 - App Scaffold](rust-workflow-mvp/01-app-scaffold.md)
2. [Plan 02 - Domain And Validation](rust-workflow-mvp/02-domain-validation.md)
3. [Plan 03 - SQLite Persistence](rust-workflow-mvp/03-sqlite-persistence.md)
4. [Plan 04 - Tauri Command API](rust-workflow-mvp/04-tauri-command-api.md)
5. [Plan 05 - Workflow UI](rust-workflow-mvp/05-workflow-ui.md)
6. [Plan 06 - Chromium Runner Spike](rust-workflow-mvp/06-chromium-runner-spike.md)
7. [Plan 07 - Runner Integration](rust-workflow-mvp/07-runner-integration.md)
8. [Plan 08 - MVP Verification And Polish](rust-workflow-mvp/08-mvp-verification-polish.md)

## MVP Boundary

Build:

- Workflow List.
- Workflow Builder.
- SQLite persistence with migrations.
- Open URL.
- Sleep.
- Type Text by XPath.
- Click by XPath.
- Scroll by pixels.
- Test Step.
- Run Workflow.
- Stop Run.
- One active run at a time.
- Current status only: `idle`, `running`, `success`, `failed`, `stopped`.
- Failure message: step number plus short reason.

Do not build:

- Profile.
- Variables.
- Run History.
- Output extraction.
- Screenshots.
- Element picker.
- Recorder.
- Headless mode.
- Multi-run.

## Stack

- Tauri 2.
- React + TypeScript.
- Rust backend.
- SQLite + SQLx migrations.
- chromiumoxide.
- Tokio.

## Overall DONE Gate

The MVP is done only when:

- A user can create, save, reopen, edit, reorder, test, run, stop, and delete workflows.
- All five MVP actions work against a real visible Chromium browser.
- Every run opens a new headed Chromium browser.
- Browser remains open after success, failure, or stop.
- Only one run/test can be active at a time.
- The app stores workflows in SQLite through migrations.
- The final manual smoke test passes.
- Automated checks pass for Rust and frontend code.
