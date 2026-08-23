# Desktop coverage expansion — techniques toward "every app"

How far the Desktop Surface can honestly widen past today's tiers, and the concrete
techniques that would do it. Follow-on to [the hands-on findings](cua-driver-windows.md)
and the [capability-tier model](../domain/desktop/capability-tiers.md) ([map #38](https://github.com/MinhBienK2/automation-app/issues/38)).

Every claim carries the source that owns it, tagged **[primary]** (official docs,
source code, specs, first-party APIs) or **[secondary]** (issue trackers of other
automation libraries, community write-ups, press). Where only a secondary source
exists, it is labelled and the gap is stated. Nothing here was measured on this
machine — [cua-driver-windows.md](cua-driver-windows.md) is the measured document;
this one is the researched one.

## Verdict

"Every app" is not reachable, and the tier model is the honest framing — keep it.
But the three tiers are not fixed populations. Most of what sits in **Chrome** and
**Pixel** today is there for a *removable* reason, and the techniques below move
windows up:

- **Electron/Chromium content** is at Chrome tier only because Chromium keeps its
  accessibility tree switched off until an assistive-technology client attaches.
  That switch can be thrown from outside the process. This is the largest single
  win, and it happens to cover the operator's own tools (Antigravity, Claude).
- **The Element tier itself is under-exploited.** The driver drives Invoke-style
  click, `set_value` and type; UI Automation exposes a dozen more control patterns
  (scroll, expand/collapse, selection, ranges, tables, rich text). These are pure
  additions that make already-Element windows far more automatable.
- **The Pixel tier can be made semi-deterministic** with classical OCR and template
  matching that resolve a stable anchor at replay with no model in the loop —
  staying inside [ADR-0001](../adr/0001-desktop-execution-surface.md)'s hard
  constraint.

What stays genuinely out of reach: windows that publish **no accessibility tree and
no stable pixels** — games, WebGL/canvas surfaces, and custom-drawn WinUI content
whose author never created automation peers. For these, coordinates remain the only
address and remain fragile. So "complete" here means: **shrink Chrome and Pixel to
the residue that is genuinely non-accessible, and make even that residue as
deterministic as classical vision allows** — not a promise to drive everything.

The honest one-liner the product can still make is the one already in
[capability-tiers.md](../domain/desktop/capability-tiers.md#what-we-may-claim); these
techniques widen the "most" in it, they do not turn it into "all".

---

## Axis 1 — Widening the Element tier for currently-blind windows

### 1a. Chromium/Electron: the tree is off until an AT client attaches

Chromium ships accessibility **off** and builds it lazily, on detecting assistive
technology. The detection mechanism is documented verbatim: *"Chrome calls
NotifyWinEvent with EVENT_SYSTEM_ALERT and the custom object id of 1. If it
subsequently receives a WM_GETOBJECT call for that custom object id, it assumes that
assistive technology is running."* and *"For performance reasons Chromium waits until
it detects the presence of assistive technology before enabling full support for
accessibility APIs."* [primary]
https://www.chromium.org/developers/design-documents/accessibility/

The DOM lives in sandboxed renderer processes; the browser process keeps a **cache**
of the accessibility tree that is only populated *"if assistive technology is
detected or if it's explicitly enabled"*, and renderers *"send atomic updates to the
browser process ... queued up and then sent periodically only after first ensuring
that layout is complete."* [primary]
https://chromium.googlesource.com/chromium/src/+/main/docs/accessibility/browser/how_a11y_works_2.md

**Accessibility modes** are `AXMode` flags in `ui/accessibility/ax_mode.h` [primary]
https://source.chromium.org/chromium/chromium/src/+/main:ui/accessibility/ax_mode.h —
`kNativeAPIs` (platform bridge: MSAA/IA2/UIA on Windows), `kWebContents` (role, name,
value, state, location for all nodes), `kInlineTextBoxes` (line/word boundaries),
`kExtendedProperties` (formerly `kScreenReader`; screen-reader attributes), `kHTML`
(HTML attributes). Bundles: `kAXModeComplete = kNativeAPIs | kWebContents |
kInlineTextBoxes | kExtendedProperties`.

The switch `--force-renderer-accessibility=[basic|form-controls|complete]` *"Force[s]
accessibility to be enabled ... during the entire execution"* [primary]
https://chromium.googlesource.com/chromium/src/+/main/docs/accessibility/overview.md;
Electron's equivalent is `app.setAccessibilitySupportEnabled(true)` [secondary]
https://github.com/electron/electron/pull/48042. **No primary registry/GPO route to
force it was found** — treat that as "not found", not "impossible".

**Can an external tool trigger it without a flag and without app cooperation? Yes,
by design — but it is timing-dependent, reversible and version-fragile.** Any client
that attaches as a UIA/MSAA client (which is exactly what walking the window does)
sends the `WM_GETOBJECT` that makes Chrome conclude AT is present and start building
the tree [primary, chromium.org above]; this is how NVDA lights Chrome up [secondary]
https://github.com/nvaccess/nvda/pull/12025. Three honest caveats:

1. **The "settle" delay is real and unbounded by any documented constant.** The tree
   is built and pushed renderer→browser asynchronously, only after layout completes
   [primary, how_a11y_works_2.md], so a walk immediately after attach sees an
   empty/partial tree. The correct design is **poll until populated**, not "wait
   N ms". This is precisely the driver's own `degraded_reason` note that
   *"Chromium/Electron require a UIA-enable + settle"* ([cua-driver-windows.md](cua-driver-windows.md)).
2. **Auto-disable turns it back off.** Chromium disables accessibility again when it
   infers AT is gone (reported as ~3 input events over ~30 s with no accessibility
   API use) [secondary] https://github.com/microsoft/vscode/issues/162331. A tool
   must keep touching the tree or re-trigger.
3. **Version fragility.** The UIA path specifically regressed in Chrome 117 with
   `--force-renderer-accessibility`, `=complete` as the workaround [primary]
   https://issues.chromium.org/issues/40072866.

**Net:** Electron content is recoverable to Element tier by attaching and polling to
settle; the reliable-but-invasive alternative is launching the app with the flag.

### 1b. WinUI3/UWP: 0 elements is usually the app's peer situation, not a client bug

Built-in XAML/WinUI controls ship automation peers and expose themselves. The gap is
**custom** controls and custom-drawn surfaces: *"The base Control class does not have
a corresponding peer class"* — a control deriving straight from `Control` has **no
peer** unless the author overrides `OnCreateAutomationPeer` [primary]
https://learn.microsoft.com/en-us/windows/apps/design/accessibility/custom-automation-peers.
`AutomationProperties` (Name, AutomationId, HelpText) only *decorate* an existing
peer; they do not create one for content that has none [primary, same page].

**Supported third-party path when peers are absent: essentially none.** UIA only
exposes what providers publish; there is no supported API for a client to synthesise
peers an app never implemented [primary, same page]. So a WinUI/UWP window reading
"0 elements" is the app's design, and the honest fallback is non-UIA (Axis 2), not a
UIA trick. This confirms [capability-tiers.md](../domain/desktop/capability-tiers.md)'s
refusal to promise "any app".

### 1c. The ApplicationFrameHost collapse: three documented causes, no single bug

No canonical Microsoft bug titled "AFH tree collapses after N reads and survives
restart" exists, but the measured behaviour ([the collapse defect](cua-driver-windows.md#the-uia-collapse-defect))
decomposes into three attested causes:

| Cause | What it does | Source |
|---|---|---|
| **Cross-process scoping** | UWP content is a child window in a *different* process under `ApplicationFrameHost.exe`; a shallow `FindAll(TreeScope_Children)` returns nothing where descendants scope works | [primary — Microsoft repo] https://github.com/microsoft/axe-windows/issues/730 |
| **UWP suspension** | A minimised/backgrounded UWP app *"is suspended ... the app's threads are stopped"*, so its provider cannot answer until foregrounded | [primary] https://learn.microsoft.com/en-us/windows/uwp/launch-resume/app-lifecycle |
| **Provider COM/state staleness** | Once activated, UIA provider state *"doesn't fully deactivate ... The overhead persists until the application is restarted"*; stale cached elements with no refresh; COM timeouts worse on Win11 | [secondary] https://gist.github.com/Skydev0h/3a8c08b148a38e8d270c02b563130ff6, https://github.com/FlaUI/FlaUI/issues/662, https://github.com/pywinauto/pywinauto/issues/1453 |

Practical rules that fall out: re-walk fresh (never trust a cached element across
time), foreground the target before reading, and expect only a target-app restart to
clear a wedged provider — restarting the client alone does not, because the damage is
provider-side. This matches the measured "survives app restart" symptom and keeps the
defect where [capability-tiers.md](../domain/desktop/capability-tiers.md#the-uwp-degradation-defect)
already puts it: **upstream, handled as a tier transition, worth reporting**. Note the
driver's 0.21.0 fix *"attribute hosted Windows apps by window (#3227)"* (Axis 6) may
touch cause #1 and is worth testing on a bump.

---

## Axis 2 — Making the Pixel tier deterministic instead of fragile

The ADR constraint is the design driver here: **an LLM/vision model must not be in the
replay loop** ([ADR-0001](../adr/0001-desktop-execution-surface.md), "cua-driver's LLM
agent loop" rejected). The findings split cleanly along that line — classical,
deterministic algorithms (Windows OCR, OpenCV matching) are safe *in* the replay loop;
neural parsers (OmniParser) are authoring-time proposers only.

### 2a. Windows OCR — `Windows.Media.Ocr.OcrEngine`

A WinRT OCR engine, part of the OS since Windows 10 build 10.0.10240 (no separate
install, no fee), running **on-device/offline** off installed language packs [primary]
https://learn.microsoft.com/en-us/uwp/api/windows.media.ocr.ocrengine?view=winrt-26100.
`RecognizeAsync(SoftwareBitmap)` OCRs an arbitrary bitmap (a screenshot converts to
`SoftwareBitmap`) and returns `OcrResult` → `Lines` (`OcrLine`) → `Words` (`OcrWord`)
[primary] https://learn.microsoft.com/en-us/uwp/api/windows.media.ocr.ocrresult?view=winrt-26100.
Crucially `OcrWord.BoundingRect` gives *"the position and size in pixels of the
recognized word from the top left corner of image"* — exactly the text-anchor →
click-point primitive [primary]
https://learn.microsoft.com/en-us/uwp/api/windows.media.ocr.ocrword.boundingrect?view=winrt-22000.

Limits, stated honestly: boxes are **word/line granularity, not character**; results
depend on **installed language packs** (`AvailableRecognizerLanguages` varies per
machine — a cross-machine determinism risk) [primary]
https://learn.microsoft.com/en-us/uwp/api/windows.media.ocr.ocrengine.availablerecognizerlanguages?view=winrt-26100;
`MaxImageDimension` must be queried and large screenshots tiled/downscaled (no
first-party numeric value published) [primary]
https://learn.microsoft.com/en-us/uwp/api/windows.media.ocr.ocrengine.maximagedimension?view=winrt-26100;
Microsoft does not publish an accuracy figure. Callable from Electron via NodeRT
WinRT projection (`@nodert-win11/windows.media.ocr`, rebuilt for Electron's ABI, main
process) or a small C#/C++ stdio helper [secondary]
https://github.com/NodeRT/NodeRT. **Deterministic in the replay loop** (same bitmap +
same language pack → same result), so an OCR text anchor is ADR-safe.

### 2b. Visual grounding / set-of-marks / OmniParser — authoring only

Microsoft **OmniParser** parses a screenshot into structured, labelled interactable
regions (set-of-marks style) using an icon-detection model plus an icon-caption model
[primary] https://arxiv.org/abs/2408.00203, https://github.com/microsoft/OmniParser.
Two things make it authoring-time-only: it is **neural** (not bit-reproducible across
GPU/driver/precision; captions are generative) and **GPU-favouring** (~0.6 s/frame on
an A100, ~0.8 s on a 4090 [secondary] https://www.marktechpost.com/2025/02/18/microsoft-ai-releases-omniparser-v2/).
Its role fits the ADR exactly: run it **once at authoring** to *propose* candidate
anchors, then persist a *classical* artifact (image patch + OCR text anchor +
coordinate) that replay matches with no model call.

**Licensing trap to flag:** the OmniParser repo and caption models are MIT, but the
icon detector is version-dependent — current `icon_detect_v3` is MIT-licensed YOLOv9,
while *"earlier Ultralytics-based icon detectors retain their original AGPL license"*
[primary] https://github.com/microsoft/OmniParser. AGPL-3.0 on a bundled model is a
real problem for closed-source distribution; verify the exact weight downloaded. The
general technique is Set-of-Mark prompting [primary] https://arxiv.org/abs/2310.11441.

### 2c. Template / feature matching for pixel anchors

OpenCV `cv2.matchTemplate` slides a stored patch over the screenshot and
`minMaxLoc` returns the best match location → bounding rect → click centre [primary]
https://docs.opencv.org/4.13.0/d4/dc6/tutorial_py_template_matching.html. **Fully
deterministic** (pure arithmetic, no model), so it is safe in the replay loop — its
risk is *fragility*, not repeatability: template matching is **not scale- or
rotation-invariant**, so it breaks under DPI change, theme/dark-mode change, font
anti-aliasing differences and resize (the OpenCV tutorial itself needs a multi-scale
search) [primary, same page]. **Feature matching (ORB/SIFT)** is scale/rotation robust
but weaker on low-texture flat UI icons; ORB is patent-free, and the **SIFT patent
expired March 2020** and SIFT moved into OpenCV's main module (~4.4.0) [secondary —
patent record + OpenCV Q&A] https://answers.opencv.org/question/238447/expired-us-patent-on-sift/.

**Licensing:** OpenCV is **Apache-2.0 from 4.5.0 onward** (BSD-3 before), both
permissive/commercial-friendly [primary]
https://opencv.org/license/, https://raw.githubusercontent.com/opencv/opencv/4.x/LICENSE.
Node bindings `opencv4nodejs`/`@u4/opencv4nodejs` (MIT, native) give `matchTemplate`;
pure-JS Jimp (MIT) has none and only suits trivial patches [secondary].

**Pragmatic deterministic design:** a *layered* anchor — OCR text anchor, then
template patch, then coordinate fallback, each with a confidence threshold — because
no single method survives every DPI/theme/scale change.

---

## Axis 3 — Richer input via UIA control patterns

UIA models a control's capabilities as composable **control patterns**; a client asks
an element which it supports and drives it through pattern methods, and patterns are
dynamic (a control exposes one only while the capability is live) [primary]
https://learn.microsoft.com/en-us/dotnet/framework/ui-automation/ui-automation-control-patterns-overview.
Today the surface reaches only Invoke (click), Value (`set_value`) and typed input.
The rest is pure Element-tier capability the surface does not yet touch:

| Pattern (provider) | Unlocks | Key methods | Exposed when |
|---|---|---|---|
| **Scroll** (`IScrollProvider`) | Scroll a container to reveal off-screen items before resolving them | `Scroll(amount,amount)`, `SetScrollPercent(h,v)`; `VerticalScrollPercent` etc. | container content exceeds viewport |
| **ExpandCollapse** (`IExpandCollapseProvider`) | Open tree nodes, combo dropdowns, menus, ribbons, date pickers | `Expand()`, `Collapse()`; `ExpandCollapseState` | control shows/hides content |
| **Selection / SelectionItem** | Select a specific list item, tab, radio, tree node; read current selection | container `GetSelection()`; item `Select()`, `AddToSelection()`, `IsSelected` | container manages selectable children |
| **RangeValue** (`IRangeValueProvider`) | Set a slider/spinner/scrollbar to an exact value | `SetValue(double)`; `Value`,`Minimum`,`Maximum`,`SmallChange` | value bounded by min/max |
| **Grid / Table** | Read a table cell-by-cell by `(row,col)` and map cells to headers — structured extraction, not scraping | `GetItem(row,col)`, `RowCount`; Table adds `GetRowHeaders()`, `GetColumnHeaders()` | children form a 2-D grid (+ headers = Table) |
| **Text / TextRange** (`ITextProvider`) | Read a document's full/structured text, find a substring, get its **on-screen rectangle** | `DocumentRange`, `RangeFromPoint`; range `GetText()`, `FindText()`, `GetBoundingRectangles()` | edit/document control with text content |
| **Transform** (`ITransformProvider`) | Move/resize/rotate an element — a *semantic* reposition, no cursor motion | `Move(x,y)`, `Resize(w,h)`, `Rotate(deg)`; `CanMove` | element is movable/resizable (rare on stock controls) |

Sources [primary, learn.microsoft.com]: IScrollProvider, IExpandCollapseProvider,
ISelectionProvider/ISelectionItemProvider, IRangeValueProvider,
IGridProvider/ITableProvider, ITextProvider/ITextRangeProvider — full URLs in Sources.

Two correctness notes worth their own line:

- **Invoke vs Toggle.** `Invoke()` is a single stateless action (a button); a
  checkbox is `TogglePattern` — `Toggle()` cycles a *persistent* state you can read
  via `ToggleState` (On/Off/Indeterminate) [primary, overview page]. Using the
  current `desktop_click` (Invoke) on a checkbox fires the default action without a
  known end-state; a proper toggle action is more deterministic.
- **Transform is not drag-and-drop.** It repositions a control directly; UIA has no
  pattern that *performs* a drag between two controls (DragPattern/DropTargetPattern
  only *describe* drag state) [primary]
  https://learn.microsoft.com/en-us/dotnet/api/system.windows.automation.provider.itransformprovider.
  This is the honest reason [action-family.md](../domain/desktop/action-family.md)
  defers drag: there is no cursor-free semantic path for the general case.

**Hard dependency to verify first:** these patterns are reachable only if
**cua-driver exposes them**, because the driver confines UIA behind its Rust layer
([ADR-0001](../adr/0001-desktop-execution-surface.md) forbids us reimplementing it).
Axis 6 confirms the driver's action toolset includes `scroll` (so ScrollPattern is
in reach today), but expand/collapse, selection, range, table and text-range
extraction are **not confirmed present** in the driver's tool list and would need
either an upstream tool or a driver that surfaces the pattern. Do not assume; probe
`listToolsJson()` on the pinned build before promising any of these.

---

## Axis 4 — A desktop recorder

**Finding: do not build the recorder on cua-driver's `replay_trajectory`. Its own
recording is not durable.** From the driver's own skill doc and Rust source [primary]
(`libs/cua-driver/rust/Skills/cua-driver/RECORDING.md`,
`crates/cua-driver-core/src/recording_tools.rs`, GitHub `main`):

- `start_recording` captures every *action* tool call verbatim as a
  `(before_state, action, after_state)` triple per `turn-NNNNN/` folder — accessibility
  state, before/after screenshots, and `action.json` holding the tool name and its
  **exact recorded arguments**. Read-only tools are not recorded.
- `replay_trajectory` *"walks turn folders ... reads each action.json, and re-invokes
  the recorded tool with its recorded arguments"* — deterministic playback of the
  recorded calls, **not** the LLM agent re-running (good, ADR-compatible in spirit).
- **But element addressing does not survive.** The driver's element handle is
  `element_index`, an ephemeral integer into a per-snapshot cache keyed on
  `(pid, window_id)`. RECORDING.md states plainly: *"element_index doesn't survive
  across sessions ... a recorded click({..., element_index: 14}) from yesterday won't
  resolve today ... Pixel clicks and keyboard tools replay cleanly; element-indexed
  actions require a live snapshot that replay doesn't currently re-emit."* cua's own
  guidance: treat recordings as *"a regression and evidence artifact rather than a
  guaranteed durable automation script"*.

So the driver's recorder gives you either brittle pixel+keyboard playback (breaks on
resize/DPI, worse than our locator model) or element steps that fail on *any* new
session. This is the same ephemerality [locator-model.md](../domain/desktop/locator-model.md)
already solved for us — the driver has an `element_index`, we have a durable
`DesktopLocator`.

**The durable recorder is our own, and we already have half of it.** The picker's
`suggestDesktopLocator` (in `surfaces/desktop/picker.ts`) turns a live element into a
durable locator; a recorder is that same algorithm run over a stream of user actions
instead of one picked element. What is genuinely missing is the *input-event source*:
cua-driver records only *tool-driven* actions, not a human operating the app, so a
human-driven recorder needs an OS input hook plus a hit-test from the click point to
the element in a fresh snapshot — then hand that element to `suggestDesktopLocator`.
That is substantial and unmeasured (input hooks, hit-testing, and the UWP collapse
budget all interact), so this is a larger idea than "wire up replay_trajectory", and
the honest framing is that the driver's recorder is a false shortcut.

Also note [primary]: the recorder tools are **not on the typed npm SDK** (`CuaDriver`
has no `startRecording`/`replayTrajectory`) — reachable only via
`callTool`/`listToolsJson` or the standalone `cua-driver` executable's `serve`/`mcp`
subcommands, and recording needs a running daemon. That further argues against leaning
on it from the Embedded in-process host the app uses.

---

## Axis 5 — Cross-platform coverage

All three OS accessibility backends let a background tool read a semantic tree and
**invoke element actions without synthesising mouse/keyboard** — provided the app
exposes accessibility:

- **macOS Accessibility (AX).** `AXUIElementRef` handles into other apps;
  `AXUIElementCopyAttributeValue` reads `AXRole`/`AXTitle`/`AXValue`/`AXChildren` to
  walk the tree; `AXUIElementPerformAction(el, kAXPressAction)` invokes semantically,
  no cursor motion [primary]
  https://developer.apple.com/documentation/applicationservices/axuielement,
  https://developer.apple.com/documentation/applicationservices/1462091-axuielementperformaction.
  Gated by the user-granted **Accessibility permission** (System Settings → Privacy &
  Security → Accessibility); `AXIsProcessTrustedWithOptions` checks/prompts [primary]
  https://developer.apple.com/documentation/applicationservices/1459186-axisprocesstrustedwithoptions.
  Sandboxed App Store apps generally cannot act as AX clients [secondary]
  https://github.com/drewster99/macos-accessibility-client.
- **Linux AT-SPI2.** A **D-Bus-based** protocol; apps publish their widget tree, and
  `libatspi` exposes `AtspiAccessible` (tree), `AtspiComponent` (bounds), `AtspiText`,
  `AtspiValue`, `AtspiSelection`, `AtspiTable`, and `AtspiAction` (invoke) [primary]
  https://gnome.pages.gitlab.gnome.org/at-spi2-core/libatspi/index.html. Depends on
  the toolkit's AT-SPI bridge (GTK via ATK, Qt via its bridge); **Chromium/Electron
  apps don't build the AT-SPI tree by default** [secondary]
  https://cua.ai/blog/inside-linux-computer-use — the same off-by-default problem as
  Axis 1a. Works over X11/XWayland; **weakest under native Wayland**, where apps
  bypassing XWayland can be invisible; the project's next-gen direction extends
  Wayland itself (AccessKit-based) but is future work [primary]
  https://gnome.pages.gitlab.gnome.org/at-spi2-core/devel-docs/new-protocol.html.

**cua-driver already supports all three** (Axis 6): its native packages ship for
`darwin`/`linux`/`win32`, and `start_recording` captures *"AX/UIA/AT-SPI state"*, with
CHANGELOG work on Linux AT-SPI scoping and macOS background input. So cross-platform is
a matter of extending **our** typed layer and measuring per-OS, not adding a driver —
but the per-OS quirks (mac permission grant, Linux Wayland gaps, Electron off-by-
default on both) are real and each needs its own measured document like
[cua-driver-windows.md](cua-driver-windows.md).

---

## Axis 6 — cua-driver current state & roadmap

Measured with the `npm` CLI and GitHub on 2026-08-23 [primary]:

- **Latest npm is 0.21.0** (published 2026-08-19); the app is pinned at **0.19.3**
  (2026-08-10). Two minor releases behind: 0.20.0 (2026-08-15), 0.21.0. Nightly
  `0.21.1` exists on GitHub. Cadence remains ~18 releases in ~4 weeks — the maturity
  risk [ADR-0001](../adr/0001-desktop-execution-surface.md) flagged is unchanged.
- **License** `@trycua/cua-driver` = MIT; native platform packages `MIT AND MPL-2.0`.
  **SLSA provenance present** (Sigstore-signed, Rekor entry) on 0.21.0.
- **Changes since 0.19.3 relevant here** (from `CHANGELOG.md`, GitHub raw) [primary]:
  - 0.20.0: ⚠ BREAKING removed browser approval tokens (#3185); **implicit lifecycle
    sessions** (#3013 — likely eases the `startSession` friction in
    [cua-driver-windows.md](cua-driver-windows.md)); capability manifests (#3015);
    persistent/immutable Driver release channels (binary distribution); **verify
    foreground focus before input** (#3068).
  - 0.21.0: **"Project Centennial" preview** (#3188/#3189, cross-platform push — no
    primary public description found, honest gap); **attribute hosted Windows apps by
    window** (#3227 — may touch the AFH scoping cause 1c); dropped the stale "0.17"
    string from `element_index` messages.
  - **The host-killing panic on a missing required field has no confirmed fix** in the
    notes since 0.19.3. Schema-hardening exists (object-rooted MCP output schemas,
    advertised refusals) that *may* reduce field-shape panics, but this is unverified —
    to confirm, reproduce a malformed required-field call against the 0.21.0 `.node`.
    The utility-process decision stands regardless (it is insurance).
- **Execution modes unchanged** (`Embedded`/`Daemon`/`PrivateWorker`/`Remote`). The
  npm package **still ships no standalone `.exe`** (unpacked 0.21.0 win32 = `.dll` +
  `.node` only), so `PrivateWorker`/`Daemon` remain unreachable from npm — **but the
  standalone binary is now distributed via GitHub releases + `install.ps1`/`install.sh`**
  (`curl -fsSL https://cua.ai/driver/install.sh | bash` [secondary]
  https://cua.ai/docs/reference/cua-driver/cli-reference). So out-of-process isolation
  is now *obtainable*, just decoupled from the npm dependency — relevant if the panic
  ever justifies real process isolation beyond our own utility process.
- **Accessibility reading is genuinely cross-platform** (AX/UIA/AT-SPI), not
  Windows-only (see Axis 5).

**Recommendation:** a controlled bump to 0.21.0 is worth it for #3013 (sessions),
#3068 (focus-before-input), and #3227 (hosted-window attribution, test against the AFH
collapse) — but it carries a breaking change (#3185) and the usual fast-cadence risk,
so bump behind the typed layer and re-run the measured slice.

---

## Feature ideas (prioritized)

Each idea: what it unlocks, which tier/windows it helps, effort/risk, how it maps to
the existing [action-family](../domain/desktop/action-family.md) /
[capability-tier](../domain/desktop/capability-tiers.md) /
[locator](../domain/desktop/locator-model.md) model, and any
[ADR-0001](../adr/0001-desktop-execution-surface.md) conflict.

### 1. Adopt the UIA control patterns the driver exposes

- **Unlocks:** scroll, expand/collapse, selection, range values, table extraction,
  rich-text read, and a proper checkbox toggle. Turns already-Element windows from
  "click/type only" into genuinely automatable.
- **Helps:** every **Element**-tier window (the largest tier). No help for Chrome/Pixel.
- **Effort/risk:** *Low–Medium, but gated.* Additive typed wrappers in
  `driverClient.ts` over `callTool`, new `desktop_scroll` / `desktop_select` /
  `desktop_expand` / `desktop_set_range` / `desktop_read_table` / `desktop_toggle`
  actions with Zod schemas in `actions/schemas/desktop/` and executors in
  `surfaces/desktop/executors/index.ts` — the same registry pattern
  [action-family.md](../domain/desktop/action-family.md) already enforces. **Risk is
  entirely upstream capability**: only `scroll` is confirmed in the driver's toolset
  (Axis 6); the rest must be verified via `listToolsJson()` before promising. Where a
  pattern is absent, the idea is blocked on the driver, not on us — do not reimplement
  UIA (ADR-0001 forbids it).
- **ADR conflict:** none. No LLM, no BrowserDriver, one surface.
- **Model fit:** each new action reuses the `snapshot → resolve locator → act →
  verify` cycle unchanged; `desktop_read_table` extends `desktop_read_text`'s
  "reading is the assertion" contract. `desktop_scroll` also enables a *scroll-then-
  resolve* helper for off-screen elements, closing a real resolution gap.

### 2. On-demand Element enablement for Electron/Chromium (settle loop)

- **Unlocks:** Electron/Chromium **content** — moves those windows from **Chrome →
  Element**. Directly covers the operator's own tools (Antigravity IDE, Claude), today
  stuck at 3 chrome-only elements.
- **Helps:** every Electron/Chromium window (a large and growing app class).
- **Effort/risk:** *Medium.* The driver already knows the tree needs *"a UIA-enable +
  settle"* (its `degraded_reason`); the feature is a bounded **poll-until-populated**
  settle helper around the first snapshot of an Electron window — attach (the walk
  itself sends `WM_GETOBJECT`), then re-snapshot until a content element appears or a
  cap is hit, before declaring Chrome tier. Risks are the documented ones: settle
  delay has no fixed constant (poll, don't sleep), auto-disable can revert it (keep
  interacting), Chrome-version fragility. Unlike UWP, Electron is **not** AFH-hosted,
  so polling does not burn a collapse budget.
- **ADR conflict:** none — this is timing, not a model. Stays within the surface.
- **Model fit:** lands in the snapshot/tier path (`snapshot.ts` `tierOf` +
  `driverClient.getWindowState`); tier detection in
  [capability-tiers.md](../domain/desktop/capability-tiers.md) gains a "settling"
  transient before Chrome/Element is decided. No new action.

### 3. Deterministic Pixel anchoring (OCR text-anchor + template patch)

- **Unlocks:** makes the **Pixel** tier semi-deterministic — a step anchors to a
  stored OCR word or image patch resolved *at replay with no model*, instead of a bare
  coordinate. Helps blind windows: WinUI/Settings, custom-drawn surfaces, some canvas.
- **Helps:** Pixel-tier windows that contain **readable text or stable glyphs**. No
  help for pure dynamic canvas/games with neither.
- **Effort/risk:** *Medium–High.* New dependency: Windows OCR via NodeRT/stdio helper
  and/or OpenCV (`opencv4nodejs`) — both permissively licensed (OS-bundled OCR;
  Apache-2.0 OpenCV). Layer the anchor (OCR text → template patch → coordinate
  fallback, each thresholded) because none survives every DPI/theme/scale change.
  OmniParser may *propose* anchors **at authoring only** (GPU, and watch the AGPL
  detector-weight trap) — never in replay.
- **ADR conflict:** *This is the idea most exposed to ADR-0001, and it stays compliant
  only if the discipline holds:* classical OCR/template matching in the replay loop is
  fine (deterministic); a vision **model** in replay is forbidden. Keep OmniParser
  strictly authoring-side.
- **Model fit:** a new `DesktopStepTarget` variant in
  [locator-model.md](../domain/desktop/locator-model.md) —
  `{ kind: "anchor"; text?; patch?; x; y }` — sitting between `element` and `pixel`.
  It inherits [capability-tiers.md](../domain/desktop/capability-tiers.md)'s
  **opt-in, marked-in-the-graph** rule for Pixel, since it is still a fragility
  contract, just a less fragile one.

### 4. A durable, element-addressed recorder built on the picker (not replay_trajectory)

- **Unlocks:** authoring by demonstration that produces **durable Desktop Locators**,
  not brittle coordinate playback.
- **Helps:** authoring speed for **Element**-tier windows; no new runtime coverage.
- **Effort/risk:** *High.* The driver's own recorder is a false shortcut (Axis 4):
  its steps are either pixel (brittle) or `element_index` (dies on any new session).
  The durable path reuses `suggestDesktopLocator` (`picker.ts`) over a stream of user
  actions — but needs a new **input-event source + click-point→element hit-test** that
  the driver does not provide, and that interacts with the UWP collapse budget. Measure
  before committing.
- **ADR conflict:** none, if it emits authored `DesktopLocator`s (no model, no
  replay_trajectory dependency). Avoid depending on the driver's daemon-only recorder
  from the Embedded host.
- **Model fit:** it *is* [locator-model.md](../domain/desktop/locator-model.md)'s
  picker run in "record" direction — "resolution and the picker are the same algorithm
  in opposite directions" already anticipates this.

### 5. Cross-platform typed layer (macOS AX, Linux AT-SPI)

- **Unlocks:** the aspired Linux + macOS coverage. The driver already reads AX/AT-SPI
  (Axis 5/6); the work is our typed layer + a measured doc per OS.
- **Helps:** whole new platforms at Element tier — subject to the same tiering.
- **Effort/risk:** *Medium per OS, sequenced.* Real quirks: macOS needs a user-granted
  Accessibility permission (and sandbox limits); Linux AT-SPI is weak under native
  Wayland and Electron is off-by-default there too (Axis 2a's problem recurs).
- **ADR conflict:** none — same driver, same surface. The locator model is UIA-shaped
  today; AX/AT-SPI roles differ, so expect a per-backend role vocabulary, not shared
  locator code (ADR-0001's "no false-shared abstraction" rule applies again).
- **Model fit:** extends the tier model unchanged (tier is a property of the window on
  every OS); the driver client gains backend-aware role mapping.

### 6. Controlled driver bump to 0.21.0 + UWP-collapse mitigations

- **Unlocks:** implicit sessions (#3013), focus-before-input (#3068), and hosted-window
  attribution (#3227) to **test against the AFH collapse** (cause 1c). Plus the
  operational mitigations that need no upstream change: foreground-before-read, always
  re-walk fresh, restart the target app to clear a wedged provider.
- **Helps:** reliability across the board; possibly narrows the **UWP** collapse.
- **Effort/risk:** *Low–Medium.* One breaking change (#3185, browser approval tokens —
  irrelevant to us) and the standing fast-cadence risk; bump behind the typed layer and
  re-run the measured slice. Confirm (or refute) the missing-field panic fix by
  reproducing against the 0.21.0 `.node`.
- **ADR conflict:** none — the pinned-version-behind-a-typed-layer strategy is exactly
  [ADR-0001](../adr/0001-desktop-execution-surface.md)'s stated risk control.
- **Model fit:** foundational; underpins ideas 1–5.

### Ranking rationale

1 and 2 are the highest value-to-risk: 1 is additive and deepens the tier the product
is already strongest in; 2 rescues an entire app class (including the operator's own
tools) with timing code and no new dependency. 3 is the honest way to make Pixel
useful and the one to watch hardest against the ADR. 4 is high-value for authoring but
the biggest build, and its main finding is a *negative* one (don't trust the driver's
recorder). 5 is real but sequenced behind a Windows-solid surface. 6 is cheap
plumbing that everything else leans on.

---

## Sources

### Primary

Chromium / accessibility:
- https://www.chromium.org/developers/design-documents/accessibility/
- https://chromium.googlesource.com/chromium/src/+/main/docs/accessibility/overview.md
- https://chromium.googlesource.com/chromium/src/+/main/docs/accessibility/browser/how_a11y_works_2.md
- https://source.chromium.org/chromium/chromium/src/+/main:ui/accessibility/ax_mode.h
- https://issues.chromium.org/issues/40072866 (Chrome 117 UIA + force-renderer-accessibility regression)

Microsoft — WinUI/UWP & UI Automation:
- https://learn.microsoft.com/en-us/windows/apps/design/accessibility/custom-automation-peers
- https://learn.microsoft.com/en-us/windows/uwp/launch-resume/app-lifecycle
- https://github.com/microsoft/axe-windows/issues/730 (AFH/UWP FindAll(children) returns nothing)
- https://learn.microsoft.com/en-us/dotnet/framework/ui-automation/ui-automation-control-patterns-overview
- https://learn.microsoft.com/en-us/dotnet/api/system.windows.automation.provider.iscrollprovider
- https://learn.microsoft.com/en-us/dotnet/api/system.windows.automation.provider.iexpandcollapseprovider
- https://learn.microsoft.com/en-us/dotnet/api/system.windows.automation.provider.iselectionprovider
- https://learn.microsoft.com/en-us/dotnet/api/system.windows.automation.provider.iselectionitemprovider
- https://learn.microsoft.com/en-us/dotnet/api/system.windows.automation.provider.irangevalueprovider
- https://learn.microsoft.com/en-us/dotnet/api/system.windows.automation.provider.igridprovider
- https://learn.microsoft.com/en-us/dotnet/api/system.windows.automation.provider.itableprovider
- https://learn.microsoft.com/en-us/dotnet/api/system.windows.automation.provider.itextprovider
- https://learn.microsoft.com/en-us/dotnet/api/system.windows.automation.provider.itextrangeprovider
- https://learn.microsoft.com/en-us/dotnet/api/system.windows.automation.provider.itransformprovider

Windows OCR:
- https://learn.microsoft.com/en-us/uwp/api/windows.media.ocr.ocrengine?view=winrt-26100
- https://learn.microsoft.com/en-us/uwp/api/windows.media.ocr.ocrresult?view=winrt-26100
- https://learn.microsoft.com/en-us/uwp/api/windows.media.ocr.ocrword.boundingrect?view=winrt-22000
- https://learn.microsoft.com/en-us/uwp/api/windows.media.ocr.ocrengine.availablerecognizerlanguages?view=winrt-26100
- https://learn.microsoft.com/en-us/uwp/api/windows.media.ocr.ocrengine.maximagedimension?view=winrt-26100
- https://learn.microsoft.com/en-us/windows/ai/apis/text-recognition

Vision / matching:
- https://arxiv.org/abs/2408.00203 (OmniParser paper) + https://github.com/microsoft/OmniParser
- https://huggingface.co/microsoft/OmniParser-v2.0
- https://arxiv.org/abs/2310.11441 (Set-of-Mark) + https://github.com/microsoft/SoM
- https://docs.opencv.org/4.13.0/d4/dc6/tutorial_py_template_matching.html
- https://opencv.org/license/ + https://raw.githubusercontent.com/opencv/opencv/4.x/LICENSE

macOS AX / Linux AT-SPI:
- https://developer.apple.com/documentation/applicationservices/axuielement
- https://developer.apple.com/documentation/applicationservices/1462091-axuielementperformaction
- https://developer.apple.com/documentation/applicationservices/1459186-axisprocesstrustedwithoptions
- https://gnome.pages.gitlab.gnome.org/at-spi2-core/libatspi/index.html
- https://gnome.pages.gitlab.gnome.org/at-spi2-core/devel-docs/new-protocol.html
- https://github.com/GNOME/at-spi2-core/blob/main/bus/README.md

cua-driver (npm CLI + GitHub `main`):
- `npm view @trycua/cua-driver version|versions|time|license --json` → 0.21.0 (2026-08-19), MIT
- https://registry.npmjs.org/-/npm/v1/attestations/@trycua%2fcua-driver@0.21.0 (SLSA provenance)
- `libs/cua-driver/rust/Skills/cua-driver/RECORDING.md` (recorder/replay semantics; element_index not durable)
- `libs/cua-driver/rust/crates/cua-driver-core/src/recording_tools.rs`
- `libs/cua-driver/rust/CHANGELOG.md` (0.20.0, 0.21.0 entries)
- https://github.com/trycua/cua + release `cua-driver-rs-v0.21.0` (standalone binaries + install scripts)

### Secondary

- https://github.com/microsoft/vscode/issues/162331 (Chromium auto-disable a11y threshold)
- https://github.com/electron/electron/pull/48042 (Electron AXMode plumbing)
- https://github.com/nvaccess/nvda/pull/12025 (UIA client-attach lights up Chromium)
- https://gist.github.com/Skydev0h/3a8c08b148a38e8d270c02b563130ff6 (UIA provider state cleared only by restart)
- https://github.com/FlaUI/FlaUI/issues/662 (stale/empty UIA elements, no refresh)
- https://github.com/pywinauto/pywinauto/issues/1453 (UIA COMError, ~20s timeouts, worse on Win11)
- https://www.marktechpost.com/2025/02/18/microsoft-ai-releases-omniparser-v2/ (OmniParser v2 latency)
- https://github.com/NodeRT/NodeRT (WinRT projection into Node/Electron)
- https://answers.opencv.org/question/238447/expired-us-patent-on-sift/ (SIFT patent expiry)
- https://cua.ai/blog/inside-linux-computer-use (AT-SPI + Wayland practicalities; Electron off-by-default on Linux)
- https://cua.ai/docs/reference/cua-driver/cli-reference (standalone driver install)
- https://deepwiki.com/trycua/cua/6.1-cua-driver-architecture-and-mcp-tools (element_index vs pixel path)
- https://community.kde.org/Accessibility/qt-atspi (Qt AT-SPI bridge)
- https://github.com/drewster99/macos-accessibility-client (macOS AX permission/sandbox notes)

### Honesty notes / gaps

- Chromium's "settle" delay has **no documented constant** — poll until populated.
- **No primary registry/GPO** method to force Chromium accessibility was found.
- No single official Microsoft bug for the **AFH "collapse after N reads"**; it is a
  composite of cross-process scoping (primary), UWP suspension (primary), and
  provider COM/state staleness (secondary).
- Microsoft publishes **no numeric `MaxImageDimension` and no accuracy figure** for
  Windows OCR; OmniParser latency is from press/labs, not a spec sheet.
- OpenCV SIFT's exact move-to-main version is **community-sourced**.
- The cua-driver **missing-field host panic** has **no confirmed fix** in notes since
  0.19.3; verify by reproducing against 0.21.0.
- **"Project Centennial"** (0.21.0 headline) has no primary public description.
- Which UIA **control patterns cua-driver actually exposes** beyond `scroll` is
  **unverified** — probe `listToolsJson()` on the pinned build before promising them.
