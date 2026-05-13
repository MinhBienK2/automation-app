# Workflow Automation Manager

Electron desktop app for building and running authorized adversarial browser automation workflows against company-owned systems.

The project is an internal red-team automation lab. Its explicit goal is to make automated workflows pass through the company's existing production and staging defenses in controlled owned environments, then produce evidence that helps security, trust, anti-abuse, and production teams find detection gaps and harden defenses. The lab models fake engagement, account integrity, network reputation, device/browser fingerprinting, behavioral analytics, velocity checks, graph detection, content/spam controls, risk scoring, challenge flows, API abuse, and coordinated bot scenarios.

## Development Commands

Install frontend dependencies:

```bash
npm install
```

Run the desktop app in development:

```bash
npm run electron:dev
```

Build the renderer and Electron main/preload:

```bash
npm run build
```

Package a Linux Electron directory build:

```bash
npm run electron:pack
```

Run frontend tests:

```bash
npm test
```

Run desktop Electron E2E tests against deterministic local fixtures:

```bash
npm run test:e2e
```

Run the real CloakBrowser smoke test separately. First run may download the
browser runtime:

```bash
npm run test:smoke
```

Typecheck the renderer:

```bash
npx tsc --noEmit
```

Build only the Electron main/preload code:

```bash
npm run build:electron
```

## MVP Smoke Checklist

Use a simple page with an input, button, iframe, dialog trigger, download link, list, table, link, tall body, and an HTTP fixture that echoes request headers and geolocation.

1. Create a workflow.
2. Confirm the new workflow graph starts with `Start -> New node`.
3. Open Settings from the sidebar, turn graph autosave off and on, and confirm the workflow detail save status changes between autosave off, unsaved changes, saving, and saved.
4. Add Navigate, Wait, Random Wait, Fill Field, Click, and Scroll action nodes.
5. Add Extract Text, Extract Attribute, Extract Field Value, Extract List, Extract Table, and Take Screenshot action nodes.
6. Add Go Back, Go Forward, Reload, Open New Tab, Switch Tab, Close Tab, Accept Dialog, Dismiss Dialog, and Wait For Download action nodes. Confirm Switch Frame and Choose Download Folder are not offered as primary in-run actions.
7. Add Set Variables, Set JSON Variables, Assert Element, Assert Text, If, Switch, Repeat Times, Repeat For Each, While, Repeat Until, Break Loop, Continue Loop, Retry, End Success, End Failure, and Stop Workflow graph nodes from their current visible graph palettes.
8. Add Set Cookie and Clear Cookies action nodes. Confirm profile, proxy, user agent, session restore, and download folder controls are configured through Workflow Settings rather than primary in-run actions.
9. Open Settings from the workflow detail header, confirm it opens to Browser, and configure Reuse login session, the workflow browser profile, proxy, Device profile preset, custom user agent, viewport, mobile/touch flags, headed/headless default, challenge policy, and fingerprint preflight fields. Also confirm Workflow Settings has General, Execution, Environment, Variables, Triggers, Advanced, Execution wait-between-nodes controls with fixed/random modes, interaction fidelity controls, section help, one Save Settings button in the dialog header, an unsaved-changes prompt when closing with edits, and a Triggers section that is clearly planned rather than an active scheduler.
10. Confirm hidden compatibility action nodes such as Detect Challenge, Pause For Human, and Resume When Condition still load and show a compatibility inspector when present in an imported or existing workflow.
11. Confirm hidden compatibility reliability actions such as Fallback Selector, Retry Step, and Checkpoint still load and show a compatibility inspector when present in an imported or existing workflow.
12. Duplicate a workflow and confirm the copy keeps the saved graph and full local settings, export a workflow package with Flow and selected Settings, confirm the native Save dialog lets you choose the folder and file name, import it back as a new workflow without overwriting the original, validate an interval schedule, and run a graph-backed batch with at least two input rows.
13. Add Run JavaScript, Wait For Request, Wait For Response, Block Request, Mock Response, Set Local Storage, and Set Session Storage action nodes.
14. Generate selector suggestions from an element snapshot, normalize recorded click/input events, dry-run validate a config, and in a debug build generate a local fixture HTML file from a single `.html` filename.
15. Move graph nodes, reopen the workflow, and confirm node positions persist.
16. Save Workflow Settings, save the graph, and run the graph workflow.
17. Run `npm run test:smoke` and confirm the Electron runner launches CloakBrowser/Playwright with `humanize` enabled by default, uses headed/headless according to Workflow Settings, and stores named profile data under the app data browser profile directory. On a fresh machine, expect the first smoke run to download the browser runtime.
17. Confirm extracted outputs are available in the browser session output store and screenshot path exists.
17. Confirm runner evidence outputs include `__action_traces`, and when fingerprint preflight is enabled against an allowlisted JSON probe, `fingerprint_preflight` is stored or the run blocks before graph actions with the probe mismatch reason.
18. Confirm tab actions move between visible Chromium tabs and reject missing tab indexes.
19. Confirm structured/legacy iframe target fields let element and output steps target iframe content. Legacy Switch Frame actions should load for compatibility but fail explicitly if run.
20. Confirm dialog actions accept prompts with text and dismiss confirms without hanging.
21. Confirm download actions save a new file under the current run evidence directory and store its app-local path plus `__evidence` metadata in outputs.
22. Confirm `{{variable}}` templates interpolate into action text, template fields can insert variables from the picker and highlight tokens, Set Variables supports multiple typed rows, Set JSON Variables stores object keys, Repeat For Each can use a variable array, and control-flow blocks run nested actions.
23. Confirm persistent profile state survives a browser restart through Workflow Settings, cookies can be set/cleared, and legacy session JSON or secret actions are hidden from active authoring and fail explicitly until implemented.
24. Confirm Workflow Settings Browser user agent, viewport, and headless default apply before browser launch, and Environment geolocation, permission grants, extra headers, storage, cookies, and Variables seed values apply before graph actions run.
25. Confirm planned challenge and human-verification compatibility actions are hidden from active authoring and fail explicitly if loaded as legacy in-run actions; confirm Resume When Condition waits for the expected condition or timeout.
26. Confirm fallback selector, retry step, and checkpoint compatibility actions are hidden from active authoring and fail explicitly until implemented; failed steps include a run-scoped failure screenshot path when capture is available.
27. Confirm batch run results account for each executed row, separate success from failure, use saved graph steps rather than legacy ordered steps, apply batch headless defaults, reject concurrency above 1, and stop after the first failed row when configured.
28. Confirm terminal workflow and batch row runs create SQLite `runs` and `run_steps` evidence with outputs, action traces, failed-step errors, and failure screenshot paths when failures occur.
28. Confirm Run JavaScript stores output, storage actions set browser storage, network wait sees the request/response, block request rejects fetch, and mock response returns controlled body/status.
29. Confirm selector suggestions prefer stable attributes and recorder output maps to the action taxonomy.
30. Confirm bad XPath fails immediately with a short message.
31. Stop during a long Wait duration.
32. Open the workflow graph and confirm a new workflow starts as `Start -> New node`. Confirm the graph toolbar shows icon controls for undo, redo, select, pan, fit view, and Shortcuts, plus New node, Add Action, Add Logic, Add Variable, and Add End without Add Output. Confirm Add Variable offers Set Variables and Set JSON Variables. Drag empty canvas to box-select graph items, hold Space and drag to pan the view, toggle the hand tool to pan persistently, add visible graph nodes, choose an action type from the searchable inspector dropdown, confirm the search input focuses and click-outside closes it, edit inspector fields, connect nodes through explicit ports, reconnect a used port and confirm the old link is replaced, multi-select nodes, bulk duplicate/copy/paste/delete, undo/redo graph edits, select/delete a link, validate the graph, save it, reopen the workflow, and confirm the graph persists.
33. Open help for Fill Field, a capture action, If, Retry, and a hidden compatibility node if available; confirm the help reads as a bilingual decision guide with minimum setup, grouped field/option details, ports/outputs where relevant, workflow examples, and no standalone Common mistakes section.
34. Run the graph and confirm blocking validation issues appear in the run issue panel before execution, runtime failures identify the failed graph node and can select it, system/startup errors remain readable, canvas run highlights use semantic colors, and subworkflow nodes fail explicitly until nested lifecycle support is implemented.
35. Confirm Chromium remains open after success, failure, and stop by default, closes when Workflow Settings browser retention is set to close, closes when an End or Stop Workflow node has Close browser after workflow ends enabled, and max workflow duration fails an overlong run with a timeout message.
36. Delete the workflow.
