# Context

The glossary for Mission Control. Terms only — no implementation detail, no specs, no decisions.
Decisions live in `docs/adr/`. Behaviour lives in `docs/domain/` and `docs/architecture/`.

## Surfaces

Mission Control automates two kinds of thing. The word for "the kind of thing being automated" is **surface**.

| Term | Definition |
|---|---|
| **Execution Surface** | The class of thing a workflow drives. Exactly two exist: **Web Surface** and **Desktop Surface**. A workflow belongs to one surface and cannot mix. |
| **Web Surface** | Browser pages driven through CloakBrowser's Playwright-compatible runtime. |
| **Desktop Surface** | Native application windows on the operator's own machine, driven through `cua-driver`. |
| **Surface Driver** | The adapter that turns a surface-specific action into real effects. One per surface; they share no interface, because a browser page and an application window have no honest common shape. |

Avoid "platform" and "engine" for this concept. *Platform* means the operating system; *engine* means the browser build (CloakBrowser, Camoufox).

## Web Surface terms

| Term | Definition |
|---|---|
| **Browser Profile** | Project-owned identity plus persistent storage. Creates `identity_id`, `fingerprint_seed`, `profile_dir`. |
| **Recording Session** | Backend-owned draft that captures browser usage into reviewable steps and then a saved workflow. |

## Desktop Surface terms

| Term | Definition |
|---|---|
| **Desktop Target** | Project-owned description of an application a workflow drives: how to reach it, which window to bind, and how it is launched. The Desktop Surface counterpart to a Browser Profile — but it owns **no** persistent storage, because desktop applications keep their own state where they choose. |
| **Window Binding** | The runtime resolution of a Desktop Target to one concrete `(pid, window_id)` pair. Ephemeral: both values change between runs, so a Desktop Target never stores them. |
| **Element Snapshot** | One read of a window's accessibility tree. Carries a `snapshot_id` and the elements addressable within it. Element addresses are valid only inside the snapshot that produced them. |
| **Desktop Locator** | The durable, authored description of an element — role, label, and ancestry — resolved against a fresh Element Snapshot at run time. The Desktop Surface counterpart to a web locator. |
| **Capability Tier** | How much of a window is machine-addressable: **Element** (accessibility tree usable), **Chrome** (only the window frame), or **Pixel** (nothing addressable; coordinates only). A property of the individual window, not of the application's toolkit. |
| **Escalation** | The driver's runtime recommendation to drop from Element addressing to Pixel addressing for a window. Reported by the driver, never guessed. |

## Shared terms

| Term | Definition |
|---|---|
| **Project** | Groups workflows, subflows, Browser Profiles, and Desktop Targets. |
| **Workflow** | Named automation with a visual graph as authoring source, bound to exactly one Execution Surface. |
| **Subflow** | Reusable non-runnable graph fragment inside one project. |
| **Graph** | Versioned visual model: nodes, edges, ports, viewport, action configs. |
| **Compiled Graph** | Executable plan generated from a Graph. |
| **Action Config** | Executable behaviour produced by graph compilation. |
| **Surface Action** | An Action Config that only one surface can execute — `click` on the Web Surface, `desktop_click` on the Desktop Surface. |
| **Control Action** | An Action Config that executes above every Surface Driver: loops, branches, routers, retries, variables, assertions. Surface-independent by construction. |
| **Run** | One execution of a Compiled Graph. |
| **Outputs** | Named values captured during execution. |
| **Evidence** | Durable artifacts derived from a Run: screenshots, extracted text, traces, downloads. |
| **Schedule** | In-app trigger for a saved workflow; runs only while the app is open. |

## Deliberate non-terms

- **"Desktop Profile"** — rejected. It implies the isolated persistent storage a Browser Profile has, which the Desktop Surface cannot provide. Use **Desktop Target**.
- **"Session"** — overloaded. `cua-driver` uses it for its own scope handle; say **Driver Session** when that is meant, never bare "session".
- **"Element index"** — a driver-internal ordinal inside one snapshot. Never persist it; persist a **Desktop Locator**.
