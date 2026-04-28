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
4. Reorder steps and reopen the workflow.
5. Test a selected step.
6. Run the full workflow.
7. Confirm extracted outputs are available in the browser session output store and screenshot path exists.
8. Confirm bad XPath fails immediately with a short message.
9. Stop during a long Sleep.
10. Confirm Chromium remains open after success, failure, and stop.
11. Delete the workflow.
