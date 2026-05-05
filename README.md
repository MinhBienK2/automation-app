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
2. Confirm the new workflow graph starts with only the Start node.
3. Open Settings from the sidebar, turn graph autosave off and on, and confirm the workflow detail save status changes between autosave off, unsaved changes, saving, and saved.
4. Add Navigate, Wait, Fill Field, Click, and Scroll action nodes.
5. Add Extract Text, Extract Attribute, Extract Field Value, Extract List, Extract Table, and Take Screenshot action nodes.
6. Add Go Back, Go Forward, Reload, Open New Tab, Switch Tab, Close Tab, Switch Frame, Accept Dialog, Dismiss Dialog, Choose Download Folder, and Wait For Download action nodes.
7. Add Set Variables, Set JSON Variables, Assert Element, Assert Text, If, Switch, Repeat Times, Repeat For Each, While, Repeat Until, Break Loop, Continue Loop, Retry, End Success, End Failure, and Stop Workflow graph nodes from their current visible graph palettes.
8. Add Use Profile, Save Session, Load Session, Set Cookie, Clear Cookies, and Set Secret action nodes.
9. Add Set Proxy, Set User Agent, Set Viewport, Set Geolocation, Set Request Headers, and Grant Permission action nodes.
10. Confirm hidden compatibility action nodes such as Detect Challenge, Pause For Human, and Resume When Condition still load and show inspector/help when present in an imported or existing workflow.
11. Confirm hidden compatibility reliability actions such as Fallback Selector, Retry Step, and Checkpoint still load and show inspector/help when present in an imported or existing workflow.
12. Export a workflow, import it back, validate an interval schedule, and run a batch with at least two input rows.
13. Add Run JavaScript, Wait For Request, Wait For Response, Block Request, Mock Response, Set Local Storage, and Set Session Storage action nodes.
14. Generate selector suggestions from an element snapshot, normalize recorded click/input events, dry-run validate a config, and generate a local fixture HTML file.
15. Move graph nodes, reopen the workflow, and confirm node positions persist.
16. Save and run the graph workflow.
17. Confirm extracted outputs are available in the browser session output store and screenshot path exists.
18. Confirm tab actions move between visible Chromium tabs and reject missing tab indexes.
19. Confirm Switch Frame lets later element/output steps target iframe content without repeating iframe XPath.
20. Confirm dialog actions accept prompts with text and dismiss confirms without hanging.
21. Confirm download actions save a new file in the configured directory and store its path in outputs.
22. Confirm `{{variable}}` templates interpolate into action text, template fields can insert variables from the picker and highlight tokens, Set Variables supports multiple typed rows, Set JSON Variables stores object keys, Repeat For Each can use a variable array, and control-flow blocks run nested actions.
23. Confirm persistent profile state survives a browser restart, session JSON can restore storage, cookies can be set/cleared, and `{{secret:name}}` templates are redacted in summaries.
24. Confirm user agent, viewport, geolocation, permission grants, and extra headers are visible to the target page.
25. Confirm challenge detection writes an output, human verification pause is logged, and resume waits for the expected condition.
26. Confirm fallback selector stores the selected XPath, retry step retries the nested action, checkpoint screenshot exists, and failed steps include a failure screenshot path.
27. Confirm batch run results account for each row and separate success from failure.
28. Confirm Run JavaScript stores output, storage actions set browser storage, network wait sees the request/response, block request rejects fetch, and mock response returns controlled body/status.
29. Confirm selector suggestions prefer stable attributes and recorder output maps to the action taxonomy.
30. Confirm bad XPath fails immediately with a short message.
31. Stop during a long Wait duration.
32. Open the workflow graph and confirm a new workflow starts as `Start -> New node`. Confirm the graph toolbar shows icon controls for undo, redo, select, pan, fit view, and Shortcuts, plus New node, Add Action, Add Logic, Add Variable, and Add End without Add Output. Confirm Add Variable offers Set Variables and Set JSON Variables. Drag empty canvas to box-select graph items, hold Space and drag to pan the view, toggle the hand tool to pan persistently, add visible graph nodes, choose an action type from the searchable inspector dropdown, confirm the search input focuses and click-outside closes it, edit inspector fields, connect nodes through explicit ports, reconnect a used port and confirm the old link is replaced, multi-select nodes, bulk duplicate/copy/paste/delete, undo/redo graph edits, select/delete a link, validate the graph, save it, reopen the workflow, and confirm the graph persists.
33. Open help for Fill Field, a capture action, If, Retry, and a hidden compatibility node if available; confirm the help reads as a bilingual decision guide with minimum setup, grouped field/option details, ports/outputs where relevant, workflow examples, and no standalone Common mistakes section.
34. Run the graph and confirm selected-node validation issues, canvas run highlights, and subworkflow expansion update from run state.
35. Confirm Chromium remains open after success, failure, and stop by default, and closes when an End or Stop Workflow node has Close browser after workflow ends enabled.
36. Delete the workflow.
