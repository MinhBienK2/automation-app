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

Run high-risk E2E interaction suites repeatedly to catch flaky pointer/form/keyboard behavior:

```bash
npm run test:e2e:flake
```

Run authorized staging E2E only with explicit owned target allowlists and named test accounts:

```bash
E2E_STAGING_TARGETS_FILE=./staging-targets.local.json \
E2E_STAGING_ACCOUNTS_FILE=./staging-accounts.local.json \
npm run test:e2e:staging
```

Example file shapes live in `tests/e2e/fixtures/staging-targets.example.json` and `tests/e2e/fixtures/staging-accounts.example.json`.

Run the real CloakBrowser smoke test separately. First run may download the
browser runtime:

```bash
npm run test:smoke
```

## CloakBrowser Operations

CloakBrowser is a pinned npm dependency through `package-lock.json`, while its
patched Chromium binary is managed by CloakBrowser's own cache. Prepare a lab
machine with:

```bash
npm install
npx cloakbrowser install
npx cloakbrowser info
npm run test:smoke
```

Operators can inspect the same data through the Electron backend diagnostics
commands exposed over IPC: `getCloakBrowserDiagnostics`,
`installCloakBrowserBinary`, and `cleanupOrphanedBrowserProfiles`. Diagnostics
report wrapper/binary version, platform, binary path/cache/download URL,
auto-update and checksum-skip status, GeoIP dependency availability, headed
display availability, font-check status, last recorded smoke/preflight summary,
and profile storage metadata without proxy passwords, cookies, or browser
storage values.

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
machines. GeoIP mode requires `npm install mmdb-lib`; prefer explicit
timezone/locale when proxy inventory already supplies region metadata.

Typecheck the renderer:

```bash
npx tsc --noEmit
```

Build only the Electron main/preload code:

```bash
npm run build:electron
```

## Desktop CI/CD

GitHub Actions workflow `.github/workflows/desktop-ci.yml` runs on pull requests
and pushes to `main`. It runs `npm ci`, `npx tsc --noEmit`, `npm test`, and
`npm run build` without producing release artifacts.

GitHub Actions workflow `.github/workflows/desktop-release.yml` runs on tags
matching `v*` or manual dispatch. After quality gates pass, it waits on the
`internal-release` environment, packages artifacts for macOS (`dmg`, `zip`),
Windows (`nsis`, `zip`), and Ubuntu/Linux (`AppImage`, `deb`, `tar.gz`),
generates `sbom.cyclonedx.json`, `SHA256SUMS`, and `release-manifest.json`,
creates artifact attestations, uploads workflow artifacts, and publishes assets
to the GitHub release.

Repository owners must configure branch protection, required release reviewers,
secret scanning, push protection, CodeQL, and Dependabot alerts as described in
`docs/release-governance.md`. Signing secrets are optional for unsigned internal
artifacts and required only when publishing signed/notarized builds.

## MVP Smoke Checklist

Use a simple page with an input, button, iframe, dialog trigger, download link, list, table, link, tall body, and an HTTP fixture that echoes request headers and geolocation.

1. Create a workflow.
2. Confirm the new workflow graph starts with `Start -> New node`.
3. Open Settings from the sidebar, turn graph autosave off and on, and confirm the workflow detail save status changes between autosave off, unsaved changes, saving, and saved.
4. Add Navigate, Wait, Random Wait, Fill Field, Click, and Scroll action nodes. Confirm Scroll shows Page Direction/Pixels fields and Into View/Until Visible target fields.
5. Add Extract Text, Extract Attribute, Extract Field Value, Extract List, Extract Table, and Take Screenshot action nodes.
6. Add Go Back, Go Forward, Reload, Open New Tab, Switch Tab, Close Tab, Accept Dialog, Dismiss Dialog, and Wait For Download action nodes.
7. Add Set Variables, Set JSON Variables, Assert Element, Assert Text, If, Switch, Repeat Times, Repeat For Each, While, Repeat Until, Break Loop, Continue Loop, Retry, End Success, End Failure, and Stop Workflow graph nodes from their current visible graph palettes.
8. Add Set Cookie and Clear Cookies action nodes. Confirm profile, proxy, user agent, fingerprint seed, timezone/locale, headless launch, and browser retention are configured through Workflow Settings rather than in-run action nodes; confirm batch run defaults are visible there but paused until Batch Run UI is ready.
9. Open Settings from the workflow detail header, confirm it opens to Browser Launch, and configure Reuse login session, identity display name, stable identity id, fingerprint seed, proxy URL/credentials/bypass/metadata, timezone/locale, viewport/device flags, allowlisted advanced fingerprint overrides, Humanize browser input, Humanize preset (`default` or `careful`), optional owned fingerprint preflight, and headed/headless default. Confirm Workflow Settings has General, Graph, Run Policy, Browser Launch, and Environment sections with related fields grouped inside each section; Run Policy shows disabled batch controls with the pause note; Graph edits the new link wait default in one grouped control; Environment edits initial variable rows; section help is available; the dialog has one Save Settings button in the header; and closing with edits shows the unsaved-changes prompt.
12. From the workflow list, run saved workflows directly and confirm the app stays on the list, disables only rows whose workflow is already running, shows row-level status and Stop for active runs, and keeps Run Center updated with each active/terminal run until terminal state.
12. Open Schedules from the sidebar, create disabled one-time, interval, daily, weekly, and monthly schedules for saved workflows, enable valid schedules, confirm invalid workflow drafts cannot be enabled, confirm isolated due schedules can start concurrently, and confirm schedule history records started/skipped/missed/failed-to-start/disabled decisions with workflow/profile/batch conflict reasons when skipped.
13. Duplicate a workflow and confirm the copy keeps the saved graph and non-storage local settings while receiving a fresh browser identity/profile/fingerprint and disabled Run from selected, export a workflow package with Flow and selected Settings, confirm the native Save dialog lets you choose the folder and file name, import it back as a new workflow without overwriting the original, and run a graph-backed batch with at least two input rows.
13. Add Run JavaScript, Wait For Request, Wait For Response, Block Request, Mock Response, Set Local Storage, and Set Session Storage action nodes.
14. Generate selector suggestions from an element snapshot, normalize recorded click/input_text events, dry-run validate a config, and in a debug build generate a local fixture HTML file from a single `.html` filename.
15. Move graph nodes, reopen the workflow, and confirm node positions persist.
16. Save Workflow Settings, save the graph, and run the graph workflow.
17. Run `npm run test:smoke` and confirm the Electron runner launches CloakBrowser/Playwright with `humanize` enabled by default, applies the selected human preset, passes the stable fingerprint seed, uses headed/headless according to Workflow Settings, reports wrapper/binary evidence, keeps `navigator.webdriver === false`, omits `HeadlessChrome` from UA, exposes baseline `window.chrome`/plugins, reflects timezone/locale/viewport, keeps fixed-seed canvas output stable across two launches, and stores persistent localStorage under the app data browser profile directory. On a fresh machine, expect the first smoke run to download the browser runtime.
17. Confirm extracted outputs are available in the browser session output store and screenshot path exists.
17. Confirm runner evidence outputs include `__action_traces` and run-scoped `__evidence` metadata when screenshot or download artifacts are produced.
18. Confirm tab actions move between visible Chromium tabs and reject missing tab indexes.
19. Confirm structured target fields let element and output steps target iframe content, and confirm Scroll Into View/Until Visible can target iframe content with an iframe XPath.
20. Confirm dialog actions accept prompts with text and dismiss confirms without hanging.
21. Confirm download actions save a new file under the current run evidence directory and store its app-local path plus `__evidence` metadata in outputs.
22. Confirm `{{variable}}` templates interpolate into action text, template fields can insert variables from the picker and highlight tokens, Set Variables supports multiple typed rows, Set JSON Variables stores object keys, Repeat For Each can use a variable array, and control-flow blocks run nested actions.
23. Confirm persistent identity profile state survives a browser restart through Workflow Settings, Reuse login session can be disabled without rotating identity id/profile directory/fingerprint seed, and cookies can be set/cleared.
24. Confirm Workflow Settings Browser Launch identity profile, proxy, timezone/locale, viewport/device, WebRTC, advanced fingerprint overrides, humanize toggle/preset, preflight, and headless defaults apply before browser launch; Environment initial variables apply before graph actions run; saved graph edge waits run before their target nodes; graph nodes for geolocation, permissions, headers, cookies, and storage apply from the graph when used; and outputs include sanitized `browser_identity` evidence.
27. Confirm batch run results account for each executed row, separate success from failure, use saved graph steps, apply batch headless defaults, reject concurrency above 1, and stop after the first failed row when configured.
28. Confirm terminal workflow and batch row runs create SQLite `runs` and `run_steps` evidence with outputs, action traces, failed-step errors, and failure screenshot paths when failures occur.
28. Confirm Run JavaScript stores output, storage actions set browser storage, network wait sees the request/response, block request rejects fetch, and mock response returns controlled body/status.
29. Confirm selector suggestions prefer stable attributes and recorder output maps to the action taxonomy.
30. Confirm bad XPath fails immediately with a short message.
31. Stop during a long Wait duration.
32. Open the workflow graph and confirm a new workflow starts as `Start -> New node`. Confirm the graph toolbar shows icon controls for undo, redo, select, pan, fit view, auto arrange, and Shortcuts, plus New node, Add Action, Add Logic, Add Variable, and Add End without Add Output. Confirm Add Variable offers Set Variables and Set JSON Variables. Drag empty canvas to box-select graph items, hold Space and drag to pan the view, toggle the hand tool to pan persistently, add visible graph nodes, use auto arrange to reposition nodes into a readable left-to-right flow, choose an action type from the searchable inspector dropdown, confirm the search input focuses and click-outside closes it, edit inspector fields, connect nodes through explicit ports, reconnect a used port and confirm the old link is replaced, confirm edge order labels follow execution order, multi-select nodes, bulk duplicate/copy/paste/delete, undo/redo graph edits, select/delete a link, validate the graph, save it, reopen the workflow, and confirm the graph persists.
33. Open help for Fill Field, a capture action, If, and Retry; confirm the help reads as a bilingual decision guide with minimum setup, grouped field/option details, ports/outputs where relevant, workflow examples, and no standalone Common mistakes section.
34. Run the graph and confirm blocking validation issues appear in the run issue panel before execution, runtime failures identify the failed graph node and can select it, long runtime/system errors stay collapsed with Copy details, the selected-node inspector mirrors last run error details without overflowing, canvas run highlights use semantic colors, and subworkflow nodes fail explicitly until nested lifecycle support is implemented.
35. Confirm Chromium remains open after success, failure, and stop by default, closes when Workflow Settings browser retention is set to close, closes when an End or Stop Workflow node has Close browser after workflow ends enabled, and max workflow duration fails an overlong run with a timeout message.
36. In Workflow Settings, enable Reuse login session and Enable Run from selected with browser retention set to retain. Run or stop a workflow to leave Chromium open, select a supported main-path node, and confirm Run from selected continues from that node in the same browser. Then close Chromium manually and confirm Run from selected is unavailable or reports that a new reusable session is required.
36. Delete the workflow and confirm the dialog asks whether to keep or delete the private browser profile data. Keep it by default unless the workflow's unshared retained login state should be removed.
