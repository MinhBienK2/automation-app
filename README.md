# Mission Control

Electron desktop app for building and running authorized adversarial browser automation workflows against company-owned systems.

The project is an internal red-team automation lab. Its explicit goal is to make automated workflows pass through the company's existing production and staging defenses in controlled owned environments, then produce evidence that helps security, trust, anti-abuse, and production teams find detection gaps and harden defenses.

---

## Development Commands

### Core Actions
| Task | Command | Description |
|---|---|---|
| **Install** | `npm install` | Install frontend/backend dependencies |
| **Dev Run** | `npm run electron:dev` | Start desktop app with HMR/rebuild watchers |
| **Build** | `npm run build` | Compile renderer and Electron main/preload |
| **Typecheck** | `npx tsc --noEmit` | Run TypeScript compiler checks |
| **Build IPC** | `npm run build:electron` | Build Electron main/preload only |
| **Deploy** | `npm run deploy [-- --minor/--major]` | Run quality gates, bump version, tag & push |

### Testing Lanes
| Target | Command | Description |
|---|---|---|
| **Frontend Unit** | `npm test` | Run Vitest unit suite |
| **E2E Full** | `npm run test:e2e` | Run all local deterministic Playwright E2E tests |
| **E2E Smoke** | `npm run test:e2e:smoke` | Run fast E2E lane for core flows |
| **E2E Visible** | `npm run test:e2e:visible` | Run E2E headed with post-run retention (Set `E2E_OBSERVE_MS` to pause) |
| **E2E Flake** | `npm run test:e2e:flake` | Repeat interaction tests to detect timing regressions |
| **E2E Real Web** | `npm run test:e2e:real-web` | Run opt-in real-world external target tests |
| **Browser Smoke** | `npm run test:smoke` | Run CloakBrowser capability tests (e.g. webdriver, UA) |
| **Fingerprint** | `npm run test:fingerprint` | Run focused fingerprint and identity matching tests |

### Packaging Distributables
| Target | Command | Description |
|---|---|---|
| **Pack (Linux)** | `npm run electron:pack` | Package distributables for Linux |
| **Pack (Dir)** | `npm run electron:pack:dir` | Package local directory build for inspection |
| **Pack (macOS)** | `npm run electron:pack:mac` | Package distributables for macOS |
| **Pack (Windows)** | `npm run electron:pack:win` | Package distributables for Windows |
| **Release SBOM** | `npm run release:sbom` | Generate CycloneDX SBOM for release |
| **Release Manifest**| `npm run release:manifest` | Generate checksums and manifest file |

---

## CloakBrowser Setup & Config

### Lab Machine Bootstrapping
```bash
npm install
npm run cloakbrowser:fonts:setup   # Set up localized Ubuntu fonts under .local/cloakbrowser-fonts/linux
npx cloakbrowser install           # Download patched Chromium binary
npx cloakbrowser info              # Verify binary status
npm run test:smoke                 # Run capability checks
```

### Key Operational Guidance
- **Headed Display**: Headed Linux runs require a real display. Use a desktop session or `xvfb-run` for headed identities; otherwise set Browser Launch headless mode.
- **Localized Fonts**: `npm run cloakbrowser:fonts:setup` downloads and extracts recommended Ubuntu fonts locally under `.local/cloakbrowser-fonts/linux` so that new/lazy-created profiles automatically use them without system-wide installations. Do not commit these fonts.
- **Diagnostics**: Operators can use `getCloakBrowserDiagnostics`, `installCloakBrowserBinary`, and `cleanupOrphanedBrowserProfiles` commands in App Settings to check wrapper/binary versions, GeoIP MMDB availability, headed display status, local font hashes, and profile directory sizes.
- **Environment Overrides**: Use `CLOAKBROWSER_AUTO_UPDATE=false` on lab machines for reproducibility. Overrides like `CLOAKBROWSER_BINARY_PATH`, `CLOAKBROWSER_CACHE_DIR`, and `CLOAKBROWSER_DOWNLOAD_URL` are supported. Never set `CLOAKBROWSER_SKIP_CHECKSUM=true`.
- **Location & GeoIP**: New profiles enable GeoIP by default, allowing blank timezone/locale fields to resolve from the proxy exit IP. Settings validation warns if a proxy is configured without explicit location settings and GeoIP is disabled.

---

## Desktop CI/CD

Workflows run on **Node 24** under GitHub Actions:
- **CI (`desktop-ci.yml`)**: Triggered on PRs and pushes to `main`. Runs checks, linting, unit tests, and production build without producing packaging artifacts.
- **Release (`desktop-release.yml`)**: Triggered on `v*` tags. packages builds for macOS (`dmg`, `zip`), Windows (`nsis`, `zip`), and Linux (`AppImage`, `deb`, `tar.gz`). Produces CycloneDX SBOM (`sbom.cyclonedx.json`), SHA256 checksums, release manifest, and attestation signatures.
- **Governance**: Refer to `docs/release-governance.md` for CodeQL, branch protection, Dependabot, and signing keys configuration.

---

## MVP Smoke Checklist

Ensure all checks pass on a simple test page (input, button, iframe, dialog, download, tables, exit IP echo) before release.

### 1. Navigation & App Shell
- [ ] App boots on Overview showing Active Runs, Succeeded Today, Attention Needed, Upcoming Schedules, Live Operations, Attention Queue, Activity, and Recent Evidence.
- [ ] Sidebar displays: Overview, Projects, Evidence, Schedules, Identities, App Settings. App shell has no top command/search header, Alerts shortcut, or Runs sidebar.
- [ ] Sidebar and page links navigate cleanly without displaying raw tokens, cookies, proxy credentials, storage data, or absolute local paths.
- [ ] Evidence explorer is searchable/filterable. Screenshot previews and Reveal in Folder actions work. Downloads show metadata only (no preview). Export Selection creates a manifest bundle without absolute paths.

### 2. Identities & Sessions
- [ ] Identities list displays owner, profile reuse, retained-session status, exit posture, diagnostics, and rotation history.
- [ ] "Close Retained Session" clears only in-memory browser sessions; "Reset Identity" prompts for confirmation and is blocked while the profile is actively running.
- [ ] Old identity IDs in evidence/history open read-only historical references.
- [ ] Deleting a workflow prompts to keep/delete private browser profile data (checked by default). Deletion is blocked during active runs.

### 3. Projects & Subflows
- [ ] Projects sidebar is searchable. Workflows, Subflows, and Settings are fixed detail tabs.
- [ ] Creating a project automatically initializes a `Main` workflow using the project browser profile.
- [ ] Subflow management: Create, rename, duplicate, delete unused. Deleting a referenced subflow is blocked with usage warnings.
- [ ] Import project (in header) previews packages and creates/remaps workflows, subflows, and profiles.
- [ ] Project Settings: Editable name, duplicate/export/delete buttons. Browser profiles list supports add, inline rename, and blocks deletion if used.

### 4. Graph Builder & Node Editing
- [ ] New workflows start with `Start -> New node`. Sidebar collapses to icon rail. Inspector drawer opens on select and closes on close action.
- [ ] Graph toolbar shows: undo, redo, select, pan (Space drag), fit view, auto arrange, and Shortcuts. Plus: New Node, Add Action, Add Subflow, Add Logic, Add Variable, and Add End (no Add Output).
- [ ] Node Accent Colors: Nodes display accent colors and category badges based on category.
- [ ] Add Subflow options: `Call subflow` (creates visually distinct Call Subflow node) and `Insert nodes` (copies non-start nodes/links in place).
- [ ] Auto-arrange repositions compact graphs left-to-right and wraps long graphs. Handles branch-heavy graphs (e.g. `If -> true/false -> Merge`).
- [ ] Inspector editing: Searchable dropdown for action types. Grouped setups (e.g. Drag/Drop source & destination; Condition, loop guard, router cases).
- [ ] Port/link editing: Reconnect replacement, execution order labels on edges. Multi-select supports duplicate, copy/paste, and delete.
- [ ] Create Subflow from selection summary offers `Chỉ tạo` (keep graph) and `Tạo và thay thế` (replace selection with Call Subflow).
- [ ] Autosave toggle changes save status (unsaved changes, saving, saved); manual Save button is disabled until content changes.
- [ ] Help panel displays bilingual decision guides with collapsible sections, minimum setup, and field disclosures (no standalone Common mistakes section).

### 5. Action Nodes Execution
- [ ] **Basic Actions**: Navigate, wait (cancellation-aware), random wait, fill field (browser native), click, focus, blur (locator-side blur), right-click (custom human move), custom select (trigger selector).
- [ ] **Advanced Interactions**: Drag/drop (supports locator/element ref, center/offset/percent modes), scroll (Page human wheel chunks, scroll to element, scroll until visible).
- [ ] **Extraction**: Extract text, attribute, input value, list, table, screenshot.
- [ ] **Navigation/Dialogs**: Back, forward, reload, new tab, switch/close tab (rejects invalid index), dialog accept (with text) and dismiss.
- [ ] **Advanced API**: Run JS (gated by `execute_js_enabled`), wait for request/response, block request, mock response, set local/session storage.
- [ ] **Variables & Loops**: Set Variables (multi-typed rows), Set JSON Variables, assertions (Assert Element/Text), control flow (If, Switch, Router, Merge, Repeat Times, Repeat For Each, While, Repeat Until, Break/Continue, Retry, End Success/Failure, Stop Workflow).
- [ ] **Cookies**: Set Cookie and Clear Cookies.

### 6. Run Execution & Batching
- [ ] Launch Run starts save/validation/run pipeline without confirmation.
- [ ] Live Run Navigator shows node activity timeline (running, completed, failed) where clicking rows opens the inspector. Follow current behaves per settings.
- [ ] Scheduled runs: Disabled schedules, active interval/daily/weekly/monthly runs. Schedule history tracks start/skip/miss decisions with conflict details.
- [ ] Run from selected: group scope selects Rerun Selected or Run From Selected. Session retains browser, runs sub-plan, and detects manual browser closure.
- [ ] Batching: results success/failure indicators, sequential execution, rejects concurrency > 1, and respects stop-on-first-failed-row.
- [ ] Persistence: terminal runs persist SQLite `runs` and `run_steps` with branch/loop traces, diagnostics, and failure screenshots.
- [ ] Diagnostics: Validation warnings appear in the run issue panel. Canvas highlights run state. Long system errors remain collapsed with copy details.
- [ ] Camoufox Engine: starting with `AUTOMATION_BROWSER_ENGINE=camoufox` records Camoufox runtime evidence in `browser_identity`.
