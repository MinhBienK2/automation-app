# Test Step Monitor Design

## Goal

Help users understand and fix workflow steps while building a workflow. The existing `Test Step` command already runs from the first step through the selected step, but the UI only exposes a coarse run status. This feature turns `Test Step` into a guided debugging flow with step progress, clear failure context, and practical suggestions.

## Scope

Implement:

- Editable step names.
- A `Test Step Monitor` popup opened when the user clicks `Test Step`.
- Realtime progress for each step included in the test run.
- Failure details and rule-based suggestions in the popup.
- Focused tests for step naming, monitor state, and error suggestions.

Do not implement:

- Browser recorder.
- Element picker.
- AI-generated suggestions.
- Run history persistence.
- Screenshots or DOM snapshots.
- Event streaming infrastructure.

## Current Behavior

The app currently has:

- A `Test Step` button in the workflow builder.
- A Tauri command `test_step(workflow_id, step_id)`.
- Runner behavior that opens a new headed Chromium browser and executes ordered steps from step 1 through the selected step.
- A final status of `running`, `success`, `failed`, or `stopped`.
- A short failure payload with failed step number, action type, and reason.

This proves the runner path, but it does not show which step is currently running or guide the user toward fixing a failed step.

## Chosen Approach

Use a popup monitor backed by an expanded polled run state.

The frontend already polls `get_run_state` while a run is active. Extend that state so the UI can render progress without introducing Tauri event streaming yet. This keeps the MVP simpler while still giving users useful realtime feedback.

Rejected alternatives:

- A popup that only shows the final result: too limited because the user still cannot track progress.
- Tauri event streaming: cleaner long term, but larger than needed for this iteration.

## Step Names

Each workflow step gets a `name` field.

Creation behavior:

- When a step is created, backend sets `name` to the action label: `Open URL`, `Sleep`, `Type Text`, `Click`, or `Scroll`.
- The user can edit the name in the step detail form.
- If the user saves a blank name, the app falls back to the action label instead of blocking the save.

Display behavior:

- The step list uses `step.name` as the main label.
- The action type remains visible as secondary metadata.
- The monitor timeline uses `step.name` as the primary label.
- Failure messages include the step name when available.

Example names:

```text
Open login page
Wait for form
Type email
Click login button
```

## Test Step Monitor UX

When the user clicks `Test Step`:

1. Open the monitor popup immediately.
2. Start the existing `test_step` flow.
3. Show only the steps that will run: step 1 through the selected step.
4. Keep polling `get_run_state` while the run is active.
5. Update the monitor until status becomes `success`, `failed`, or `stopped`.

The popup has two areas.

Left side: `Step Progress`

- Shows steps `1..selectedStep`.
- Primary text: step name.
- Secondary text: action label.
- Status per step: `Pending`, `Running`, `Passed`, or `Failed`.
- The currently running step is highlighted.
- A failed step is marked failed and later steps remain pending.

Right side: `Step Detail`

- While running: show the current step name, action type, and summarized config.
- On success: show that the test completed through the selected step.
- On failure: show failed step name, step number, reason, and suggestions.
- On stopped: show that the test was stopped and the browser remains open.

The existing Chromium behavior stays the same: a new headed browser opens for each test and remains open after success, failure, or stop.

## Run State Data

Extend the run state returned by `get_run_state` so the UI can render monitor progress.

Recommended shape:

```text
status: idle | running | success | failed | stopped
mode: none | run_workflow | test_step
target_step_id: string | null
current_step_id: string | null
current_step_number: number | null
completed_step_ids: string[]
error: {
  step_id: string | null
  step_number: number
  step_name: string | null
  action_type: string
  reason: string
} | null
```

During a test run:

- Before executing a step, set `current_step_id` and `current_step_number`.
- After a step succeeds, append its id to `completed_step_ids`.
- If a step fails, set status to `failed`, populate `error`, and keep the browser session open.
- If the selected step succeeds, set status to `success`.

For full workflow runs, the same progress fields may be populated, but the monitor only opens for `test_step` in this feature.

## Error Suggestions

Suggestions are rule-based and derived from the failure reason plus action type.

Initial rules:

```text
XPath not found
-> Check the XPath in the Chromium window that remains open.
-> If the element loads slowly, add a Sleep step before this step.
-> Prefer XPath based on id, name, placeholder, text, or stable attributes.
-> Avoid absolute XPath such as /html/body/div[2]/...

Element cannot receive text
-> Make sure the XPath points to an input, textarea, or editable element.
-> Check whether the XPath points to a label, div, button, or wrapper instead of the field.

Invalid URL / URL is required
-> Use a full URL with http:// or https://.
-> Check for extra whitespace or missing characters.

Seconds must be greater than 0
-> Use a Sleep value greater than 0.
-> Try 0.5, 1, or 2 seconds depending on page speed.

Pixels must be greater than 0
-> Use a Scroll pixels value greater than 0.
-> Try 300 to 800 pixels for a single scroll.

Browser or runner error
-> Close old test browsers and try again.
-> Check that Chrome or Chromium can start on this machine.
```

Suggestions appear in the monitor only after failure. The normal step detail panel stays focused on editing.

## Validation And Persistence

Database:

- Add a migration for `workflow_steps.name`.
- Backfill existing steps with their action label.

Rust domain:

- Add `name` to `WorkflowStep`.
- Preserve `Serialize` and `Deserialize` compatibility with frontend types.
- Normalize blank names to the action label when creating or updating a step.

Commands:

- Extend `update_step` so step name and config are saved together.
- Keep command-facing errors serializable through `CommandError`.

Frontend:

- Add `name` to the TypeScript `WorkflowStep` type.
- Add a `Step name` input to `StepForm`.
- Render step name in the list and monitor.

## Error Handling

- If `test_step` fails to start, keep the popup open and show the command error in the detail area.
- If another run is already active, show the existing one-active-run error.
- If the selected step is deleted or missing before start, close the monitor and show `Step not found`.
- If polling fails, show the polling error without discarding the last known progress.

## Testing

Frontend tests:

- Step detail shows and saves `Step name`.
- Blank step name falls back to the action label after save/reload.
- Clicking `Test Step` opens the monitor.
- Monitor renders the included step range from step 1 through selected step.
- Monitor shows pending, running, passed, and failed states from run state.
- `XPath not found` renders the XPath suggestions.

Rust tests:

- Creating a step sets the default name from action type.
- Updating a blank step name falls back to the action label.
- `test_step` sets run mode and target step id.
- Runner progress marks current and completed steps.
- Failure state includes failed step id, number, name, action type, and reason.

Checks:

```text
npm test -- src/App.test.tsx
npx tsc --noEmit
cd src-tauri && cargo test --test command_api
cd src-tauri && cargo test
```

## Design Notes

This is a UI-facing workflow change. Implementation must consult `DESIGN.md` before modifying `src/App.css`, layout structure, or user-facing styling. The popup should preserve the existing Supabase-inspired dark theme, use restrained borders and surfaces, and keep the builder dense and work-focused.
