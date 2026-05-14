# Fingerprint Preflight Gate Design

## Purpose

Production already has an internal browser-fingerprint probe. The app should use that probe as a machine-readable contract before running sensitive workflows against owned systems. A workflow should not proceed when its browser identity is internally inconsistent or when production reports a fingerprint mismatch.

This design intentionally does not add an HTML report page. The operator already has production-side visibility. The app only needs structured verdicts, run evidence, and clear blocking errors.

## Goals

- Run an allowlisted production or staging fingerprint probe before the real workflow.
- Read a JSON verdict that says whether the browser identity passed, which fields mismatched, and what evidence was observed.
- Treat browser identity as one coherent profile rather than independent user-agent, viewport, timezone, proxy, and storage toggles.
- Persist enough run evidence for security, trust, anti-abuse, and production teams to reproduce and harden detections.
- Keep the scope limited to owned or explicitly authorized targets, named test accounts, and operator-controlled workflow settings.

## Non-Goals

- No public probe endpoint.
- No HTML report inside the app.
- No CAPTCHA, account-control, or third-party anti-abuse bypass feature.
- No random one-off spoofing that makes fields inconsistent across browser, network, storage, and production telemetry.
- No storage of sensitive values such as proxy passwords in exported evidence.

## Probe Verdict Contract

The production probe should return JSON with a stable schema. The app should reject missing or malformed verdicts as a preflight failure.

```json
{
  "passed": false,
  "risk_score": 72,
  "run_id": "fp-2026-05-09-001",
  "profile_id": "desktop-us-chrome-a",
  "verdict": "blocked",
  "mismatches": [
    {
      "category": "browser_device",
      "field": "timezone",
      "severity": "high",
      "expected": "America/Los_Angeles",
      "observed": "Asia/Ho_Chi_Minh",
      "reason": "Timezone does not match proxy region"
    }
  ],
  "evidence": {
    "headers_seen": true,
    "tls_seen": true,
    "storage_seen": true,
    "canvas_seen": true,
    "webgl_seen": true,
    "audio_seen": true
  }
}
```

Required top-level fields:

- `passed`: boolean gate result.
- `verdict`: production classification such as `passed`, `warn`, or `blocked`.
- `risk_score`: numeric score from production, or `null` when the probe does not score a run.
- `run_id`: production-side correlation id.
- `profile_id`: app/browser identity profile id used for the probe.
- `mismatches`: list of field-level findings.
- `evidence`: booleans or compact metadata confirming which signal families were measured.

Mismatch fields:

- `category`: one of `browser_device`, `canvas`, `webgl`, `audio`, `storage`, `network`, `tls`, `headers`, `behavior`, or `other`.
- `field`: field name from the detection system.
- `severity`: `low`, `medium`, `high`, or `critical`.
- `expected`: optional expected value or family.
- `observed`: optional observed value or family.
- `reason`: operator-facing reason.

## Coherent Identity Profile

Workflow Settings Browser should evolve from individual launch fields into an identity bundle. The bundle should keep these values aligned:

- Browser/device: user agent, OS family, viewport, device scale factor, mobile flag, touch support, hardware class hints, language.
- Local environment: timezone, locale, geolocation, permission state.
- Storage/session: persistent profile name, cookies, localStorage, sessionStorage, IndexedDB readiness if supported later.
- Network: proxy label, proxy region, ASN/datacenter classification from the owned inventory, IP family, allowlisted egress path.
- Browser internals: expected WebGL/GPU family, canvas/audio stability policy, headless/headed policy.
- Headers: extra headers constrained to owned testing needs, with browser-native headers left to Chromium whenever possible.

The app should validate profile coherence before launch. Examples:

- Mobile Safari user agent cannot pair with desktop Chromium-only WebGL expectations.
- Proxy region, timezone, locale, and geolocation should be intentionally compatible.
- Headless mode should be blocked for profiles whose production probe requires headed hardware-backed rendering.
- Extra headers should not contradict Chromium's normal header set for the selected profile.

## Runner Flow

1. Load Workflow Settings and compile the saved graph.
2. Resolve the Browser identity bundle.
3. Launch Chromium with the resolved profile, proxy, viewport, user agent, locale/timezone settings, and persistent user data directory when configured.
4. Apply environment setup actions that must happen after launch, such as permissions, geolocation, cookies, localStorage, sessionStorage, and extra headers.
5. Open the configured probe URL on an owned allowlisted domain.
6. Read the JSON verdict from the page response or a production verdict API keyed by `run_id`.
7. If `passed` is false, stop before workflow actions and return a settings/system run issue containing mismatch details.
8. If `passed` is true, continue into the compiled workflow actions.
9. Save compact evidence with the run state for audit and reproduction.

## Evidence

Each run should capture:

- Probe URL origin, not secret query strings.
- Production `run_id`.
- Identity `profile_id`.
- Browser profile name or generated temporary profile marker.
- Proxy label and region, not proxy password.
- Verdict, risk score, and mismatch list.
- Evidence coverage flags for browser/device, canvas, WebGL, audio, storage, IP/ASN/proxy, TLS, and headers.
- Timestamp and workflow id.

Evidence should be export-sanitized by default.

## Browser Signal Strategy

The first implementation should focus on measurable consistency rather than broad spoofing:

- Prefer real headed Chrome/Chromium with hardware acceleration for production-like WebGL and audio behavior.
- Treat headless as a test-only mode unless production explicitly accepts it.
- Use persistent profiles for session continuity when account state is part of the probe.
- Keep TLS and browser-native header behavior owned by Chromium and the selected egress path. The app should collect production observations, not hand-roll TLS behavior.
- Avoid per-run random canvas/audio values. Any approved variance must be stable per identity profile and visible in evidence.

## UI Surface

No report page is required. The UI only needs:

- A Workflow Settings Browser control for enabling fingerprint preflight.
- Probe URL or probe profile selector restricted to owned allowlisted domains.
- A selected identity profile.
- A run issue panel entry when preflight fails, showing mismatch category, field, severity, observed/expected summary, and production `run_id`.

## Testing

Add tests in the implementation phase for:

- Probe verdict schema parsing.
- Blocking failed or malformed verdicts before workflow actions.
- Passing verdicts continuing into normal run execution.
- Sanitized evidence export.
- Coherence validation for invalid browser/network/profile combinations.
- UI rendering of mismatch run issues without adding an HTML report page.

## Docs To Update During Implementation

- `docs/domain/product-model.md`
- `docs/domain/execution-semantics.md`
- `docs/architecture/runner.md`
- `docs/contracts/workflow-types.md`
- `docs/contracts/run-state.md`
- `docs/contracts/tauri-commands.md` if new commands are introduced
- `README.md` smoke checklist if operator workflow changes
