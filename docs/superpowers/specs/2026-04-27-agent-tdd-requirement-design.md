# Agent TDD Requirement Design

Date: 2026-04-27

## Goal

Make test-first development the default workflow for meaningful code changes in this repository without forcing artificial tests for changes that have no behavior to verify.

## Recommendation

Add a balanced TDD requirement to `AGENTS.md`:

- Agents must use `.agents/skills/test-driven-development` before implementing any feature, bug fix, refactor, or behavior change.
- Agents must add or update a focused failing test first, run it to confirm the expected failure, implement the smallest change, and re-run the focused test plus relevant checks.
- Agents may skip TDD for docs-only, formatting-only, comment-only, generated code, trivial configuration updates, and throwaway prototypes.
- If an agent skips TDD for a code change, it must state the reason clearly in its final response.

This makes TDD mandatory where it protects product behavior: validation, Tauri commands, persistence, runner flow, workflow UI behavior, and Rust/TypeScript contracts.

## Plan Execution Reminder

Also add a short reminder to the implementation plan index under `docs/superpowers/plans/2026-04-27-rust-workflow-automation-mvp-plan.md`:

> Each implementation task that changes behavior must start with the TDD skill and include the RED/GREEN verification in the task notes or final summary.

This keeps the rule visible when agents execute the split MVP mini-plans.

## Non-Goals

- Do not require TDD for every byte-level code edit.
- Do not require tests for pure formatting, comments, docs, generated code, or trivial config changes.
- Do not change the TDD skill itself.
- Do not add new tooling or CI gates in this step.

## Success Criteria

- Agents have a clear default: use TDD for behavior-affecting code changes.
- Exceptions are explicit and narrow.
- The rule is easy to find in `AGENTS.md`.
- Plan execution also reminds agents to use TDD before behavior changes.
