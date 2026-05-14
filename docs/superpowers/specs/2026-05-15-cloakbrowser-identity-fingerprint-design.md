# CloakBrowser Identity And Fingerprint Design

## Status

Approved for spec-only documentation on 2026-05-15.

## Problem

The app now launches workflows through CloakBrowser, but it still treats browser
identity as a loose set of settings and legacy graph actions. This leaves several
gaps:

- CloakBrowser's default fingerprint seed is random per launch. That is useful
  for temporary sessions, but it is wrong for a persistent login profile because
  the same account state can appear to come from a different device on each run.
- `use_profile`, `use_proxy`, and `set_user_agent` can still exist as graph
  actions even though they are launch-time properties. In the runner they are
  currently compatibility no-ops that only write outputs.
- Workflow Settings Browser Launch only maps a narrow subset of available
  CloakBrowser launch fields.
- The recently removed fingerprint preflight feature should not be restored as
  the old `Owned Test Gates` surface, but the product still needs a controlled,
  owned probe when sensitive workflows require measured browser identity
  consistency.
- The UI currently exposes `profile_name` as the persistent profile identity.
  Rename semantics are ambiguous if a user changes the name after session data
  exists.

The target product should use CloakBrowser as a controlled browser identity
system, not only as a drop-in browser executable.

## Goals

- Create a coherent browser identity bundle for every workflow by default.
- Generate a fingerprint seed once when an identity is created, then reuse it
  for that identity until the operator explicitly resets or replaces it.
- Give each workflow its own persistent browser profile/session by default.
- Keep `Reuse login session` as a storage/session toggle that does not change
  fingerprint identity.
- Make profile naming safe by separating stable storage identity from the
  operator-facing display name.
- Map identity settings into CloakBrowser launch-time options before the context
  is created.
- Remove new launch-time graph actions from the main workflow authoring surface
  and replace silent no-ops with validation or migration behavior.
- Add an owned fingerprint preflight gate with structured verdicts, sanitized
  evidence, and allowlisted probe origins.
- Preserve auditability through explicit identity ids, test accounts,
  allowlists, run evidence, and operator controls.

## Non-Goals

- Do not build custom canvas, WebGL, audio, font, or TLS spoofing in the app.
  Those surfaces belong to CloakBrowser and the selected Chromium binary.
- Do not add a public fingerprint probe endpoint.
- Do not add CAPTCHA bypass, account-control bypass, spam, or third-party
  anti-abuse bypass features.
- Do not restore the removed `Owned Test Gates` UI exactly as it existed.
- Do not silently rotate browser identities for persistent login sessions.
- Do not automatically share sessions between workflows.
- Do not export proxy passwords, cookies, localStorage values, or secrets as
  evidence by default.

## Safety Boundary

This feature is for authorized testing of owned or explicitly authorized systems.
The design must keep sensitive automation bounded by:

- domain allowlists for workflow navigation and fingerprint probe origins;
- named browser identities and test accounts;
- explicit profile, proxy, and preflight settings;
- stable evidence records that can be correlated with production-side telemetry;
- sanitized package export and run evidence.

The app should improve measurement and repeatability. It should not present
browser identity controls as a general-purpose stealth or abuse tool.

## Current State

The repository already uses `cloakbrowser` and `playwright-core`. The runner
launches contexts through `launchContext()` and `launchPersistentContext()` with
`humanize: true`.

Current launch mapping covers:

- `headless`
- `proxy`
- `humanize: true`
- download paths through `contextOptions`
- persistent `userDataDir` when `profile_name` is set

Current launch mapping does not yet cover:

- fixed fingerprint seed
- `timezone`
- `locale`
- `geoip`
- top-level `userAgent`
- top-level `viewport`
- storage quota fingerprint flags
- WebRTC IP policy
- human behavior preset/config
- identity-specific preflight settings

Current graph runtime behavior treats `use_profile`, `use_proxy`, and
`set_user_agent` as compatibility actions that only write output fields. That is
misleading for operators because these properties must be resolved before the
browser context is created.

## Core Concepts

### Browser Identity

A browser identity is the stable device/browser/network/session profile used to
launch a workflow. It includes:

- stable internal identity id;
- operator-facing display name;
- persistent profile directory id;
- fingerprint seed;
- session reuse mode;
- proxy settings or proxy reference;
- timezone, locale, and optional GeoIP behavior;
- viewport and device class;
- headless/headed policy;
- humanize preset;
- WebRTC policy;
- storage quota policy;
- preflight policy.

The identity is the source of truth for launch-time browser behavior.

### Profile Directory

The profile directory is the storage location passed to
`launchPersistentContext()` as `userDataDir`. It stores browser state such as
cookies, localStorage, IndexedDB, cache, extensions, and other Chromium profile
data.

Profile directory names must be derived from stable internal ids, not mutable
display names.

### Display Name

The display name is the label operators can edit in the UI. Renaming an identity
must not move, recreate, or delete profile storage. Rename is a metadata-only
operation.

### Fingerprint Seed

The fingerprint seed is the deterministic CloakBrowser seed passed through a
Chromium argument such as:

```ts
args: ["--fingerprint=48392"]
```

For a persistent login identity, the seed must be generated once and reused. A
new seed means a new device identity and should be an explicit reset or duplicate
operation.

### Reuse Login Session

`Reuse login session` controls whether the runner uses persistent browser
storage. It does not mean "reuse random fingerprint."

When enabled:

- run with `launchPersistentContext()`;
- use the identity's stable profile directory;
- use the identity's stable fingerprint seed;
- preserve cookies and local browser state across runs.

When disabled:

- run with `launchContext()` and temporary storage;
- keep the same identity seed by default so browser/device signals remain
  stable;
- do not write cookies or localStorage back to the persistent profile.

An explicit advanced operation can run with a temporary random identity, but that
should not be the default behavior of disabling login-session reuse.

## New Workflow Defaults

Creating a workflow should create a browser identity automatically. Operators
should not have to manually configure identity before a workflow can run.

Default identity creation:

```ts
browser_identity: {
  identity_id: "bi_<stable-id>",
  display_name: "<workflow name> identity",
  session_mode: "persistent_profile",
  profile_dir: "bi_<stable-id>",
  fingerprint_seed: "<random-once>",
  headless: false,
  humanize: true,
  human_preset: "default",
  viewport: {
    width: 1920,
    height: 947,
    device_scale_factor: 1,
    mobile: false,
    touch: false
  },
  timezone: null,
  locale: null,
  geoip: false,
  proxy: {
    enabled: false,
    server: null,
    username: null,
    password: null,
    label: null,
    region: null
  },
  webrtc_policy: "default",
  storage_quota_mb: null,
  preflight: {
    enabled: false,
    probe_url: null,
    allowed_origins: []
  }
}
```

The fingerprint seed is random at identity creation time only. Re-running the
workflow must not generate a new seed unless the operator explicitly resets the
identity.

## Workflow Settings Model

Workflow Settings should evolve from the current Browser Launch section into a
browser identity-oriented surface.

Recommended sections:

- `General`
- `Run Policy`
- `Browser Identity`
- `Environment`

`Browser Identity` should contain grouped controls:

- Session: reuse login session, identity display name, reset identity, duplicate
  identity.
- Device: fingerprint seed, viewport preset, device scale factor, mobile/touch
  flags, user agent if supported.
- Location: timezone, locale, optional GeoIP from proxy.
- Network: proxy server/auth or proxy reference, label, region, WebRTC policy.
- Behavior: humanize enabled, human preset/config.
- Preflight: enabled flag, probe URL/profile selector, allowed origins.

The existing `Browser Launch` label can remain temporarily for compatibility,
but the product direction should be identity-first. If the UI keeps the old
section name during implementation, help text must still explain the identity
semantics.

## Rename, Reset, And Duplicate Semantics

Renaming an identity:

- changes `display_name`;
- does not change `identity_id`;
- does not change `profile_dir`;
- does not change `fingerprint_seed`;
- does not move files.

Resetting an identity:

- requires explicit operator confirmation;
- creates a new `identity_id`, `profile_dir`, and `fingerprint_seed`;
- starts with empty browser storage unless the operator imports state;
- should preserve non-storage preferences such as proxy, timezone, locale, and
  viewport when safe.

Duplicating an identity:

- creates a new `identity_id`;
- creates a new `fingerprint_seed` by default;
- creates a new empty profile directory by default;
- can optionally copy preferences;
- should not copy cookies/profile data unless the operator confirms a sensitive
  storage copy.

Deleting a workflow:

- should ask whether to keep or delete its private profile data;
- must not delete shared identities unless the identity is owned only by the
  deleted workflow.

## CloakBrowser Launch Mapping

The runner must resolve identity before browser launch and pass stable settings
to CloakBrowser.

Temporary storage:

```ts
launchContext({
  headless,
  humanize: true,
  humanPreset,
  humanConfig,
  proxy,
  userAgent,
  viewport,
  timezone,
  locale,
  geoip,
  args,
  contextOptions: {
    acceptDownloads: true,
    downloadsPath,
    geolocation,
    permissions,
    extraHTTPHeaders,
    storageState
  }
});
```

Persistent storage:

```ts
launchPersistentContext({
  userDataDir,
  headless,
  humanize: true,
  humanPreset,
  humanConfig,
  proxy,
  userAgent,
  viewport,
  timezone,
  locale,
  geoip,
  args,
  contextOptions: {
    acceptDownloads: true,
    downloadsPath,
    geolocation,
    permissions,
    extraHTTPHeaders
  }
});
```

The `args` list should be built from identity settings:

```ts
[
  `--fingerprint=${fingerprintSeed}`,
  storageQuotaMb ? `--fingerprint-storage-quota=${storageQuotaMb}` : null,
  explicitWebrtcIp ? `--fingerprint-webrtc-ip=${explicitWebrtcIp}` : null
]
```

Rules:

- Use CloakBrowser top-level `timezone` and `locale`, not Playwright
  `contextOptions.timezoneId` or `contextOptions.locale`.
- `geoip: true` requires `mmdb-lib`. If the dependency is not installed, the app
  should fail validation or disable the control with clear copy.
- Do not pass extra HTTP headers that contradict Chromium's normal header set
  for the selected user agent and locale.
- Do not mix a mobile user agent with desktop-only viewport and touch settings.
- Do not run production-like preflight in headless mode unless the selected
  profile policy explicitly allows it.

## Launch-Time Action Cleanup

The graph should describe workflow behavior after the browser is ready. Browser
identity belongs in Workflow Settings.

Launch-time actions to remove from the new-action surface:

- `use_profile`
- `use_proxy`
- `set_user_agent`

Potential future launch-time settings must follow the same rule:

- fingerprint seed;
- timezone;
- locale;
- proxy;
- WebRTC policy;
- platform/device class.

Compatibility behavior:

- Existing workflows with these actions must continue to load.
- New workflows should not show these actions in the main action picker.
- If a legacy launch-time node appears before any browser action and does not
  conflict with Workflow Settings, the compiler may hoist it into the identity
  bundle and emit a migration note.
- If a legacy launch-time node appears after browser work starts, validation
  should fail with an operator-facing message.
- The runner should not silently no-op these actions after the compatibility
  path is implemented.

Example validation message:

```text
Set User Agent is a launch-time browser identity setting. Move it to Workflow
Settings > Browser Identity before running this workflow.
```

## Owned Fingerprint Preflight

The product should add a new preflight gate that is identity-first and distinct
from the removed `Owned Test Gates` implementation.

Preflight should:

- run only against owned or explicitly authorized allowlisted origins;
- launch the resolved CloakBrowser identity first;
- open an internal or staging fingerprint probe before user graph actions;
- read a structured JSON verdict;
- stop the workflow before graph execution when the verdict fails;
- save compact sanitized evidence for audit and reproduction.

The probe should measure or correlate:

- User-Agent and browser version;
- OS/platform family;
- screen, viewport, device pixel ratio, mobile/touch flags;
- timezone, language, locale;
- fonts, canvas, WebGL, audio;
- cookies, localStorage, sessionStorage, IndexedDB readiness where applicable;
- WebRTC/IP behavior;
- TLS and HTTP/header observations;
- automation signals such as `navigator.webdriver` and CDP-related indicators;
- interaction timing coverage when the probe includes behavior checks.

The app should not try to compute all verdicts locally. Production or staging
probe systems remain the source of truth for detection and scoring.

## Probe Verdict Contract

The probe response should be JSON with a stable schema:

```json
{
  "passed": false,
  "verdict": "blocked",
  "risk_score": 72,
  "run_id": "fp-2026-05-15-001",
  "profile_id": "bi_01hv7example",
  "identity_display_name": "QA US Login 01",
  "mismatches": [
    {
      "category": "browser_device",
      "field": "timezone",
      "severity": "high",
      "expected": "America/New_York",
      "observed": "Asia/Ho_Chi_Minh",
      "reason": "Timezone does not match proxy region"
    }
  ],
  "evidence": {
    "browser_device_seen": true,
    "headers_seen": true,
    "tls_seen": true,
    "storage_seen": true,
    "canvas_seen": true,
    "webgl_seen": true,
    "audio_seen": true,
    "webrtc_seen": true,
    "automation_seen": true
  }
}
```

Required top-level fields:

- `passed`: boolean gate result.
- `verdict`: production classification such as `passed`, `warn`, or `blocked`.
- `risk_score`: numeric score or `null`.
- `run_id`: production-side correlation id.
- `profile_id`: browser identity id used for the probe.
- `mismatches`: list of findings.
- `evidence`: compact coverage flags.

Mismatch fields:

- `category`: one of `browser_device`, `canvas`, `webgl`, `audio`, `storage`,
  `network`, `tls`, `headers`, `webrtc`, `automation`, `behavior`, or `other`.
- `field`: field name from the detection system.
- `severity`: `low`, `medium`, `high`, or `critical`.
- `expected`: optional expected value or family.
- `observed`: optional observed value or family.
- `reason`: operator-facing reason.

Missing or malformed verdicts should fail preflight.

## Runner Flow

The run flow should become:

```text
load workflow and settings
  -> validate graph and browser identity
  -> compile graph
  -> resolve identity bundle
  -> launch CloakBrowser with identity launch options
  -> apply initial environment setup that is valid after launch
  -> optionally run owned fingerprint preflight
  -> stop before graph actions if preflight fails
  -> execute graph actions
  -> capture outputs, traces, and evidence
  -> retain or close browser by run policy
```

Environment setup that remains valid after launch can include:

- cookies;
- localStorage;
- sessionStorage;
- permissions;
- geolocation;
- extra headers where they do not contradict identity settings.

## Validation Rules

Settings validation should catch incoherent identities before launch:

- persistent profile requires a fixed fingerprint seed;
- profile display name can change, but `identity_id` and `profile_dir` are
  immutable except through reset;
- proxy region, timezone, locale, and geolocation must be compatible when all
  are supplied;
- `geoip: true` requires `mmdb-lib`;
- headless mode is blocked when preflight profile policy requires headed;
- mobile/touch settings must be compatible with the selected user agent and
  viewport;
- extra headers must not override browser-managed identity headers unless a
  dedicated advanced override is enabled;
- legacy launch-time graph actions cannot run after browser actions.

Validation should return blocking issues for unsafe contradictions and warnings
for incomplete but intentional configurations.

## Evidence And Export

Run evidence should include:

- workflow id and run id;
- identity id and display name;
- profile directory id or temporary marker;
- fingerprint seed hash or redacted seed according to security policy;
- proxy label and region, not proxy password;
- timezone, locale, and viewport summary;
- preflight verdict and production `run_id`;
- mismatch summaries;
- evidence coverage flags;
- timestamp and CloakBrowser package/binary version when available.

Exports must sanitize:

- proxy password;
- cookies;
- localStorage/sessionStorage values;
- raw authorization headers;
- secrets and environment variables;
- full probe URLs when they contain query secrets.

## UI Surface

Workflow Settings should support:

- Reuse login session toggle;
- identity display name input;
- read-only identity id/profile directory summary;
- reset identity action with confirmation;
- duplicate identity action;
- fingerprint seed display with copy/redacted mode and reset guard;
- proxy, timezone, locale, GeoIP, viewport, and humanize controls;
- preflight enablement and probe selector;
- warnings when identity settings are incomplete or risky.

The graph editor should:

- hide launch-time identity actions from new action palettes;
- show clear validation errors for legacy launch-time nodes;
- provide migration help when legacy nodes can be safely moved to settings.

No standalone HTML fingerprint report page is required.

## Migration And Compatibility

Existing workflows should migrate as follows:

- If `browser_launch.profile_name` exists, create an identity using a stable
  `identity_id`, keep the old name as `display_name`, and derive a stable
  `profile_dir`.
- If `Reuse login session` is enabled and no fingerprint seed exists, generate
  one once during migration and persist it.
- If proxy settings exist in Browser Launch, move them into the identity's
  network group.
- If legacy browser fingerprint/preflight fields exist from older package data,
  ignore unsupported fields unless they map cleanly to the new identity/preflight
  model.
- If a graph starts with launch-time actions and Browser Identity does not
  already define conflicting settings, hoist those values into identity settings
  and emit migration notes.
- If a graph has launch-time actions after browser work begins, keep the graph
  loadable but block execution until the operator fixes it.

The app must not crash on old package imports containing removed
`owned_test_gates` data.

## Rollout Plan

### Phase 1: Identity Model And Launch Mapping

- Add browser identity fields and defaults.
- Auto-create identity for new workflows.
- Generate fixed fingerprint seeds at identity creation.
- Map identity into CloakBrowser launch options.
- Add validation for persistent profile without fixed seed.
- Keep current UI shape if needed, but store identity semantics correctly.

### Phase 2: Launch-Time Action Cleanup

- Hide `use_profile`, `use_proxy`, and `set_user_agent` from new action pickers.
- Add compiler validation and migration notes for legacy launch-time nodes.
- Remove runner silent no-op behavior once compiler compatibility is in place.

### Phase 3: Owned Fingerprint Preflight

- Add preflight settings under Browser Identity.
- Add verdict parser and schema validation.
- Run the probe after launch and before graph actions.
- Store sanitized evidence.
- Render preflight failures in the run issue panel.

### Phase 4: Smoke Tests, Docs, And Operator Checklist

- Add focused unit tests and real CloakBrowser smoke coverage.
- Update current docs and README smoke checklist.
- Document dependency requirements for `geoip: true`.
- Document identity reset, duplicate, and rename behavior.

## Testing Plan

Implementation must follow TDD.

Backend tests:

- default workflow creation produces a browser identity;
- identity seed is generated once and reused across runs;
- rename changes display name only;
- reset creates new identity id, profile dir, and seed;
- `Reuse login session` controls persistent vs temporary context without
  rotating identity seed;
- `buildLaunchOptions()` maps seed, proxy, timezone, locale, geoip, viewport,
  humanize, and context options to CloakBrowser;
- `geoip: true` validates `mmdb-lib` availability;
- legacy launch-time graph nodes migrate or fail clearly;
- preflight verdict parsing accepts valid verdicts and rejects malformed ones;
- failed preflight stops before graph actions;
- passed preflight continues into graph actions;
- evidence export sanitizes sensitive values.

Frontend tests:

- Workflow Settings shows identity controls and reuse session semantics;
- profile rename does not imply reset;
- reset identity requires confirmation;
- preflight failures render in the run issue panel;
- launch-time actions do not appear in the main action picker;
- legacy launch-time nodes show actionable validation messages.

Smoke tests:

- real CloakBrowser launch reports `navigator.webdriver === false`;
- persistent profile preserves cookies/localStorage;
- fixed fingerprint seed stays stable across two launches of the same identity;
- timezone and locale are visible as configured;
- viewport and device scale are coherent;
- headed policy is enforced for preflight profiles that require it.

Focused commands:

- `npm test -- src/features/workflows/lib/workflowSettings.test.ts`
- `npm test -- src/features/workflows/components/WorkflowSettingsDialog.test.tsx`
- `npm test -- electron/backend/commands.test.ts`
- `npm test -- electron/backend/graphCompiler.test.ts`
- `npm test -- electron/backend/runner.test.ts`
- `npm run build:electron`
- `npx tsc --noEmit`
- `npm run test:smoke` when real CloakBrowser launch behavior changes

## Docs To Update During Implementation

- `README.md`
- `docs/domain/product-model.md`
- `docs/domain/user-visible-invariants.md`
- `docs/domain/workflow-lifecycle.md`
- `docs/domain/execution-semantics.md`
- `docs/architecture/runner.md`
- `docs/contracts/workflow-types.md`
- `docs/contracts/action-configs.md`
- `docs/contracts/run-state.md`
- `docs/contracts/electron-ipc.md` if IPC commands change

Historical specs under `docs/superpowers/` can remain as historical records.
This spec intentionally supersedes the old active-product direction without
resurrecting the removed `Owned Test Gates` implementation unchanged.

## Open Implementation Decisions

The implementation plan should make these concrete:

- whether `Browser Launch` is renamed to `Browser Identity` immediately or after
  an intermediate compatibility release;
- whether fingerprint seed is shown in full, partially redacted, or hidden by
  default;
- whether temporary runs with reuse disabled always use the identity seed or can
  opt into a random ephemeral seed from the run dialog;
- whether shared identities are supported in the first implementation or held
  for a later identity inventory design;
- whether preflight is disabled by default or enforced by organization policy.

