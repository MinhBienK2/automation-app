# ADR-0001: Keep the WorkflowRepository facade

Date: 2026-08-22 · Status: Accepted

## Context

`WorkflowRepository` (electron/backend/features/workflows/workflowRepository.ts:44–112) forwards ~20 calls verbatim to `ProjectRepository` and `SubflowRepository`. Applying the deletion test marks it shallow: complexity vanishes rather than reappearing. An architecture review (2026-08-22) proposed absorbing the sub-repositories or deleting the facade.

## Decision

Keep the facade. Callers (the ten `create*Commands` factories wired in `features/index.ts`) get one interface over project/profile/subflow/workflow persistence — leverage worth more than the ~70 forwarded lines cost. We accept the stated price: adding a delegated method touches three places (sub-repository, facade, caller).

Cheap wins are still taken: the three byte-identical private `parseJson<T>` copies hoist to `backend/shared/records.ts`.

## Consequences

- Revisit this decision if a fourth repository joins the facade, or the forwarding block grows past ~120 lines.
- Do not re-suggest deletion/absorption in future architecture reviews without new load-bearing friction (see revisit triggers above).
