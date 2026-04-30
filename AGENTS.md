Read SPEC.md if you need more clarification about this project's bigger picture.

---

## Current Architecture

### Stack
- Single `index.html` — no build step, CDN-only (DaisyUI v4, Tailwind, SortableJS)
- `src/data.js` — ingredients + recipes databases (exports `INGREDIENTS`, `ALL_RECIPES`)
- `src/state.js` — grid state management, storage operations
- `src/calculations.js` — macro calculations, formatting, data access utilities
- `src/recipe-ui.js` — recipe list rendering and edit modal
- `src/grid-ui.js` — meal grid rendering and summary calculations
- `src/print.js` — print view generation
- `src/main.js` — event wiring and initialization (thin glue)
- `css/style.css` — reserved for custom styles (currently unused)

### Data Model

**INGREDIENTS** (`src/data.js`) — flat lookup object keyed by string ID:
- `macrosPer100g`: `{ calories, protein, carbs, fat }`
- `pricePerUnit`: cost per gram/ml
- `unit`: "g" or "ml"
- `isRecipe` (optional): if `true`, auto-generates a single-ingredient recipe at runtime
- `servingSize` (optional): required when `isRecipe: true`, defines the serving size for the generated recipe
- `category` (optional): determines which category the auto-generated recipe appears in

**ALL_RECIPES** (`src/data.js`) — merged array of base recipes + auto-generated single-ingredient recipes:
- `id`: unique string identifier
- `name`: display name
- `servingSize`: total grams per 1x serving (used for weight display only)
- `ingredients`: `[{ id, amount }]` — references INGREDIENTS keys
- `prepNotes`: free text string for print/export section (optional, empty string for no prep)

**Single-Ingredient Recipes** — Ingredients with `isRecipe: true` are automatically converted to recipes at runtime. The recipe `id` is the ingredient id, `name` is the ingredient name, `servingSize` and `category` are inherited from the ingredient.

**Macros/price are always derived at runtime** via `calculateRecipeMacros(recipe, multiplier)` — never hardcoded.

---

### State Model (`src/state.js`)

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
- `input-days` — fires `renderMealGrid()` then `updateSummary()` (no grid rebuild needed)
- `input-meals`, `input-variants` — fires `renderMealGrid()` which calls `updateSummary()` at the end
- Print button — calls `generatePrintView()`
- Clear button (`#btn-clear`) — confirms, clears `gridState`, resets `nextEntryId`, calls `clearStorage()`, re-renders grid

Note: Storage operations are now called automatically on mutations via `state.js`. The `main.js` file contains only event listener wiring and initialization.

### Print View (`generatePrintView`)
Opens a new browser window with a clean, print-ready HTML document (no app chrome). The document has three sections:

1. **Summary** — plan config (days/variants/meals), daily average macros (calories/protein/carbs/fat), cost per day and per week, and a per-variant breakdown table showing each day type's macros, cost, and how many times it occurs.
2. **Shopping List** — all ingredients across the entire plan aggregated into a single table (ingredient name, total quantity with unit, estimated cost), sorted alphabetically, with a grand total at the bottom. Quantities are rounded to the nearest whole number.
3. **Meal Prep Guide** — one block per unique recipe used anywhere in the plan, showing the total scaled ingredient amounts to cook for the whole week (sum of `multiplier × occurrences` across all slots containing that recipe), and the recipe's `prepNotes`.

The function reuses `computeOccurrences()`, `calculateRecipeMacros()`, and `fmtNum()`. It iterates `gridState` respecting the same in-bounds logic as `updateSummary()`. The new window calls `window.print()` after writing the document so the browser print dialog fires automatically.

### Persistence (`localStorage`)

All plan state is saved to `localStorage` under the key `bulk-meal-planner-v1` on every mutation. The stored JSON shape is:

```json
{
  "gridState": { "0-0": [{"entryId": 0, "recipeId": "chicken-rice", "multiplier": 1}], ... },
  "nextEntryId": 3,
  "days": "7",
  "meals": "3",
  "variants": "3"
}
```

- `saveToStorage()` (in `calculations.js`) — serialises `gridState` (Map → plain object via `Object.fromEntries`) and the three input values, writes to `localStorage`.
- `loadFromStorage()` (in `calculations.js`) — reads and JSON-parses; returns `null` on any error (missing key, malformed JSON).
- `clearStorage()` (in `calculations.js`) — removes the key.
- On `DOMContentLoaded`, `initGridFromStorage()` (in `grid-ui.js`) is called first; if data exists, inputs and `gridState` are restored before `renderMealGrid()` runs.
- **Storage key versioning**: if the data shape ever changes in a breaking way, increment the version suffix (`-v2`, etc.) so old data is silently ignored rather than causing a parse error.

**Custom Recipe Storage** (recipes with user modifications):
- Stored separately under key `bulk-meal-planner-recipes`
- `saveCustomRecipe()`, `getCustomRecipe()`, `deleteCustomRecipe()` in `calculations.js`
- `isRecipeModified()` checks if a recipe has been customized

### Number Formatting (`fmtNum`)
- `fmtNum(num)` — 2 significant figures (e.g. 321 → "320", 1.5 → "1.5")
- `fmtNum(num, true)` — nearest cent with `$` prefix (e.g. `$1.88`)

---

## Recipe Categories

Recipes now have a `category` field. The sidebar shows a dropdown to switch between categories. `renderRecipeList()` reads `document.getElementById('recipe-category').value` and filters `ALL_RECIPES` accordingly.

**Current categories:**
- `"meal"` — standard food recipes (all original recipes)
- `"drink"` — drinks (Whole Milk, Orange Juice, Protein Shake)
- `"snack"` — snacks (single-ingredient granola bar)

**Auto-generated recipes** — When an ingredient has `isRecipe: true`, the generated recipe inherits the ingredient's `category` field. This keeps single-ingredient items organized with similar recipes.

All categories are functionally identical — they use the same drag-and-drop mechanics, gridState, macros calculations, and print view. The category field is purely a UI filter.

**To add a new category:** add a new `<option>` to the `#recipe-category` select in `index.html` and add recipes with the matching `category` string. No JS changes needed.

---

## Adding a New Recipe

### Multi-Ingredient Recipe
1. Add any new ingredients to `INGREDIENTS` in `src/data.js` following the existing schema
2. Add the recipe object to `RECIPES` in `src/data.js`:
   - `id`: unique kebab-case string
   - `category`: `"meal"`, `"drink"`, `"snack"`, or any new category string
   - `name`: display name
   - `servingSize`: total grams/ml (1x serving)
   - `ingredients`: array of `{ id, amount }` referencing INGREDIENTS keys
   - `prepNotes`: one or two sentences for the print prep guide (or omit/empty for no prep section)

No other changes needed — recipes appear in the sidebar automatically under their category.

### Single-Ingredient Recipe (Ingredient as Recipe)
For simple items like "Whole Milk" or "Granola Bar" that don't need custom prep:

1. Add the ingredient to `INGREDIENTS` in `src/data.js`:
   - Include `isRecipe: true` to enable auto-generation
   - Include `servingSize: <number>` (required when `isRecipe: true`)
   - Include `category: "drink"`, `"snack"`, etc. (optional, defaults to "meal")
   - Single-ingredient recipes have no `prepNotes` — they're excluded from the Meal Prep Guide in print view

Example:
```javascript
"chewy-granola-bar": {
  name: "Kirkland Granola Bar",
  macrosPer100g: { calories: 417, protein: 4.2, carbs: 75, fat: 12.5 },
  pricePerUnit: 0.00625,
  unit: "g",
  isRecipe: true,        // ← Auto-generates a recipe
  servingSize: 24,       // ← Required for recipe generation
  category: "snack"      // ← Optional, defaults to "meal"
}
```

This automatically creates a recipe with:
- `id`: ingredient id (`"chewy-granola-bar"`)
- `name`: ingredient name (`"Kirkland Granola Bar"`)
- `ingredients`: `[{ id: "chewy-granola-bar", amount: 24 }]`
- No `prepNotes` (empty section in print view)

---

## File Architecture

```
src/
├── data.js              # INGREDIENTS, ALL_RECIPES, RECIPES (ES module exports)
├── state.js             # gridState Map, entry management, persistence helpers
├── calculations.js      # calculateRecipeMacros, fmtNum, computeOccurrences, storage
├── recipe-ui.js         # renderRecipeList, edit modal functions
├── grid-ui.js           # renderMealGrid, buildSlotCard, updateSummary
├── print.js             # generatePrintView
└── main.js              # Event wiring + initialization (thin glue)
```

**Module Dependencies:**
- `main.js` imports: state, calculations, recipe-ui, grid-ui, print
- `grid-ui.js` imports: state, calculations, data
- `recipe-ui.js` imports: calculations, data (no circular imports - uses callback pattern)
- `print.js` imports: state, calculations, data
- `calculations.js` imports: data

## Known Gaps / TODO

- **Drag reorder doesn't sync to gridState** — cosmetic only, doesn't affect calculations
- **Mobile not optimized** — desktop-first per SPEC
- **ES modules required** — all scripts now use ES module imports/exports, requires modern browser

## Print View Behavior

- **Meal Prep Guide** — Only includes recipes that have `prepNotes` defined. Single-ingredient recipes (drinks, snacks) have no prep notes and are excluded from this section to keep the printout clean.
- **Shopping List** — Includes all ingredients from all recipes, including single-ingredient auto-generated ones.
- **Daily Meal Schedule** — Shows all recipes used in the plan, regardless of prep notes.
