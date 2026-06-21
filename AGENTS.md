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

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **tik-automation** (5539 symbols, 14912 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "main"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `query({search_query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit changes without running `detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/tik-automation/context` | Codebase overview, check index freshness |
| `gitnexus://repo/tik-automation/clusters` | All functional areas |
| `gitnexus://repo/tik-automation/processes` | All execution flows |
| `gitnexus://repo/tik-automation/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
