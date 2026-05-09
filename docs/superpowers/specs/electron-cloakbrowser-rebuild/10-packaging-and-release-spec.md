# Packaging And Release Spec

## Purpose

Define packaging and release requirements for the Electron/CloakBrowser rebuild
across Windows, macOS, and Linux.

The app must ship as a desktop product while keeping Playwright/CloakBrowser
runtime behavior reproducible and auditable.

## In Scope

- Windows `.exe`.
- macOS app packaging.
- Linux packaging.
- Electron builder strategy.
- Bundled runtime policy.
- CloakBrowser version pinning.
- Binary checksum verification.
- Signing/notarization expectations.
- Smoke testing.

## Out Of Scope

- Public app store distribution.
- Auto-update implementation details.
- Cloud license service.
- Enterprise deployment tooling beyond local installers.

## Product Concepts

Packaging must preserve:

- workspace data directory;
- artifact directories;
- browser profile directories;
- runner process availability;
- CloakBrowser binary/version reproducibility.

## Technical Design

### Packaging Tool

Use an Electron packaging toolchain that supports Windows, macOS, and Linux
targets. `electron-builder` is the default candidate unless implementation
planning selects a better tool with equivalent support.

### Runtime Strategy

The packaged app must not depend on an operator-installed global Node runtime.
Runner code and runtime must be packaged with the app or compiled into a
controlled executable form.

### CloakBrowser Strategy

The release spec must choose one supported CloakBrowser distribution mode:

1. bundled binary;
2. internal artifact mirror download during install/first run;
3. operator-provided path with version/checksum validation.

All modes require:

- pinned version;
- checksum validation;
- visible runtime diagnostics;
- evidence of browser version used in runs.

The packaging implementation must respect CloakBrowser binary license and
internal distribution policy.

### Platform Targets

Windows:

- `.exe` installer target;
- process cleanup on crash/stop;
- path length handling;
- antivirus false-positive review process.

macOS:

- `.app` and signed/notarized distribution when required;
- helper binaries included in signing scope;
- quarantine behavior checked;
- Apple Silicon and Intel policy decided during release planning.

Linux:

- AppImage/deb/rpm target decision;
- browser runtime dependencies documented;
- sandbox behavior tested;
- display/headed behavior tested.

### Release Manifest

Each release should produce a manifest:

- app version;
- runner protocol version;
- Electron version;
- Playwright version;
- CloakBrowser version;
- checksums for bundled binaries;
- migration/schema version;
- known platform limitations.

## Interfaces / Contracts

Packaging scripts must expose:

- build per platform;
- package per platform;
- smoke test package;
- verify bundled runtime;
- verify CloakBrowser checksum;
- generate release manifest.

## Data Model

Release manifest can be JSON stored with build artifacts.

App runtime should expose version diagnostics to UI and evidence:

- app version;
- runner version;
- browser engine/version;
- profile path summary;
- protocol version.

## Error Handling

- Missing CloakBrowser binary blocks runner startup with clear remediation.
- Checksum mismatch blocks use.
- Unsupported platform shows startup diagnostic.
- Packaging smoke failure blocks release.
- Runtime dependency failure on Linux reports missing dependency category.

## Security / Safety / Audit

- Verify bundled or downloaded binaries by checksum.
- Do not download unpinned browser binaries in production runs.
- Release manifest must support reproducibility.
- Code signing/notarization must include helper/runner binaries where required.
- Logs must not include secrets during install/startup diagnostics.

## Testing

Tests/checks:

- package builds for each target;
- app boots from packaged artifact;
- runner health check passes from packaged app;
- CloakBrowser launches from packaged app;
- simple workflow smoke test passes;
- artifacts are written to app data;
- uninstall/cleanup behavior is documented or tested;
- version diagnostics match release manifest.

## Acceptance Criteria

- Windows, macOS, and Linux packaging paths are defined.
- Packaged app does not require global Node install.
- CloakBrowser version is pinned and verifiable.
- Packaged runner can launch and execute smoke workflow.
- Release manifest includes app, runner, Playwright, and CloakBrowser versions.

## Dependencies

- Electron App Architecture Spec.
- CloakRunner Spec.
- Data And Storage Spec.
- Testing And Acceptance Spec.

## Open Questions

None blocking for spec baseline. The exact CloakBrowser distribution mode must
be finalized before packaging implementation starts.
