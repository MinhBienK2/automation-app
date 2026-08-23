# CONTEXT

Domain glossary for Mission Control — an Electron desktop app for building and
running browser automation workflows against company-owned systems. Terms here
are the project's vocabulary; use them exactly in code, tests, issues, and docs.

## Product concepts

| Term | Definition |
|------|------------|
| **Project** | Groups workflows, subflows, and browser profiles. Default project: `Main`. |
| **Browser Profile** | Project-owned identity + persistent storage (`identity_id`, `fingerprint_seed`, `profile_dir`). |
| **Workflow** | Named automation whose authoring source is a visual graph. |
| **Subflow** | Reusable, non-runnable graph fragment inside one project; invoked via `call_subflow`. |
| **Graph** | Versioned visual model: nodes, edges, ports, viewport, action configs. |
| **Compiled Graph** | Executable plan generated from a graph: ordered action-config steps + domain policy. |
| **Action Config** | One executable behavior unit produced by compilation (`type` + `config`). |
| **Run** | One execution of a compiled graph via the CloakBrowser runner. |
| **Schedule** | In-app trigger for a saved workflow (fires only while the app is open). |
| **Outputs** | Named values captured during execution (text, file paths, variables). |
| **Evidence** | Run-captured proof artifacts (screenshots, downloads, traces) plus the redaction/truncation manifest applied to outputs before persistence. Lives in `electron/backend/evidence/`. |
| **Recording Session** | Backend-owned draft: captures browser usage → reviewable steps → saved workflow. |
| **Identity** | High-entropy browser identity bound to a profile; fingerprint seed derived from it. |

## Backend module vocabulary

| Term | Meaning |
|------|---------|
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

## Pointers

- Product model & lifecycle: `docs/domain/product-model.md`, `docs/domain/workflow-lifecycle.md`
- Execution semantics & invariants: `docs/domain/execution-semantics.md`, `docs/domain/user-visible-invariants.md`
- Architecture layers: `docs/architecture/overview.md`
- Decisions: `docs/adr/`
