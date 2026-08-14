# Platform Support

What each operating system costs, and what is known versus assumed. Resolves [#40](https://github.com/MinhBienK2/automation-app/issues/40).

The design covers all three platforms; only Windows is verified. This document is explicit about which is which, because a plausible-looking assumption is more dangerous than a stated gap.

## Status

| Platform | Prebuilt binary | Verified | Confidence |
|---|---|---|---|
| Windows x64 | `@trycua/cua-driver-win32-x64-msvc` | ✅ hands-on | High — see [findings](../../research/cua-driver-windows.md) |
| Windows arm64 | `@trycua/cua-driver-win32-arm64-msvc` | ❌ | Medium — same code path, different arch |
| macOS arm64 / x64 | `@trycua/cua-driver-darwin-{arm64,x64}` | ❌ | Medium — the API has first-class macOS support |
| Linux x64 / arm64 | `@trycua/cua-driver-linux-{x64,arm64}-gnu` | ❌ | **Low — see below** |

All six platforms ship prebuilt binaries as optional dependencies, and npm installs only the host's. A packaged build therefore carries one platform's driver, which suits per-platform release artifacts.

## The API tells us where the effort went

Counting platform-specific surface in the generated type definitions:

- **21** `MacOs*` identifiers, including a dedicated `MacOsPermissionStatus` type and a whole `@trycua/cua-driver/electron` entry point
- **1** mention of `Linux` — the `Platform` enum member, nothing more

```ts
export declare enum Platform { Macos = 0, Windows = 1, Linux = 2 }
```

macOS has a permission model represented in the API. Linux has a name in an enum. That asymmetry is the most reliable signal available about relative maturity, and it is why Linux confidence is rated low despite a shipped binary.

## macOS

The obstacle is TCC, and the driver has already solved it in a way that suits us.

**What TCC demands.** The driver needs Accessibility and Screen Recording grants. Those grants attach to a **signed application bundle identity**, not to a binary path — upstream is explicit that *"TCC grants are persistent only if the binary is part of a signed app bundle."* Their standalone answer is a signed, notarized `CuaDriver.app` with bundle id `com.trycua.driver` in `/Applications/`.

**Why we do not need their app.** The package ships an Electron-specific entry point:

```ts
import {
  requestMacOSPermissions,
  hasRequiredMacOSPermissions,
  openMacOSScreenRecordingSettings,
} from "@trycua/cua-driver/electron";
// "Call after Electron's app.whenReady(), from the Electron main process."
```

Mission Control is already a signed macOS bundle — `npm run electron:pack:mac` exists — so **our** bundle identity can hold the grants. The grants belong to Mission Control, which is also the honest arrangement: the operator is granting accessibility access to the app they installed, not to an opaque helper.

**What this costs us.**

- The driver binary must live inside our bundle and be covered by our signature. It is a `.dylib` plus a `.node`, so it needs the same treatment as any other native module: signed, and permitted by our hardened-runtime entitlements.
- Notarization must pass with those binaries embedded. This is the step most likely to surprise, and it should be exercised early rather than at release time.
- First-run needs a permission flow: check with `hasRequiredMacOSPermissions`, prompt with `requestMacOSPermissions`, and deep-link to System Settings with `openMacOSScreenRecordingSettings` when the operator declines.
- The [utility process decision](../../adr/0001-desktop-execution-surface.md#why-a-separate-process) interacts with TCC: the grants follow the bundle, and a utility process of a signed bundle inherits its identity. This is expected to hold and is **unverified**.

## Linux

Design for it, do not claim it.

**Wayland is the real question.** Wayland isolates clients from each other by design: one client cannot synthesise input into another, which is the entire mechanism desktop automation depends on. X11 permits it freely. Ubuntu 22.04 and later default to Wayland.

Upstream documentation does not state whether Linux support requires X11, or whether it goes through a portal or `libei`. Combined with the single `Linux` enum member as the only Linux-specific API surface, the honest position is: **unknown**.

**AT-SPI is a second unknown.** The Linux accessibility bus is often opt-in per toolkit (`GTK_MODULES`, `QT_ACCESSIBILITY`, Java Access Bridge). Windows measurements already showed that [tier is a property of the window, not the toolkit](capability-tiers.md#tier-is-a-property-of-the-window-not-the-toolkit); Linux is likely to be worse in this respect, not better.

**What we do about it.** Nothing that costs anything now. The [Desktop Target](desktop-target.md) already carries `AccessibilityHints` for per-application toolkit flags, and the [capability tier](capability-tiers.md) model already handles a window that exposes nothing. Both were designed for Windows realities and happen to be exactly what Linux needs. No Linux-specific abstraction is warranted before a single measurement exists.

A dual-boot Ubuntu machine is available. The first Linux task is one measurement: does an element click work at all under the operator's session, and is it X11 or Wayland. Until then, Linux is designed-for and unproven, and the product must not claim it.

## Why the design does not fragment

Nothing in the specs is Windows-specific by accident:

- [Locators](locator-model.md) use role, name and ancestry — concepts UIA, AX and AT-SPI all express, with different vocabulary for the same ideas.
- [Capability tiers](capability-tiers.md) consume the driver's own `degraded` and `escalation` signals rather than probing platform APIs directly.
- [Desktop Target](desktop-target.md) launches by app id or executable path, both of which every platform has.
- The [utility process](../../adr/0001-desktop-execution-surface.md#why-a-separate-process) exists because of a Rust panic, which is not platform-specific.

The one place platforms genuinely diverge is **permission acquisition**: Windows needed none, macOS needs a TCC flow, Linux needs an unknown amount of session setup. That belongs behind a single per-platform readiness check reported into the existing environment-readiness surface on the Overview screen, alongside the CloakBrowser diagnostics already there. It does not warrant a platform abstraction layer.

## Untested on every platform including Windows

- Elevated windows. Windows uses `cua-driver-uia` with UIAccess privileges to reach them, which typically requires a signed binary in a trusted location. Not exercised.
- Multi-monitor and mixed DPI. `get_screen_size` reported one display at scale factor 1; nothing else was measured.
- Windows on arm64.
