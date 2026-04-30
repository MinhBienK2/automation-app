# Plan 5: Logic Inspector And Condition Builder

## Objective

Make logic nodes usable from the right inspector with structured condition and loop configuration. Users should configure logic through forms, not JSON.

## TDD Slices

1. Add failing tests for condition builder:
   - output equals condition.
   - output contains condition.
   - text visible condition.
   - URL contains condition.
   - element visible condition.
2. Add failing inspector tests:
   - `if` node edits condition.
   - `repeat_times` edits count.
   - `repeat_for_each` edits item name and items.
   - `retry` edits attempts and delay.
   - `manual_approval` and `rate_limit` show safe copy and safe fields.

## Implementation Notes

- Reuse existing `WorkflowCondition` variants first.
- Expose advanced condition source/operator labels in the UI only when there is backing structured data.
- Show unsupported advanced node execution messages as validation issues, not hidden behavior.

## DONE Criteria

- Condition builder tests pass.
- Graph inspector tests pass.
- Logic node edits survive save/reload through graph persistence.
- No user-facing copy suggests CAPTCHA bypass, anti-detection evasion, or spam automation.
