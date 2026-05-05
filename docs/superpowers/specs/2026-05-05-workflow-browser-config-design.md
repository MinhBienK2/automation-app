# Workflow Browser Runtime Config Design

## Goal

Give each workflow one default browser runtime configuration that is applied before Chromium launches.

The workflow graph should describe automation logic. Browser environment settings such as profile, proxy, user agent, viewport, and challenge policy should live outside the graph because they affect how the browser is created or how the whole run is governed.

## Current Problems

- `use_profile` and `use_proxy` look like normal graph actions, but the runner reads them before browser launch through launch settings.
- The in-graph shape suggests a proxy or profile could change midway through a workflow, while Chromium launch settings cannot reliably work that way.
- Users need a clear place to configure the workflow's default browser environment without mixing it into click/input/wait logic.
- Proxy/profile wording must stay focused on authorized routing, profile isolation, and repeatable test environments. The product must not present these settings as stealth, anti-detection, CAPTCHA bypass, spam, or account-control bypass tools.

## Recommended Approach

Add a workflow-level browser runtime config.

```text
Workflow
  -> BrowserRuntimeConfig
      -> profile
      -> proxy
      -> user agent
      -> viewport
      -> challenge policy
```

When a user runs a workflow:

```text
run_workflow(workflow_id)
  -> load saved workflow graph
  -> validate and compile graph
  -> load workflow browser runtime config
  -> launch Chromium with runtime config
  -> execute compiled graph actions
```

The graph remains responsible for automation behavior: navigation, click, input, wait, capture, variables, branching, loops, retries, recovery, and terminal nodes.

## Scope

### First Slice

The first implementation should support the browser settings that matter most at launch time and have existing action/config precedent:

- `profile_name`
- proxy enabled flag
- proxy server
- proxy username
- proxy password
- user agent
- viewport width
- viewport height
- mobile flag
- touch flag
- challenge policy

### Deferred

These can remain actions or be added to the workflow config in later slices:

- geolocation
- extra HTTP headers
- permission grants
- locale
- timezone
- proxy presets
- proxy pools or automatic rotation
- per-run overrides

Proxy pools and automatic rotation are intentionally out of scope for this design. They add health checks, allocation rules, run history, retry policy, and profile-proxy affinity, and they also risk shifting the product toward anti-detection use cases.

## Data Model

Introduce a persisted workflow browser runtime config keyed by `workflow_id`.

The storage can be a dedicated `workflow_browser_configs` table or a JSON config column if that better matches the repository shape at implementation time. A dedicated table is preferred because the config is optional, versionable, and likely to grow.

Recommended shape:

```text
workflow_id: string
profile_name: string | null
proxy_enabled: boolean
proxy_server: string | null
proxy_username: string | null
proxy_password: string | null
user_agent: string | null
viewport_width: number | null
viewport_height: number | null
mobile: boolean
touch: boolean
challenge_policy: "none" | "detect_only" | "pause_for_human"
```

Default config for existing workflows:

```text
profile_name: null
proxy_enabled: false
proxy_server: null
proxy_username: null
proxy_password: null
user_agent: null
viewport_width: null
viewport_height: null
mobile: false
touch: false
challenge_policy: "none"
```

Null user agent and viewport values mean the runner keeps the browser defaults it uses today.

## Backend Flow

`run_workflow` should load the workflow graph and workflow browser config before starting the background run.

Graph validation should still happen before Chromium launch. Invalid graphs should fail fast without opening a browser.

The runner should receive explicit launch settings derived from the workflow browser config. It should not need to infer launch settings by scanning compiled action steps.

Existing `use_profile` and `use_proxy` actions should remain compatible during the transition:

- If a workflow has no workflow-level config, legacy actions can continue to populate launch settings as they do today.
- If workflow-level config is present, it should be the primary source of launch settings.
- A future validation warning can flag workflows that combine workflow-level proxy/profile config with legacy proxy/profile nodes.

## Frontend Flow

Add a workflow detail browser config surface. It can be a panel, tab, or header settings control, but it should be scoped to the selected workflow rather than a global app setting.

The first UI should include:

- Profile name
- Proxy enabled
- Proxy server
- Proxy username
- Proxy password
- User agent
- Viewport width and height
- Mobile and touch toggles
- Challenge policy

The graph canvas and inspector should remain focused on workflow logic. `use_profile` and `use_proxy` should eventually be hidden from the main action palette or moved to advanced compatibility surfaces.

## Validation

Validation should be strict enough to prevent confusing saved config, but it should not attempt network checks at save time.

Rules:

- Proxy server is required when proxy is enabled.
- Proxy username cannot be blank when provided.
- Proxy password cannot be empty when provided.
- Viewport width must be greater than 0 when set.
- Viewport height must be greater than 0 when set.
- Profile name is trimmed before use.
- Challenge policy must be one of `none`, `detect_only`, or `pause_for_human`.

Proxy reachability and authentication should be reported at run time because they depend on the current network and proxy service state.

## Error Handling

Config errors should fail before step execution and produce readable command-facing messages.

Examples:

- Missing proxy server with proxy enabled: `Proxy server is required`.
- Invalid viewport value: `Viewport width must be greater than 0`.
- Browser launch failure: `Browser could not start with this workflow browser config`.
- Profile directory creation failure: `Profile directory could not be created`.

If the proxy cannot connect or rejects authentication, the run should fail before the first graph step when Chromium reports that failure. More specific proxy connection/auth errors can be added when the runner can reliably classify them.

## Challenge Policy

Challenge policy is not an anti-detection feature.

Recommended meanings:

- `none`: no special challenge handling.
- `detect_only`: challenge detection can record an output or fail according to future action semantics.
- `pause_for_human`: authorized human verification can pause a headed browser run and resume after user action.

The UI and docs should describe this as human checkpoint handling for authorized workflows, not bypass.

## Migration And Compatibility

Existing workflows should continue to run without requiring a browser config row.

Migration behavior:

- Add default config behavior for workflows without persisted config.
- Preserve existing graphs and legacy action configs.
- Keep `use_profile` and `use_proxy` action execution as compatibility no-ops after launch.
- Keep legacy launch-setting inference only as a fallback when workflow-level config is absent.

Later cleanup can:

- Hide `use_profile` and `use_proxy` from the main action picker.
- Add validation warnings for mixed workflow config and legacy nodes.
- Provide an explicit migration helper that moves simple first-node proxy/profile actions into workflow config.

## Testing

Add focused tests at each boundary touched by implementation:

- Rust domain validation for browser runtime config.
- Persistence tests for save/load by workflow id.
- Command API tests for config get/save commands if new commands are added.
- Runner tests proving launch settings come from workflow browser config.
- Compatibility tests for legacy `use_profile` and `use_proxy` fallback behavior.
- Frontend API tests for invoke names and payload shape.
- UI tests for the workflow browser config surface.

## Documentation Updates

Implementation should update current source-of-truth docs when behavior changes:

- `docs/domain/product-model.md`
- `docs/domain/workflow-lifecycle.md`
- `docs/domain/execution-semantics.md`
- `docs/architecture/runner.md`
- `docs/contracts/workflow-types.md`
- `docs/contracts/tauri-commands.md` if new commands are added
- `README.md` smoke checklist if user-visible run setup changes

## Open Decisions For Implementation

- Whether persistence uses a dedicated table or a JSON column.
- Whether config save/load uses new commands or is folded into existing workflow detail commands.
- Where the UI surface lives in the workflow detail screen.
- Whether password values are stored directly in the first slice or moved through the existing secret-output pattern before persistence.

