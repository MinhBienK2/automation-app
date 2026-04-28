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

Use a simple page with an input, button, iframe, dialog trigger, download link, list, table, link, and tall body.

1. Create a workflow.
2. Add Open URL, Sleep, Type Text, Click, and Scroll steps.
3. Add Extract Text, Extract Attribute, Extract Input Value, Extract List, Extract Table, and Take Screenshot steps.
4. Add Go Back, Go Forward, Reload, Open New Tab, Switch Tab, Close Tab, Switch Frame, Accept Dialog, Dismiss Dialog, Set Download Directory, and Wait For Download steps.
5. Reorder steps and reopen the workflow.
6. Test a selected step.
7. Run the full workflow.
8. Confirm extracted outputs are available in the browser session output store and screenshot path exists.
9. Confirm tab actions move between visible Chromium tabs and reject missing tab indexes.
10. Confirm Switch Frame lets later element/output steps target iframe content without repeating iframe XPath.
11. Confirm dialog actions accept prompts with text and dismiss confirms without hanging.
12. Confirm download actions save a new file in the configured directory and store its path in outputs.
13. Confirm bad XPath fails immediately with a short message.
14. Stop during a long Sleep.
15. Confirm Chromium remains open after success, failure, and stop.
16. Delete the workflow.
