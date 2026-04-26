# Workflow Automation MVP Design

Date: 2026-04-27

## Summary

Build a desktop MVP for creating and running browser automation workflows. A workflow is an ordered list of simple web actions. The app stores workflows locally, lets the user edit steps through forms, and runs the workflow in a visible Chromium browser controlled by Playwright.

This MVP is workflow-first. It does not include profiles, variables, browser session persistence, run history, output extraction, screenshots, recorder, or element picker.

## Goals

- Let users create, edit, delete, and reopen workflows stored on their machine.
- Let users build a workflow from simple web actions.
- Let users test a selected step by running from step 1 through that step.
- Let users run the full workflow from start to finish.
- Always open a new headed Chromium browser for each Test or Run.
- Keep the browser open after success, failure, or stop so the user can inspect the final state.
- Store workflows and steps in SQLite with migrations.

## Non-Goals

- No Profile concept in the MVP.
- No custom variables or `{{variable}}` syntax.
- No persistent browser cookies, localStorage, or userDataDir per profile.
- No Run History.
- No detailed step logs.
- No output data extraction.
- No screenshot action or automatic error screenshot.
- No recorder or element picker.
- No headless mode.
- No multiple simultaneous runs.

## User Model

The user knows how to get an XPath for page elements and enters it manually into step forms.

Preferred XPath examples:

```text
//*[@id="login-button"]
//*[@name="email"]
//*[@type="password"]
//button[contains(text(), "Login")]
```

The app does not generate selectors in the MVP.

## Product Surface

The MVP has two main screens:

1. Workflow List
2. Workflow Builder

Workflow List supports:

- Create workflow.
- Open workflow.
- Delete workflow.
- Run workflow.

Workflow Builder uses a two-column layout:

- Left side: ordered step list.
- Right side: detail form for the selected step.

The step list supports:

- Add step to the end of the workflow.
- Select step.
- Delete step.
- Reorder steps by drag and drop.

The detail form supports:

- Edit action-specific config.
- Save step.
- Test selected step.
- Delete selected step.

## Workflow Data

Each workflow contains:

- `id`
- `name`
- `created_at`
- `updated_at`
- ordered steps

Each step contains:

- `id`
- `workflow_id`
- `order_index`
- `type`
- `config_json`
- `created_at`
- `updated_at`

Use `config_json` because each action type has a different config shape.

## MVP Actions

### Open URL

Config:

- `url`

Behavior:

- Navigate the browser to the URL.
- Do not wait for page load.
- Continue to the next step immediately after issuing navigation.
- If waiting is needed, the user adds a Sleep step.

### Sleep

Config:

- `seconds`

Behavior:

- Wait for the configured number of seconds.
- Continue to the next step after the wait completes.

### Type Text

Config:

- `xpath`
- `text`

Behavior:

- Find the XPath at the moment the step runs.
- Fail immediately if the element is not found.
- Focus the element.
- Clear existing text.
- Type the configured text.
- Do not auto-wait for the XPath.

### Click

Config:

- `xpath`

Behavior:

- Find the XPath at the moment the step runs.
- Fail immediately if the element is not found.
- Click the element.
- Do not auto-wait for the XPath.

### Scroll

Config:

- `direction`: `up` or `down`
- `pixels`

Behavior:

- Scroll the main page by the configured pixel amount.
- No scroll-to-element support in the MVP.
- No container-specific scroll support in the MVP.

## Runner Behavior

The runner uses Playwright with Chromium.

General behavior:

- Each Test Step opens a new Chromium browser.
- Each Run Workflow opens a new Chromium browser.
- Browser is always headed.
- Browser starts clean for every run.
- Browser remains open after success, failure, or stop.
- User closes the browser manually.
- Only one Test or Run can be active at a time.

There is no auto-wait in the MVP:

- Open URL does not wait for page load.
- Click does not wait for XPath to appear.
- Type Text does not wait for XPath to appear.
- Sleep is the explicit waiting mechanism.

## Test Step

Test Step is a builder command, not a workflow action.

When the user tests step N:

1. Open a new Chromium browser.
2. Run steps 1 through N in order.
3. Stop after step N.
4. Show status as `success`, `failed`, or `stopped`.
5. Keep the browser open.

This makes tests match real workflow execution and avoids depending on a previously opened browser state.

## Run Workflow

Run Workflow executes all steps in order.

Flow:

1. User clicks Run Workflow.
2. App opens a new headed Chromium browser.
3. Runner executes steps from first to last.
4. If all steps pass, status becomes `success`.
5. If a step fails, status becomes `failed`.
6. If the user clicks Stop, status becomes `stopped`.
7. Browser remains open in every final state.

## Stop

When a run is active:

- Disable Test Step.
- Disable Run Workflow.
- Show Stop.

When the user clicks Stop:

- Stop executing further steps.
- Keep the browser open.
- Set status to `stopped`.

## Status And Errors

MVP status values:

```text
idle
running
success
failed
stopped
```

The app only shows the current run status. It does not persist a run history.

On failure, the MVP shows:

- failed step number
- short reason

Examples:

```text
Failed at step 4: XPath not found
Failed at step 2: Invalid URL
Failed at step 5: Browser was closed
```

## Persistence

Use SQLite for local storage. Use migrations from the first version.

Initial schema:

```text
workflows
- id
- name
- created_at
- updated_at

workflow_steps
- id
- workflow_id
- order_index
- type
- config_json
- created_at
- updated_at
```

Indexes:

- `workflow_steps.workflow_id`
- `workflow_steps.workflow_id, workflow_steps.order_index`

Migration requirements:

- Track applied migration versions.
- Create workflow tables in the first migration.
- Keep future schema changes additive where practical.

## Architecture

Recommended stack:

- Electron for desktop shell.
- React for UI.
- Playwright for browser automation.
- Chromium as the MVP browser engine.
- SQLite for local persistence.

Suggested modules:

- `workflowRepository`: CRUD workflows and steps.
- `migrationRunner`: apply SQLite migrations.
- `workflowRunner`: execute Test Step and Run Workflow.
- `actionHandlers`: one handler per action type.
- `runStateStore`: current in-memory run status.
- `WorkflowList`: workflow list UI.
- `WorkflowBuilder`: two-column workflow builder UI.
- `StepForm`: action-specific step config forms.

## Validation

Validate at save time where possible:

- Workflow name is required.
- Step type is required.
- Open URL requires a non-empty URL.
- Sleep seconds must be greater than 0.
- Type Text requires XPath and text.
- Click requires XPath.
- Scroll requires direction and pixels greater than 0.

Runtime validation still exists because XPath and URLs can fail when executed.

## Testing Strategy

Unit tests:

- Action config validation.
- Step ordering and reorder persistence.
- Migration runner.
- Workflow repository CRUD.

Runner tests:

- Run a workflow against a local/static test page.
- Test Step runs from the first step through the selected step.
- Click fails when XPath is missing.
- Type Text clears before typing.
- Sleep delays execution.
- Stop prevents later steps from running.

UI tests:

- Create workflow.
- Add each MVP action type.
- Edit step form.
- Drag and drop reorder.
- Run button disabled while running.
- Stop visible while running.

## Open Decisions Deferred

These are intentionally deferred until after MVP:

- Whether Profile means data profile, browser profile, or account profile.
- Whether variables should be plain values, secrets, or both.
- Whether to support browser session persistence.
- Whether to add Run History before output extraction.
- Whether to add element picker or recorder first.
- Whether to support Chrome/Edge in addition to Playwright Chromium.
