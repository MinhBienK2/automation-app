# Action Catalog And Locator Spec

## Purpose

Define the new Playwright-native action catalog and locator model. The new app
must stop treating XPath as the primary targeting model and instead use
Playwright-style resilient locators while keeping XPath as an explicit fallback.

## In Scope

- Action taxonomy.
- Locator model.
- Action config ownership.
- Action mode classification.
- Template/variable support.
- Validation rules.
- Product-equivalent coverage of the current action catalog.

## Out Of Scope

- Old Rust `ActionConfig` compatibility.
- Hidden legacy compatibility actions.
- Exact UI form component layout.
- Runner implementation details beyond the contract needed by actions.

## Product Concepts

Action nodes live in workflow graphs. They use locators, runtime variables, and
node-local config. They do not own identity profile, proxy, persistent browser
profile, or global run policy.

## Technical Design

### Action Groups

The new action catalog should use these groups:

- Navigation: navigate, back, forward, reload, tabs.
- Locator Interaction: click, double click, right click, hover, drag/drop.
- Form Fields: fill, clear, select, checkbox/radio, upload, submit, rich text.
- Keyboard: press key, hotkey, type text, paste.
- Wait: fixed wait, random wait, wait for locator, wait for URL, wait for
  request/response.
- Capture: text, attribute, value, table, list, screenshot, download.
- Variables: set variable, set JSON variables, transform, assert output.
- Browser Context: dialogs, frames, viewport override when allowed, permissions
  where runtime-safe.
- Network: wait for request/response, block requests, mock response where
  allowed by run policy.
- Control: checkpoint, stop, terminal success/failure.
- Advanced: evaluate JavaScript with explicit risk/evidence marking.

### Actions To Remove From Main Catalog

Do not expose legacy setup actions as graph actions when they belong to settings:

- use profile;
- use proxy;
- set user agent as launch identity;
- global browser identity toggles.

The new catalog can still support runtime environment actions such as setting
headers or storage if they are safe after context launch and clearly classified.

### Locator Model

Locator config:

```json
{
  "strategy": "role",
  "value": "button",
  "name": "Log in",
  "exact": false,
  "frame": null,
  "filters": {
    "hasText": null,
    "visible": true,
    "index": 0
  },
  "fallbacks": []
}
```

Supported strategies:

- `role`
- `label`
- `placeholder`
- `text`
- `testId`
- `css`
- `xpath`
- `attribute`

XPath is supported but treated as fallback or advanced mode.

### Locator Resolution

Actions should resolve locators through Playwright locators, not manual DOM
XPath scripts. The runner should preserve locator metadata in action traces.

Locators can include fallback candidates. Fallback usage must be traced.

### Action Mode Classification

Every executed action should be classified:

- `browser_input`: browser/user-like interaction through Playwright input APIs.
- `playwright_action`: Playwright semantic action such as locator click/fill.
- `direct_dom`: explicit DOM mutation or script evaluation.
- `observer`: read-only state capture.
- `control`: graph/run control.
- `manual`: operator checkpoint.

Trace output must show actual mode.

### Templates And Variables

Text fields may reference variables using template tokens. Rendering happens in
runner before action execution. Failed template resolution should fail the action
with a clear message.

### Action Config Shape

Action configs should be TypeScript-first and schema-validated. Each action
needs:

- `type`
- `label`
- `locator` when target-dependent;
- `timeoutMs` optional;
- `retry` optional;
- action-specific config;
- evidence tags optional.

## Interfaces / Contracts

Action catalog must expose:

- list of visible action definitions;
- default config factory;
- validation schema;
- summary builder;
- runner execution mapping;
- help metadata.

Runner receives compiled action configs from graph compiler, not UI form drafts.

## Data Model

Action configs live inside graph node config JSON. Storage does not require
separate action tables for the first release.

Action definition metadata can live in code and be tested against schemas.

## Error Handling

- Missing required locator fails validation before run.
- Locator resolves to zero elements: runtime failure with locator summary.
- Locator resolves to multiple elements when uniqueness required: runtime
  failure unless index/filter intentionally selects one.
- Fallback locator use is allowed only when configured and must be traced.
- Direct JavaScript failures must include node id and sanitized error message.

## Security / Safety / Audit

- Advanced JavaScript actions must be visibly classified and traced.
- Network mocking/blocking must be restricted by workspace policy.
- Actions cannot override identity profile fields during a run.
- Manual checkpoint/challenge nodes must not automate challenge solving.
- Domain allowlist checks apply to navigation and request-changing actions.

## Testing

Tests must cover:

- action default configs;
- action schema validation;
- locator validation;
- summary text;
- compile-to-runner config shape;
- representative runner mappings for P0 actions;
- fallback locator trace behavior;
- direct DOM classification.

## Acceptance Criteria

- P0 action catalog covers current product-equivalent workflow behavior.
- Locator-first model is the default in UI and runner.
- XPath remains available as explicit fallback/advanced locator.
- Every action has schema, defaults, summary, validation, and runner mapping.
- Action traces can report actual execution mode and locator summary.

## Dependencies

- Product Model Spec.
- Workflow Graph And Builder Spec.
- CloakRunner Spec.
- Run Evidence And Audit Spec.

## Open Questions

None blocking. The Testing And Acceptance Spec will classify each action as P0,
P1, or P2 in the parity matrix.
