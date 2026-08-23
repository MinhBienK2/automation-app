# Desktop Target

The Desktop Surface counterpart to a Browser Profile: what a workflow drives, and how it gets there. Resolves [#44](https://github.com/MinhBienK2/automation-app/issues/44).

## Where the analogy holds, and where it breaks

A Browser Profile is an identity plus persistent storage: it owns a `profile_dir`, and `BrowserSessionManager` launches the browser against that directory rather than attaching to the operator's everyday Chrome. Logins survive because the profile directory survives.

A Desktop Target launches its application the same way — **launch, never attach to whatever the operator happens to have open**. But the storage half does not transfer:

> Browsers accept `--user-data-dir`. Desktop applications, in general, do not. There is no portable way to give an application a private profile directory.

So a Desktop Target owns **no** persistent storage. The application keeps its state wherever it already keeps it, shared with the operator's own use of that application. This is why the concept is not called a "Desktop Profile" — see [CONTEXT.md](../../../CONTEXT.md#deliberate-non-terms).

**Isolation on the Desktop Surface means input-device isolation only.** The automation does not take over the mouse or keyboard; it does not get a private copy of the application's data. Any claim otherwise would be false.

## Shape

```ts
type DesktopTarget = {
  id: string;
  project_id: string;
  name: string;                       // operator-facing
  launch: DesktopLaunchSpec;
  window: WindowSelector;
  accessibility?: AccessibilityHints; // per-app flags, see below
  observed_tier?: CapabilityTier;     // last probe result, advisory
};

type DesktopLaunchSpec = {
  kind: "app_id" | "executable";
  value: string;                      // "calc" | "C:\\Tools\\ledger.exe"
  args?: string[];
  ready?: ReadyCondition;             // how to know it finished starting
};

type WindowSelector = {
  title?: NameMatch;                  // same matcher as a Desktop Locator name
  ordinal?: number;                   // when several match, 0-based by z-order
};
```

`pid` and `window_id` are **never stored**. They are a Window Binding, resolved per run.

## Launch and binding

```
launch (or reuse a retained app)
  → wait for ready
  → list windows for that pid
  → apply WindowSelector
  → bind (pid, window_id)
```

`launch_app` returns a `windows` array carrying `bounds` and `window_id`, so binding usually needs no second lookup.

Window selection must be **deterministic**, never "whichever one". Rules, in order:

1. Windows belonging to the launched `pid`, on-screen, not minimised.
2. Filter by `WindowSelector.title` if set.
3. If exactly one remains, bind it.
4. If several and `ordinal` is set, take it by z-order.
5. Otherwise **fail** and list what was found, so the operator can add a title match.

Failing beats guessing: binding the wrong window means the workflow types into the wrong place.

## Launch is not clean-slate

Measured: `launch_app({name:"notepad"})` restored the operator's previously open tabs, including unsaved content. The application restored its own session, and nothing about launching prevented it.

So "launch" gives a **fresh process**, not a **fresh state**. Workflows must not assume an application opens empty. Where starting state matters, the workflow asserts it — the same discipline the Web Surface already needs when a profile directory carries cookies.

## Single-instance applications

Many desktop applications refuse a second instance: the launch command hands off to the running process and focuses its existing window. For these, "launch" silently becomes "attach", and the workflow inherits whatever state the operator left behind.

This is detected rather than assumed. If the launch returns a `pid` that was already running before the attempt, the target is single-instance for this run. The run **continues** — attaching is usually what the operator wants for their own applications — but the run records that it attached rather than launched, so a failure caused by inherited state is diagnosable afterwards rather than mysterious.

Refusing to run would be worse: it would exclude a large share of real applications for a purity the Desktop Surface never had.

## Lifecycle and retention

Retention reuses the existing Run Policy rather than inventing a parallel notion:

- **Retain** — leave the application running between runs. Fast, and matches how operators use their own machines.
- **Close** — terminate what this run launched.

`kill_app` enforces provenance: *"standard mode may terminate only a process proven to have been launched by this Cua runtime."* A driver instance cannot terminate a process it did not start. Two consequences: a run can never close an application the operator opened themselves, which is the right default; and a retained application outlives the driver host that launched it, so closing it later needs the same host or falls to the operator.

Attached (single-instance) applications are **never** terminated by a run. The run did not start it and cannot know what else it holds.

## Locking

`RunManager` blocks conflicting runs on the same workflow, profile or batch. The Desktop Surface adds one lock unit: **the Desktop Target**.

The lock is not the whole machine. Two desktop runs against different applications do not contend for the accessibility tree, and serialising all desktop work would make batches useless. It is not narrower than the target either — two runs driving the same application would interleave keystrokes into shared state.

Windows the operator is using are not locked at all. They are not ours to lock, and input isolation is what makes concurrent use safe.

## Accessibility hints

Some applications expose their tree only when asked. Electron needs renderer accessibility enabled; Qt and Java have their own switches. Where the flag is a launch argument, it belongs in `DesktopLaunchSpec.args`. Where it is an environment variable or a runtime toggle, `AccessibilityHints` carries it.

This only works for applications the target launches. An already-running, attached application cannot be retrofitted, which is a further reason single-instance applications tend to sit at a lower [capability tier](capability-tiers.md).
