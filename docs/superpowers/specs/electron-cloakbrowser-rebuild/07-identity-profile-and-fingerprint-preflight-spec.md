# Identity Profile And Fingerprint Preflight Spec

## Purpose

Define coherent browser identity and owned fingerprint preflight behavior for
the Electron/CloakBrowser rebuild.

Identity must be a first-class product model. It must be reproducible,
operator-controlled, and auditable. Fingerprint preflight must use owned
production or staging probes to block sensitive runs before workflow actions
when the browser identity is internally inconsistent or production reports a
blocking verdict.

## In Scope

- Identity Profile fields and boundaries.
- Persistent browser profile/session reuse.
- Proxy binding metadata.
- Device/browser/locale/timezone/geolocation coherence.
- Headed/headless policy.
- Owned-domain fingerprint preflight.
- Verdict parsing and blocking behavior.
- Evidence payload requirements.

## Out Of Scope

- Public fingerprint probes.
- CAPTCHA solving or automated challenge bypass.
- Third-party anti-abuse bypass.
- Raw proxy credential storage design beyond secret references.
- Low-level fingerprint patch implementation details inside CloakBrowser.

## Product Concepts

Identity Profile answers: which browser identity is used?

Environment answers: what state is applied after launch?

Run Profile answers: how execution behaves?

These must remain separate.

## Technical Design

### Identity Profile Fields

Identity profile should include:

- id and name;
- description and tags;
- browser engine: CloakBrowser;
- browser version/channel policy;
- persistent profile slug/path;
- profile reuse enabled;
- user agent family or explicit user agent;
- device class;
- viewport width/height;
- device scale factor;
- mobile and touch flags;
- locale and languages;
- timezone;
- geolocation region or coordinates when authorized;
- permissions baseline;
- proxy reference;
- proxy region/ASN/inventory metadata;
- headed/headless policy;
- preflight policy;
- evidence labels.

### Coherence Rules

Validation must catch contradictory profiles before launch:

- mobile identity cannot use desktop-only viewport defaults unless explicitly
  marked custom;
- timezone/locale/geolocation/proxy region must be intentionally compatible;
- headed-only profiles cannot run headless;
- proxy metadata must exist when profile requires owned egress inventory;
- persistent profile slug must be filesystem-safe;
- user agent family and device flags must not contradict each other.

### Persistent Profiles

Persistent profiles are stored under app-controlled browser profile directories.
Profile locking must prevent two active runs from using the same persistent
profile concurrently unless a future spec adds safe sharing.

### Proxy Binding

Identity profile stores proxy reference and sanitized metadata. Raw credentials
must use secret references or operator-provided runtime values.

Evidence uses proxy label, region, and inventory id, not password.

### Fingerprint Preflight

Preflight is optional per workflow/run profile but required for sensitive runs
when workspace policy says so.

Flow:

```text
launch browser/context
  -> apply identity and environment setup required for probe
  -> navigate to allowlisted owned probe URL
  -> read JSON verdict
  -> validate verdict schema
  -> if failed/malformed, stop before workflow actions
  -> persist sanitized evidence
  -> continue only when verdict permits
```

### Verdict Contract

Minimum verdict fields:

- `passed`: boolean;
- `verdict`: string such as `passed`, `warn`, `blocked`;
- `risk_score`: number or null;
- `run_id`: production-side correlation id;
- `profile_id`: app identity profile id or configured probe profile id;
- `mismatches`: array;
- `evidence`: object with signal family coverage.

Mismatch fields:

- category;
- field;
- severity;
- expected summary;
- observed summary;
- reason.

## Interfaces / Contracts

Profile service commands:

- `profile.list`
- `profile.get`
- `profile.create`
- `profile.update`
- `profile.delete`
- `profile.validate`
- `profile.checkAvailability`

Runner preflight events:

- `preflight.started`
- `preflight.verdictReceived`
- `preflight.failed`
- `preflight.passed`

## Data Model

Identity profiles persist in `identity_profiles`.

Run records store identity snapshots. Evidence records store sanitized preflight
results.

Persistent browser storage lives in app data file paths, not in SQLite.

## Error Handling

- Invalid identity profile blocks run before runner start.
- Browser launch mismatch blocks as startup/validation error.
- Probe URL outside allowlist blocks as policy error.
- Missing/malformed verdict blocks as preflight failure.
- Blocking verdict stops before workflow actions and creates evidence.

## Security / Safety / Audit

- Preflight URLs must be owned and allowlisted.
- Profile evidence must be sanitized.
- Raw secrets and proxy passwords must not appear in logs, events, or exports.
- Preflight is a detection gate, not a bypass report generator.
- Headless mode must be explicit and can be disallowed by workspace policy.

## Testing

Tests must cover:

- identity profile schema validation;
- coherence rule failures;
- persistent profile path safety;
- proxy secret sanitization;
- allowlisted probe URL validation;
- malformed verdict blocks;
- failed verdict blocks before workflow actions;
- passed verdict continues execution;
- evidence payload sanitization.

## Acceptance Criteria

- Identity Profile is a first-class saved entity.
- Runner can launch with an identity profile snapshot.
- Profile coherence is validated before launch.
- Preflight blocks malformed or failed owned-probe verdicts.
- Preflight evidence is persisted and sanitized.
- Domain and owned-scope constraints are enforced.

## Dependencies

- Product Model Spec.
- Data And Storage Spec.
- CloakRunner Spec.
- Run Evidence And Audit Spec.

## Open Questions

None blocking. The exact owned probe endpoint list is workspace configuration,
not part of this spec.
