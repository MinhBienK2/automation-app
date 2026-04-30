# Advanced Visual Logic Graph Builder Implementation Plan

## Scope

Implement the approved Advanced Visual Logic Graph Builder spec as a staged feature set. The graph editor becomes the primary authoring surface for visual logic while preserving existing workflow step behavior and runner compatibility.

## Constraints

- Use TDD for every behavior-changing code slice.
- Do not start implementation before all plan files are written and committed.
- Each plan has explicit DONE criteria. Do not proceed to the next plan until the current plan's tests/checks pass.
- Keep existing workflows readable and runnable.
- Do not introduce CAPTCHA bypass, anti-detection evasion, spam automation, or mass account creation features.
- Keep backend validation authoritative; frontend validation may mirror it for UX.

## Plan Order

1. `01-graph-domain-persistence-commands.md`
2. `02-frontend-graph-contracts-api.md`
3. `03-graph-validation-compiler.md`
4. `04-editable-graph-canvas.md`
5. `05-logic-inspector-condition-builder.md`
6. `06-run-graph-timeline-output-inspector.md`
7. `07-docs-final-verification.md`

## Global DONE

- All plan-specific DONE criteria pass.
- Existing workflow list/detail/edit/run behavior remains covered by tests.
- Graph workflows can be created from existing steps, edited visually, saved, validated, compiled to runnable action configs, and run through the existing runner path for supported nodes.
- Advanced nodes that cannot safely execute through the current runner are represented in the graph model and validated with clear blocking messages until their executable semantics are implemented.
- Docs match code for touched areas.
- Final checks include focused frontend tests, focused Rust tests, frontend typecheck, and build-level checks that are practical in the environment.
