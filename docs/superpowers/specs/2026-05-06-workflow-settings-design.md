# Workflow Settings Design

## Status

Approved by the user on 2026-05-06 after brainstorming.

This spec defines the target product model for per-workflow settings. It is not
only a UI shell for the current browser runtime dialog. The goal is a complete
workflow-level configuration system that controls how a workflow is named,
validated, launched, seeded with inputs, scheduled, debugged, exported, imported,
and explained to users.

## Problem

The workflow detail screen currently exposes a `Runtime` button for browser
configuration. That name and placement make browser launch settings look like a
standalone feature rather than part of a broader workflow settings model.

The product also has settings-like concepts spread across graph nodes, command
payloads, app preferences, and runtime behavior:

- browser profile, proxy, user agent, viewport, mobile/touch flags, and challenge
  policy are workflow-level launch concerns;
- geolocation, permissions, headers, downloads, locale, and timezone are
  environment defaults that may also be overridden during a graph run;
- variables can be seeded before a run, mutated during a run, and supplied by
  batch rows;
- schedule validation exists, but schedule/trigger configuration is not yet a
  persisted workflow settings surface;
- graph autosave is an app/editor preference and must not be mixed with workflow
  behavior.

Users need one durable place to understand and configure the behavior of a
specific workflow without turning the graph action palette into a settings panel.

## Goals

- Create one `Workflow Settings` product surface for per-workflow settings.
- Keep app preferences, such as graph autosave, in the app-level Settings screen.
- Replace the workflow list edit dialog with Workflow Settings opened to
  `General`.
- Replace the workflow detail `Runtime` button with `Settings`, opened to
  `Browser`.
- Define settings sections deeply enough to support backend validation, runner
  behavior, export/import, future scheduling, and migration from legacy setup
  nodes.
- Preserve the graph as the workflow logic surface.
- Use Workflow Settings as the baseline run context before graph execution.
- Allow graph actions to override workflow defaults when the setting can safely
  change during a run.
- Add detailed `?` help for every settings section and important setting so users
  understand effects, precedence, examples, and tradeoffs.

## Non-Goals

- Do not move graph authoring, action editing, or visual logic into Workflow
  Settings.
- Do not make graph autosave a per-workflow setting.
- Do not remove existing action nodes or break saved workflows.
- Do not implement multiple named run profiles in the first full design. A future
  profile system can layer on top of the same settings model.
- Do not store raw long-lived secrets directly in workflow settings once a secret
  store is available. Workflow settings should store secret references.
- Do not present browser or proxy settings as stealth, anti-detection, CAPTCHA
  bypass, spam, or third-party account-control bypass tools.

## Core Model

Workflow Settings is a per-workflow aggregate:

```text
Workflow
  -> WorkflowGraph
  -> WorkflowSettings
      -> general
      -> execution
      -> browser
      -> environment
      -> inputs
      -> triggers
      -> advanced
```

Workflow Settings travels with the workflow. Export, import, duplicate, backup,
and future sync flows should include it because it can change how the workflow
runs.

App preferences remain outside Workflow Settings. Preferences such as graph
autosave, sidebar collapse, theme, keyboard shortcut preferences, and editor
behavior belong to the app/user, not to the workflow definition.

## Precedence

Precedence must be deterministic:

```text
App preference < Workflow Settings < Per-run override < Graph action override
```

App preferences should not change workflow output. They only affect the local
editing or app experience.

Workflow Settings defines the default context for a workflow run.

Per-run overrides are temporary values supplied by a manual run, batch run,
trigger dispatch, or future CLI/API invocation. They do not mutate saved workflow
settings unless the user explicitly saves them.

Graph action overrides apply only at the point where the graph action runs and
only for capabilities that can safely change during a run.

Launch-level values such as profile and proxy are not safe runtime overrides.
They should live in Workflow Settings. Existing `Use Profile` and `Use Proxy`
nodes remain compatibility behavior and should be surfaced through Advanced
warnings or migration tools.

## Run Flow

When a workflow runs:

```text
run_workflow(workflow_id, optional_run_overrides)
  -> load workflow
  -> load saved workflow graph
  -> load workflow settings
  -> merge settings with per-run overrides
  -> validate graph and settings together
  -> compile graph
  -> build initial run context from settings
  -> launch browser from Browser settings
  -> apply Environment defaults before the first graph step
  -> seed Inputs & Variables
  -> execute graph steps
  -> allow action-level runtime overrides where supported
  -> apply terminal close/retain policy
  -> capture outputs and terminal run state
```

Graph validation should still block invalid graph topology or config before the
runner starts. Workflow settings validation should block invalid run context
before browser launch or before trigger activation.

## Settings Sections

### General

General owns workflow identity and metadata.

Fields:

- workflow name;
- description;
- tags;
- notes;
- created and updated metadata;
- optional owner/team metadata if the product later supports collaboration.

Behavior:

- Workflow list `Edit` opens Workflow Settings at General.
- Saving General updates workflow summary data used by the list, header, search,
  export/import, and duplicate flows.
- General does not change runner behavior except through user-visible metadata.
- Metadata should be included in workflow export/import.

Validation:

- Name is required and trimmed.
- Description, tags, and notes are optional.
- Tags are unique after trimming and case-normalized according to the product
  convention chosen during implementation.

Help content:

- Explain which fields identify the workflow, which fields are only notes, and
  what is included when exporting or duplicating.
- Include examples of useful descriptions and tags.

### Execution

Execution owns default run policy for the workflow.

Fields:

- default action timeout;
- default retry attempts for retry-capable operations;
- default retry interval;
- maximum workflow run duration;
- default browser retention after terminal outcome: retain or close;
- failure policy, initially stop on first failure;
- batch defaults: concurrency limit, headed/headless default, and stop batch on
  first failed row;
- optional output retention policy for future cleanup behavior.

Behavior:

- Execution defaults apply when an action, graph node, batch request, or per-run
  override does not supply its own value.
- Action-level timeout and retry fields override Execution defaults for that
  action.
- Terminal End or Stop Workflow nodes override the default browser retention
  policy for that terminal path.
- Maximum workflow duration cancels the run through the same cancellation path as
  manual stop, but the terminal state should be `failed` with a timeout reason.
- Batch defaults apply to `run_batch_workflow` unless the request provides
  explicit per-run values.

Validation:

- Durations must be positive when set.
- Retry attempts must be positive when set.
- Retry interval must be positive when set.
- Batch concurrency must be positive when set.
- Maximum workflow duration should be greater than or equal to default action
  timeout when both are set.

Help content:

- Explain defaults versus action-level overrides.
- Explain the difference between retaining and closing the browser.
- Explain when to set a workflow max duration versus per-action timeouts.
- Explain batch concurrency tradeoffs without promising parallel browser support
  beyond what the runner implements.

### Browser

Browser owns launch context for Chromium and browser-level device defaults.

Fields:

- profile name or persistent profile reference;
- proxy enabled flag;
- proxy server;
- proxy username;
- proxy password or secret reference;
- user agent;
- viewport width and height;
- mobile flag;
- touch flag;
- challenge policy;
- headed/headless default when no per-run override is provided.

Behavior:

- Browser settings are resolved before Chromium launches.
- Profile and proxy are launch-level settings. Graph nodes should not be used to
  change them mid-run.
- User agent and viewport are default launch/context values. Graph actions may
  still override them later when the user intentionally changes context during a
  workflow.
- Challenge policy must be described as authorized human checkpoint handling, not
  bypass.
- If no settings row exists for an existing workflow, defaults are created lazily
  or returned without forcing migration.

Validation:

- Proxy server is required when proxy is enabled.
- Proxy username cannot be blank when provided.
- Proxy password cannot be empty when provided.
- Viewport width and height must be positive when set.
- Profile name is trimmed.
- Challenge policy must be one of `none`, `detect_only`, or `pause_for_human`.

Help content:

- Explain which values require browser restart or new run.
- Explain proxy/profile as repeatable test environment and authorized routing.
- Explain mobile/touch relationship with viewport.
- Explain challenge policy meanings and safety limits.

### Environment

Environment owns default browser context applied after launch and before the
first graph step.

Fields:

- geolocation;
- granted permissions;
- extra HTTP headers;
- locale;
- timezone;
- download directory;
- initial cookies;
- initial localStorage values;
- initial sessionStorage values;
- optional session restore reference.

Behavior:

- Environment settings apply before the first executable graph step.
- Graph actions such as Set Geolocation, Set Extra Headers, Grant Permission, Set
  Local Storage, Set Session Storage, and cookie/session actions remain valid
  runtime overrides.
- Environment defaults should be visible in run summaries because they can affect
  page behavior.
- Download directory default applies unless a graph action changes it.

Validation:

- Geolocation latitude must be between -90 and 90.
- Geolocation longitude must be between -180 and 180.
- Permission names must be non-empty and supported by the runner/browser.
- Header names and values must be non-empty.
- Timezone and locale must match supported formats.
- Download directory must be a valid path when set.
- Cookie/storage entries must have non-empty keys.

Help content:

- Explain defaults versus graph overrides.
- Explain when to set Environment defaults instead of adding first-step setup
  nodes.
- Explain that headers, permissions, and geolocation apply only where the browser
  and target site permit them.

### Inputs & Variables

Inputs & Variables owns the initial data contract for the workflow.

Fields:

- input schema rows: name, type, required flag, default value, description;
- supported types: text, JSON, number, boolean, array, object, secret reference;
- initial variable defaults;
- required input validation;
- batch column mapping from row columns to workflow inputs;
- secret references for sensitive values;
- preview of resolved initial values before run.

Behavior:

- Initial inputs seed the run output/variable store before graph execution.
- Graph Set Variables and Set JSON Variables nodes remain runtime mutations and
  can overwrite initial values by execution order.
- Batch rows override input defaults for the row being executed.
- Per-run manual input values override saved defaults for that run.
- Secret references resolve at run time and should be redacted in UI summaries,
  logs, exports, and captured output views.

Validation:

- Input names are required and must be valid variable paths.
- Duplicate input names are rejected.
- Required inputs must have a saved default or be supplied by per-run/manual
  input, batch mapping, or trigger input source.
- JSON/object/array defaults must parse successfully.
- Number defaults must be finite numbers.
- Boolean defaults must be true or false.
- Secret references must point to an available secret entry at run time.

Help content:

- Explain initial inputs versus runtime variables.
- Explain overwrite order: defaults, per-run values, batch row values, then graph
  writes.
- Explain how to use `{{variable.path}}` templates.
- Include examples for single manual runs and batch rows.

### Triggers

Triggers owns persisted orchestration settings for automatic or scheduled runs.

Fields:

- trigger enabled flag;
- mode: manual only, once at timestamp, interval, future cron/calendar/event;
- interval seconds for interval triggers;
- once-at timestamp for one-time triggers;
- input source used by triggered runs;
- batch source reference when a trigger starts a batch;
- missed-run policy when the app was closed: skip or run next eligible instance;
- concurrency policy: skip if running, queue one, or reject;
- last run and next run metadata.

Behavior:

- Manual runs remain available even when triggers are disabled.
- Triggered runs use the saved graph and saved Workflow Settings at dispatch
  time.
- Trigger dispatch must validate required inputs before starting a run.
- Existing `OrchestrationSchedule` validation should become part of persisted
  Workflow Settings rather than a standalone validation-only command.
- Trigger state is included in export/import, but last-run runtime history can be
  omitted unless export diagnostics explicitly includes it.

Validation:

- Enabled triggers require a valid mode.
- Interval seconds must be positive.
- Once-at timestamp is required and must be parseable.
- Required inputs must be satisfiable by defaults, trigger input source, or batch
  source.
- Concurrency policy must be one of the supported values.

Help content:

- Explain that triggers run saved workflow state, not unsaved graph edits.
- Explain manual versus scheduled runs.
- Explain missed-run and concurrency policies with examples.

### Advanced

Advanced owns compatibility, migration, diagnostics, and rare technical settings.

Fields and tools:

- compatibility warnings for legacy launch/setup nodes;
- migration helper to move simple first-step setup nodes into Workflow Settings;
- debug logging level;
- export/import diagnostics;
- experimental flags when needed;
- read-only settings JSON preview for troubleshooting.

Behavior:

- Advanced must not become the default place for normal workflow behavior.
- Compatibility warnings should be actionable and link to the section that owns
  the modern setting.
- Migration helpers should show a preview before changing graph nodes or saved
  settings.
- Debug logging should redact secrets.

Validation:

- Experimental flags must be known keys.
- Logging level must be one of the supported values.
- Migration helpers must refuse ambiguous graph patterns.

Help content:

- Explain each warning and the modern alternative.
- Explain what migration changes before applying it.
- Explain diagnostics and redaction behavior.

## Section Help System

Every settings section and important setting must have a `?` help entry.

The help model should follow the existing action/node help direction: it should
teach decisions, not only define fields.

Recommended section help shape:

```ts
type WorkflowSettingsHelpContent = {
  title: string;
  summary: string;
  bestFor: string[];
  notFor?: string[];
  precedence?: string[];
  fieldGuide: Array<{
    name: string;
    description: string;
    whenToUse?: string;
    overrideBehavior?: string;
  }>;
  workflowExamples: Array<{
    title: string;
    steps: string[];
    notes?: string[];
  }>;
  relatedGraphActions?: Array<{
    action: string;
    relationship: "default" | "runtime_override" | "compatibility";
    explanation: string;
  }>;
  safetyNotes?: string[];
  commonMistakes: Array<{
    mistake: string;
    fix: string;
  }>;
};
```

Help popup layout:

1. What this section controls
2. Use it when
3. Do not use it for
4. Precedence and overrides
5. Field guide
6. Related graph actions
7. Workflow examples
8. Common mistakes and fixes
9. Safety notes

Help should be available from:

- the section header;
- complex field groups such as proxy, retention, trigger concurrency, batch
  mapping, secret references, and migration helpers;
- validation messages when a field error is easier to fix with context.

Vietnamese content should be first-class alongside English content, matching the
existing help guide direction for action/node help.

## Data Model

Recommended persisted shape:

```text
workflow_settings
  workflow_id: string primary key
  version: number
  general_json: json
  execution_json: json
  browser_json: json
  environment_json: json
  inputs_json: json
  triggers_json: json
  advanced_json: json
  created_at: string
  updated_at: string
```

The implementation may choose one JSON column for all settings if that is simpler
for migration, but the domain model should still expose strongly typed section
structs in Rust and TypeScript.

Versioning is required because this settings model will grow. Unknown future
fields should not crash older import paths; they should be preserved when
possible or reported in import diagnostics.

Default settings for existing workflows:

```text
general: existing workflow name, empty metadata
execution: current runner defaults
browser: current WorkflowBrowserConfig defaults
environment: no defaults
inputs: no initial inputs
triggers: manual only, disabled
advanced: no warnings unless graph compatibility issues are detected
```

## Command API

Recommended commands:

- `get_workflow_settings(workflow_id) -> WorkflowSettings`
- `save_workflow_settings(workflow_id, settings) -> WorkflowSettings`
- `validate_workflow_settings(settings) -> Vec<SettingsValidationIssue>`
- `validate_workflow_run(workflow_id, optional_run_overrides) -> Vec<RunValidationIssue>`
- `migrate_workflow_setup_nodes(workflow_id, migration_request) -> MigrationPreview | WorkflowSettings`

The implementation may provide section-specific save commands if independent
dirty states are easier:

- `save_workflow_settings_section(workflow_id, section, section_value)`

Section-specific saves must still validate cross-section constraints before run.

Existing browser config commands can be preserved temporarily and mapped to
`settings.browser`, then deprecated after callers move to Workflow Settings.

## Frontend Flow

Workflow list:

- `Create Workflow` can keep its small creation dialog for fast creation.
- `Edit` opens Workflow Settings at General.

Workflow detail:

- Replace the header `Runtime` button with `Settings`.
- Opening from detail defaults to Browser.
- The dialog uses a left sidebar and right content area.
- Sidebar order:
  1. General
  2. Execution
  3. Browser
  4. Environment
  5. Inputs & Variables
  6. Triggers
  7. Advanced
- Each section shows its own save status and save action.
- Closing the dialog does not auto-save.
- Failed saves keep the dialog open and show field-level errors when available.
- Section help is reachable through `?` buttons in headers and field groups.

The settings surface should not contain nested cards inside cards. It should use
the existing dark design system, compact labels, clear groups, and predictable
form controls.

## Migration And Compatibility

Existing workflows must keep running.

Migration rules:

- Existing `WorkflowBrowserConfig` is mapped into `settings.browser`.
- Workflows without a settings row receive default settings lazily on load.
- Existing graph actions continue to deserialize and execute.
- `Use Profile` and `Use Proxy` become compatibility launch hints only when no
  Browser setting is present.
- `Set User Agent` and `Set Viewport` remain allowed runtime overrides.
- `Set Geolocation`, `Set Extra Headers`, and `Grant Permission` remain allowed
  runtime overrides.
- `Set Variables` and `Set JSON Variables` remain runtime writes and can
  overwrite initial variables.

Advanced migration helpers can later detect simple setup prefixes such as:

```text
Start -> Use Profile -> Use Proxy -> Set User Agent -> Set Viewport -> real work
```

The helper should preview moving those values into Browser settings and removing
or hiding the redundant setup nodes only after user confirmation.

## Error Handling

Save-time errors should identify section and field.

Run-time settings errors should appear before browser launch when possible.

Examples:

- `Browser proxy server is required when proxy is enabled.`
- `Input "email" is required but no default, batch mapping, or run value was provided.`
- `Trigger interval must be greater than 0.`
- `Workflow max duration must be greater than 0.`
- `Legacy Use Proxy node conflicts with Browser proxy settings. Browser settings will be used.`

Warnings should not block run unless the behavior would be ambiguous or unsafe.

## Testing

Implementation should add focused tests at each boundary:

- TypeScript tests for settings defaults, section labels, help content lookup, and
  dialog routing from list/detail.
- UI tests for opening Settings from workflow list and detail, switching
  sections, saving General, saving Browser, and opening `?` help.
- Frontend API tests for command names and payload shapes.
- Rust domain tests for settings validation and defaults.
- Persistence tests for save/load, lazy defaults, export/import, and versioning.
- Command API tests for get/save/validate settings and compatibility with old
  browser config commands.
- Runner tests proving Browser, Environment, Execution, and Inputs defaults are
  applied before graph execution.
- Compatibility tests for legacy setup nodes and graph action overrides.
- Trigger tests for persisted schedule validation and dispatch behavior when the
  app supports background scheduling.

## Documentation Updates During Implementation

Update source-of-truth docs when implementation changes behavior:

- `docs/domain/product-model.md`
- `docs/domain/workflow-lifecycle.md`
- `docs/domain/execution-semantics.md`
- `docs/domain/user-visible-invariants.md`
- `docs/architecture/frontend.md`
- `docs/architecture/runner.md`
- `docs/architecture/persistence.md`
- `docs/contracts/workflow-types.md`
- `docs/contracts/tauri-commands.md`
- `docs/contracts/run-state.md` if run-state errors or trigger states change
- `README.md` smoke checklist

## Rollout

Recommended implementation phases:

1. Introduce `WorkflowSettingsDialog`, sidebar, General, Browser, and section help
   using existing browser config persistence.
2. Replace browser config storage with `WorkflowSettings` persistence and map old
   commands to the Browser section.
3. Add Execution defaults and runner application.
4. Add Environment defaults and runner application.
5. Add Inputs & Variables initial run context and batch mapping.
6. Persist Triggers and connect existing schedule validation to workflow settings.
7. Add Advanced compatibility warnings and migration previews.

Each phase should keep existing workflows runnable and update docs/tests for the
behavior it touches.
