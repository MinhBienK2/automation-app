# CloakBrowser Operational Completeness Design

## Status

Approved for spec-only documentation on 2026-05-15.

## Relationship To Identity Spec

This spec complements
`docs/superpowers/specs/2026-05-15-cloakbrowser-identity-fingerprint-design.md`.

The identity spec defines browser identity, fixed fingerprint seeds, profile
semantics, launch-time settings, launch-time graph action cleanup, and owned
fingerprint preflight.

This spec defines the remaining operational work needed to use CloakBrowser
effectively and reproducibly in this repo:

- version and binary lifecycle;
- runtime environment hardening;
- proxy, GeoIP, and WebRTC operational policy;
- advanced fingerprint controls;
- humanized runner behavior;
- expanded smoke and diagnostics coverage;
- operator documentation.

## Problem

Using CloakBrowser correctly is more than importing `cloakbrowser` and setting
`humanize: true`. The app also needs to control how the patched Chromium binary
is installed, updated, configured, diagnosed, and exercised by the runner.

Without this operational layer:

- an automatic CloakBrowser binary update can change fingerprint behavior between
  two otherwise identical runs;
- CI or Linux desktops may lack fonts, system dependencies, or headed display
  support needed by production-like probes;
- a proxy can be technically configured but still mismatch timezone, locale,
  geolocation, WebRTC, or owned inventory expectations;
- raw advanced Chromium arguments can make browser identities internally
  inconsistent;
- runner actions can bypass CloakBrowser humanization by using direct DOM
  dispatch or excessive CDP/evaluate calls;
- smoke tests can pass while important fingerprint and behavioral surfaces remain
  untested.

The product needs an explicit operational contract so the identity design remains
true in real runs.

## Goals

- Pin and report the CloakBrowser wrapper and binary versions used by each run.
- Make binary installation, cache location, update policy, and rollback
  operator-visible.
- Harden Linux, CI, and headed-mode prerequisites.
- Treat proxy, GeoIP, WebRTC, and location settings as one validated network
  posture.
- Expose advanced fingerprint flags only through safe, allowlisted controls.
- Align runner action implementation with CloakBrowser's humanization behavior.
- Add smoke coverage that proves actual CloakBrowser stealth and persistence
  properties, not only launch success.
- Document operator workflows for setup, diagnostics, troubleshooting, reset,
  and rollback.

## Non-Goals

- Do not fork or patch CloakBrowser.
- Do not implement browser fingerprint spoofing in application JavaScript.
- Do not expose arbitrary raw Chromium flags to normal workflow authors.
- Do not integrate CloakBrowser Manager or `cloakserve` in the first
  implementation. The desktop app already owns workflow and profile management.
- Do not add proxy rotation as part of this spec. Proxy rotation requires a
  separate inventory, allocation, health, and audit design.
- Do not make public third-party detector sites a required CI dependency.

## Safety Boundary

Operational controls must preserve the product's authorized-testing boundary:

- diagnostics can report versions, settings, and probe verdicts, but must not
  export secrets;
- proxy credentials, cookies, localStorage/sessionStorage, authorization
  headers, and probe query secrets must be redacted;
- advanced fingerprint controls must be tied to named identities and evidence;
- preflight and smoke probes must use local fixtures or owned allowlisted
  endpoints unless explicitly run by an operator.

## CloakBrowser Version And Binary Lifecycle

### Package Version Policy

The repo should treat `cloakbrowser` as a security- and behavior-sensitive
runtime dependency.

Implementation requirements:

- Pin `cloakbrowser` through `package-lock.json`.
- Upgrade intentionally in a dedicated change.
- Run focused runner tests, real CloakBrowser smoke tests, and any owned
  fingerprint preflight smoke before accepting an upgrade.
- Record the wrapper version used by each run.
- Document a rollback path to a previous `cloakbrowser` package version when a
  binary or wrapper update regresses owned probes.

The implementation should avoid opportunistic dependency churn mixed with
unrelated UI or workflow changes.

### Binary Version And Cache

CloakBrowser downloads a patched Chromium binary separately from Playwright's
browser installer. The app should make this visible and diagnosable.

Implementation requirements:

- Add a backend utility that imports CloakBrowser `binaryInfo()` and reports:
  - wrapper version;
  - platform;
  - expected binary version;
  - installed status;
  - binary path;
  - cache directory;
  - download URL.
- Add a command or diagnostics route exposed through the Electron backend. The
  renderer should not import CloakBrowser directly.
- Add an operator-visible diagnostics panel or structured command output in a
  later UI phase.
- Add run evidence fields for CloakBrowser wrapper version and binary version.
- Redact or normalize local filesystem paths in exported evidence if they expose
  user-specific directories.

### Install And Update Policy

The app should control when binary installation and updates happen.

Implementation requirements:

- Provide an explicit install/check command that calls `ensureBinary()` or
  `npx cloakbrowser install` during setup or smoke.
- Decide whether the app uses the default cache at `~/.cloakbrowser` or an
  app-controlled cache path under app data.
- Support operator overrides:
  - `CLOAKBROWSER_BINARY_PATH`
  - `CLOAKBROWSER_CACHE_DIR`
  - `CLOAKBROWSER_DOWNLOAD_URL`
  - `CLOAKBROWSER_AUTO_UPDATE=false`
- For reproducible sensitive runs, default to a pinned package and binary
  version. If auto-update remains enabled, evidence must record the effective
  binary version.
- Do not set `CLOAKBROWSER_SKIP_CHECKSUM=true` in normal product paths.

### Supply Chain Verification

The implementation should document how to verify downloaded binary artifacts
outside normal app execution.

Docs should cover:

- CloakBrowser SHA-256 checksum verification behavior;
- signed release tag or binary attestation verification when operators require
  it;
- Docker image signature verification if the team later uses CloakBrowser's
  Docker image.

This does not need to block local development runs, but it should be available
for production-like lab machines.

## Runtime Environment Hardening

### Playwright And System Dependencies

CloakBrowser provides its own Chromium binary. The app should not require
`playwright install chromium`.

The setup docs should instead state:

- install Node/npm dependencies with `npm install`;
- run the CloakBrowser binary install/check command when preparing a machine;
- install Playwright/Chromium system dependencies where required by the OS;
- use `npm run test:smoke` to confirm the real CloakBrowser runtime works.

### Linux Fonts

Production-like fingerprint probes can fail when Linux machines lack normal
desktop fonts or emoji/extended font coverage.

Implementation requirements:

- Add a Linux setup checklist for font packages used by lab machines.
- Add an optional identity setting for a managed font bundle only if the team
  chooses to maintain one.
- If `--fingerprint-fonts-dir` is exposed, expose it only as an advanced
  allowlisted identity field and validate that the path is readable by the
  backend.
- Include font coverage in owned fingerprint preflight evidence.

### Headed Mode And Virtual Display

Some aggressive probes can detect headless mode even when the binary is patched.
The app should support headed production-like runs.

Implementation requirements:

- Keep headless/headed as a browser identity policy field.
- For production-like preflight profiles, default to headed unless explicitly
  allowed by policy.
- Document Xvfb or equivalent virtual display setup for CI/Linux machines.
- Add a headed smoke path when the environment provides a display.
- Fail clearly when a headed profile runs on a machine without a usable display.

## Network Posture: Proxy, GeoIP, WebRTC

### Proxy Support

The app should support the proxy forms that CloakBrowser supports while keeping
operator intent explicit.

Implementation requirements:

- Support HTTP, HTTPS, and SOCKS5 proxy URLs.
- Support Playwright-style proxy object fields: `server`, `bypass`, `username`,
  `password`.
- Validate proxy schemes and credentials before launch.
- Store proxy label, region, provider, and test-account binding separately from
  credentials.
- Sanitize proxy passwords in export and evidence.
- Keep proxy rotation out of scope until a proxy inventory design exists.

### GeoIP Policy

`geoip: true` can auto-detect timezone and locale from proxy exit IP. It is
useful, but it adds dependency and runtime failure modes.

Implementation requirements:

- Add `mmdb-lib` only if the product enables `geoip: true`.
- Validate that `mmdb-lib` is available before allowing `geoip: true`.
- Set bounded timeout behavior expectations for GeoIP resolution.
- Prefer explicit timezone/locale when operator inventory already knows proxy
  region.
- Evidence should record whether timezone/locale came from explicit settings or
  GeoIP resolution.
- If GeoIP cannot resolve a result, fail preflight or warn according to identity
  policy.

### WebRTC Policy

WebRTC behavior must match the selected network posture.

Implementation requirements:

- Add identity-level WebRTC policy:
  - `default`
  - `auto_proxy_exit_ip`
  - `explicit_ip`
  - `disabled_if_supported`
- Map `auto_proxy_exit_ip` to `--fingerprint-webrtc-ip=auto` when using a proxy.
- Map `explicit_ip` to `--fingerprint-webrtc-ip=<ip>`.
- Validate that explicit IPs match proxy inventory when a proxy is selected.
- Include WebRTC coverage and observed IP family in preflight evidence.

## Advanced Fingerprint Controls

Advanced fingerprint settings should be allowlisted, validated, and tied to a
browser identity. The app should not expose an arbitrary raw `args` text box for
normal operators.

Allowed advanced fields can include:

- platform family through `--fingerprint-platform`;
- platform version when supported by the binary;
- brand and brand version when supported by the binary;
- screen width and height;
- taskbar height;
- hardware concurrency;
- device memory;
- GPU vendor and renderer family;
- storage quota;
- fonts directory;
- noise policy when supported.

Rules:

- Defaults should rely on CloakBrowser's seed-derived coherent values.
- Advanced overrides should be opt-in and marked as high risk.
- Every override must have validation against the rest of the identity bundle.
- Evidence should list which advanced overrides were active.
- Unknown flags should be rejected unless a developer-only escape hatch is added
  in a separate design.

## Humanized Runner Behavior

CloakBrowser's `humanize` option works best when the runner uses Playwright
actions that go through CloakBrowser's patched interaction pipeline.

The runner should classify action execution paths:

- `humanized`: selector or locator actions such as click, hover, type, press,
  scroll, drag, check, uncheck, select when supported;
- `browser_api`: Playwright context/page APIs that are not behavioral input but
  are expected, such as cookies, permissions, geolocation, screenshots, waits,
  downloads;
- `dom_fallback`: direct DOM dispatch or `page.evaluate()` used to emulate an
  action;
- `cdp_sensitive`: actions likely to create extra protocol or behavior signals
  before a protected check.

Implementation requirements:

- Keep `humanize: true` enabled by default.
- Prefer `locator.type()` or keyboard typing for sensitive text entry.
- Keep `fill()` available for deterministic internal forms, but mark it lower
  fidelity than typing.
- Avoid `page.waitForTimeout()` in runner implementation. Use host-side sleep
  for duration waits.
- Minimize `page.evaluate()` before owned fingerprint or behavior probes.
- Replace custom DOM dispatch helpers with locator/keyboard/mouse APIs where
  practical.
- Add an identity or run-policy field for behavior fidelity:
  - `balanced`
  - `strict_humanized`
  - `deterministic_internal`
- In `strict_humanized`, fail or warn when an action requires `dom_fallback` for
  a sensitive run.
- Record action execution path in action traces so evidence can explain whether
  a run used humanized interactions or fallbacks.

Current runner touch points to review during implementation:

- text input actions that call `locator.fill()`;
- scroll actions that call `page.evaluate()`;
- submit, radio, and right-click helpers that dispatch DOM events;
- arbitrary `execute_js` before preflight or protected checks.

## Persistent Session And Storage Discipline

The identity spec defines per-workflow persistent profile behavior. This spec
adds operational controls around storage.

Implementation requirements:

- Add profile storage diagnostics: profile id, display name, directory id,
  approximate size, last run time, and active-session status.
- Add safe cleanup UI or command for orphaned profile directories.
- Prevent reset/delete operations while the profile is actively used by a
  retained browser session.
- For package export, include profile metadata but not raw browser storage by
  default.
- If storage export/import is later needed, design it as a separate sensitive
  package feature with explicit secret handling.

## Diagnostics And Operator Surface

Add an operator diagnostics surface that can be implemented as UI, backend
command output, or both.

Diagnostics should include:

- CloakBrowser wrapper version;
- binary version;
- binary installed status;
- cache directory;
- effective binary path;
- auto-update setting;
- GeoIP dependency status;
- default profile root;
- headed display availability;
- font checklist status where detectable;
- last smoke result;
- last owned preflight verdict summary.

Diagnostics should never display proxy passwords, cookies, tokens, or local
storage values.

## Smoke And Test Coverage

The current smoke test only proves that CloakBrowser can launch and navigate to
a local fixture. It should grow into a real runtime confidence suite.

### Unit Tests

Add focused tests for:

- binary diagnostics object shape and redaction;
- launch option generation with advanced fingerprint flags;
- proxy URL validation and redaction;
- GeoIP dependency validation;
- WebRTC policy to argument mapping;
- behavior fidelity classification;
- action trace fields for humanized vs fallback execution paths.

### Real CloakBrowser Smoke Tests

Add gated smoke tests for:

- `navigator.webdriver === false`;
- UA does not contain `HeadlessChrome` for default supported modes;
- `window.chrome` and plugin baseline signals are present where expected;
- persistent profile preserves cookies/localStorage;
- fixed fingerprint seed gives stable probe values across two launches;
- timezone and locale reflect identity settings;
- viewport and screen values are coherent;
- WebRTC policy is observable through an owned/local probe when available;
- CloakBrowser binary diagnostics match the launched runtime.

### Owned Preflight Smoke

When an owned probe URL is available, add an opt-in smoke command that:

- launches a named identity;
- runs fingerprint preflight;
- records the verdict;
- fails on malformed verdicts;
- optionally fails on blocked verdicts depending on environment policy.

No CI job should depend on public third-party detector availability.

## Docs To Update During Implementation

- `README.md`
- `docs/architecture/testing.md`
- `docs/architecture/runner.md`
- `docs/domain/product-model.md`
- `docs/domain/user-visible-invariants.md`
- `docs/domain/execution-semantics.md`
- `docs/contracts/workflow-types.md`
- `docs/contracts/action-configs.md`
- `docs/contracts/run-state.md`
- `docs/contracts/electron-ipc.md` if diagnostics commands are added

README should include:

- CloakBrowser binary install/check command;
- Linux dependencies and font checklist;
- headed/Xvfb setup;
- GeoIP dependency setup;
- smoke test commands;
- rollback guidance;
- troubleshooting for preflight mismatch categories.

## Rollout Plan

### Phase 1: Diagnostics And Version Control

- Add binary diagnostics backend utility.
- Record CloakBrowser wrapper and binary version in run evidence.
- Decide cache/update policy.
- Document install/check/rollback commands.

### Phase 2: Runtime Environment Checklist

- Add Linux/system dependency docs.
- Add font checklist.
- Add headed/Xvfb guidance.
- Add diagnostics fields for display/font/dependency availability where
  feasible.

### Phase 3: Network And Advanced Fingerprint Policy

- Add proxy validation and redaction improvements.
- Add GeoIP dependency validation.
- Add WebRTC policy mapping.
- Add allowlisted advanced fingerprint controls.

### Phase 4: Humanized Runner Hardening

- Classify runner action paths.
- Prefer humanized APIs for sensitive actions.
- Add strict behavior mode.
- Record fallback usage in action traces.

### Phase 5: Expanded Smoke Coverage

- Add real CloakBrowser stealth smoke tests.
- Add persistent-profile and fixed-seed smoke tests.
- Add owned preflight smoke command when probe infrastructure is available.
- Update README and docs with the final operator workflow.

## Implementation Notes

- This spec should be implemented after or alongside the browser identity model.
- Do not block basic workflow execution on optional diagnostics or owned probe
  infrastructure.
- Prefer warnings for missing optional hardening in development, and blocking
  validation for identities marked production-like or preflight-required.
- Keep all sensitive values out of renderer logs, evidence exports, and package
  files unless a later explicit secret-handling design allows them.

