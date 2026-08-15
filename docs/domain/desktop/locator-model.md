# Desktop Locator Model

How a desktop step names an element so it still finds the same one tomorrow. Resolves [#43](https://github.com/MinhBienK2/automation-app/issues/43).

## Why the driver's own address cannot be stored

`cua-driver` returns elements like this:

```json
{"depth":4,"element_index":27,"element_token":"s00000001:27","enabled":true,
 "frame":{"h":63,"w":97,"x":4,"y":405},"label":"Seven","role":"Button","parent_index":1}
```

`element_token` is `<snapshot_id>:<index>`. Both parts are **per-snapshot**: every `get_window_state` mints a new `snapshot_id`, and the index is a position in that walk. A stored token is meaningless on the next run, and the driver rejects a bare index outright:

> *"bare element_index is not accepted in Cua Driver 0.17; pass element_token or snapshot_id with element_index"*

So the driver's address is a **runtime handle**, and the authored workflow needs a **durable description** that resolves to one.

## Shape

```ts
type DesktopLocator = {
  role: string;                    // "Button", "Edit", "TabItem" — from the tree
  name?: NameMatch;                // the element's label
  ancestors?: AncestorStep[];      // nearest-first, named ancestors only
  ordinal?: number;                // disambiguate identical siblings, 0-based
  automationId?: string;           // UIA AutomationId when present — most stable
};

type NameMatch =
  | { kind: "exact"; value: string }
  | { kind: "prefix"; value: string }
  | { kind: "pattern"; value: string };   // anchored regex

type AncestorStep = { role: string; name?: NameMatch };
```

A locator reads as a path: `Window "Calculator" › Group "Number pad" › Button "Seven"`.

## Resolution

Against a fresh Element Snapshot:

1. Filter to elements whose `role` matches.
2. If `automationId` is set and matches, take it — done. It is the most stable identifier available and skips the rest.
3. Apply `name` per its match kind.
4. Walk `ancestors` nearest-first using `parent_index`, requiring each step to match some ancestor in order. Intermediate unnamed containers are skipped, not required.
5. If exactly one survives, resolve to its `element_token`. If several and `ordinal` is set, take that one. If several and no `ordinal`, **fail** — never silently take the first.

Then act immediately: the token is only valid for that snapshot.

## Why ancestry is nearest-first and name-bearing only

The full root-to-element path is available — `parent_index` gives real ancestry rather than the guess `depth` alone would allow — and it is the wrong thing to store. Every intermediate layout container becomes a dependency, so a cosmetic regrouping breaks a locator that should not care.

Storing only **named** ancestors, nearest-first, keeps what identifies the element (which tab, which dialog, which pane) and discards what merely positions it. Two named ancestors is almost always enough; the resolver requires them in order but tolerates anything between them.

## Failure is loud

Ambiguity fails. Two matching buttons means the locator is under-specified, and picking one at random converts an authoring bug into a workflow that does the wrong thing on some runs and not others.

The three failures are distinct because they need different fixes:

| Failure | Meaning | Fix |
|---|---|---|
| No match, tier is Element | The element is gone or renamed | Re-author the step |
| No match, tier is Pixel | The window lost its accessibility tree | See [capability tiers](capability-tiers.md) — not a locator problem |
| Several matches | Locator under-specified | Add an ancestor or an ordinal |

Conflating the first two wastes the operator's time on the wrong repair.

## `ordinal` is a last resort

It is positional, so it breaks when items are added or reordered — exactly the fragility the model exists to avoid. The authoring UI offers an ancestor first and only falls back to an ordinal when ancestry cannot disambiguate, marking the step so the weakness is visible.

## Pixel addressing is a separate kind, not a field

```ts
type DesktopStepTarget =
  | { kind: "element"; locator: DesktopLocator }
  | { kind: "pixel"; x: number; y: number; origin: "window" };
```

Named `DesktopStepTarget`, not `DesktopTarget`: [CONTEXT.md](../../../CONTEXT.md) reserves *Desktop Target* for the project-owned application description in [desktop-target.md](desktop-target.md). What a step points at and what a workflow drives are different things, and one name for both would resolve to the wrong one in half the places it is read.

A discriminated union rather than optional coordinates on `DesktopLocator`, because the two carry different reliability contracts and the type should not let a step be quietly half-specified. Coordinates are **window-relative** — screen-relative coordinates break when the window moves, which is not a failure worth inheriting.

Choosing `kind: "pixel"` is deliberate and marked in the graph. See [capability tiers](capability-tiers.md#the-pixel-tier-is-opt-in-per-step).

## Relationship to the web locator model

Deliberately parallel to `ActionTargetConfig` and `targetResolver.ts`: several ways to identify a target, ranking when several match, an explicit resolution step. Operators who know the web side should recognise the shape.

Deliberately **not** shared code. A web locator resolves against a DOM with CSS, XPath and ARIA roles; a desktop locator resolves against a UIA tree with control types and an ancestor chain. A common abstraction over both would be a union with no shared behaviour — the same mistake [ADR-0001](../../adr/0001-desktop-execution-surface.md) forbids for the driver.

## Authoring

The operator does not hand-write these. Recording is out of scope for this effort, so authoring needs an **element picker**: snapshot the window, present the tree, let the operator choose, and generate the most stable locator that uniquely identifies it — preferring `automationId`, then name plus ancestry, then an ordinal, showing which one it settled on and why.

Locator resolution and the picker are the same algorithm run in opposite directions. Build them together or they will disagree.

### How it is built

`surfaces/desktop/picker.ts`, beside the resolver, and three things keep the two halves one model:

- **Every suggestion is resolved before it is returned.** `suggestDesktopLocator` ends by calling `resolveDesktopLocator` on what it just wrote and checking it comes back to the same element. A disagreement is a bug in the picker, but the operator finds out in the dialog rather than on a run three weeks later.
- **The suggestion is computed in the backend, for every element, up front.** The renderer displays a locator and never composes one. Writing the algorithm twice — once to resolve, once to author — is precisely how the two drift apart. The cost is quadratic in the tree; a 410-element File Explorer window is the largest measured, and it is nothing next to the launch that produced it.
- **`ancestry` means the chain did the narrowing.** A locator that carries ancestors it never needed matched by name, and recording it as ancestry would hide the day the name stops being unique.

Authoring launches the application, reads one snapshot, and closes it again (`surfaces/desktop/inspector.ts`). There is no way around the launch: a Desktop Locator resolves against a live tree, and there is no live tree until something is running. The tree is redacted on the way out — `PickerElement` has no `value` field, because a `Document`'s value is the operator's whole open file, and no `element_token`, because it has expired by the time anyone clicks.

A picking session takes the same Desktop Target lock a run does. It drives the application, and a picker that launched, snapshotted and then closed an application mid-run would be worse than a refusal.
