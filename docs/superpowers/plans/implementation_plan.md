# Implementation Plan - Fix Graph Editor Nodes, Fields, Validations & UX Issues

This plan addresses all the bugs, logic inconsistencies, and UX gaps identified in the Graph Editor nodes.

## User Review Required

> [!IMPORTANT]
> The fix for the **Switch Node Cases Reordering & Index Shifting Bug** introduces a new, stable ID-based data structure for `switch` cases (`SwitchGraphCase` and `SwitchGraphConfig`) instead of the current simple `string[]` list. 
> To ensure backward compatibility, helper utilities will automatically convert existing workflows' `cases` (which are `string[]`) to the new format upon load/compile. No data loss will occur.

---

## Proposed Changes

### 1. Switch Node Stable Case ID Fix

#### [MODIFY] [workflowGraphOps.ts](file:///home/minhbien/Documents/automation_app/src/types/workflowGraphOps.ts)
- Add new exported types `SwitchGraphCase` and `SwitchGraphConfig`.
```typescript
export type SwitchGraphCase = {
  id: string;
  value: string;
};

export type SwitchGraphConfig = {
  expression: string;
  cases: SwitchGraphCase[];
};
```

#### [MODIFY] [graphNodeConfig.ts](file:///home/minhbien/Documents/automation_app/src/features/workflows/lib/graphNodeConfig.ts)
- Add a new helper `switchConfig(config: unknown): SwitchGraphConfig` to normalize switch node configs (with backward compatibility mapping `string[]` to `SwitchGraphCase[]`).
- Update `switchPortsForCases` to accept `SwitchGraphCase[]` and generate stable port IDs (e.g. `case_${caseValue.id}`) and display actual case values as labels on the canvas.

#### [NEW] [SwitchNodeFields.tsx](file:///home/minhbien/Documents/automation_app/src/features/workflows/components/inspector/SwitchNodeFields.tsx)
- Create a new component `SwitchNodeFields` (similar to `RouterNodeFields`) that renders a table of switch cases with Add/Delete/Move actions, using stable case IDs to ensure canvas connections are preserved during modification.

#### [MODIFY] [WorkflowGraphInspectorFields.tsx](file:///home/minhbien/Documents/automation_app/src/features/workflows/components/WorkflowGraphInspectorFields.tsx)
- Import `SwitchNodeFields` and use it under `case "switch"` instead of the old `Textarea` input.
- Extract any switch-specific logic to keep the file size clean.

#### [MODIFY] [compiler.ts](file:///home/minhbien/Documents/automation_app/electron/backend/graph/compiler.ts)
- Update `case "switch"` to compile cases using `switchConfig(node.config)` and map each case target port to `case_${caseValue.id}` instead of using indices.

#### [MODIFY] [validateNodeSemantics.ts](file:///home/minhbien/Documents/automation_app/electron/backend/graph/validateNodeSemantics.ts)
- Update `case "switch"` validation, `pushStaleSwitchCaseIssues`, and `branchContinuationSemantics` to use the new `SwitchGraphCase` structure.

---

### 2. Variable/Template Validation for Numeric Fields

#### [MODIFY] [validation.ts](file:///home/minhbien/Documents/automation_app/electron/backend/actions/validation.ts)
- Modify number validation helper functions (`zeroOrPositiveInteger`, `positiveValue`, `optionalPositive`, `optionalNonNegative`, `finiteValue`, `percentValue`) to return `null` (allow) if the value is a string matching the variable template pattern (`/^\{\{\s*[^}]+?\s*\}\}$/`).

---

### 3. Loop & Retry Node Variable Inputs

#### [MODIFY] [LoopNodeFields.tsx](file:///home/minhbien/Documents/automation_app/src/features/workflows/components/inspector/LoopNodeFields.tsx)
- Update Loop inspector fields (`repeat_times` and loop guards) to use `VariableNumericInput` instead of standard `<Input type="number" />`, allowing users to toggle and select variables.

#### [MODIFY] [WorkflowGraphInspectorFields.tsx](file:///home/minhbien/Documents/automation_app/src/features/workflows/components/WorkflowGraphInspectorFields.tsx)
- Update `case "retry"` fields (max attempts and delay ms) to use `VariableNumericInput`.

---

## Verification Plan

### Automated Tests
We will write unit tests using TDD to verify the new switch config backward-compatibility, compilation, validation, and number-template validations.
- Run `rtk npm run test` to verify all tests pass.
- Focus on testing:
  - `validation.test.ts` (adding tests for variable templates in numeric validations)
  - `compiler.test.ts` (verifying switch compilation with stable IDs and backward compatibility)
  - `graphNodeConfig.test.ts` (testing switchConfig helper)

### Manual Verification
- Launch the application and test the Switch node on the canvas:
  1. Add a Switch node, enter case values, draw connections to the cases.
  2. Reorder the cases in the inspector and verify the ports/edges on the canvas preserve their logic.
- Test numeric fields:
  1. Set tab index, retry count, or wait delay to a variable using the variable toggle `{}`.
  2. Verify that saving/compiling/running does not trigger a validation error.
