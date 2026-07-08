# Migration to daisyUI 5 — Full UI Library Cleanup

Replace the current shadcn/Radix UI component layer with daisyUI 5 class names. Remove all redundant UI dependencies. All UI must use daisyUI components + Tailwind CSS utilities exclusively.

## Current State Analysis

### Libraries to REMOVE

| Package | Type | Used In | Purpose |
|---------|------|---------|---------|
| `@radix-ui/react-dialog` | dep | [dialog.tsx](file:///home/minhbien/Documents/automation_app/src/components/ui/dialog.tsx) → 20 consumers | Modal/dialog primitive |
| `@radix-ui/react-dropdown-menu` | dep | [dropdown-menu.tsx](file:///home/minhbien/Documents/automation_app/src/components/ui/dropdown-menu.tsx) → 1 consumer | Dropdown menus |
| `@radix-ui/react-label` | dep | [label.tsx](file:///home/minhbien/Documents/automation_app/src/components/ui/label.tsx) → 32 consumers | Label primitive |
| `@radix-ui/react-scroll-area` | dep | [scroll-area.tsx](file:///home/minhbien/Documents/automation_app/src/components/ui/scroll-area.tsx) → 2 consumers | Custom scrollbars |
| `@radix-ui/react-slot` | dep | [button.tsx](file:///home/minhbien/Documents/automation_app/src/components/ui/button.tsx) → 38 consumers | Slot composition |
| `@radix-ui/react-tooltip` | dep | [tooltip.tsx](file:///home/minhbien/Documents/automation_app/src/components/ui/tooltip.tsx) → used via IconButton (9) | Tooltip primitive |
| `class-variance-authority` | dep | [button.tsx](file:///home/minhbien/Documents/automation_app/src/components/ui/button.tsx), [badge.tsx](file:///home/minhbien/Documents/automation_app/src/components/ui/badge.tsx) | Variant class builder |
| `clsx` | dep | [utils.ts](file:///home/minhbien/Documents/automation_app/src/lib/utils.ts) only | Class merging |
| `tailwind-merge` | dep | [utils.ts](file:///home/minhbien/Documents/automation_app/src/lib/utils.ts) only | Tailwind class dedup |

> [!IMPORTANT]
> `lucide-react` is an **icon library**, not a UI component library. It provides SVG icons used across ~35 files and does **NOT** conflict with daisyUI. **Recommend keeping it.**

### Libraries to KEEP

| Package | Reason |
|---------|--------|
| `daisyui` | Target UI library |
| `tailwindcss` + `@tailwindcss/vite` | CSS framework (required by daisyUI 5) |
| `lucide-react` | Icon library — no daisyUI equivalent, no conflict |
| `@xyflow/react` | Graph/flow editor — specialized, not a UI kit |

---

## User Review Required

> [!IMPORTANT]
> ### Theme System Decision
> The current codebase has a sophisticated custom theme system in [base.css](file:///home/minhbien/Documents/automation_app/src/styles/base.css) with:
> - **2 themes**: Dark (default) + Light (`data-theme="light"`)
> - **4 accent colors**: Cyan, Teal, Purple, Orange (`data-accent="..."`)
> - **3 density levels**: Compact, Normal, Spacious (`data-density="..."`)
> - **~30 custom CSS variables** (`--app-*`, `--bg`, `--surface`, etc.)
>
> daisyUI has its own theme system with built-in themes (dark, light, etc.) and custom theme support via `@plugin "daisyui/theme"`. 
>
> **Options:**
> 1. **Map to daisyUI themes** — Create 2 custom daisyUI themes (`automation-dark`, `automation-light`) with 4 accent variations each (8 themes total). Use `data-theme` attribute. Density stays as custom CSS.
> 2. **Use built-in daisyUI themes** — Pick from daisyUI built-in themes (e.g., `dark`, `night`, `business`). Simpler but loses the current brand identity.
> 3. **Hybrid** — Use daisyUI theme for base colors but keep `--app-*` accent overrides for the 4-accent system. Most flexible but more complex.

> [!WARNING]
> ### Breaking Changes
> - The `cn()` utility ([utils.ts](file:///home/minhbien/Documents/automation_app/src/lib/utils.ts)) will be **deleted**. It's only used inside the `src/components/ui/` wrappers which are all being rewritten.
> - All component APIs from `src/components/ui/` will change. Components like `<Dialog>`, `<Button variant="ghost">` etc. will use daisyUI class names directly instead of React component wrappers.
> - The `asChild` pattern (from Radix `Slot`) will be removed entirely. Any consumer using `<Button asChild>` needs refactoring.

## Open Questions

> [!IMPORTANT]
> 1. **Accent system**: Do you want to keep the 4-accent-color system (cyan/teal/purple/orange) or simplify to a single brand color via daisyUI's `primary`?
> 2. **Wrapper components vs. direct classes**: Should we keep thin React wrapper components (e.g., a `<DaisyButton>` component) for consistency, or use daisyUI classes directly on `<button className="btn">` everywhere?
> 3. **Density system**: daisyUI has size variants (`btn-xs`, `btn-sm`, etc.) but no global density toggle. Keep the custom density system or drop it?

---

## Proposed Changes

### Phase 0 — Foundation: Activate daisyUI + Custom Themes

#### [MODIFY] [App.css](file:///home/minhbien/Documents/automation_app/src/App.css)
Add `@plugin "daisyui"` and custom theme definitions. The `@import "tailwindcss"` already exists.

```css
@import "tailwindcss";
@plugin "daisyui" {
  themes: automation-dark --default, automation-light;
  logs: false;
}
@plugin "daisyui/theme" {
  name: "automation-dark";
  default: true;
  prefersdark: true;
  color-scheme: dark;
  /* Map current --bg/#0b1016, --surface/#121c26, etc. to daisyUI color vars */
  --color-base-100: #0b1016;
  --color-base-200: #121c26;
  --color-base-300: #172431;
  --color-base-content: #e7eef5;
  --color-primary: #32d3e6;  /* current --accent cyan */
  --color-primary-content: #0b1016;
  --color-secondary: #9aaebd;
  --color-secondary-content: #0b1016;
  --color-neutral: #233240;
  --color-neutral-content: #e7eef5;
  --color-info: #32d3e6;
  --color-success: #39d98a;
  --color-warning: #f4b740;
  --color-error: #f06467;
  /* ... content colors + radius/border/depth */
}
```

---

### Phase 1 — Rewrite `src/components/ui/` (16 files)

Every shadcn/Radix wrapper gets replaced with a daisyUI-native equivalent (either pure daisyUI class names or a minimal wrapper using daisyUI classes).

#### [MODIFY] [button.tsx](file:///home/minhbien/Documents/automation_app/src/components/ui/button.tsx)
**Before**: Radix Slot + CVA + `cn()` with custom CSS vars  
**After**: `<button className="btn">` with daisyUI variants

| Current variant | daisyUI mapping |
|----------------|-----------------|
| `default` | `btn` (default) |
| `secondary` | `btn btn-ghost` or `btn btn-outline` |
| `ghost` | `btn btn-ghost` |
| `destructive` | `btn btn-error` |
| `size: sm` | `btn btn-sm` |
| `size: lg` | `btn btn-lg` |
| `size: icon` | `btn btn-square btn-sm` |
| `loading` | `btn` + `<span className="loading loading-spinner">` |

> Remove: `@radix-ui/react-slot`, `class-variance-authority`, `cn()` import

#### [MODIFY] [dialog.tsx](file:///home/minhbien/Documents/automation_app/src/components/ui/dialog.tsx)
**Before**: Radix Dialog primitives (Root, Portal, Overlay, Content, Close, Title, Description)  
**After**: daisyUI `modal` component

```jsx
// daisyUI modal pattern
<dialog className="modal" open={open}>
  <div className="modal-box">
    <h3 className="font-bold text-lg">{title}</h3>
    <p>{description}</p>
    <div className="modal-action">{footer}</div>
    <form method="dialog">
      <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
    </form>
  </div>
  <form method="dialog" className="modal-backdrop"><button>close</button></form>
</dialog>
```

> Keep the same export API names (`Dialog`, `DialogContent`, `DialogTitle`, etc.) as thin wrappers so 20 consumers don't need interface changes.

#### [MODIFY] [dropdown-menu.tsx](file:///home/minhbien/Documents/automation_app/src/components/ui/dropdown-menu.tsx)
**Before**: Radix DropdownMenu primitives  
**After**: daisyUI `dropdown` + `menu` component

```jsx
<div className="dropdown">
  <div tabIndex={0} role="button" className="btn">{trigger}</div>
  <ul tabIndex={0} className="dropdown-content menu bg-base-200 rounded-box z-10 w-52 p-2 shadow-sm">
    <li><a>Item 1</a></li>
  </ul>
</div>
```

#### [MODIFY] [tooltip.tsx](file:///home/minhbien/Documents/automation_app/src/components/ui/tooltip.tsx)
**Before**: Radix Tooltip primitives  
**After**: daisyUI `tooltip` class

```jsx
<div className="tooltip" data-tip="tooltip text">
  {children}
</div>
```

#### [MODIFY] [scroll-area.tsx](file:///home/minhbien/Documents/automation_app/src/components/ui/scroll-area.tsx)
**Before**: Radix ScrollArea  
**After**: Plain `overflow-auto` with Tailwind utilities (daisyUI has no scroll area component; CSS scrollbar styles in `base.css` already handle styling)

#### [MODIFY] [label.tsx](file:///home/minhbien/Documents/automation_app/src/components/ui/label.tsx)
**Before**: Radix Label primitive  
**After**: Plain `<label>` with daisyUI fieldset/label classes or Tailwind utilities

#### [MODIFY] [badge.tsx](file:///home/minhbien/Documents/automation_app/src/components/ui/badge.tsx)
**Before**: CVA-based Badge  
**After**: daisyUI `badge` component

| Current variant | daisyUI mapping |
|----------------|-----------------|
| `default` | `badge badge-primary badge-outline` |
| `secondary` | `badge badge-ghost` |
| `destructive` | `badge badge-error` |
| `outline` | `badge badge-outline` |
| `success` | `badge badge-success` |
| `attention` | `badge badge-warning` |
| `failure` | `badge badge-error` |
| `running` | `badge badge-info` |

#### [MODIFY] [card.tsx](file:///home/minhbien/Documents/automation_app/src/components/ui/card.tsx)
**Before**: Custom Card with `cn()` and CSS vars  
**After**: daisyUI `card` component

```jsx
<div className="card card-border bg-base-100">
  <div className="card-body">
    <h2 className="card-title">{title}</h2>
    {children}
  </div>
</div>
```

#### [MODIFY] [input.tsx](file:///home/minhbien/Documents/automation_app/src/components/ui/input.tsx)
**Before**: Custom styled `<input>` with `cn()`  
**After**: daisyUI `input` class

```jsx
<input className="input input-bordered w-full" />
```

#### [MODIFY] [select.tsx](file:///home/minhbien/Documents/automation_app/src/components/ui/select.tsx)
**Before**: Custom styled `<select>` with `cn()`  
**After**: daisyUI `select` class

```jsx
<select className="select select-bordered w-full">{children}</select>
```

#### [MODIFY] [textarea.tsx](file:///home/minhbien/Documents/automation_app/src/components/ui/textarea.tsx)
**Before**: Custom styled `<textarea>` with `cn()`  
**After**: daisyUI `textarea` class

```jsx
<textarea className="textarea textarea-bordered w-full" />
```

#### [MODIFY] [switch.tsx](file:///home/minhbien/Documents/automation_app/src/components/ui/switch.tsx)
**Before**: Custom button-based switch with CSS vars  
**After**: daisyUI `toggle` component

```jsx
<input type="checkbox" className="toggle toggle-primary" checked={checked} onChange={...} />
```

`SwitchField` → Use daisyUI `form-control` + `label` pattern

#### [MODIFY] [icon-button.tsx](file:///home/minhbien/Documents/automation_app/src/components/ui/icon-button.tsx)
**Before**: Radix Tooltip wrapping custom Button  
**After**: daisyUI `tooltip` + `btn btn-square`

#### [MODIFY] [segmented-control.tsx](file:///home/minhbien/Documents/automation_app/src/components/ui/segmented-control.tsx)
**Before**: Custom with Button + CSS class  
**After**: daisyUI `join` + radio buttons or `tabs tabs-box`

#### [MODIFY] [settings-field-group.tsx](file:///home/minhbien/Documents/automation_app/src/components/ui/settings-field-group.tsx)
**Before**: Custom fieldset with CSS classes  
**After**: daisyUI `fieldset` component

```jsx
<fieldset className="fieldset bg-base-200 border-base-300 rounded-box border p-4">
  <legend className="fieldset-legend">{title}</legend>
  {children}
</fieldset>
```

#### [DELETE] [utils.ts](file:///home/minhbien/Documents/automation_app/src/lib/utils.ts)
The `cn()` helper (clsx + tailwind-merge) is no longer needed. daisyUI class names don't conflict and don't need deduplication.

---

### Phase 2 — CSS Files Migration (12 files, 8,081 lines)

The CSS files are the **biggest part** of this migration. Currently there are **~889 references** to custom CSS variables across 12 files, plus **critical class name conflicts** with daisyUI.

> [!CAUTION]
> #### Class Name Conflicts with daisyUI
> These custom CSS class names **will clash** with daisyUI's built-in classes once we activate `@plugin "daisyui"`:
> 
> | Conflicting Class | Custom CSS Location | daisyUI Component |
> |---|---|---|
> | `.btn`, `.btn-primary` | [mission-control.css:927-961](file:///home/minhbien/Documents/automation_app/src/styles/mission-control.css#L927-L961) | `btn` component |
> | `.badge`, `.badge-success/failure` | [mission-control.css:1116-1129](file:///home/minhbien/Documents/automation_app/src/styles/mission-control.css#L1116-L1129) | `badge` component |
> | `.switch`, `.slider` | [mission-control.css:1144-1171](file:///home/minhbien/Documents/automation_app/src/styles/mission-control.css#L1144-L1171) | `toggle` component |
> | `.text-input` | [mission-control.css:1028-1041](file:///home/minhbien/Documents/automation_app/src/styles/mission-control.css#L1028-L1041) | `input` component |
> | `.toggle` | various | `toggle` component |
> 
> These MUST be resolved before activating daisyUI, otherwise styles will break unpredictably.

#### CSS Migration Strategy: 3 Tiers

**Tier 1 — FULL REWRITE** (remove custom CSS, use daisyUI classes in TSX)

| File | Lines | CSS Var Refs | Action |
|------|-------|-------------|--------|
| [base.css](file:///home/minhbien/Documents/automation_app/src/styles/base.css) | 437 | 63 | Remove global `button/input/select/textarea/label` resets (lines 234-319). Keep: `:root` theme variables (map to daisyUI aliases), scrollbar styles, density/spacing tokens, font stack. Remove `.switch-field`, `.segmented-control` classes (replaced by daisyUI `toggle`/`tabs`). |
| [auth.css](file:///home/minhbien/Documents/automation_app/src/styles/auth.css) | 293 | 3 | Mostly standalone. Minimal var refs — easy to migrate forms to daisyUI `input`/`btn`/`card` classes. |

**Tier 2 — PARTIAL MIGRATION** (replace component classes with daisyUI, keep layout CSS)

| File | Lines | CSS Var Refs | Action |
|------|-------|-------------|--------|
| [mission-control.css](file:///home/minhbien/Documents/automation_app/src/styles/mission-control.css) | 1,360 | 251 | **Highest conflict risk.** Remove: custom `.btn`/`.btn-primary` (L927-961), `.badge` (L1116-1129), `.switch`/`.slider` (L1144-1171), `.text-input` (L1028-1041), `.action-dropdown` (L1207-1261). These all have daisyUI equivalents. Keep: `.tweaks-panel`, `.project-card`, `.metric-card`, `.data-table-card` layout CSS (no daisyUI equivalent). Replace `var(--border)` → `border-base-300`, `var(--surface)` → `bg-base-200` etc. |
| [layout.css](file:///home/minhbien/Documents/automation_app/src/styles/layout.css) | 1,159 | 129 | Keep: `.app-shell` grid, `.app-sidebar` structure, `.projects-workspace` layout. Remove: `.sidebar-nav-item` button overrides with `!important` (use daisyUI `menu` + `menu-item` instead). Replace `.panel`/`.workflow-card` → daisyUI `card card-border`. Replace color vars with daisyUI semantic colors. |
| [modals.css](file:///home/minhbien/Documents/automation_app/src/styles/modals.css) | 470 | 27 | Remove `.workflow-dialog` border/bg styles (daisyUI `modal-box` handles this). Keep: `.recording-review-dialog` layout, `.help-disclosure` disclosure patterns. Replace color vars. |
| [workflows.css](file:///home/minhbien/Documents/automation_app/src/styles/workflows.css) | 307 | 31 | Remove `.workflow-import-button` (use daisyUI `btn`). Keep: `.add-step-palette` grid layout, `.workflow-card` grid structure. Replace color vars. |
| [schedules.css](file:///home/minhbien/Documents/automation_app/src/styles/schedules.css) | 117 | 14 | Small. Replace form/button styles with daisyUI. Keep layout grids. |
| [mission-workspaces.css](file:///home/minhbien/Documents/automation_app/src/styles/mission-workspaces.css) | 574 | 66 | Replace `.metric-card` duplicates, status badges. Keep `.overview-kpi-grid` layout, chart containers. |

**Tier 3 — KEEP AS-IS** (specialized/graph CSS, no daisyUI equivalent)

| File | Lines | CSS Var Refs | Action |
|------|-------|-------------|--------|
| [workflow-panels.css](file:///home/minhbien/Documents/automation_app/src/styles/workflow-panels.css) | 1,627 | 168 | Inspector panels, run monitor drawers, console output. Very specialized graph editor UI. Only replace color vars (`var(--border)` → daisyUI token aliases). Keep all layout. |
| [workflow-graph.css](file:///home/minhbien/Documents/automation_app/src/styles/workflow-graph.css) | 1,203 | 104 | React Flow/xyflow node styles, edge styles, canvas. Highly specialized. Only replace color vars. |
| [workflow-graph-overlays.css](file:///home/minhbien/Documents/automation_app/src/styles/workflow-graph-overlays.css) | 337 | 31 | Graph overlay popups. Keep layout, replace color vars only. |
| [responsive.css](file:///home/minhbien/Documents/automation_app/src/styles/responsive.css) | 200 | 2 | Media queries for responsive breakpoints. No component styles, keep entirely. |

#### Color Variable Migration Map

All CSS files use custom vars. After daisyUI themes are active, we need bridge aliases in `:root` so existing CSS continues working:

```css
/* Bridge: map legacy vars → daisyUI theme tokens */
:root {
  --bg:                 var(--color-base-100);
  --surface:            var(--color-base-200);
  --surface-elevated:   var(--color-base-300);
  --border:             var(--color-base-300);
  --border-emphasized:  var(--color-neutral);
  --fg-primary:         var(--color-base-content);
  --fg-secondary:       var(--color-secondary);
  --fg-muted:           var(--color-neutral-content);
  --accent:             var(--color-primary);
  --success:            var(--color-success);
  --attention:          var(--color-warning);
  --failure:            var(--color-error);
  /* ... all --app-* aliases chain through these */
}
```

This bridge approach allows **incremental migration** — existing `var(--border)` references in Tier 3 CSS files keep working immediately, while we gradually replace them with Tailwind/daisyUI classes in Tier 1 & 2 files.

---

### Phase 2.5 — Deep Cleanup (hidden debt that must be resolved)

These items were found during deep audit. They're not strictly "library removal" but are **critical for a clean codebase** that future agents can work with efficiently.

#### A. CSS Variables Used Directly in TSX Files (136 occurrences)

Many TSX files bypass the UI wrapper components and use `var(--app-*)` / `var(--bg)` etc. directly in Tailwind arbitrary values or inline `style={{}}` props:

```tsx
// Example — hardcoded CSS vars in Tailwind arbitrary values:
className="text-[var(--app-text-muted)]"
className="bg-[var(--app-surface)] border-[var(--app-border-strong)]"

// Example — hardcoded CSS vars in inline styles:
style={{ color: "var(--fg-muted)", backgroundColor: "var(--app-border)" }}
```

**Files with most occurrences:**
- [WorkflowSettingsDialog.tsx](file:///home/minhbien/Documents/automation_app/src/features/workflows/components/WorkflowSettingsDialog.tsx) — skeleton placeholders with inline `var(--app-*)` styles
- [VariableAutocompletePopover.tsx](file:///home/minhbien/Documents/automation_app/src/features/workflows/components/VariableAutocompletePopover.tsx) — hardcoded `bg-[#0b1016]`, `border-[#233240]`
- [VariableNumericInput.tsx](file:///home/minhbien/Documents/automation_app/src/features/workflows/components/VariableNumericInput.tsx)
- [ActionConfigReliabilityFields.tsx](file:///home/minhbien/Documents/automation_app/src/features/workflows/components/ActionConfigReliabilityFields.tsx) — copy-pasted Input styling as raw Tailwind
- [SettingsPage.tsx](file:///home/minhbien/Documents/automation_app/src/features/settings/pages/SettingsPage.tsx) — inline styles with `var(--space-md)`, `var(--fg-muted)`

**Action:** Replace all `var(--app-*)` / `var(--bg)` / `var(--fg-*)` with daisyUI semantic classes:
- `text-[var(--app-text)]` → `text-base-content`
- `bg-[var(--app-surface)]` → `bg-base-200`
- `border-[var(--app-border)]` → `border-base-300`
- Inline `style={{ color: "var(--fg-muted)" }}` → `className="text-neutral-content"`

#### B. Hardcoded Hex Colors in TSX (37 occurrences)

These will NOT respond to theme changes. They must all become daisyUI semantic colors:

| Hardcoded Value | Correct daisyUI Class | Files |
|---|---|---|
| `#0b1016` | `bg-base-100` | VariableAutocompletePopover, ProfileEditDialog |
| `#233240` | `border-base-300` | VariableAutocompletePopover, ProfileEditDialog |
| `#121c26` | `bg-base-200` | VariableAutocompletePopover |
| `#32d3e6` | `text-primary` | RunMonitorDrawer, RunVariablesDrawer |
| `#f06467` | `text-error` | RunMonitorDrawer |
| `#39d98a` | `text-success` | RunVariablesDrawer |
| `#9aaebd` | `text-secondary` | RunVariablesDrawer |
| `#667d8d` | `text-neutral` | SettingsPage |
| `#dc2626`, `#ffffff` | `btn-error` | ProjectSettings |
| `#4ade80`, `#60a5fa`, `#cbd5e1`, `#64748b` | daisyUI semantic | AdminPanel |

#### C. Hardcoded Hex Colors in CSS (135 occurrences)

Across CSS files, mostly in [modals.css](file:///home/minhbien/Documents/automation_app/src/styles/modals.css) (16), [auth.css](file:///home/minhbien/Documents/automation_app/src/styles/auth.css) (22), and [workflow-graph.css](file:///home/minhbien/Documents/automation_app/src/styles/workflow-graph.css) (31). These should use `var(--*)` tokens or daisyUI color vars.

#### D. Inline `style={{}}` Props (169 occurrences)

A large number of TSX files use React inline styles instead of Tailwind/daisyUI classes. While not all need changing, those using color/spacing CSS vars should be converted to class-based styling.

#### E. `!important` Overrides in CSS (89 total)

| File | Count | Cause |
|------|-------|-------|
| [layout.css](file:///home/minhbien/Documents/automation_app/src/styles/layout.css) | 58 | Sidebar nav item overrides fighting base `button` styles |
| [workflow-panels.css](file:///home/minhbien/Documents/automation_app/src/styles/workflow-panels.css) | 17 | Inspector panel overrides |
| [auth.css](file:///home/minhbien/Documents/automation_app/src/styles/auth.css) | 7 | Login form overrides |
| Others | 7 | Various |

**Root cause:** The global `button {}` reset in [base.css:234-264](file:///home/minhbien/Documents/automation_app/src/styles/base.css#L234-L264) forces `.sidebar-nav-item` and others to use `!important` everywhere. Removing the global reset (daisyUI handles this) will eliminate most `!important` needs.

#### F. Duplicate CSS Definitions Across Files

| Class | Defined In | Should Be |
|-------|-----------|-----------|
| `.metric-card` | `mission-control.css` AND `mission-workspaces.css` | Single definition or daisyUI `stat` |
| `.project-collection-tabs` | `layout.css` AND `mission-control.css` | Single file (mission-control.css wins) |
| `.project-collection-item` | `layout.css` AND `mission-control.css` | Single file |
| `.row-title-cell`, `.row-title`, `.row-desc` | `mission-control.css` (2 places) | Deduplicate |

#### G. CSS Classes Used Directly in TSX (not via React components)

These TSX files use CSS class names from `mission-control.css` directly — they WILL be affected by daisyUI class conflicts:

| CSS Class | TSX Files Using It |
|---|---|
| `.text-input` | SubflowListPage, WorkflowListPage, ProjectProfilesPanel, ProjectsPage |
| `.text-input-full` | ProjectSettings |
| `.btn-action-circle` | SubflowListPage (5x), WorkflowListPage (4x), ProjectProfilesPanel (2x) |
| `.btn-destruct` | SubflowListPage, WorkflowListPage, ProjectProfilesPanel |
| `.badge.badge-running` | WorkflowListPage |
| `.switch-field` / `.switch-field-copy` | SettingsPage, switch.tsx component |

#### H. Debug Code to Remove

- [button.tsx:62](file:///home/minhbien/Documents/automation_app/src/components/ui/button.tsx#L62): `console.log("DEBUG: Button rendering", ...)` — left-over debug log in production component

#### I. Test File Dependencies on Current Architecture

[AppCss.test.ts](file:///home/minhbien/Documents/automation_app/src/AppCss.test.ts) (462 lines) is a **massive CSS contract test** that:
- Reads raw CSS file contents and asserts specific CSS rules exist
- Asserts `var(--border)`, `var(--accent)`, `var(--surface)` etc. in specific selectors
- Asserts `button.tsx` contains `var(--app-accent-border)` 
- Asserts dialog.tsx contains `aria-label="Close dialog"`
- Asserts specific hex colors in graph node styles

**This entire test file will need significant rewriting** after CSS migration — it's tightly coupled to the exact CSS var names and component implementations being replaced.

---

### Phase 3 — Update Consumers (~80+ TSX files)

Consumers import from `src/components/ui/*`. Since we keep the same file names and export names as thin wrappers, **most consumers won't need changes**. The wrapper APIs will be adapted to pass daisyUI classes internally.

**Files that will need direct changes:**
- Any file using `asChild` prop on Button (search: `asChild`)
- Any file using `onOpenChange` on Dialog (daisyUI modal uses different open/close pattern)
- Any file directly applying `cn()` from `@/lib/utils`

**Files using inline CSS class names from conflicts:**
- Files using `.btn`, `.btn-primary` CSS classes directly (in TSX `className="btn"`) — will now get daisyUI styling automatically, which is what we want
- Files using `.badge`, `.badge-success` etc. — same, daisyUI replaces cleanly
- Files using `.switch`/`.slider` — need to change to daisyUI `toggle` markup pattern

---

### Phase 4 — Remove Dependencies

#### [MODIFY] [package.json](file:///home/minhbien/Documents/automation_app/package.json)

```bash
npm uninstall @radix-ui/react-dialog @radix-ui/react-dropdown-menu \
  @radix-ui/react-label @radix-ui/react-scroll-area @radix-ui/react-slot \
  @radix-ui/react-tooltip class-variance-authority clsx tailwind-merge
```

Removes **9 packages** from dependencies.

---

### Phase 5 — Update Tests

#### [MODIFY] [AppShellStatic.test.ts](file:///home/minhbien/Documents/automation_app/src/AppShellStatic.test.ts)
Update to assert **no** Radix packages remain

#### [MODIFY] [shadcn-components.test.tsx](file:///home/minhbien/Documents/automation_app/src/components/ui/shadcn-components.test.tsx)
Rewrite or remove — tests for shadcn wrappers will be replaced with daisyUI component tests

#### [MODIFY] [button.test.tsx](file:///home/minhbien/Documents/automation_app/src/components/ui/button.test.tsx)
Rewrite for new daisyUI-based Button

#### [MODIFY] [dropdown-menu.test.tsx](file:///home/minhbien/Documents/automation_app/src/components/ui/dropdown-menu.test.tsx)
Rewrite for new daisyUI-based Dropdown

---

## Summary of Impact

| Category | Count |
|----------|-------|
| **Packages to remove** | **9** |
| **UI wrapper files to rewrite** | **16** (in `src/components/ui/`) |
| **Files to delete** | **1** (`src/lib/utils.ts`) |
| | |
| CSS files — Tier 1 (full rewrite) | 2 files, 730 lines |
| CSS files — Tier 2 (partial migration) | 6 files, 3,987 lines |
| CSS files — Tier 3 (color vars only) | 4 files, 3,367 lines |
| CSS class name conflicts to resolve | 5 (`.btn`, `.badge`, `.switch`, `.slider`, `.text-input`) |
| CSS `!important` overrides to eliminate | 89 |
| Duplicate CSS definitions across files | 4 classes |
| Total CSS variable references | ~889 |
| | |
| TSX files with inline `var(--*)` | 136 occurrences |
| TSX files with hardcoded hex colors | 37 occurrences |
| CSS files with hardcoded hex colors | 135 occurrences |
| TSX files with inline `style={{}}` | 169 occurrences |
| TSX files using conflicting CSS classes | ~20 files |
| | |
| Consumer TSX files (transparent via wrappers) | ~80+ |
| Test files to rewrite | 5+ (incl. 462-line AppCss.test.ts) |
| Debug code to remove | 1 (`console.log` in button.tsx) |

---

## Verification Plan

### Automated Tests
```bash
rtk npm run lint
rtk npm run test
rtk npm run build
```

### Manual Verification
- Run `rtk npm run dev` and visually inspect every page
- Verify dark/light theme switching still works
- Verify all dialog/modal interactions work
- Verify dropdown menus, tooltips, form inputs render correctly
- Check no Radix or shadcn imports remain: `grep -r "@radix-ui" src/`
- Check no CVA/clsx/tailwind-merge imports remain
