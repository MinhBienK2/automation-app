# Design Spec: Evaluate Logic Node

This specification defines the implementation of a new Action Node type `evaluate_logic` (Evaluate Logic) to provide a centralized, powerful, and flexible logic evaluation mechanism. It addresses the limitations of the current simple `WorkflowCondition` (which only supports basic "equals" checks) by introducing both a Visual Rule Builder (with nested AND/OR operators, variable comparisons, element state checks, and URL checks) and a JavaScript evaluation mode.

## Proposed Changes

### 1. Types & Schema
We will add `evaluate_logic` as a first-class Action type in the workflow domain.

#### [MODIFY] [workflowCore.ts](file:///home/minhbien/Documents/automation_app/src/types/workflowCore.ts)
Add `"evaluate_logic"` to `ActionType` and define its config types:
```typescript
export type ActionType =
  // ... existing types ...
  | "evaluate_logic";

export type EvaluateLogicConfig = {
  output_name: string;
  mode: "visual" | "script";
  script?: string;
  rules_group?: LogicRuleGroup;
};

export type LogicRuleGroup = {
  operator: "and" | "or";
  rules: Array<LogicRule | LogicRuleGroup>;
};

export type LogicRule = {
  type: "value_compare" | "element_state" | "url_check";
  
  // value_compare
  left_operand?: string;
  comparison?:
    | "equals"
    | "not_equals"
    | "contains"
    | "not_contains"
    | "greater_than"
    | "less_than"
    | "greater_than_or_equals"
    | "less_than_or_equals"
    | "is_empty"
    | "is_not_empty"
    | "matches_regex";
  right_operand?: string;

  // element_state
  element_source?: "xpath" | "ref";
  xpath?: string;
  target_ref?: string;
  element_property?:
    | "visible"
    | "hidden"
    | "enabled"
    | "disabled"
    | "checked"
    | "unchecked";

  // url_check
  url_comparison?: "contains" | "not_contains" | "matches_regex";
  url_value?: string;
};
```

#### [MODIFY] [workflowGraphOps.ts](file:///home/minhbien/Documents/automation_app/src/types/workflowGraphOps.ts)
Add `"evaluate_logic"` to `GraphNodeType`.

### 2. Frontend UI
We will implement the Inspector sidebar panel for `evaluate_logic`.

#### [MODIFY] [WorkflowGraphPalettes.tsx](file:///home/minhbien/Documents/automation_app/src/features/workflows/components/WorkflowGraphPalettes.tsx)
Add `"evaluate_logic"` to the "Variables & Logic" node groups.

#### [NEW] [WorkflowGraphEvaluateLogicFields.tsx](file:///home/minhbien/Documents/automation_app/src/features/workflows/components/WorkflowGraphEvaluateLogicFields.tsx)
Create a new file containing the configuration UI components:
- An input for the output variable name.
- A mode switcher (SegmentedControl/Tabs) for Visual vs. Script.
- The rule builder UI for Visual mode supporting nested OR/AND rules and adding/deleting conditions.
- A Textarea for Script mode with syntax guidelines.

#### [MODIFY] [WorkflowGraphInspectorFields.tsx](file:///home/minhbien/Documents/automation_app/src/features/workflows/components/WorkflowGraphInspectorFields.tsx)
Delegate rendering of `evaluate_logic` config to the new `WorkflowGraphEvaluateLogicFields` component.

#### [MODIFY] [workflowGraph.ts](file:///home/minhbien/Documents/automation_app/src/features/workflows/lib/workflowGraph.ts)
- Add port definition case for `evaluate_logic` (standard sequential flow, single input and output port `"out"`).
- Define default configs and labels for the node.

### 3. Compiler & Backend Execution
We will translate the node to serializable steps and execute them in the Playwright environment.

#### [MODIFY] [compiler.ts](file:///home/minhbien/Documents/automation_app/electron/backend/graph/compiler.ts)
Compile `"evaluate_logic"` node:
```typescript
case "evaluate_logic":
  steps.push(step(node, {
    type: "evaluate_logic",
    config: {
      output_name: requiredString(node.config, "output_name", "Output variable name is required"),
      mode: stringField(node.config, "mode") === "script" ? "script" : "visual",
      script: stringField(node.config, "script"),
      rules_group: objectField(node.config, "rules_group"),
    },
  }, options));
  compileContinuation(graph, node.id, "out", visited, steps, options);
  break;
```

#### [MODIFY] [registry.ts](file:///home/minhbien/Documents/automation_app/electron/backend/actions/registry.ts)
Register `"evaluate_logic"` under the `"variables"` owner:
```typescript
definition("evaluate_logic", "variables")
```

#### [MODIFY] [validation.ts](file:///home/minhbien/Documents/automation_app/electron/backend/actions/validation.ts)
Add schema validation for the `evaluate_logic` action configurations.

#### [MODIFY] [runnerActionExecutors.ts](file:///home/minhbien/Documents/automation_app/electron/backend/runtime/runnerActionExecutors.ts)
Implement executor for `evaluate_logic`:
- In JS mode, evaluate the script inside Playwright `page.evaluate`, passing `runtime.outputs` so the script can access both the workflow outputs and the page environment.
- In Visual mode, evaluate `rules_group` recursively against outputs, element properties, and URL.

---

## Verification Plan

### Automated Tests
- Unit tests for the compiler output in `electron/backend/graph/compiler.test.ts`.
- Unit tests for logic evaluation logic in `electron/backend/runtime/runnerActionExecutors.test.ts`.
- Node component rendering tests in `src/features/workflows/components/WorkflowGraphInspectorFields.test.tsx`.
- Integration and regression checks using `rtk npm run test`.
