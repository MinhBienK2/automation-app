# Desktop Action Family (v1)

Which actions the Desktop Surface offers, what each promises, and what is deliberately absent. Resolves [#45](https://github.com/MinhBienK2/automation-app/issues/45).

## Naming

Every desktop action is prefixed `desktop_`. Workflows cannot mix surfaces, so the prefix is not needed to disambiguate at run time — it is needed when reading `registry.ts`, a schema directory, or a stack trace, where both families sit side by side. The existing web actions keep their unprefixed names; renaming them would churn every saved workflow for no gain.

## The v1 set

| Action | Owner | Contract |
|---|---|---|
| `desktop_click` | `element_interaction` | Click a resolved target. `button` (left/right/middle) and `count` (single/double). |
| `desktop_set_value` | `form` | Set a control's value directly via UIA, no per-character typing. Preferred over typing wherever the control supports it. |
| `desktop_type_text` | `keyboard` | Type into the focused control. For controls that reject `set_value`. |
| `desktop_press_key` | `keyboard` | A single key, with modifiers. |
| `desktop_hotkey` | `keyboard` | A chord. Separate from `press_key` because chord semantics and failure modes differ. |
| `desktop_read_text` | `capture` | Read a resolved element's text into an output. The bridge into control flow. |
| `desktop_wait_for` | `wait` | Wait until a `verify_state` predicate set holds, or time out. |
| `desktop_screenshot` | `capture` | Capture the bound window. See [secrets and evidence](secrets-and-evidence.md). |
| `desktop_focus_window` | `element_interaction` | Bring the bound window forward. Explicit, because most actions do not need it. |
| `desktop_invoke_menu` | `element_interaction` | Drive a menu path. Menus are a distinct UIA surface; treating them as ordinary clicks is unreliable. |

Ten actions. Enough to express real work, small enough to get the contracts right.

## Every element action carries the same envelope

```ts
type DesktopActionCommon = {
  target: DesktopStepTarget;    // element locator or pixel — see locator-model.md
  verify?: VerifyExpectation;   // what must hold afterwards
  timeout_ms?: number;
};
```

## Success is verified, not reported

The driver's `isError` has been observed both `true` and `false` for the same successful click, once carrying the Win32 success text `"The operation completed successfully. (0x00000000)"`. The runner therefore does not trust it.

`verify_state` accepts one to eight predicates, ANDed. A desktop action succeeds when its verification holds:

- `desktop_click` — default verification is that the window still exists and its tier has not dropped. A caller who knows the expected effect states it.
- `desktop_set_value` and `desktop_type_text` — verify the control now holds the intended value. This one is close to free and catches most silent failures.
- `desktop_read_text` — nothing to verify; reading is the assertion.

Where no meaningful predicate exists, the action records that it could not verify rather than reporting a success it did not confirm. An unverified success is a lie the operator will discover much later.

## Deliberately absent

Recording what was left out, so a later reader does not mistake it for an oversight:

| Not included | Why |
|---|---|
| Navigation (`goto`, back, forward) | No addresses on the Desktop Surface. Windows are reached through Desktop Targets. |
| Cookies, localStorage, sessionStorage | No such concept. |
| Network interception, request blocking, response mocking | Not observable from an accessibility tree. Belongs to the Web Surface. |
| `execute_js` | Nothing to execute against. Not a gap — the absence of an escape hatch is deliberate; it is what makes desktop runs auditable. |
| iframes and frame locators | No analogue. |
| Drag and drop, scroll | Deferred. Both need pointer-path semantics that interact with input isolation in ways not yet measured. |
| `set_viewport` | Window geometry belongs to the Desktop Target, not to a step. |
| Clipboard | Deferred. The clipboard is shared with the operator, who is using the machine concurrently; overwriting it mid-run is a side effect on a person, not just on an app. |

## Reading text is what makes the surface useful

`desktop_read_text` writes a named output exactly like the web capture actions, so `set_variable`, `conditions.ts` and every assertion consume it **without modification**. That is the practical proof of [ADR-0001](../../adr/0001-desktop-execution-surface.md): a desktop step feeds shared control flow with no desktop-specific code above the dispatch layer.

It returns the element's text content, trimmed, as a string. Structured extraction — tables, lists — is deferred until there is a real case; guessing at shapes now would produce a contract nobody wants.

## Waiting

Desktop applications start slowly and have no `waitForLoadState`. "Ready" is expressed as a `verify_state` predicate set — a window exists, a named element is present, a control holds a value — and `desktop_wait_for` polls it until it holds or the timeout expires, honouring the run's `AbortSignal`.

The driver accepts `AbortSignal` on every call, so cancellation needs no new mechanism.

## Registry obligations

`docs/domain/action-taxonomy.md` lists what must stay in sync when an action is added. For desktop actions the list is unchanged, and two entries do real work:

- **Zod schema** in `actions/schemas/desktop/` — `assertSchemaCoverage()` fails the build if one is missing.
- **Executor** in `surfaces/desktop/executors/` — `assertActionExecutorCoverage()` fails the build if one is missing.

Both already exist and already enforce coverage across the whole `ActionType` union, so the desktop family inherits compile-time completeness without new machinery. This is the payoff for keeping one registry rather than two.

## Palette

Desktop actions carry `hiddenFromPalette: false` but are only offered in desktop workflows, and web actions only in web workflows. The filter is the workflow's surface, applied in the palette — not a new capability class.
