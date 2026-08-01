# Runner Invariants

Preserve these unless the task explicitly changes them.

## Execution

- Full runs execute the compiled saved graph.
- Default engine: CloakBrowser/Playwright with humanized interaction. `AUTOMATION_BROWSER_ENGINE=camoufox` selects Camoufox Firefox-compatible runtime.
- Full runs use persisted Workflow Settings + selected browser profile as baseline.
- Environment variables applied before first graph step. Loaded in priority: Profile Environment (lowest priority) -> Workflow Settings Environment (takes precedence over profile) -> Workflow logic nodes (runtime overrides).
- Profile variables marked as persistent (`persist: true`) write back their final execution values to the database when the run completes.
- Edge waits compile into synthetic wait steps before target nodes.
- Run Policy max duration cancels overlong runs with timeout reason.
- Run Policy can reject Run JavaScript before page script evaluation.
- Set Viewport updates runtime width and height only.
- Domain allowlist becomes run-scope navigation policy. Disallowed URLs fail after template rendering, before navigation.
- `system.loop.index` (0-based) / `system.loop.number` (1-based) are scoped per loop: a nested loop restores its parent's values on exit, so an outer loop body always reads its own index. Only one module assigns them; loop implementations broadcast through it.

## Browser Launch

- Identity settings (profile dir, fingerprint seed, fonts dir, proxy, timezone/locale, WebRTC, humanize, headless) resolved before launch.
- Lazy defaults auto-fill `.local/cloakbrowser-fonts/linux` when readable; operator-cleared `null` stays cleared.
- Persona viewport/window dimensions recorded in evidence; no explicit Playwright viewport/window-size/screen-size overrides.
- Headed Linux runs fail with display prerequisite message when no `DISPLAY`/`WAYLAND_DISPLAY`.

## Session Management

- Browser profiles persist Chromium user data under app data directory (survives temp cleanup).
- Starting a workflow with persistent profile closes any retained session owning same profile dir.
- Missing Workflow Settings rows return lazy v2 defaults.
- Different workflows can run concurrently if they don't share a persistent profile.
- Same-workflow, shared-profile, and batch conflicts rejected with readable errors.
- Batch runs globally exclusive with normal runs.

## Stop And Retention

- Stop returns stopped state immediately for targeted run id; ownership clears after runner cancels.
- Browser sessions remain open after success/failure/stop by default.
- Run Policy browser retention can close browser. Terminal nodes can request closure.

## Evidence

- Screenshots, downloads, failure screenshots: run-scoped evidence directories + `__evidence` metadata.
- Artifact commands accept evidence ids, not paths. Backend validates under `evidence/runs/<run_id>/...`.
- Renderer never receives absolute original paths. Downloads not previewed in-app.
- `browser_identity` evidence: fingerprint seed hash, font hash, persona metadata, timezone source, WebRTC policy, override names, humanization, CloakBrowser version.
- Failures identify the failed step when possible.
- Graph runs use same run-state contract; canvas reflects node state from compiled node ids.

## Command Boundary

- Electron IPC errors serialize as `{ message, field? }`.
- Renderer calls `window.workflowApi` through `src/lib/workflowApi.ts`.
- Renderer must not import Node, Electron, filesystem, SQLite, Playwright, or CloakBrowser APIs.

## Persistence

- Workflow summaries: list metadata only; graph JSON keyed by workflow id.
- Graph saves touch parent workflow `updated_at`.
- Settings saves keyed by workflow id, touch `updated_at`. General save also updates summary name.
