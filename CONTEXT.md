# CONTEXT

Domain glossary for Mission Control — an Electron desktop app for building and
running automation workflows against company-owned systems. Terms here
are the project's vocabulary; use them exactly in code, tests, issues, and docs.

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
| **Identity** | High-entropy browser identity bound to a profile; fingerprint seed derived from it. |

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
| **Project** | Groups workflows, subflows, Browser Profiles, and Desktop Targets. Default project: `Main`. |
| **Workflow** | Named automation with a visual graph as authoring source, bound to exactly one Execution Surface. |
| **Subflow** | Reusable non-runnable graph fragment inside one project; invoked via `call_subflow`. |
| **Graph** | Versioned visual model: nodes, edges, ports, viewport, action configs. |
| **Compiled Graph** | Executable plan generated from a Graph: ordered action-config steps + domain policy. |
| **Action Config** | One executable behavior unit produced by compilation (`type` + `config`). |
| **Surface Action** | An Action Config that only one surface can execute — `click` on the Web Surface, `desktop_click` on the Desktop Surface. |
| **Control Action** | An Action Config that executes above every Surface Driver: loops, branches, routers, retries, variables, assertions. Surface-independent by construction. |
| **Run** | One execution of a Compiled Graph. |
| **Outputs** | Named values captured during execution (text, file paths, variables). |
| **Evidence** | Durable artifacts derived from a Run (screenshots, extracted text, traces, downloads) plus redaction/truncation. Lives in `electron/backend/evidence/`. |
| **Schedule** | In-app trigger for a saved workflow; runs only while the app is open. |

## Backend module vocabulary

| Term | Meaning |
|---|---|
| **Action Registry** | `actions/registry.ts` — metadata per action type (owner category, audit risk). Compile-time coverage is asserted against the type union. |
| **Validation tiers** | Tier 1 `parseActionConfigShape` (zod shape check, authoring feedback) vs tier 2 `validateActionConfig` (run authority). Asymmetric ON PURPOSE — see `actions/schemas/index.ts` header comment. |
| **Executor group** | Owner-scoped partial map of executors under `runtime/executors/`, merged into one `ActionExecutorMap`. |
| **Nested steps** | Persisted-shape knowledge of which node config fields hold child step arrays (`graph/nestedSteps.ts`): step keys, branch keys (`cases`/`choices`), and the template-skip table derived from them. |
| **Quarantined node** | Graph node converted to a runnable no-op placeholder preserving its original payload, with a validation warning (`graph/quarantine.ts`). |
| **Command seam** | IPC channel ↔ handler correspondence guarded at the type level by `electron/ipcContract.ts`; see ADR-0001. |

## Invariants worth remembering

- A workflow run conflicts with itself and with persistent-profile siblings;
  guards live with the RunManager (`activeRunConflict`, scheduler conflict reason).
- Evidence paths must resolve inside the app evidence directory; artifact name
  slugging lives in `evidence/artifacts.ts`, generic path sanitizing in `shared/paths.ts`.
- Graph loads migrate forward monotonically (`graph/migrations/`) and re-persist
  when migrations applied — loaded graphs are always at the latest registry version.

## Deliberate non-terms

- **"Desktop Profile"** — rejected. It implies the isolated persistent storage a Browser Profile has, which the Desktop Surface cannot provide. Use **Desktop Target**.
- **"Session"** — overloaded. `cua-driver` uses it for its own scope handle; say **Driver Session** when that is meant, never bare "session".
- **"Element index"** — a driver-internal ordinal inside one snapshot. Never persist it; persist a **Desktop Locator**.

## Pointers

- Product model & lifecycle: `docs/domain/product-model.md`, `docs/domain/workflow-lifecycle.md`
- Execution semantics & invariants: `docs/domain/execution-semantics.md`, `docs/domain/user-visible-invariants.md`
- Architecture layers: `docs/architecture/overview.md`
- Decisions: `docs/adr/`
