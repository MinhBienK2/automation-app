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

Use a simple page with an input, button, iframe, dialog trigger, download link, list, table, link, tall body, and an HTTP fixture that echoes request headers and geolocation.

1. Create a workflow.
2. Add Navigate, Wait, Input Text, Click, and Scroll steps.
3. Add Extract Text, Extract Attribute, Extract Input Value, Extract List, Extract Table, and Take Screenshot steps.
4. Add Go Back, Go Forward, Reload, Open New Tab, Switch Tab, Close Tab, Switch Frame, Accept Dialog, Dismiss Dialog, Set Download Directory, and Wait For Download steps.
5. Add Set Variable, Assert Element, Assert Text, If Condition, Repeat Times, Repeat For Each, Retry Block, and Stop Workflow steps.
6. Add Use Profile, Save Session, Load Session, Set Cookie, Clear Cookies, and Set Secret steps.
7. Add Use Proxy, Set User Agent, Set Viewport, Set Geolocation, Set Extra Headers, and Grant Permission steps.
8. Add Detect Challenge, Pause For Human, and Resume When Condition steps.
9. Add Fallback Selector, Retry Step, and Checkpoint steps.
10. Export a workflow, import it back, validate an interval schedule, and run a batch with at least two input rows.
11. Add Execute JS, Wait For Request, Wait For Response, Block Request, Mock Response, Set Local Storage, and Set Session Storage steps.
12. Generate selector suggestions from an element snapshot, normalize recorded click/input events, dry-run validate a step config, and generate a local fixture HTML file.
13. Reorder steps and reopen the workflow.
14. Test a selected step.
15. Run the full workflow.
16. Confirm extracted outputs are available in the browser session output store and screenshot path exists.
17. Confirm tab actions move between visible Chromium tabs and reject missing tab indexes.
18. Confirm Switch Frame lets later element/output steps target iframe content without repeating iframe XPath.
19. Confirm dialog actions accept prompts with text and dismiss confirms without hanging.
20. Confirm download actions save a new file in the configured directory and store its path in outputs.
21. Confirm `{{variable}}` templates interpolate into action text and control-flow blocks run nested actions.
22. Confirm persistent profile state survives a browser restart, session JSON can restore storage, cookies can be set/cleared, and `{{secret:name}}` templates are redacted in summaries.
23. Confirm user agent, viewport, geolocation, permission grants, and extra headers are visible to the target page.
24. Confirm challenge detection writes an output, human verification pause is logged, and resume waits for the expected condition.
25. Confirm fallback selector stores the selected XPath, retry step retries the nested action, checkpoint screenshot exists, and failed steps include a failure screenshot path.
26. Confirm batch run results account for each row and separate success from failure.
27. Confirm Execute JS stores output, storage actions set browser storage, network wait sees the request/response, block request rejects fetch, and mock response returns controlled body/status.
28. Confirm selector suggestions prefer stable attributes and recorder output maps to the action taxonomy.
29. Confirm bad XPath fails immediately with a short message.
30. Stop during a long Wait duration.
31. Confirm Chromium remains open after success, failure, and stop.
32. Delete the workflow.
