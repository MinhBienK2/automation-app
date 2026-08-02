# Building with Automation App UI

A dark-first **Tailwind v4 + daisyUI v5** kit for an internal browser-automation
desktop app. Surfaces are deep blue-black, the accent is cyan, density is tight
(13px base), and content is operational: workflows, runs, schedules, identities,
browser steps.

## Setup

**No provider is needed for styling.** `styles.css` styles `body` directly
(`background: var(--bg)`, `color: var(--fg-primary)`, `font-family:
var(--font-body)`), so any page that loads it is already on the DS surface — do
not paint your own background to "make it dark".

Two components do need wrapping:

```jsx
<TooltipProvider>            {/* required by Tooltip / TooltipTrigger / TooltipContent */}
  <ToastProvider>            {/* required before calling useToast() */}
    <App />
  </ToastProvider>
</TooltipProvider>
```

**Theme** is three attributes on `<html>`; omit them all for the default
(dark + cyan + normal):
`data-theme="dark|light"`, `data-accent="cyan|teal|purple|orange"`,
`data-density="compact|normal|spacious"`.

## The styling idiom

Three layers, in priority order.

**1. Use a library component.** Reach for `Button`, `Input`, `Select`, `Card`,
`Dialog`, `DataTable`, `Badge`, `StatusBadge`, `EmptyState`, `PageHeader`,
`SectionCard`, `FormField` before styling anything yourself.

**2. Tailwind core utilities for your own layout glue** — `flex`, `grid`,
`gap-3`, `p-4`, `text-xs`, `font-semibold`, `rounded-lg`, `w-full`, `truncate`.
These all work normally.

**3. Colour comes from CSS custom properties, via arbitrary-value syntax.**

> **Important:** this DS has **no** named colour utilities. `bg-surface`,
> `text-fg-primary`, `text-fg-secondary` and `text-fg-muted` appear in some
> older component source but **do not resolve** — no `@theme` block maps them,
> so they compile to nothing. Never write them. Use `var(--token)` in an
> arbitrary value instead, the way `StatusBadge` does:

```jsx
<div className="rounded-lg border p-4"
     style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
  <p className="text-[13px]" style={{ color: 'var(--fg-secondary)' }}>…</p>
</div>
```

| Purpose | Tokens |
|---|---|
| Surfaces | `--bg` `--surface` `--surface-elevated` `--surface-overlay` `--sidebar-bg` |
| Text | `--fg-primary` `--fg-secondary` `--fg-muted` |
| Borders | `--border` `--border-emphasized` `--border-hover` |
| Accent | `--accent` `--accent-bg` `--accent-hover` `--accent-border` `--focus-ring` |
| Status | `--success` `--attention` `--failure` (+ each `-bg`) |
| Radius | `--radius-sm` `--radius-md` `--radius-lg` `--radius-xl` `--radius-full` |
| Spacing | `--space-xxs` … `--space-xl` |
| Type | `--font-display` `--font-body` `--font-mono` |

daisyUI's own semantic utilities also work when you want them: `bg-base-100`
`bg-base-200` `bg-base-300` `text-base-content` `text-primary` `text-secondary`
`text-error`. They are wired to the tokens above, so they follow the theme.

Use `var(--font-mono)` (JetBrains Mono) for ids, selectors, durations and log
output — it carries real meaning in this product.

## Where the truth is

Read these before styling: `_ds/<folder>/styles.css` and its `@import` closure
(the full token set and every daisyUI component rule), and the per-component
`<Name>.prompt.md` + `<Name>.d.ts` for exact props.

## A representative build

```jsx
<SectionCard title="Run policy" description="Applies to every run of this workflow.">
  <div className="flex flex-col gap-4">
    <FormField label="Start URL" htmlFor="url" description="The page each run opens first.">
      <Input id="url" defaultValue="https://portal.internal.example/orders" />
    </FormField>
    <div className="flex items-center justify-between">
      <span style={{ color: 'var(--fg-secondary)' }}>Nightly inventory sync</span>
      <StatusBadge status="running" />
    </div>
    <div className="flex gap-2">
      <Button>Run now</Button>
      <Button variant="secondary">Save draft</Button>
    </div>
  </div>
</SectionCard>
```

`Button` variants are `default | secondary | ghost | destructive` — there is no
`outline`; `secondary` is the outlined one.
