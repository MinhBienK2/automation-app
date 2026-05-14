# Plan 04 - CloakBrowser Runner Parity

Date: 2026-05-09

## Goal

Replace the custom `chromiumoxide` browser execution layer with a
Node/TypeScript runner built on npm `cloakbrowser` and `playwright-core`.

## Scope

- Add dependencies:
  - `electron`
  - `cloakbrowser`
  - `playwright-core`
  - SQLite driver selected during implementation
  - Electron packaging dependencies selected during implementation
- Implement browser launch mapping:
  - headless/headed
  - named profile with `launchPersistentContext`
  - temporary context with cleanup
  - proxy
  - user agent
  - viewport
  - mobile/touch approximations where Playwright supports them
  - geolocation
  - permissions
  - extra headers
  - download path
  - `humanize: true` by default
- Implement action dispatch parity:
  - navigation
  - waits and random waits
  - pointer actions
  - input, keyboard, clipboard, form actions
  - scrolling
  - tab, frame, dialog, download actions
  - screenshots
  - extraction and output storage
  - cookies, storage, headers, permissions, geolocation
  - request/response waits, block request, mock response
  - JavaScript execution
  - manual/challenge checkpoint actions as current product semantics define
- Implement cancellation checks between actions and in long-running waits.
- Implement action traces and failure screenshot capture.
- Implement retained session behavior.

## Out Of Scope

- Batch orchestration, except shared runner APIs needed by a later plan.
- Removing Rust files.
- Production/staging target tests.

## TDD And Checks

- Use `.agents/skills/test-driven-development` before code changes.
- Start with local fixture page runner tests for each action group.
- Add CloakBrowser launch smoke tests that can run in a controlled local
  environment.
- Run:
  - runner unit tests
  - runner integration tests against local fixture pages
  - CloakBrowser launch smoke test
  - command/run service tests
  - `npx tsc --noEmit`

## Docs To Update

- `docs/architecture/runner.md`
- `docs/domain/execution-semantics.md`
- `docs/contracts/run-state.md`
- `docs/domain/user-visible-invariants.md` if visible run behavior changes
- README smoke checklist

## DONE Gate

- CloakBrowser launches successfully from the packaged/dev Electron runtime.
- `humanize` is enabled by default.
- Persistent profiles retain login/session state under Electron app data.
- Temporary contexts are cleaned up according to retention policy.
- All current action groups have Playwright/CloakBrowser implementations or
  documented parity-compatible behavior.
- Runner tests pass against local fixture pages.
- Docs describe CloakBrowser as the execution runtime.
- Changes are committed.
