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
| `desktop_scroll` | `element_interaction` | Scroll at a target (element or pixel), `direction` up/down/left/right, `by` line/page, `amount`. An element resolves to the centre of its frame. |
| `desktop_drag` | `element_interaction` | Drag from a source target to a destination target; either end may be an element (resolved to its frame centre) or a pixel. |
| `desktop_read_clipboard` | `capture` | Read the operator's clipboard text into an output. |
| `desktop_set_clipboard` | `form` | Place text on the operator's clipboard. Confirmed by reading it back. |
| `desktop_read_table` | `capture` | Structured read: flatten the subtree under a resolved element into rows of cell strings. Covers the `read_text` gap of one element at a time. |

Fifteen actions. The first ten were enough to express real work; the five added on top close the gaps real applications hit first — a list that will not fit on screen, a control reached only by dragging, copy/paste, and reading a grid rather than a single label. Each was verified against the real driver in `scripts/desktop-smoke.mjs` before it was wrapped.

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
| `set_viewport` | Window geometry belongs to the Desktop Target, not to a step. |

Scroll, drag and clipboard have since graduated out of this list — `scripts/desktop-smoke.mjs` measured the pointer-path and clipboard tools working under input isolation, so the "not yet measured" reason no longer holds ([#58](https://github.com/MinhBienK2/automation-app/issues/58), [#59](https://github.com/MinhBienK2/automation-app/issues/59), [#60](https://github.com/MinhBienK2/automation-app/issues/60)). `desktop_read_table` ([#61](https://github.com/MinhBienK2/automation-app/issues/61)) covers the one-element limit of `read_text`. The clipboard's shared-with-the-operator hazard did not go away with the deferral; it is handled by policy now — see below.

## Reading text is what makes the surface useful

`desktop_read_text` writes a named output exactly like the web capture actions, so `set_variable`, `conditions.ts` and every assertion consume it **without modification**. That is the practical proof of [ADR-0001](../../adr/0001-desktop-execution-surface.md): a desktop step feeds shared control flow with no desktop-specific code above the dispatch layer.

It returns the element's text content, trimmed, as a string. Structured extraction — tables, lists — is now `desktop_read_table`: it flattens the subtree under a resolved element into rows of cell strings (a row's children are its cells; a childless row contributes its own text). Deliberately generic rather than UIA-table-aware, because the tree does not reliably carry a table schema and guessing one would produce a contract nobody wants.

## Two isolation classes — measured, not assumed

Input-device isolation is the core requirement (constraint #2), and the fifteen
actions do **not** all honour it equally. `scripts/desktop-isolation-check.mjs`
measured this live on Windows 11, and the split is real:

| Class | Actions | Mechanism (measured) | Touches the operator's mouse/keyboard? |
|---|---|---|---|
| **Isolated** | `click`, `set_value`, `type_text`, `press_key`, `hotkey`, `read_text`, `read_table`, `invoke_menu`, `wait_for`, `focus_window` | UIA — `click` delivers `delivery.mode: "background"`, `set_value` reports `route: "accessibility"`; `get_cursor_position` is **locked** in the window-scope session the runner uses, so automation cannot even read the pointer | **No.** Safe to run while the operator uses the machine. |
| **Not isolated** | `scroll`, `drag`, `hover` | Synthetic input — `move_cursor` reported `route: "global_input"` and moved the real pointer by exactly the requested delta ((120,90) in the probe); `scroll` drives a real `SendInput` wheel | **Yes.** They move the real pointer / wheel. |

This is not a defect to fix so much as a property to expose: `cua-driver` offers
no UIA-pattern scroll or drag, only coordinate synthetic input, so these three
cannot be isolated the way the UIA family is. They earn their place — a list
that will not scroll otherwise is worse than a scroll that moves the pointer —
but a workflow that runs them is briefly taking over the operator's mouse, and
that belongs in the operator's awareness, not buried. Prefer the isolated family
wherever it expresses the work; reach for the pointer tools only when nothing
else can.

## The clipboard is shared with the operator

`desktop_read_clipboard` and `desktop_set_clipboard` exist, but the hazard that kept them out of v1 is real: a desktop run happens while the operator is using the machine, and their clipboard is live state that belongs to them. A read is side-effect-free. A `set` overwrites whatever they had copied, so it is never implicit — it is an action the workflow author chooses on purpose, and it confirms itself by reading the value back rather than trusting the driver's own answer.

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
