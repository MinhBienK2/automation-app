# Plan 08 - MVP Verification And Polish

## Goal

Finish the MVP without expanding scope.

This plan is for usability fixes, verification, documentation, and final review.

## Scope

Add only polish that supports the approved MVP:

- Empty states.
- Delete confirmations.
- Unsaved form handling.
- Concise status bar.
- Failed message formatting.
- Basic app menu/window title.
- README development commands.
- Final smoke test checklist.

Do not add new product features.

## Final User Flow

The full MVP must support:

1. Create workflow.
2. Add Open URL.
3. Add Sleep.
4. Add Type Text.
5. Add Click.
6. Add Scroll.
7. Reorder steps.
8. Save workflow.
9. Test a selected step.
10. Run full workflow.
11. Stop a running workflow.
12. Reopen workflow after restart.
13. Delete workflow.

## DONE Gate

The MVP is DONE when:

- The final user flow passes manually.
- `cargo test` passes.
- Frontend build passes.
- Formatting checks pass.
- Clippy either passes or remaining findings are documented and accepted.
- README has dev commands.
- The app does not include non-MVP features:
  - Profile.
  - Variables.
  - Run History.
  - Output extraction.
  - Screenshots.
  - Element picker.
  - Recorder.
  - Headless mode.
  - Multi-run.
- Final commit is created.

## Checks

```text
cargo test
cargo fmt --check
cargo clippy --all-targets --all-features
npm run build
```

If a frontend test command exists, also run it.

## Manual Smoke Test

Use a simple local or public test page and verify:

- Open URL navigates.
- Sleep waits.
- Type Text clears and types into input.
- Click activates a button.
- Scroll moves page.
- Bad XPath fails immediately.
- Stop during Sleep works.
- Chromium remains open after success.
- Chromium remains open after failure.
- Chromium remains open after stop.
- Reopening the app keeps saved workflows.

## Stop Rule

Stop only when the DONE gate passes. Do not start post-MVP work in this plan.
