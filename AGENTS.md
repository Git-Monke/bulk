Read SPEC.md if you need more clarification about this project's bigger picture.

---

## Current Architecture

### Stack
- Single `index.html` — no build step, CDN-only (DaisyUI, Tailwind, SortableJS)
- `src/data.js` — ingredients + recipes databases
- `src/main.js` — UI rendering and drag-and-drop logic
- `css/style.css` — reserved for custom styles

### Data Model

**INGREDIENTS** — flat lookup object keyed by string ID:
- `macrosPer100g`: `{ calories, protein, carbs, fat }`
- `pricePerUnit`: cost per gram/ml
- `unit`: "g" or "ml"

**RECIPES** — array of objects:
- `id`: unique string identifier
- `name`: display name
- `servingSize`: total grams per 1x serving (informational)
- `ingredients`: `[{ id, amount }]` — references INGREDIENTS
- `prepNotes`: free text for print/export

**Macros/price are always derived at runtime** via `calculateRecipeMacros(recipe, multiplier)` — never hardcoded.

### Layout Structure

```
┌─────────────────────────────────────────────────────┐
│  TOP BAR: Days | Meals/day | Variants | Print btn  │
├──────────┬──────────────────────────┬───────────────┤
│  LEFT    │                          │    RIGHT      │
│ SIDEBAR  │       MAIN GRID          │   SIDEBAR     │
│ (recipes)│  (variant cols × meals)  │  (summary)    │
│  280px   │       flex-1             │    320px      │
└──────────┴──────────────────────────┴───────────────┘
```

### Meal Grid Layout (updated 2026-04-29)
- Columns = `Variants` count, each `flex-1 min-w-[200px]` to stretch and fill space
- Rows = `Meals/day` count, each `flex-1` to stretch vertically
- Recipe stacks inside slots are `flex-1 overflow-y-auto` for scrolling
- Day headers removed — slots just show "Meal 1", "Meal 2", etc.
- Grid container uses `h-full` to fill parent

### Important Notes for Developers
- `input-days` exists in UI but is NOT wired to `renderMealGrid()` — only `Meals/day` and `Variants` control layout
- Recipe cards dragged from sidebar are **cloned** (original stays in sidebar)
- Dropped recipes live in `.recipe-stack` divs with `data-variant` and `data-meal` attributes
- No state management yet — dropped recipes are lost on re-render

### Key Functions (`src/main.js`)

- `calculateRecipeMacros(recipe, multiplier)` → sums ingredient macros + price, scales by multiplier
- `fmtNum(num, isPrice)` → formats numbers (2 sig figs or cents for prices)
- `renderRecipeList()` → injects draggable recipe cards into left sidebar via SortableJS
- `renderMealGrid()` → generates variant × meal slots, reads from DOM inputs
- `updateSummary()` → updates right sidebar totals (TODO: wire to actual slot data)

### SortableJS Groups (as of 2026-04-29)
- Left sidebar: `group: { name: 'recipes', pull: 'clone', put: false }` — clones on drag out, never accepts drops
- Main grid stacks: `group: { name: 'recipes', pull: true, put: true }` — full cross-list drag, items deletable by spill
- Sidebar uses `onEnd` to delete cloned items dropped outside a valid `.recipe-stack`
- Stacks use `removeOnSpill: true` — dropping outside any list removes the card (do NOT use `onEnd` for this; SortableJS reverts `evt.to` to source on invalid drops, making manual checks unreliable)
- Cards have `data-recipe-id` attribute; stacks have `data-variant` + `data-meal`

### Input Controls
- `input-days`, `input-meals`, `input-variants` — changing any triggers `renderMealGrid()`

### DaisyUI Theme
- `data-theme="emerald"` on `<html>` — light, clean aesthetic

### TODO / Gaps
- Meal slots don't save dropped recipes (no state management yet)
- Serving multiplier slider not implemented
- Summary panel is hardcoded to $0
- Print/export not implemented
- Number formatting spec says 2 sig figs for macros, 2 decimal places for price — `fmtNum()` handles this 
