# Capability Tiers

What "any desktop app can be automated" honestly means. Resolves [#41](https://github.com/MinhBienK2/automation-app/issues/41).

## The problem

The goal is broad coverage — any application on the operator's machine. The locator model is built on the accessibility tree. Not every window has one. Those two facts cannot both be satisfied uniformly, so coverage is expressed as tiers rather than a promise.

## The tiers

| Tier | What is addressable | Locator | Reliability |
|---|---|---|---|
| **Element** | Full accessibility tree with roles, labels and ancestry | [Desktop Locator](locator-model.md) | Survives layout, DPI and window moves |
| **Chrome** | Window frame only — minimise, restore, close | Desktop Locator, but only for frame controls | Reliable but nearly useless for real work |
| **Pixel** | Nothing addressable; coordinates only | Coordinates inside the window frame | Breaks on resize, DPI change, theme change, any layout shift |

## Tier is a property of the window, not the toolkit

The intuitive ranking — native Win32 best, Electron worst — is **wrong**. Measured on Windows 11:

| Window | Toolkit | Elements | Tier |
|---|---|---|---|
| File Explorer | shell | 410 | Element |
| Paint | Store-packaged | 92 | Element |
| Notepad | Store-packaged | 35 | Element |
| Character Map | classic Win32 | 15 | Element |
| Antigravity IDE | Electron | 3 | Chrome |
| Claude | Electron | 3 | Chrome |
| Settings | UWP / WinUI | 0 | Pixel |

A WinUI application exposed nothing; Electron applications exposed their frame without any flag. **Never infer a tier from what an app is built with.** Probe the window.

## Detection is the driver's job

`cua-driver` reports degradation itself, so we consume rather than reimplement:

```json
"degraded": true,
"degraded_reason": "ax_tree_empty: the UIA walk returned no actionable elements...",
"escalation": { "reason": "non-AX surface — act by pixel (x,y)...", "recommended": "px" }
```

Mapping:

- `degraded: false` and elements beyond frame controls → **Element**
- `degraded: false` but only frame controls (`Minimize`, `Maximize`, `Restore`, `Close`) → **Chrome**
- `degraded: true`, or `escalation.recommended === "px"` → **Pixel**

`elements_complete: false` appears even on healthy snapshots. Treat it as "the tree may be partial", surface it as a warning on the authored step, and do not use it for tiering.

## Tier is read from the run's own snapshots, never probed separately

Every element-addressed action takes an Element Snapshot, and a snapshot already
says what tier the window is at. So the tier costs nothing to know — provided
nothing takes a snapshot purely to ask.

- **Run time.** Every snapshot re-reads the tier. An Element-addressed action against a window that has dropped to Pixel fails with that specific reason rather than a generic "element not found" — the distinction is the difference between a broken locator and a degraded window.
- **Authoring.** The Desktop Target shows the tier its **last run** observed, labelled as such, and says so plainly when no run has looked yet. A window that never had a snapshot taken has no tier, and an empty column is the honest rendering of that.

**Binding takes no snapshot.** An earlier design probed the window once at bind
so the operator would see the tier before the first action. On the windows
affected by [the collapse defect](#the-uwp-degradation-defect) that probe spent
one of the roughly two reads the window would ever answer — to learn something
the next action re-reads anyway. The tier is not worth a read of its own.

For the same reason the tier is **not** probed when a Desktop Target is created.
An authoring-time probe measures the window that happens to be open then, and
the tier is a property of the individual window, so the answer would be a guess
dressed as a measurement by the time a run used it.

## The Pixel tier is opt-in per step

Pixel addressing is never chosen automatically. It is not a graceful fallback; it is a different, more fragile contract, and silently switching to it converts a loud failure into a workflow that clicks the wrong thing.

An operator enables Pixel addressing on a step deliberately, and the step is marked in the graph so the fragility is visible when reading the workflow later.

## The UWP degradation defect

Some windows lose their accessibility tree after roughly two reads and never recover — not after the driver is recreated, not after the application is restarted. Measured: Calculator dies after two reads; Explorer sustained twelve reads of a 410-element tree unaffected. It is confined to UWP windows hosted by `ApplicationFrameHost`; Win32, Store-packaged and shell windows are unaffected. See [the findings](../../research/cua-driver-windows.md#the-uia-collapse-defect).

Because every element action consumes a snapshot, an affected window supports about two element actions per session — and only if nothing else spends one, which is why binding does not. The product handles the collapse as a tier transition, which the existing detection already covers: the window drops from Element to Pixel mid-run and the action fails with the specific reason. No extra mechanism is needed.

This is an upstream defect worth reporting, not something to design around further.

## What we may claim

> Mission Control drives desktop applications that expose an accessibility tree — most native, shell and packaged Windows applications. Applications that render their own interface, such as games and canvas-based tools, can only be driven by screen position, which is inherently fragile. Mission Control tells you which case you are in before you build the workflow.

Not "any app". The distinction is the product being honest about where it is reliable.
