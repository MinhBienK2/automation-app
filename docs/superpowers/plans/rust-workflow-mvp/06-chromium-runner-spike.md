# Plan 06 - Chromium Runner Spike

## Goal

Prove Rust can control headed Chromium for all MVP browser actions before integrating with the UI.

This is a technical spike with production-shaped code. It should stay isolated from the full workflow UI until the DONE gate passes.

## Scope

Create runner modules similar to:

- `runner/mod.rs`
- `runner/browser_session.rs`
- `runner/action_handlers.rs`
- `runner/xpath.rs`
- `runner/cancellation.rs`

Implement browser action execution against a local/static test page.

## Required Behaviors

- Launch headed Chromium with chromiumoxide.
- Open a new clean browser/page for each run.
- Navigate to URL without intentionally waiting for page load.
- Locate XPath immediately using `document.evaluate`.
- Fail immediately when XPath returns no element.
- Click element.
- Type text by focusing element, clearing current value, and inserting text.
- Scroll main page by pixels.
- Sleep with cancellation support.
- Keep browser open after final status.
- Stop execution without closing browser.

## XPath Strategy

Use browser-side JavaScript:

```javascript
document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue
```

If this returns no node, fail immediately with `XPath not found`.

## DONE Gate

This plan is DONE when:

- Headed Chromium opens from Rust.
- Open URL works.
- Sleep works and can be stopped.
- Type Text clears existing input and enters new text.
- Click works on a button found by XPath.
- Scroll moves the main page by configured pixels.
- Missing XPath fails immediately with a short reason.
- Browser remains open after success.
- Browser remains open after failure.
- Browser remains open after stop.
- Runner spike tests pass or a documented manual runner smoke test passes if automation tests are limited by local display constraints.

## Checks

```text
cargo test
cargo fmt --check
cargo clippy --all-targets --all-features
```

Manual smoke test:

1. Run a local/static page.
2. Execute Open URL, Sleep, Type Text, Click, Scroll.
3. Confirm Chromium is visible.
4. Confirm Chromium remains open after completion.
5. Execute a missing XPath case.
6. Confirm failure is reported and browser remains open.
7. Execute Stop during Sleep.
8. Confirm status is stopped and browser remains open.

## Stop Rule

Stop if chromiumoxide cannot reliably perform all five MVP actions. Do not integrate runner into UI until this spike passes.
