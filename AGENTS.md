# Agent Instructions

## Product Purpose

Adversarial browser automation lab simulating realistic client bypasses (fingerprints, behavior, timing) on company-owned systems. Identifies abuse detection gaps (fake engagement, rate limits) via auditable test runs (allowlists, test accounts).

## Rules
- Always prefix shell commands with `rtk` and wait up to 5 minutes instead of polling frequently.
- Source files: max **300 lines** (excluding blank lines and comments). Tests and pure data are exempt.
- Use TTD before implementing any feature, bug fix, refactor, or behavior change, MUST use `.agents/skills/test-driven-development`. **Exceptions:** docs-only, formatting-only, comment-only, generated code, trivial config updates, throwaway prototypes.

## graphify
Trigger: Architecture understanding, major planning, or very big changes, or if user requests.
Action: Read @.agents/rules/graphify.md for guidance.
Skip: For small, normal change.

## Verification
For small or isolated changes, run only the relevant focused checks
For complex, big changes and high-risk changes. The appropriate component will be run.
- `rtk npm run lint`
- `rtk npm run test` read 30 last lines
- `rtk npm run build` 
 
## After Changes
Skip this section when no implementation files were changed, including planning, specification, investigation, review, explanation, and verification-only tasks.

- Update the relevant `docs/` detail doc only when the change affects contracts or observable behavior.

