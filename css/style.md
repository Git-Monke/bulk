# Style Guide

## File Structure

All custom styles live in `css/`. They are split into five logical layers, loaded in this order from `index.html`:

```html
<link rel="stylesheet" href="css/tokens.css">   <!-- must be first -->
<link rel="stylesheet" href="css/base.css">
<link rel="stylesheet" href="css/layout.css">
<link rel="stylesheet" href="css/components.css">
<link rel="stylesheet" href="css/utilities.css">
```

| File | Purpose |
|------|---------|
| `tokens.css` | DaisyUI theme overrides (CSS custom properties / design tokens). Must load first — all other files reference its variables. |
| `base.css` | Global resets, typography, scrollbars, number-input spinners, SortableJS drag helpers. |
| `layout.css` | Major page regions: app header, brand, header controls, left/right sidebars, main grid area, day columns, meal slots, recipe stacks. |
| `components.css` | All reusable UI elements: buttons, cards (recipe, ingredient, slot), modals, sliders, summary panels, agent chat, ingredient modal, category dropdowns, ingredient search. |
| `utilities.css` | Single-purpose helpers: empty-state display only. |

---

## Naming Conventions

### Classes
- **BEM-like** with a short prefix: `.slot-card`, `.slot-card-head`, `.recipe-card-stats`, `.summary-card-header`
- **Layout helpers**: `.sidebar-left`, `.sidebar-right`, `.sidebar-tab`, `.sidebar-content`
- **Variant helpers**: `.variant-row`, `.variant-row-price`, `.day-col`, `.day-header`
- **Utility-like**: `.empty-state`, `.empty-icon`, `.empty-title`, `.badge-modified`
- State classes via attribute/JS: `.is-modified`, `.is-custom`, `.drag-over`, `.active`

### IDs
- Only for elements wired by `main.js` / UI modules: `#ingredient-search-container`, `#ingredient-search-results`, `#edit-modal`
- Prefix with the component scope: `ing-`, `edit-`, `agent-`

### CSS Custom Properties
- **DaisyUI overrides**: `--p`, `--pc`, `--b1`, `--rounded-btn`, etc. — match DaisyUI's token names
- **Semantic tokens** (all in `:root, [data-theme="bulk"]`):
  - `--c-surface`, `--c-canvas`, `--c-inset`, `--c-line`, `--c-line-strong` — surface colours
  - `--c-text`, `--c-muted`, `--c-faint` — text colours
  - `--c-accent`, `--c-accent-soft` — brand accent (emerald-700)
  - `--c-warm`, `--c-warm-soft` — price/warning colour (amber-700)
  - `--c-danger`, `--c-danger-soft` — destructive actions
  - `--shadow-card`, `--shadow-pop` — box shadows

---

## Adding New Styles

### Colours / Theming
Edit `css/tokens.css`. All semantic tokens use `--c-*` prefixes so a single-file theme swap is possible.

### New Layout Region
Add rules to `css/layout.css`. Prefer flex/grid layout primitives already established (`.sidebar`, `.day-col`, `.meal-slot`).

### New UI Component
Add rules to `css/components.css`. Follow existing class naming (BEM-ish). If the component needs state classes (`.is-modified`, etc.), add them here too.

### One-off Exception
Use `css/utilities.css` only for truly single-purpose helpers that don't fit anywhere else. Prefer adding to the appropriate component/layout file instead.

### DaisyUI Conflicts
DaisyUI utilities (`.btn`, `.modal`, `.input`, `.textarea`, `.select`) are used throughout the app. Custom overrides targeting those classes belong in `css/components.css`. Do not redefine Tailwind/DaisyUI utilities — extend them.

---

## CSS Loading Notes

- Files are loaded via `<link>` tags in `index.html` (no build step, CDN-only).
- `tokens.css` **must** be first so custom properties are defined before any other file reads them.
- If a new file is added, insert it in the correct position in the `<head>` based on the dependency order above.
