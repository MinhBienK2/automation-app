# Workflow Automation Manager

Rust desktop MVP for building and running browser automation workflows.

## Development Commands

Install frontend dependencies:

```bash
npm install
```

Run the desktop app in development:

```bash
npm run tauri dev
```

Build the frontend:

```bash
npm run build
```

Run Rust tests:

```bash
cd src-tauri
cargo test
```

Run frontend tests:

```bash
npm test -- --run
```

Check Rust formatting:

```bash
cd src-tauri
cargo fmt --check
```

Run Rust lint checks:

```bash
cd src-tauri
cargo clippy --all-targets --all-features
```

## MVP Smoke Checklist

Use a simple page with an input, button, list, table, link, and tall body.

1. Create a workflow.
2. Add Open URL, Sleep, Type Text, Click, and Scroll steps.
3. Add Extract Text, Extract Attribute, Extract Input Value, Extract List, Extract Table, and Take Screenshot steps.
4. Add Go Back, Go Forward, Reload, Open New Tab, Switch Tab, and Close Tab steps.
5. Reorder steps and reopen the workflow.
6. Test a selected step.
7. Run the full workflow.
8. Confirm extracted outputs are available in the browser session output store and screenshot path exists.
9. Confirm tab actions move between visible Chromium tabs and reject missing tab indexes.
10. Confirm bad XPath fails immediately with a short message.
11. Stop during a long Sleep.
12. Confirm Chromium remains open after success, failure, and stop.
13. Delete the workflow.
