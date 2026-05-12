# CloakBrowser Action And Settings Simplification Design

## Goal

Simplify the workflow authoring model after the CloakBrowser migration so the
product expresses workflow intent instead of re-exposing browser engine knobs.

The design applies to both:

- action node contracts and runner dispatch
- Workflow Settings contracts and persisted settings JSON

This is a strong migration design. It assumes the repo will move to a new
contract version and actively migrate old graphs/settings instead of preserving
every legacy field forever.

## Verified Runtime Basis

Current code already routes browser execution through npm `cloakbrowser`:

- `createCloakBrowserDriver()` imports `cloakbrowser`
- `launchContext()` and `launchPersistentContext()` are the backend launch path
- launch options already set `humanize: true`

The CloakBrowser repository describes the JavaScript package as a drop-in
Playwright/Puppeteer replacement and documents:

- `launchContext(...)`
- `launchPersistentContext(...)`
- `humanize: true`
- persistent profiles
- proxy support
- forwarding Playwright-compatible context options

Playwright already provides:

- locator-based actions
- built-in actionability checks and auto-waiting
- browser/context launch controls such as proxy, user agent, viewport,
  locale, timezone, storage state, permissions, and geolocation

Design consequence:

- the app should not ask operators to rebuild interaction timing and browser
  actionability semantics by hand at every node or in global settings
- settings should only expose product-level policy that the app truly owns

## Product Principles

1. Action nodes describe intent, not Playwright/CloakBrowser mechanics.
2. Settings describe workflow/run policy, not a second browser engine API.
3. A field remains public only when changing it changes product behavior in a
   way operators can reason about.
4. Engine-owned behavior stays in the runner or CloakBrowser launch path.
5. Compatibility is handled through explicit versioned migration, not by
   keeping stale public contracts indefinitely.

## Current Problems

### Action surface problems

The current action model mixes intent fields with engine/tuning fields:

- many element actions repeat `wait_until` and `timeout_ms`
- `input_text.typing_mode` and `delay_ms` duplicate interaction humanization
- click exposes fields such as `mode`, retry wait, post-click wait, and advanced
  positioning even though the runner does not consistently use all of them
- old XPath-first targeting coexists with structured `target`
- iframe selection is duplicated through separate `iframe_xpath` fields

This creates:

- large forms
- large DTOs
- repeated validation code
- behavior that looks configurable in the UI but is partly ignored or already
  handled by Playwright/CloakBrowser

### Settings surface problems

The current settings model also exposes fields that are unused, duplicated, or
too low-level:

- `default_retry_attempts`
- `default_retry_interval_ms`
- `direct_dom_fallback`
- `failure_policy` with only one effective choice
- `output_retention_days`
- `challenge_policy`
- `interaction_fidelity`
- `timing_profile`
- `wait_between_nodes_*`
- raw browser identity knobs: `user_agent`, viewport dimensions, `mobile`,
  `touch`
- browser-context fields inside Environment: locale, timezone, geolocation,
  permissions, headers
- download directory and row-based browser storage seeding

Some fields have no meaningful runtime policy yet. Others re-expose browser
engine options that should either be fully owned by CloakBrowser/Playwright or
represented through a much higher-level product abstraction.

## Target Settings Architecture

Workflow Settings should become smaller and more product-oriented.

### Keep

#### `general`

Workflow metadata remains unchanged in principle:

- name
- description
- tags
- notes

#### `run_policy`

This section owns workflow orchestration decisions:

- `max_workflow_duration_ms`
- `browser_retention`
- batch controls that already have real command-layer behavior

These are app-owned policies, not engine options.

#### `browser_launch`

This section owns only launch decisions the workflow truly needs:

- `session_mode`: `temporary` or `persistent_profile`
- `profile_name` when persistent mode is selected
- proxy configuration
- `headless`

Persistent profile and proxy are retained because they are real launch/session
controls supported by CloakBrowser and needed for controlled test scenarios.

#### `environment`

Environment remains, but it is redefined as workflow input/runtime data:

- initial variables
- typed workflow values that nodes interpolate through templates

Environment no longer owns browser emulation or context mutation.

#### `owned_test_gates`

Fingerprint preflight remains because it is product-specific run validation:

- enable/disable
- probe URL
- allowed origins
- profile/evidence metadata required by the internal verdict contract

This is not an engine option. It is an owned test gate with explicit failure
semantics and run evidence.

### Remove From Primary Settings Contract

- `default_action_timeout_ms`
- `default_retry_attempts`
- `default_retry_interval_ms`
- `failure_policy`
- `interaction_fidelity`
- `direct_dom_fallback`
- `timing_profile`
- `wait_between_nodes_enabled`
- `wait_between_nodes_random`
- `wait_between_nodes_ms`
- `wait_between_nodes_min_ms`
- `wait_between_nodes_max_ms`
- `output_retention_days`
- `challenge_policy`
- `user_agent`
- `viewport_width`
- `viewport_height`
- `mobile`
- `touch`
- `locale`
- `timezone`
- `geolocation`
- `permissions`
- `extra_http_headers`
- `download_directory`
- row-based `cookies`
- row-based `local_storage`
- row-based `session_storage`
- `session_restore_ref`

These fields should not reappear under renamed sections without a separate,
explicitly justified product design.

## Target Action Architecture

### Intent-First Action DTOs

Action configs should keep only data required to express the workflow step.

Examples:

- `navigate`: `{ url }`
- `click`: `{ target }`
- `fill_field`: `{ target, text, clear_before_input? }`
- `clear_field`: `{ target }`
- `select_option`: `{ target, match_by, value }`
- `check`, `uncheck`, `toggle_checkbox`, `select_radio`: `{ target }`
- `upload_file`: `{ target, files }`
- `submit_form`: `{ target? }`
- `hover`, `double_click`, `right_click`, `focus`, `blur`: `{ target }`
- `drag_and_drop`: `{ source_target, target_target }`

Graph-native control flow stays separate from browser action nodes:

- branch
- loops
- retry/recovery
- stop/end
- variable/control graph nodes

### Canonical Target Model

Structured `target` becomes the only element targeting contract.

Required characteristics:

- ordered locator bundle
- optional target constraints when they materially improve disambiguation
- nested iframe target support

Legacy targeting fields are removed from the new public contract:

- `xpath`
- `iframe_xpath`
- `trigger_xpath`
- `source_xpath`
- `target_xpath`

Migration converts legacy selectors into the canonical target model.

### Fields To Remove From Action Configs

Remove action-level fields that duplicate or fight the engine layer:

- `wait_until`
- `timeout_ms`
- `typing_mode`
- `delay_ms`
- `mode: force_dom`
- `retry_interval_ms`
- `post_click_wait_ms`
- advanced click positioning knobs that are not part of stable product intent
- scroll tuning fields that do not have consistent supported runtime semantics

Wait remains as an explicit workflow behavior only when the author wants a
business-semantic wait node, not as an implicit engine-control escape hatch.

## Runner Architecture After Simplification

The runner should receive compact intent configs and execute them through
CloakBrowser-backed Playwright APIs.

Runner responsibilities that remain:

- launch CloakBrowser contexts
- keep `humanize: true`
- apply session/profile/proxy/headless launch policy
- resolve canonical structured targets
- execute browser actions through Playwright-compatible locators/pages
- enforce domain allowlists
- run fingerprint preflight
- maintain cancellation
- collect outputs, evidence, and run state
- retain or close browser sessions according to run policy

Runner responsibilities that should disappear:

- synthesizing per-node wait/readiness policy from user-entered knobs
- synthesizing per-node typing fidelity modes
- carrying settings that only exist to restate Playwright/CloakBrowser behavior

## Migration Strategy

### Versioning

Introduce new explicit versions for:

- workflow graph/action config payloads
- workflow settings payloads

Existing persisted payloads are upgraded when loaded or through a dedicated
migration step, then saved in the new shape.

### Deterministic Conversions

Examples:

- `xpath` -> `target.locators = [{ kind: "xpath", value }]`
- `iframe_xpath` -> nested iframe target in `target`
- `source_xpath` / `target_xpath` -> drag source/target structured locators
- old row-based Environment variables -> new variable-oriented Environment
  shape when they represent node-visible values

### Dropped Fields

Fields that should not survive migration are removed explicitly:

- action `timeout_ms`
- action `wait_until`
- typing fidelity fields
- settings timeout/retry/fidelity/wait-between-nodes fields
- low-level browser emulation and context seeding fields removed from settings

Migration should not silently pretend to preserve semantics that the future
contract rejects.

### Migration Reporting

Each migration should produce a structured note stream for:

- fields dropped as obsolete or unsupported
- workflows that may need operator review
- contracts upgraded successfully without review

This reporting is important because the repo intentionally chooses a strong
migration path rather than indefinite backward compatibility.

## Testing Strategy

### Contract Tests

- every current public action uses the simplified DTO shape
- forbidden engine-level fields do not reappear in public action configs
- forbidden engine-level settings do not reappear in Workflow Settings

### Migration Tests

- legacy graph with XPath-based actions migrates into structured targets
- legacy iframe targeting migrates correctly
- legacy settings contract migrates into new sections
- dropped fields emit migration notes
- workflows that cannot be migrated safely are marked for review

### Runner Tests

- simplified action configs still execute through existing CloakBrowser driver
- target resolution works through the canonical structured target model
- fingerprint preflight remains ordered before workflow actions
- retention/cancellation/domain policy still work after contract changes

### UI Tests

- action editor no longer renders removed engine-level fields
- settings dialog no longer renders removed settings fields
- Environment renders variable/data inputs only

## Scope Boundaries

This design does not:

- invent a new recorder
- add a scheduler service
- broaden CAPTCHA/challenge automation semantics
- add arbitrary advanced override panels back into the primary contract
- preserve every legacy setting by another name

## Decision Summary

The repo should move to:

- intent-first action nodes
- canonical structured targeting only
- minimal Workflow Settings
- Environment limited to workflow/node data context
- CloakBrowser/Playwright owning browser interaction mechanics
- explicit migration instead of compatibility sprawl
