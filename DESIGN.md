# Mission Control Design System

Mission Control is a dark, precise desktop operations workspace for repeated
authorized automation work. It prioritizes dense readable data, stable panel
geometry, explicit status semantics, keyboard-accessible controls, and restrained
motion.

## Color Tokens

| Role | Token |
| --- | --- |
| Canvas | `#0B1016` |
| Sidebar / inset | `#0E151D` |
| Surface | `#121C26` |
| Elevated surface | `#172431` |
| Border | `#233240` |
| Emphasized border | `#314758` |
| Primary text | `#E7EEF5` |
| Secondary text | `#9AAEBD` |
| Muted text | `#667D8D` |
| Active/control cyan | `#32D3E6` |
| Success green | `#39D98A` |
| Attention amber | `#F4B740` |
| Failure red | `#F06467` |

Use cyan for focus, selection, primary controls, and active execution. Use green
only for successful terminal states. Use amber for validation, warning, and
stale/recheck states. Use red for runtime/system failures and destructive
actions. Never use color alone to communicate state.

## Typography

- Use `Inter` or the closest available modern sans-serif for UI text.
- Use monospace for run ids, timestamps, identity ids, safe paths, serialized
  details, and other technical values.
- Page titles are compact desktop headings around `28-32px`.
- Section headings use `18-20px`; body and controls use `13-14px`; metadata uses
  `11-12px`.
- Letter spacing is `0`.
- Avoid hero-scale marketing typography inside product workspaces.

## Shape And Density

- Use 4px and 8px spacing increments.
- Controls, panels, repeated cards, and table regions use radii no larger than
  `8px`.
- Dialogs and focused overlays may use up to `12px`.
- Status pills are allowed only as compact semantic indicators.
- Use borders and tonal surfaces for depth; reserve shadows for dialogs and
  popovers that sit above existing context.
- Do not nest decorative cards inside cards.

## Shell And Layout

- The sidebar is the stable Mission Control anchor.
- Workspace pages use compact command regions with page context, status, and
  real primary actions.
- Operational surfaces should be table/detail, graph/detail, or dashboard
  layouts rather than landing pages.
- At `1024x768`, the sidebar may collapse to an icon rail, tables should hide
  secondary metadata first, and dialogs/drawers must stay within the viewport.

## Interaction

- Icon-only controls must have accessible labels and tooltip text.
- Focus indicators use the cyan treatment against dark surfaces.
- Consequential primary commands use clear text, for example `Run` and
  `New Workflow`.
- Active execution may use small indicators, but large panels and layout regions
  remain stable.
- Destructive and high-impact actions remain confirmed and name the affected
  scope.
