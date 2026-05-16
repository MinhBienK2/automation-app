# CloakBrowser Alignment Matrix

Status: CloakBrowser launch/session, browser identity fields, and batch lifecycle mapping reviewed; residual gaps are tracked in findings and test-gap report.

Local package source of truth: `cloakbrowser@0.3.27`.

## Sources

- CloakBrowser API: `node_modules/cloakbrowser/dist/types.d.ts`, `dist/playwright.d.ts`, `README.md`
- App schema: `src/types/workflow.ts:164`
- Defaults and help: `src/features/workflows/lib/workflowSettings.ts`
- UI: `src/features/workflows/components/WorkflowSettingsDialog.tsx`
- Runtime mapping: `electron/backend/runner.ts:1600`
- Settings validation and migration: `electron/backend/commands.ts`

## CloakBrowser API Surface

`LaunchOptions` supports `headless`, `proxy`, `args`, `stealthArgs`, `timezone`, `locale`, `geoip`, `launchOptions`, `humanize`, `humanPreset`, and `humanConfig`.

`LaunchContextOptions` adds `userAgent`, `viewport`, `timezoneId`, `colorScheme`, and `contextOptions`. CloakBrowser strips `locale` and `timezoneId` from `contextOptions`; use top-level `locale` and `timezone`.

`LaunchPersistentContextOptions` adds required `userDataDir`.

## App-To-CloakBrowser Matrix

| App field | CloakBrowser option or arg | Current mapping | Expected mapping | Risk if wrong | Current tests | Missing test | Severity |
|---|---|---|---|---|---|---|---|
| `session_mode` | `launchContext` vs `launchPersistentContext` | Persistent uses `launchPersistentContext` with `userDataDir`; temporary uses `launchContext` | Same | P1 if persistent storage silently lost or temporary presented as reusable | `electron/backend/runner.test.ts`, `commands.test.ts` | E2E settings-before-run verifies visible retained state only indirectly | P1 |
| `identity_id` | evidence/profile ownership | Evidence only; profile storage uses `profile_dir` | Same | P2 audit trace mismatch if omitted | runner evidence tests | profile ownership delete collision test depth | P2 |
| `display_name` | evidence only | Evidence only | Same | P3 operator audit context loss | runner evidence tests | none | P3 |
| `profile_dir` | `userDataDir` | `path.join(appPaths.browserProfilesDir, sanitizePathSegment(profileDir))` | Same | P1 profile reuse/storage lock bugs | runner retained-session tests, commands active-profile guard | delete while active E2E | P1 |
| `profile_name` | legacy fallback for `profile_dir` | Used by retained profile key fallback | Compatibility only | P2 legacy load drift | commands tests | legacy package/import path audit | P2 |
| `fingerprint_seed` | `args: --fingerprint=<seed>` | Top-level `args` entry | Same | P1 unstable browser identity | runner launch options tests | boundary invalid seed tests | P1 |
| `user_agent` | `userAgent` | Top-level `userAgent` when nonblank | Same | P2 UA mismatch with profile signals | runner launch options tests | F-002: Workflow Settings UI/help omit the runtime field | P2 |
| `viewport_width` | `viewport.width` | Top-level `viewport` | Same | P2 screen/window coherence drift | runner launch options tests | mobile/touch/device coherence cases | P2 |
| `viewport_height` | `viewport.height` | Top-level `viewport` | Same | P2 screen/window coherence drift | runner launch options tests | mobile/touch/device coherence cases | P2 |
| `device_scale_factor` | `contextOptions.deviceScaleFactor` | Forwarded through `contextOptions` | Same unless CloakBrowser exposes safer top-level option later | P2 device coherence drift | runner launch options tests | range/boundary audit | P2 |
| `mobile` | `contextOptions.isMobile` | Forwarded through `contextOptions` | Same | P2 device coherence drift | runner launch options tests | coherent viewport/touch/mobile bundle tests | P2 |
| `touch` | `contextOptions.hasTouch` | Forwarded through `contextOptions` | Same | P2 device coherence drift | runner launch options tests | coherent viewport/touch/mobile bundle tests | P2 |
| `timezone` | top-level `timezone` | Top-level `timezone`; not in `contextOptions` | Same | P1 detectable CDP emulation if moved into context options | runner launch options tests, commands validation | precedence with `geoip` and explicit locale/timezone | P1 |
| `locale` | top-level `locale` | Top-level `locale`; not in `contextOptions` | Same | P1 detectable CDP emulation if moved into context options | runner launch options tests, commands validation | precedence with `geoip` and explicit locale/timezone | P1 |
| `geoip` | top-level `geoip` | Top-level boolean | Same | P1 proxy/timezone mismatch | commands validation, runner launch options tests | missing `mmdb-lib` behavior/evidence test | P1 |
| `proxy_enabled` | `proxy` present/absent | Disabled returns `undefined` | Same | P1 wrong network posture | runner proxy tests, commands validation | E2E with proxy fixture unavailable locally | P1 |
| `proxy_server` | `proxy.server` or URL string parsing | URL credentials stripped into `username/password`; server sanitized | Same | P0/P1 credential leak or wrong route | runner proxy tests, package sanitization tests | malformed URL boundary table | P1 |
| `proxy_username` | `proxy.username` | Forwarded unless URL credentials present | Same; validation must reject both credential sources | P0 secret conflict/leak | commands validation tests | UI warning state audit | P1 |
| `proxy_password` | `proxy.password` | Forwarded at launch; sanitized from package/evidence | Same | P0 secret leak | commands package sanitization, diagnostics redaction | runner evidence redaction table | P0 |
| `proxy_bypass` | `proxy.bypass` | Forwarded | Same | P2 route leakage if wrong | runner launch options tests | bypass parsing edge cases | P2 |
| `proxy_label` | evidence only | Evidence only | Same | P3 audit metadata loss | runner evidence tests | none | P3 |
| `proxy_region` | evidence only | Evidence only | Same | P2 proxy/timezone review drift | runner evidence tests | consistency warning tests | P2 |
| `proxy_provider` | evidence only | Evidence only | Same | P3 audit metadata loss | runner evidence tests | none | P3 |
| `test_account_binding` | evidence only | Evidence only | Same | P2 weak auditability for owned account scope | runner evidence tests | UI/export redaction audit | P2 |
| `webrtc_policy` | `args: --fingerprint-webrtc-ip=*` | `auto_proxy_exit_ip` and `explicit_ip` map to args; `default` omits WebRTC args; `disabled_if_supported` is rejected/defaulted because CloakBrowser has no disable flag | Same | P1 WebRTC leak if disabled mode is a no-op | `electron/backend/commands.test.ts`, `electron/backend/runner.test.ts` | none for F-001 | P1 |
| `webrtc_ip` | `args: --fingerprint-webrtc-ip=<ip>` | Used only with `explicit_ip` | Same | P1 IP mismatch/leak | runner launch options tests | IP format validation boundary | P1 |
| `fingerprint_platform` | `args: --fingerprint-platform=*` | Top-level arg | Same | P2 incoherent platform bundle | commands validation, runner tests | platform/hardware bundle consistency | P2 |
| `hardware_concurrency` | `args: --fingerprint-hardware-concurrency=*` | Top-level arg | Same | P2 incoherent hardware | commands validation, runner tests | min/max boundary tests | P2 |
| `device_memory_gb` | `args: --fingerprint-device-memory=*` | Top-level arg | Same | P2 incoherent hardware | commands validation, runner tests | allowed value set review | P2 |
| `fingerprint_fonts_dir` | `args: --fingerprint-fonts-dir=*` | Top-level arg after validation | Same | P2 font fingerprint mismatch | commands validation | active profile + missing path race test | P2 |
| `storage_quota_mb` | `args: --fingerprint-storage-quota=*` | Top-level arg | Same | P2 storage quota fingerprint drift | commands validation, runner tests | range/boundary tests | P2 |
| `humanize` | `humanize` | Top-level boolean, default true | Same | P1 behavior fidelity mismatch | runner launch tests | E2E action trace fidelity smoke | P1 |
| `human_preset` | `humanPreset` | Top-level preset | Same | P2 behavior mismatch | runner launch tests | invalid preset validation audit | P2 |
| `behavior_fidelity` | app runner policy | Blocks DOM fallback and CDP-sensitive actions when strict | Same | P1 silent stealth degradation if bypassed | runner strict humanized tests | broad action trace matrix | P1 |
| `preflight_enabled` | app-owned runtime probe | Runs after launch before graph actions | Same | P1 unsafe run if preflight skipped | runner preflight tests, commands diagnostics tests | headed-only UI guard E2E | P1 |
| `preflight_probe_url` | app-owned runtime probe URL | Allowlist checked before navigation | Same | P0 unauthorized/cross-domain probe | runner/commands preflight tests | URL redaction in all evidence surfaces | P0 |
| `preflight_allowed_origins` | app-owned allowlist | Exact origin list check | Same | P0 unauthorized probe | runner/commands tests | normalization/case/port table | P0 |
| `headless` | `headless` | Top-level boolean; Linux headed preflight guard checks display | Same | P1 headless/headed identity drift | runner tests | settings-before-run E2E with headless visible state | P1 |
| `run_from_selected_enabled` | app retained session gate | Command and UI gate; runner reuses retained session only | Same | P1 accidental fresh launch mid-workflow | commands, runner, page tests | stale session desktop E2E | P1 |

## CloakBrowser Options Not Exposed Directly

| CloakBrowser option | Classification | Current app stance | Audit requirement |
|---|---|---|---|
| `stealthArgs` | dangerous/should not expose | Not public; default CloakBrowser stealth args remain enabled | Verify no app path sets it false |
| `launchOptions` | dangerous/should not expose | Not public | Verify raw Playwright launch options cannot bypass guardrails |
| `humanConfig` | nice-to-have | Not public; app exposes preset only | Decide only after behavior-fidelity product need |
| `timezoneId` | already covered indirectly | App uses top-level `timezone` | Verify no code sends timezone through `contextOptions` |
| `colorScheme` | nice-to-have | Not public | Classify against product need; no automatic add |
| `contextOptions.acceptDownloads` | already covered indirectly | App sets true for evidence/downloads | Verify no secret path leaks in evidence |
| `contextOptions.permissions` | already covered by action | In-run `grant_permission` action | Verify launch-time vs runtime semantics are documented |
| `contextOptions.geolocation` | already covered by action | In-run `set_geolocation` action | Verify location coherence with proxy/timezone preflight |

## Reviewed Evidence - 2026-05-15

Reviewed source rows:

- CloakBrowser API confirms top-level `timezone`, `locale`, `geoip`, `humanize`, `humanPreset`, `proxy`, `args`, and persistent `userDataDir` options in `node_modules/cloakbrowser/dist/types.d.ts:6` and `playwright.d.ts:42`.
- Persistent sessions use `launchPersistentContext` with sanitized `userDataDir`; temporary sessions use `launchContext` in `electron/backend/runner.ts:470`.
- Launch options map seed, advanced fingerprint args, WebRTC auto/explicit IP, headless, humanize, user agent, viewport, timezone, locale, geoip, proxy, downloads, device scale, mobile, and touch in `electron/backend/runner.ts:1600`.
- Proxy URL credentials are stripped into proxy auth fields in `electron/backend/runner.ts:1655`.
- Browser identity evidence hashes the seed and omits raw proxy credentials in `electron/backend/runner.ts:1689`.
- Settings validation covers proxy server, credential-source conflicts, fingerprint seed, geoip dependency, explicit WebRTC IP, auto WebRTC proxy requirement, mobile UA coherence warning, advanced fingerprint ranges, preflight allowlist, and headed preflight mode in `electron/backend/commands.ts:1110`.
- Run-from-selected gates persistent profile, retention, enabled setting, and reusable retained session before runner execution in `electron/backend/commands.ts:565`.

Reviewed test rows:

- Launch option and evidence mapping: `electron/backend/runner.test.ts:46`.
- Proxy URL credential normalization: `electron/backend/runner.test.ts:175`.
- Preflight blocked/pass/malformed behavior: `electron/backend/runner.test.ts:238`.
- Retained session reuse and stale-session detection: `electron/backend/runner.test.ts:699`.
- Driver calls `launchContext` and `launchPersistentContext`: `electron/backend/runner.test.ts:2075`.
- Browser launch validation and package sanitization: `electron/backend/commands.test.ts:449`, `electron/backend/commands.test.ts:755`.
- Active retained profile guard: `electron/backend/commands.test.ts:315`.
- Run-from-selected command gate: `electron/backend/commands.test.ts:1113`.
- Workflow Settings UI coverage for visible Browser Launch fields: `src/features/workflows/pages/WorkflowDetailPage.test.tsx:190`.
- Help alignment test intentionally excludes `User agent`, `Mobile viewport`, and `Touch input`: `src/features/workflows/lib/workflowSettings.test.ts:83`.

Reviewed gaps:

- F-001 WebRTC policy drift is fixed: unsupported `disabled_if_supported` is rejected/defaulted, and supported policy launch args/evidence are covered by backend tests.
- F-002 records `user_agent` UI/help drift.
- No app path currently exposes raw `stealthArgs`, `launchOptions`, `humanConfig`, `timezoneId`, or `colorScheme`; `rg` found only audit docs for those names outside CloakBrowser sources.

## Session Lifecycle Checks

Reviewed source rows:

- Full run closes any previous retained context before a fresh launch in `electron/backend/runner.ts:405`.
- Run from selected is command-gated on persistent profile, retained browser policy, enabled setting, and `hasReusableRetainedSession` before it calls the runner with `reuseRetainedSession: true` in `electron/backend/commands.ts:565`.
- Retained session reuse does not relaunch; stale/closed contexts clear retained metadata and fail with a readable no-session message in `electron/backend/runner.ts:390` and `electron/backend/runner.ts:410`.
- Retained session state reports `"Browser session was closed"` when the context or page is stale in `electron/backend/runner.ts:437`.
- Active retained profile diagnostics mark `active_session` against the retained profile name in `electron/backend/commands.ts:1532`.
- Browser identity evidence hashes `fingerprint_seed` and omits raw proxy credentials in `electron/backend/runner.ts:1689`.
- Workflow package export strips `proxy_password`, proxy URL credentials, and preflight probe query strings in `electron/backend/commands.ts:1616`.

Reviewed test rows:

- Run-from-selected command coverage verifies the reusable-session gate, graph subset, and rejection cases for disabled setting, temporary session, close retention, and no retained session in `electron/backend/commands.test.ts:1113`.
- Runner coverage verifies retained run-from-selected reuse without relaunch, continuation after the selected node, and stale retained-session failure after manual close in `electron/backend/runner.test.ts:699`.
- Active retained profile cleanup/change guards are covered in `electron/backend/commands.test.ts:280` and `electron/backend/commands.test.ts:315`.
- Package export sanitization is covered in `electron/backend/commands.test.ts:755` and desktop package smoke coverage exists in `tests/e2e/workflow-package.e2e.ts:35`.

Residual gaps:

- Desktop E2E does not currently exercise manually closing a retained browser window, then invoking Run from selected.
- F-024: Batch mode maps forced close/headless/concurrency behavior in backend code, but headless mapping lacks a direct assertion.

## Batch Lifecycle Checks

Reviewed source rows:

- Batch run settings force `run_policy.browser_retention` to `close` for each row in `electron/backend/commands.ts:879` through `electron/backend/commands.ts:884`.
- Batch row launch headless mode is resolved from `request.headless ?? settings.run_policy.batch_headless` in `electron/backend/commands.ts:885` through `electron/backend/commands.ts:888`.
- Batch concurrency above one is rejected until row isolation is implemented in `electron/backend/commands.ts:866` through `electron/backend/commands.ts:873`.
- Run Policy UI keeps batch concurrency/headless/stop-on-failure controls disabled while still displaying saved defaults in `src/features/workflows/components/WorkflowSettingsDialog.tsx:332` through `src/features/workflows/components/WorkflowSettingsDialog.tsx:354`.
- Run Policy help documents the paused batch controls and backend concurrency limit in `src/features/workflows/lib/workflowSettings.ts:433` through `src/features/workflows/lib/workflowSettings.ts:485`.

Reviewed test rows:

- `src/features/workflows/components/WorkflowSettingsDialog.test.tsx:10` asserts paused batch controls are disabled.
- `src/features/workflows/components/WorkflowSettingsDialog.test.tsx:126` asserts disabled batch switches do not mutate settings.
- `electron/backend/commands.test.ts:1640` covers sequential batch rows, stop-on-first-failed-row, and rejection of `concurrency_limit: 2`.
- `electron/backend/commands.test.ts:1713` asserts each batch runner setting forces browser retention to `close`.
- `tests/e2e/batch-evidence.e2e.ts:8` covers desktop batch execution and persisted row evidence.

Residual gaps:

- Direct backend test should assert `batchSettings.browser_launch.headless` for both saved `batch_headless` and request override paths.
