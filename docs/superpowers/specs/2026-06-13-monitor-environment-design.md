# Design Spec: Workflow Monitor Environment Integration

Integrating environment variable state monitoring directly into the Workflow Detail Monitor timeline events.

## 1. Problem Statement
Users need to monitor how workflow environment variables evolve and get modified/activated at each step during graph execution. Currently, the Run Monitor only displays step progression, errors, and terminal outputs, making it hard to audit intermediate variable transformations or custom state changes at specific execution nodes.

## 2. Proposed Solution
Implement delta-based environment variable tracking during execution.
- **Backend Trace Enhancement**: Capture changed variable values at the end of each node execution and store them as a key-value delta (`output_values`) inside the chronological `ActionTrace`.
- **Live Progress Updates**: Include intermediate `outputs` and `__action_traces` in the runner progress callbacks to enable real-time tracking during execution.
- **Collapsible Timeline Rows**: Redesign the `RunMonitorDrawer` timeline rows to be expandable. When expanded, show the delta of changed environment variables.
- **Full State Inspection**: Provide a toggle inside the expanded row to show the complete state of all variables at that step (computed via accumulated deltas).

## 3. Data Model Changes

### `ActionTrace` (in [actionTrace.ts](file:///home/minhbien/Documents/automation_app/electron/backend/runtime/actionTrace.ts))
Extend `ActionTrace` to store the values of added or changed variables at that specific trace step:
```typescript
export type ActionTrace = {
  // Existing fields...
  output_summary?: {
    added_keys: string[];
    changed_keys: string[];
    removed_keys: string[];
  };
  output_values?: Record<string, unknown>; // [NEW] Values for added_keys and changed_keys at this step
};
```

Update `summarizeActionEffects` to populate `output_values`:
```typescript
export function summarizeActionEffects(
  runtime: TraceEffectSource,
  outputSnapshot: Map<string, unknown>,
  evidenceStartIndex: number,
) {
  const output_summary = summarizeOutputChanges(outputSnapshot, runtime.outputs);
  // ...
  const output_values: Record<string, unknown> = {};
  if (output_summary) {
    for (const key of [...output_summary.added_keys, ...output_summary.changed_keys]) {
      output_values[key] = runtime.outputs[key];
    }
  }
  return {
    ...(output_summary ? { output_summary } : {}),
    ...(Object.keys(output_values).length > 0 ? { output_values } : {}),
    // ...
  };
}
```

### Live Progress Callback (in [runner.ts](file:///home/minhbien/Documents/automation_app/electron/backend/runtime/runner.ts))
Update `reportProgress` to carry the current outputs (variables) and traces:
```typescript
private reportProgress(runtime: Runtime) {
  runtime.onProgress?.({
    current_step_id: runtime.liveState.current_step_id,
    current_step_number: runtime.liveState.current_step_number,
    completed_step_ids: [...runtime.liveState.completed_step_ids],
    outputs: {
      ...runtime.outputs,
      __action_traces: [...runtime.traces],
    },
  });
}
```

## 4. Frontend Integration

### Reconstructing Variables State at Step $N$
Accumulate deltas in [RunMonitorDrawer.tsx](file:///home/minhbien/Documents/automation_app/src/features/workflows/components/RunMonitorDrawer.tsx):
```typescript
function getVariablesStateAtStep(
  initialVariables: Array<{ name: string; value: string }>,
  traces: any[],
  stepIndex: number
): Record<string, unknown> {
  const state: Record<string, unknown> = {};
  for (const v of initialVariables) {
    if (v.name.trim()) state[v.name] = v.value;
  }
  for (let i = 0; i <= stepIndex; i++) {
    const trace = traces[i];
    if (!trace) continue;
    const summary = trace.output_summary;
    const values = trace.output_values ?? {};
    if (summary) {
      for (const key of summary.added_keys) state[key] = values[key];
      for (const key of summary.changed_keys) state[key] = values[key];
      for (const key of summary.removed_keys) delete state[key];
    }
  }
  return state;
}
```

### UI Components and Layout
- Modify each timeline list item in `RunMonitorDrawer.tsx` to support local expanded/collapsed state (keyed by timeline item `id`).
- When a timeline row is clicked, toggle its expansion and call `onFocusNode(item.nodeId)`.
- When expanded, render:
  - **Delta Section**: Shows added, changed, or removed variables in a clean, color-coded style matching `DESIGN.md`.
    - Added variables: light-green background badge / green text.
    - Changed variables: light-cyan background badge / cyan text. Shows `old_value` and `new_value`.
    - Removed variables: muted text with line-through.
  - **Toggle Action**: A compact link/button "Show all variables" / "Show delta only".
  - **Full State Section**: (visible when "Show all variables" is enabled) Shows all environment variables at that step in alphabetical order, highlighting the modified ones.

### Styles (`src/styles/workflow-panels.css`)
Add responsive, dark-theme styled CSS rules for variable lists, badges, and expand transitions inside the timeline step elements.

## 5. Verification Plan
- **Backend Tests**: Run `npm test -- electron/backend/runtime/runner.test.ts` to ensure traces are populated with `output_values`.
- **Frontend Tests**: Run `npm test -- src/features/workflows/pages/` to ensure the detail page and monitor drawer render and toggle expansion cleanly.
- **Manual Verification**: Run Electron in development mode (`npm run electron:dev`), trigger a run with a `set_variable` action, open the Monitor drawer, click the timeline steps, and verify variables delta and full state are rendered correctly.
