# Mission Control

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

Package Linux/Ubuntu Electron distributables:

```bash
npm run electron:pack
```

Package a local Linux directory build for quick inspection:

```bash
npm run electron:pack:dir
```

Package platform-specific desktop builds:

```bash
npm run electron:pack:mac
npm run electron:pack:win
npm run electron:pack:linux
```

Generate release SBOM and checksums for existing files in `release/`:

```bash
npm run release:sbom
npm run release:manifest
```

Run frontend tests:

```bash
npm test
```

Run desktop Electron E2E tests against deterministic local fixtures:

```bash
npm run test:e2e
```

Run the fast E2E smoke lane:

```bash
npm run test:e2e:smoke
```

Run the browser-observable E2E subset in visible mode for local review/debugging.
This excludes coverage, package, Electron-isolation, and UI-only journeys that
would only open the desktop app without meaningful browser action. The visible
lane keeps workflow browsers headed, retains them at terminal state during the
test, and adds a short observation pause after helper-driven workflow runs:

```bash
npm run test:e2e:visible
```

To slow the post-run observation window:

```bash
E2E_OBSERVE_MS=3000 npm run test:e2e:visible -- tests/e2e/core-execution.e2e.ts
```

Run high-risk E2E interaction suites repeatedly to catch flaky pointer, humanized
interaction, form, and keyboard behavior:

```bash
npm run test:e2e:flake
```

Run the real CloakBrowser smoke test separately. First run may download the
browser runtime:

```bash
npm run test:smoke
```

Run the focused fingerprint identity gate when changing browser identity or
CloakBrowser wrapper behavior:

```bash
npm run test:fingerprint
```

## CloakBrowser Operations

CloakBrowser is an exact-pinned npm dependency through `package.json` and
`package-lock.json`, while its patched Chromium binary is managed by
CloakBrowser's own cache. The app also installs CloakBrowser's optional
`mmdb-lib` peer so GeoIP mode is available consistently on lab machines.
Prepare a lab machine with:

```bash
npm install
npm run cloakbrowser:fonts:setup
npx cloakbrowser install
npx cloakbrowser info
npm run test:smoke
```

Operators can inspect the same data through the Electron backend diagnostics
commands exposed over IPC: `getCloakBrowserDiagnostics`,
`installCloakBrowserBinary`, and `cleanupOrphanedBrowserProfiles`. Diagnostics
report wrapper/binary version, platform, binary path/cache/download URL,
auto-update and checksum-skip status, GeoIP dependency availability, headed
display availability, fingerprint font diagnostics with file counts,
normalized hashes, missing/shared directory warnings, last recorded
smoke summary, and profile storage metadata with bounded approximate
profile sizes without proxy passwords,
cookies, or browser storage values.

For reproducible sensitive runs, keep `CLOAKBROWSER_AUTO_UPDATE=false` on lab
machines or record the effective binary version from `browser_identity`
evidence. Supported operator overrides are `CLOAKBROWSER_BINARY_PATH`,
`CLOAKBROWSER_CACHE_DIR`, `CLOAKBROWSER_DOWNLOAD_URL`, and
`CLOAKBROWSER_AUTO_UPDATE=false`. Do not set
`CLOAKBROWSER_SKIP_CHECKSUM=true` in normal product paths; CloakBrowser verifies
downloaded binaries with SHA-256 checksums. If an update regresses owned probes,
roll back by pointing `CLOAKBROWSER_BINARY_PATH` at a previous cached Chromium
binary under `~/.cloakbrowser`.
For production-like lab machines that require stronger supply-chain checks,
verify CloakBrowser signed release tags, binary attestations, or Docker image
signatures when those artifacts are published by the upstream project before
accepting a new wrapper or binary version.

Linux headed runs require a real display. Use a desktop session or `xvfb-run`
for headed identities; otherwise set Browser Launch headless mode. Install
Playwright/Chromium system dependencies where the OS requires shared libraries,
and keep normal desktop fonts plus emoji/extended fonts available on lab
machines. To avoid installing the recommended Linux font packages system-wide,
run `npm run cloakbrowser:fonts:setup`; it downloads and extracts the
CloakBrowser-recommended Ubuntu font packages into the gitignored repo-local
directory `.local/cloakbrowser-fonts/linux`, refreshes fontconfig for that
directory when `fc-cache` is available, and prints the absolute path. New or
lazy-created Workflow Settings auto-fill that repo-local path when the directory
exists and is readable; operators can still edit or clear Workflow Settings ->
Browser Launch -> Fingerprint fonts directory per workflow. The generated font
files and downloaded `.deb` packages are local machine output and should not
be committed. GeoIP mode uses the installed `mmdb-lib` package and may download
its GeoIP database on first use. New workflows enable GeoIP by default so blank
timezone/locale fields resolve from the current public or proxy exit IP; blank
legacy location settings normalize back to GeoIP. Prefer explicit
timezone/locale only when proxy inventory already supplies region metadata.
Workflow Settings validation warns when an enabled proxy has no explicit
timezone/locale and GeoIP is off, or when a shared `fingerprint_fonts_dir` can
create a stable font hash.

Typecheck the renderer:

```bash
npx tsc --noEmit
```

Build only the Electron main/preload code:

```bash
npm run build:electron
```

Deploy a new tag-backed desktop release. A real deploy requires a clean
worktree, runs tests and build, bumps the package version, commits, creates a
`v*` tag, pushes the branch, and pushes the tag to trigger Desktop Release:

```bash
npm run deploy
npm run deploy -- --minor
npm run deploy -- --major
npm run deploy -- --dry-run
```

## Desktop CI/CD

GitHub Actions workflows use Node.js 24. Workflow
`.github/workflows/desktop-ci.yml` runs on pull requests and pushes to `main`.
It runs `npm ci`, `npx tsc --noEmit`, `npm test`, and `npm run build` without
producing release artifacts.

GitHub Actions workflow `.github/workflows/desktop-release.yml` runs on tags
matching `v*` or manual dispatch. After quality gates pass, it waits on the
`internal-release` environment, packages artifacts for macOS (`dmg`, `zip`),
Windows (`nsis`, `zip`), and Ubuntu/Linux (`AppImage`, `deb`, `tar.gz`),
generates `sbom.cyclonedx.json`, `SHA256SUMS`, and `release-manifest.json`
with actual `generated_at` provenance plus deterministic `reproducible_epoch`,
creates artifact attestations, uploads workflow artifacts, and publishes assets
to the GitHub release.

Repository owners must configure branch protection, required release reviewers,
secret scanning, push protection, CodeQL, and Dependabot alerts as described in
`docs/release-governance.md`. Signing secrets are optional for unsigned internal
artifacts and required only when publishing signed/notarized builds.

## MVP Smoke Checklist

Use a simple page with an input, button, iframe, dialog trigger, download link, list, table, link, tall body, and an HTTP fixture that echoes request headers and geolocation.

1. Confirm the app opens on Overview, shows Active Runs, Succeeded Today, Attention Needed, Upcoming Schedules, Live Operations, Attention Queue, Execution Activity, Recent Evidence, and Upcoming Schedules, and that Open Workflows navigates to the workflow list.
1. Open Evidence from the sidebar, confirm screenshot/download/browser identity/action trace/evidence manifest items from completed runs are searchable and filterable, screenshot preview and Reveal in Folder work only through validated evidence actions, downloads show metadata without in-app preview, Export Selection creates a manifest bundle without absolute original paths, and Overview Recent Evidence plus Runs selected details navigate into Evidence.
2. Create a workflow.
2. Confirm the new workflow graph starts with `Start -> New node`.
3. Open Settings from the sidebar, turn graph autosave off and on, and confirm the workflow detail save status changes between autosave off, unsaved changes, saving, and saved.
4. Add Navigate, Wait, Random Wait, Fill Field, Click, and Scroll action nodes. Confirm Scroll shows Page Scroll Direction/Pixels fields and Scroll To Element/Wait Then Scroll To Element target fields with Timeout ms defaulting to 60000, without low-level target constraint or scroll tuning controls.
5. Add Extract Text, Extract Attribute, Extract Field Value, Extract List, Extract Table, and Take Screenshot action nodes.
6. Add Go Back, Go Forward, Reload, Open New Tab, Switch Tab, Close Tab, Accept Dialog, Dismiss Dialog, and Wait For Download action nodes.
7. Add Set Variables, Set JSON Variables, Assert Element, Assert Text, If, Switch, Router, Merge, Repeat Times, Repeat For Each, While, Repeat Until, Break Loop, Continue Loop, Retry, End Success, End Failure, and Stop Workflow graph nodes from their current visible graph palettes.
8. Add Set Cookie and Clear Cookies action nodes. Confirm profile, proxy, fingerprint seed, timezone/locale, headless launch, and browser retention are configured through Workflow Settings rather than in-run action nodes; confirm batch run defaults are visible there but paused until Batch Run UI is ready.
9. Open Settings from the workflow detail header, confirm it opens to Browser Launch, and configure Reuse login session, identity display name, stable identity id, fingerprint seed, fingerprint fonts directory, proxy URL/credentials/bypass/metadata, timezone/locale with GeoIP location enabled by default and the detected local machine fallback visible, Humanize browser input, Humanize preset (`default` or `careful`), and headed/headless default. Confirm Reset identity opens an in-app confirmation, returns a backend-generated identity/profile/seed, and disables Run from selected. Confirm Workflow Settings has General, Graph, Run Policy, Browser Launch, and Environment sections with related fields grouped inside each section; Run Policy edits max duration, browser retention, Allow Run JavaScript, and a grouped Run from selected control with the Run from selected scope select, and shows disabled batch controls with the pause note; Graph edits the new link wait default in one grouped control; Environment edits initial variable rows; section help is available with nested collapsible guidance groups and item-level field/example/mistake disclosures; the dialog has one Save Settings button in the header; and closing with edits shows the unsaved-changes prompt.
12. From the workflow list, run saved workflows directly and confirm the app stays on the list, disables Run, Duplicate, Export, and Delete only for rows whose workflow is already running, shows row-level status and Stop for active runs, and keeps Runs updated with each active/terminal run until terminal state.
13. From Graph Builder, click `Launch Run`, confirm the dialog names the workflow and current browser identity/session context, cancel once to verify no run starts, then confirm launch to verify the existing save/settings/validation/run pipeline starts.
12. Open Schedules from the sidebar, create disabled one-time, interval, daily, weekly, and monthly schedules for saved workflows, enable valid schedules, confirm invalid workflow drafts cannot be enabled, confirm isolated due schedules can start concurrently, and confirm schedule history records started/skipped/missed/failed-to-start/disabled decisions with workflow/profile/batch conflict reasons when skipped.
13. Duplicate a workflow and confirm the copy keeps the saved graph and non-storage local settings while receiving a fresh browser identity/profile/fingerprint and disabled Run from selected, export a workflow package with Flow and selected Settings, confirm the native Save dialog lets you choose the folder and file name, import it back as a new workflow without overwriting the original, and run a graph-backed batch with at least two input rows.
13. Add Run JavaScript, Wait For Request, Wait For Response, Block Request, Mock Response, Set Local Storage, and Set Session Storage action nodes.
14. Generate selector suggestions from an element snapshot, normalize recorded click/input_text events, dry-run validate a config, and in a debug build generate a local fixture HTML file from a single `.html` filename.
15. Move graph nodes by dragging the node body, reopen the workflow, and confirm node positions persist.
16. Save Workflow Settings, save the graph, and run the graph workflow.
17. Run `npm run test:fingerprint` and confirm browser identity launch mapping and sanitized `browser_identity` evidence pass. Run `npm run test:smoke` and confirm the Electron runner launches CloakBrowser/Playwright with `humanize` enabled by default, applies the selected human preset, passes the stable fingerprint seed, configured fingerprint fonts directory, and current Fingerprint.com mitigation args without explicit user-agent, Playwright viewport, `--window-size`, or CloakBrowser screen-size overrides, records the fingerprint font hash, uses headed/headless according to Workflow Settings, reports wrapper/binary evidence, keeps `navigator.webdriver === false`, omits `HeadlessChrome` from UA, keeps Chromium UA Client Hints coherent when exposed, exposes baseline `window.chrome`/plugins, reflects explicit or detected local timezone/locale and evidence persona metadata, keeps fixed-seed canvas output stable across two launches, and stores persistent localStorage under the app data browser profile directory. On a fresh machine, expect the first smoke run to download the browser runtime.
17. For Camoufox lab runs, start the app with `AUTOMATION_BROWSER_ENGINE=camoufox` and optionally `CAMOUFOX_EXECUTABLE_PATH=/path/to/camoufox`; confirm run evidence records `browser_engine: "camoufox"` and Camoufox runtime evidence.
17. Confirm extracted outputs are available in the browser session output store and screenshot path exists.
17. Confirm runner evidence outputs include `__action_traces` and run-scoped `__evidence` metadata when screenshot or download artifacts are produced, and that nested branch/body action traces include parent node and sequence metadata.
18. Confirm tab actions move between visible Chromium tabs and reject missing tab indexes.
19. Confirm structured target fields let element and output steps target iframe content, and confirm Scroll To Element/Wait Then Scroll To Element can target iframe content with an iframe XPath.
20. Confirm dialog actions accept prompts with text and dismiss confirms without hanging.
21. Confirm download actions save a new file under the current run evidence directory and store its app-local path plus `__evidence` metadata in outputs.
22. Confirm `{{variable}}` templates interpolate into action text, template fields can insert variables from the picker and highlight tokens, Set Variables supports multiple typed rows, Set JSON Variables stores object keys, Repeat For Each can use literal items and a variable array, Router takes the first matching case or default branch, Merge converges routed branches, and control-flow blocks run nested actions.
23. Confirm persistent identity profile state survives a browser restart through Workflow Settings, Reuse login session can be disabled without rotating identity id/profile directory/fingerprint seed, and cookies can be set/cleared.
24. Confirm Workflow Settings Browser Launch identity profile, fingerprint fonts directory, proxy, GeoIP or explicit timezone/locale, WebRTC, humanize toggle/preset, and headless defaults apply before browser launch; Environment initial variables apply before graph actions run; saved graph edge waits run before their target nodes; graph nodes for geolocation, permissions, headers, cookies, and storage apply from the graph when used; and outputs include sanitized `browser_identity` evidence.
27. Confirm batch run results account for each executed row, separate success from failure, use saved graph steps, apply batch headless defaults, reject concurrency above 1, and stop after the first failed row when configured.
28. Confirm terminal workflow and batch row runs create SQLite `runs` and `run_steps` evidence with outputs, action traces, nested branch/body run-step rows, failed-step errors, and failure screenshot paths when failures occur.
28. Confirm Run JavaScript stores output when Run Policy allows it, fails clearly before script evaluation when Allow Run JavaScript is off, storage actions set browser storage, network wait sees the request/response, block request rejects fetch, and mock response returns controlled body/status.
29. Confirm selector suggestions prefer stable attributes and recorder output maps to the action taxonomy.
30. Confirm bad XPath fails immediately with a short message.
31. Stop during a long Wait duration.
32. Open the workflow graph and confirm a new workflow starts as `Start -> New node`. Confirm the graph toolbar shows icon controls for undo, redo, select, pan, fit view, auto arrange, and Shortcuts, plus New node, Add Action, Add Logic, Add Variable, and Add End without Add Output. Confirm Add Variable offers Set Variables and Set JSON Variables. Drag empty canvas to box-select graph items, hold Space and drag to pan the view, toggle the hand tool to pan persistently, add visible graph nodes, use auto arrange to reposition nodes into a readable left-to-right flow, choose an action type from the searchable inspector dropdown, confirm the search input focuses and click-outside closes it, edit inspector fields, connect nodes through explicit ports, reconnect a used port and confirm the old link is replaced, confirm edge order labels follow execution order, multi-select nodes, bulk duplicate/copy/paste/delete, undo/redo graph edits, select/delete a link, validate the graph, save it, reopen the workflow, and confirm the graph persists.
33. Open help for Fill Field, a capture action, If, and Retry; confirm the help reads as a bilingual decision guide with collapsible parent sections, minimum setup, grouped required/optional/advanced field and option details, item-level field/option/output/example disclosures, ports/outputs where relevant, workflow examples, and no standalone Common mistakes section.
34. Run the graph and confirm blocking validation issues appear in the run issue panel before execution, runtime failures identify the failed graph node and can select it, long runtime/system errors stay collapsed with Copy details, the selected-node inspector mirrors last run error details without overflowing, canvas run highlights use semantic colors, and subworkflow nodes fail explicitly until nested lifecycle support is implemented.
35. Confirm Chromium remains open after success, failure, and stop by default, closes when Workflow Settings browser retention is set to close, closes when an End or Stop Workflow node has Close browser after workflow ends enabled, and max workflow duration fails an overlong run with a timeout message.
36. In Workflow Settings, enable Reuse login session, set browser retention to retain, and enable Run from selected in Run Policy. Confirm the grouped scope select can choose either `Only rerun selected node` or `Run from selected node onward`. Run or stop a workflow to leave Chromium open, select a supported main-path node, and confirm Run from selected uses the selected scope in the same browser. Then close Chromium manually and confirm Run from selected is unavailable or reports that a new reusable session is required.
36. Delete the workflow and confirm the dialog asks whether to keep or delete the private browser profile data. Keep it by default unless the workflow's unshared retained login state should be removed. Confirm deletion is unavailable during an active run and works again after the run reaches a terminal state.
