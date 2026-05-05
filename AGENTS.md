Read SPEC.md for project context.

---

## Stack

Single `index.html` — no build step, CDN-only (DaisyUI v4, Tailwind, SortableJS)

| File | Purpose |
|------|---------|
| `src/data.js` | INGREDIENTS, ALL_RECIPES databases |
| `src/state.js` | gridState Map, entry management, persistence helpers |
| `src/calculations.js` | calculateRecipeMacros, fmtNum, computeOccurrences, storage |
| `src/recipe-ui.js` | renderRecipeList, recipe edit modal, ingredient search |
| `src/ingredient-ui.js` | renderIngredientList, ingredient modal, category dropdowns |
| `src/grid-ui.js` | renderMealGrid, buildSlotCard, updateSummary |
| `src/print.js` | generatePrintView |
| `src/agent-ui.js` | Agent chat: conversation state, localStorage, send/stop |
| `src/main.js` | Event wiring + initialization (thin glue) |
| `css/components-buttons-agent.css` | buttons, agent placeholder, agent chat UI, select pill |
| `css/components-cards.css` | recipe list cards, ingredient list cards |
| `css/components-slots.css` | ingredient modal, slot cards, range slider |
| `css/components-panels.css` | right summary cards, edit recipe modal, ingredient search typeahead |

---

## Data Model

**INGREDIENTS** (`src/data.js`) — flat lookup object keyed by string ID:

```javascript
{
  macrosPer100g: { calories, protein, carbs, fat },
  pricePerUnit: number,
  unit: string,                    // "g", "ml", "slice", "whole"
  servingSize: number,             // defaults to 100 for base ingredients
  isRecipe?: boolean,              // auto-generates single-ingredient recipe
  category?: string,               // required when isRecipe: true
  custom?: boolean                 // only on user-created ingredients (gates edit/delete)
}
```

**ALL_RECIPES** (`src/data.js`) — merged array of base recipes + auto-generated single-ingredient recipes:

```javascript
{
  id: string,
  name: string,
  servingSize: number,             // total grams per 1x serving (weight display only)
  ingredients: [{ id, amount }],   // references INGREDIENTS keys
  prepNotes?: string               // empty string = no prep section in print
}
```

**Single-Ingredient Recipes** — `isRecipe: true` on ingredients auto-generates recipes at runtime. Recipe `id`, `name`, `servingSize`, `category` inherited from ingredient.

**Macros/price always derived at runtime** via `calculateRecipeMacros(recipe, multiplier)` — never hardcoded.

---

## State Model (`src/state.js`)

**`gridState`** — `Map<string, Array<{ entryId, recipeId, multiplier }>>`

- Key: `"variant-meal"` (e.g. `"0-2"` = variant A, meal slot 3)
- Value: array of stacked recipe entries for that slot
- **Keys never deleted** — out-of-bounds keys kept on resize, excluded from calculations
- `entryId`: unique incrementing integer for mutation/removal

**Key functions:**
- `getSlotEntries(variant, meal)` → returns or creates array
- `addEntry(variant, meal, recipeId, multiplier)` → pushes, returns entry
- `removeEntry(variant, meal, entryId)` → splices out by entryId
- `updateEntryMultiplier(variant, meal, entryId, multiplier)` → mutates in place

---

## Layout

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
- Columns = `input-variants`, each `flex-1 min-w-[200px]`
- Rows = `input-meals`, each `flex-1`
- Headers: Day A/B/C…, Meal 1/2…
- Each slot has `.recipe-stack` div for dropped cards; empty shows `slot-placeholder`

### Slot Cards
Built by `buildSlotCard(variant, meal, entry)` → DOM node. Shows: recipe name, scaled macros (cal/protein/carbs/fat/weight/price), range slider (0.1–4x, step 0.1), remove button. Card holds closure over `entry`; slider `input` mutates `entry.multiplier` in gridState, refreshes macro display, calls `updateSummary()`. Remove button calls `removeEntry()`, removes DOM node, calls `updateSummary()`.

### Drag and Drop (SortableJS)
- Left sidebar: `group: { name: 'recipes', pull: 'clone', put: false }` — clones on drag
- Recipe stacks: `group: { name: 'recipes', pull: true, put: true }` — accepts drops
- `onAdd` handler on each stack: reads `recipeId` from `data-recipe-id`, removes clone, calls `addEntry()`, calls `buildSlotCard()`, calls `updateSummary()`
- Reorder within stacks is cosmetic only (DOM only, not gridState)

### Summary Calculations (`updateSummary`)
- Reads `days`, `variants`, `mealsPerDay` from inputs
- Computes `occurrences[v]` per variant: `base = Math.floor(days / variants)`, first `days % variants` get `base + 1` (7 days, 3 variants → [3, 2, 2])
- Iterates in-bounds slots only (0..variants-1, 0..mealsPerDay-1)
- Accumulates per-variant daily/weekly totals (weighted by occurrences)
- Daily average = weekly totals ÷ days
- Updates: summary-calories, summary-protein, summary-carbs, summary-fat, cost-per-day, cost-per-week, variant-breakdown

### Input Wiring
- `input-days` → `renderMealGrid()` → `updateSummary()`
- `input-meals`, `input-variants` → `renderMealGrid()` (calls `updateSummary()` at end)
- Print button → `generatePrintView()`
- Clear button (`#btn-clear`) → confirms, clears `gridState`, resets `nextEntryId`, calls `clearStorage()`, re-renders

Storage operations called automatically on mutations via `state.js`.

---

## Print View (`generatePrintView`)

Opens clean print-ready window (no chrome) with three sections:

1. **Summary** — plan config, daily average macros, cost/day and /week, per-variant breakdown table
2. **Shopping List** — all ingredients aggregated (name, total quantity+unit, estimated cost), sorted alphabetically, grand total. Quantities rounded to nearest whole number.
3. **Meal Prep Guide** — one block per unique recipe with `prepNotes`, showing total scaled ingredient amounts for the week (`multiplier × occurrences` summed across slots)

Reuses `computeOccurrences()`, `calculateRecipeMacros()`, `fmtNum()`. Iterates `gridState` with same in-bounds logic as `updateSummary()`. Calls `window.print()` after writing document.

---

## Persistence (`localStorage`)

**Plan state** — key `bulk-meal-planner-v1` on every mutation:

```json
{
  "gridState": { "0-0": [{"entryId": 0, "recipeId": "chicken-rice", "multiplier": 1}] },
  "nextEntryId": 3,
  "days": "7",
  "meals": "3",
  "variants": "3"
}
```

- `saveToStorage()` — serialises `gridState` (Map→object via `Object.fromEntries`), writes to localStorage
- `loadFromStorage()` — reads/parses, returns `null` on error
- `clearStorage()` — removes key
- `initGridFromStorage()` called on `DOMContentLoaded` before `renderMealGrid()`

**Storage key versioning** — increment suffix (`-v2`, etc.) on breaking changes to ignore old data.

**Custom recipes** — key `bulk-meal-planner-recipes`. Functions: `saveCustomRecipe()`, `getCustomRecipe()`, `deleteCustomRecipe()`, `isRecipeModified()`.

**Custom ingredients** — key `bulk-meal-planner-ingredients` (flat object keyed by id). Loaded via `mergeCustomIngredientsIntoIngredients()` in `src/data.js`.

**Edit modal behavior**:
- Recipes: create via `+ New Recipe` button, edit via pencil icon. Modal edits title, serving size, ingredients (search typeahead), amounts. New recipes get slugified ID + timestamp, pushed to `ALL_RECIPES`, persisted. Delete/revert only for custom/modified recipes. Changes trigger `onRecipeModifiedCallback` → refresh list, grid, summary.
- Ingredients: modal supports "Per 100g" or "Per serving" macro entry (normalizes to `macrosPer100g`), price entry normalizes to `pricePerUnit`. Category field has autocomplete from union of recipe+ingredient categories + defaults `meal`, `drink`, `snack`. "Also add as a recipe" toggles `isRecipe`. **Base ingredients read-only** (no `custom: true` flag). Delete blocked when referenced by non-auto-generated recipes (blocking recipes shown inline). Changes trigger `onIngredientChangedCallback` → re-render sidebar, grid, summary.

---

## Sidebar & Categories

**View toggle** (`#view-toggle`):
- `recipes` — draggable recipe cards, `#recipes-subheader` (category filter) visible
- `ingredients` — non-draggable ingredient cards, category filter hidden

`main.js` owns toggle wiring (`applyView`) and `#btn-new-item` label swap.

**Recipe categories** — dropdown populated at runtime by `populateCategoryDropdowns()` from union of all `ALL_RECIPES` `category` values + defaults (`meal`, `drink`, `snack`). `renderRecipeList()` filters by `#recipe-category`. Auto-generated recipes inherit ingredient `category`. All categories functionally identical; field is UI filter only. New categories appear automatically when created.

---

## Adding Content

### Multi-Ingredient Recipe
1. Add ingredients to `INGREDIENTS` in `src/data.js`
2. Add recipe to `RECIPES` in `src/data.js`:
   ```javascript
   {
     id: string,           // unique kebab-case
     category: string,     // "meal" | "drink" | "snack" | custom
     name: string,
     servingSize: number,
     ingredients: [{ id, amount }],
     prepNotes?: string
   }
   ```

### Single-Ingredient Recipe
Add ingredient with `isRecipe: true`, `servingSize: <number>`, optional `category`:
```javascript
{
  name: string,
  macrosPer100g: { calories, protein, carbs, fat },
  pricePerUnit: number,
  unit: string,
  isRecipe: true,
  servingSize: number,
  category?: string      // defaults to "meal"
}
```

Auto-generates recipe with same `id`/`name`/`category`, `ingredients: [{ id, amount: servingSize }]`, no `prepNotes`.

---

## File Architecture

```
src/
├── data.js
├── state.js
├── calculations.js
├── recipe-ui.js
├── ingredient-ui.js
├── grid-ui.js
├── print.js
├── agent-ui.js
└── main.js
```

**Dependencies:**
- `main.js` imports: state, calculations, recipe-ui, ingredient-ui, grid-ui, print, agent-ui
- `grid-ui.js` imports: state, calculations, data
- `recipe-ui.js` imports: calculations, data (callback pattern, no circular)
- `ingredient-ui.js` imports: calculations, data (callback pattern)
- `print.js` imports: state, calculations, data
- `agent-ui.js` — self-contained
- `calculations.js` imports: data

---

## Styling

`css/` split into seven layers: `tokens.css` (DaisyUI overrides / CSS custom properties), `base.css` (resets, typography, scrollbars, SortableJS helpers), `layout.css` (app shell regions), four `components-*.css` (UI elements by group), `utilities.css` (empty-state helpers). See `css/style.md` for guide, naming, import order. Add new styles by purpose; never add to `tokens.css` unless new custom properties.

---

## Agent Chat (`src/agent-ui.js`)

**Feature flag** — `AGENT_HISTORY_ON_RELOAD` at top of file controls localStorage history restore on load.

**Conversation state** — module-level `conversation` array (loaded from localStorage when flag true):
```javascript
{ type: 'user' | 'agent' | 'tool_call' | 'tool_cluster', content, timestamp, thinking?, toolName?, params?, result? }
```

**Storage** — key `bulk-meal-planner-conversation`. Every mutation triggers `saveConversation()`.

**OpenRouter** — `callOpenRouter(userMessage)`:
1. Reads `apiKey`, `model` from agent settings (`loadAgentSettings()`)
2. Falls back to inline error if no API key
3. Builds messages from last `AGENT_CONTEXT_WINDOW` (20) turns, POSTs to `https://openrouter.ai/api/v1/chat/completions` with `stream: true`. API key passed through `toAscii()` to strip non-ASCII
4. After 400ms delay shows "Thinking…" bubble, updates in-place from stream
5. On completion replaces bubble with final `content`, appends error on failure
6. `cancelAgentTask()` calls `abortController.abort()`, removes thinking node from DOM and state

**Send/Stop button** — `#agent-send` toggles: Send (paper plane) appends message → calls `callOpenRouter()`; Stop (square, amber) calls `cancelAgentTask()`. Enter key in `#agent-input` triggers send. Empty messages ignored.

**Settings button** — `#agent-settings-btn` (gear icon) opens `#agent-settings-modal` (<dialog>). Contains: masked `#agent-api-key` input, `#agent-model-select` dropdown (populated with static models, disabled until key typed). Save persists `{ apiKey, model }` to `bulk-meal-planner-agent-settings`. Wired in `initAgentSettings()`.

**Rendering** — `renderAgentMessages(messages)` groups consecutive `tool_call` into `tool_cluster`, renders all. `addAgentMessage(msg)` appends single message. `renderMessage()` updates thinking bubble in-place.

**Exports:**
```javascript
export function initAgentView()
export function renderAgentMessages()
export function addAgentMessage()
export function clearAgentConversation()
```

---

## Known Gaps

- Drag reorder doesn't sync to gridState (cosmetic only)
- Mobile not optimized (desktop-first per SPEC)
- ES modules required (modern browser)
- Agent cannot call tools (text-only protocol)
- No "Clear chat" button (function exists, no UI trigger)

---

## Print View Behavior Notes

- **Meal Prep Guide** — only recipes with `prepNotes`. Single-ingredient recipes excluded.
- **Shopping List** — all ingredients from all recipes, including auto-generated.
- **Daily Meal Schedule** — shows all recipes used, regardless of prep notes.
