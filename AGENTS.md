Read SPEC.md if you need more clarification about this project's bigger picture.

---

## Current Architecture

### Stack
- Single `index.html` — no build step, CDN-only (DaisyUI v4, Tailwind, SortableJS)
- `src/data.js` — ingredients + recipes databases
- `src/main.js` — all UI rendering, state management, drag-and-drop logic
- `css/style.css` — reserved for custom styles (currently unused)

### Data Model

**INGREDIENTS** (`src/data.js`) — flat lookup object keyed by string ID:
- `macrosPer100g`: `{ calories, protein, carbs, fat }`
- `pricePerUnit`: cost per gram/ml
- `unit`: "g" or "ml"

**RECIPES** (`src/data.js`) — array of objects:
- `id`: unique string identifier
- `name`: display name
- `servingSize`: total grams per 1x serving (used for weight display only)
- `ingredients`: `[{ id, amount }]` — references INGREDIENTS keys
- `prepNotes`: free text string for print/export section

**Macros/price are always derived at runtime** via `calculateRecipeMacros(recipe, multiplier)` — never hardcoded.

---

### State Model (`src/main.js`)

**`gridState`** — `Map<string, Array<{ entryId, recipeId, multiplier }>>`

- Key: `"variant-meal"` (e.g. `"0-2"` = variant A, meal slot 3)
- Value: array of stacked recipe entries for that slot
- **Keys are never deleted** — when the grid is resized, out-of-bounds keys are kept in memory but excluded from all calculations. This prevents accidental data loss if the user temporarily shrinks the grid.
- Each entry has a unique `entryId` (incrementing integer from `nextEntryId`) used to identify it for mutation/removal.

**Key state functions:**
- `getSlotEntries(variant, meal)` → returns (or creates) the array for a slot
- `addEntry(variant, meal, recipeId, multiplier)` → pushes a new entry, returns it
- `removeEntry(variant, meal, entryId)` → splices out by entryId
- `updateEntryMultiplier(variant, meal, entryId, multiplier)` → mutates in place

---

### Layout Structure

```
┌─────────────────────────────────────────────────────┐
│  TOP BAR: Days | Meals/day | Variants | Print btn   │
├──────────┬──────────────────────────┬───────────────┤
│  LEFT    │                          │    RIGHT      │
│ SIDEBAR  │       MAIN GRID          │   SIDEBAR     │
│ (recipes)│  (variant cols × meals)  │  (summary)    │
│  288px   │       flex-1             │    320px      │
└──────────┴──────────────────────────┴───────────────┘
```

### Meal Grid
- Columns = `Variants` count (`input-variants`), each `flex-1 min-w-[200px]`
- Rows = `Meals/day` count (`input-meals`), each `flex-1`
- Column headers: Day A, Day B, Day C…
- Slot headers: Meal 1, Meal 2…
- Each slot contains a `.recipe-stack` div where dropped cards are appended
- Empty stacks show a `slot-placeholder` div

### Slot Cards
- Built by `buildSlotCard(variant, meal, entry)` — returns a DOM node
- Shows: recipe name, scaled macros (calories/protein/carbs/fat/weight/price), range slider (0.1–4x, step 0.1), remove button
- The card holds a closure over `entry` — slider `input` events mutate `entry.multiplier` directly in gridState and refresh the macro display in-place, then call `updateSummary()`
- Remove button calls `removeEntry()`, removes the DOM node, calls `updateSummary()`

### Drag and Drop (SortableJS)
- Left sidebar: `group: { name: 'recipes', pull: 'clone', put: false }` — clones on drag, never accepts drops
- Recipe stacks: `group: { name: 'recipes', pull: true, put: true }` — accepts drops, allows reorder
- `onAdd` handler on each stack:
  1. Reads `recipeId` from the raw cloned node's `data-recipe-id`
  2. Removes the raw clone from DOM immediately
  3. Calls `addEntry()` to register in gridState
  4. Calls `buildSlotCard()` and appends the rendered card
  5. Calls `updateSummary()`
- Cards within stacks can be reordered via drag — note this reorders DOM only, not gridState. This is cosmetic only and doesn't affect calculations (which are order-independent).

### Summary Calculations (`updateSummary`)
- Reads `days`, `variants`, `mealsPerDay` from inputs
- Computes `occurrences[v]` per variant:
  - `base = Math.floor(days / variants)`
  - first `days % variants` variants get `base + 1`
  - Example: 7 days, 3 variants → occurrences = [3, 2, 2]
- Iterates only in-bounds slots (0..variants-1, 0..mealsPerDay-1)
- Accumulates per-variant daily totals and weekly totals (weighted by occurrences)
- Daily average = weekly totals ÷ days
- Updates: summary-calories, summary-protein, summary-carbs, summary-fat, cost-per-day, cost-per-week, variant-breakdown

### Input Wiring
- `input-days` — fires `updateSummary()` only (no grid rebuild needed)
- `input-meals`, `input-variants` — fire `renderMealGrid()` which calls `updateSummary()` at the end
- Print button — calls `window.print()`

### Number Formatting (`fmtNum`)
- `fmtNum(num)` — 2 significant figures (e.g. 321 → "320", 1.5 → "1.5")
- `fmtNum(num, true)` — nearest cent with `$` prefix (e.g. `$1.88`)

---

## Adding a New Recipe

1. Add any new ingredients to `INGREDIENTS` in `src/data.js` following the existing schema
2. Add the recipe object to `RECIPES` in `src/data.js`:
   - `id`: unique kebab-case string
   - `name`: display name
   - `servingSize`: total grams (1x serving)
   - `ingredients`: array of `{ id, amount }` referencing INGREDIENTS keys
   - `prepNotes`: one or two sentences for the print prep guide

No other changes needed — recipes appear in the sidebar automatically.

---

## Known Gaps / TODO

- **Drag reorder doesn't sync to gridState** — cosmetic only, doesn't affect calculations
- **Print/export not implemented** — `window.print()` is wired but there's no print CSS or export sections yet
- **No localStorage** — all state is lost on page refresh (out of scope for v1 per SPEC)
- **Mobile not optimized** — desktop-first per SPEC
- **Grocery list / Meal Prep Guide sections** not yet built (needed for print view per SPEC)
