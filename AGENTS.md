Read SPEC.md if you need more clarification about this project's bigger picture.

---

## Current Architecture

### Stack
- Single `index.html` — no build step, CDN-only (DaisyUI v4, Tailwind, SortableJS)
- `src/data.js` — ingredients + recipes databases (exports `INGREDIENTS`, `ALL_RECIPES`)
- `src/state.js` — grid state management, storage operations
- `src/calculations.js` — macro calculations, formatting, data access utilities
- `src/recipe-ui.js` — recipe list rendering and recipe edit modal
- `src/ingredient-ui.js` — ingredient list rendering, ingredient modal, and category dropdowns
- `src/grid-ui.js` — meal grid rendering and summary calculations
- `src/print.js` — print view generation
- `src/main.js` — event wiring and initialization (thin glue)
- `css/components-buttons-agent.css` — buttons, agent placeholder, agent chat UI, select pill
- `css/components-cards.css` — recipe list cards and ingredient list cards
- `css/components-slots.css` — ingredient modal, slot cards, range slider
- `css/components-panels.css` — right summary cards, edit recipe modal, ingredient search typeahead

### Data Model

**INGREDIENTS** (`src/data.js`) — flat lookup object keyed by string ID:
- `macrosPer100g`: `{ calories, protein, carbs, fat }`
- `pricePerUnit`: cost per `unit`
- `unit`: free text (e.g. "g", "ml", "slice", "whole")
- `servingSize`: amount in `unit` that the ingredient card displays (defaults to 100 for base ingredients)
- `isRecipe` (optional): if `true`, auto-generates a single-ingredient recipe at runtime sized to `servingSize`
- `category` (optional): set on the auto-generated recipe; required when `isRecipe: true`
- `custom` (optional): present (and `true`) only on user-created ingredients loaded from `localStorage` — used to gate edit/delete UI

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

**Custom Recipe Creation & Editing** (via edit modal):
- Users can create new recipes via the `+ New Recipe` button in the sidebar (button label swaps with the active sidebar view)
- Users can edit existing recipes via the pencil icon on recipe cards
- Modal allows: editing title, serving size, adding/removing ingredients, adjusting amounts
- Adding ingredients opens a search typeahead that filters `INGREDIENTS` by name (custom ingredients included)
- New recipes get auto-generated IDs (slugified title + timestamp)
- New recipes are pushed to `ALL_RECIPES` array at runtime and persisted to custom storage
- Delete button appears only for custom/modified recipes (not base recipes)
- Revert button restores original base recipe by deleting custom override
- Recipe changes trigger `onRecipeModifiedCallback` which refreshes list, grid, and summary

**Custom Ingredient Creation & Editing** (via ingredient modal):
- Stored under `localStorage` key `bulk-meal-planner-ingredients` as a flat object keyed by id
- Loaded into `INGREDIENTS` at startup via `mergeCustomIngredientsIntoIngredients()` in `src/data.js`
- Modal supports both "Per 100g" and "Per serving" macro entry; values are normalized to `macrosPer100g` on save
- Price entry supports "Per unit" or "Per serving" — normalized to `pricePerUnit` on save
- Category field is a free-text input with autocomplete suggestions drawn from the live union of recipe + ingredient categories plus defaults `meal`, `drink`, `snack`
- "Also add as a recipe" checkbox toggles `isRecipe` — adds/removes a single-ingredient recipe in `ALL_RECIPES`
- **Base ingredients are read-only** — they have no `custom: true` flag, so the ingredient cards omit the edit pencil and the modal cannot be opened for them
- Delete is blocked when the ingredient is referenced by any non-auto-generated recipe (the modal shows the blocking recipes inline)
- Ingredient changes trigger `onIngredientChangedCallback` which re-renders the active sidebar, grid, and summary (since recipe macros depend on ingredient data)

### Number Formatting (`fmtNum`)
- `fmtNum(num)` — 2 significant figures (e.g. 321 → "320", 1.5 → "1.5")
- `fmtNum(num, true)` — nearest cent with `$` prefix (e.g. `$1.88`)

---

## Sidebar View Toggle

The left sidebar has a `#view-toggle` dropdown at the top with two values:
- `recipes` — shows draggable recipe cards (default). The `#recipes-subheader` (containing the category filter) is visible.
- `ingredients` — shows non-draggable ingredient cards. The category filter is hidden.

`main.js` owns the toggle wiring (`applyView`) and the `#btn-new-item` click handler — its label swaps between `New Recipe` / `New Ingredient` to match the active view.

## Recipe Categories

Recipes have a `category` field. When the Recipes view is active, a category dropdown filters the list. The dropdown options are populated at runtime by `populateCategoryDropdowns()` (in `ingredient-ui.js`) from the union of:
1. All `category` values present in `ALL_RECIPES`
2. Defaults: `meal`, `drink`, `snack`

`renderRecipeList()` reads `#recipe-category` and filters `ALL_RECIPES` accordingly. `populateCategoryDropdowns()` runs at init and again whenever recipes or ingredients are modified, so any new category typed by a user during ingredient creation appears in the filter on the next render.

**Auto-generated recipes** — When an ingredient has `isRecipe: true`, the generated recipe inherits the ingredient's `category`.

All categories are functionally identical — they share drag-and-drop, gridState, macros, and print view. The category field is purely a UI filter.

**To add a new category:** create a recipe (or a custom ingredient with `isRecipe: true`) using a new `category` string. The dropdown picks it up automatically.

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
├── recipe-ui.js         # renderRecipeList, recipe edit modal, ingredient search (in-modal)
├── ingredient-ui.js     # renderIngredientList, ingredient modal, category dropdowns
├── grid-ui.js           # renderMealGrid, buildSlotCard, updateSummary
├── print.js             # generatePrintView
├── agent-ui.js          # Agent chat: conversation state, localStorage, filler loop, send/stop
└── main.js              # Event wiring + initialization (thin glue)
```

**Module Dependencies:**
- `main.js` imports: state, calculations, recipe-ui, ingredient-ui, grid-ui, print, agent-ui
- `grid-ui.js` imports: state, calculations, data
- `recipe-ui.js` imports: calculations, data (no circular imports — uses callback pattern)
- `ingredient-ui.js` imports: calculations, data (no circular imports — uses callback pattern)
- `print.js` imports: state, calculations, data
- `agent-ui.js` is self-contained (no imports from other app modules)
- `calculations.js` imports: data

## Styling

All custom styles are in `css/` and split into seven logical layers: `tokens.css` (DaisyUI theme overrides / CSS custom properties), `base.css` (resets, typography, scrollbars, SortableJS helpers), `layout.css` (app shell regions), four `components-*.css` files (UI elements split by group), and `utilities.css` (empty-state helpers). See `css/style.md` for the full style guide, naming conventions, and import order. To add a new style, find the appropriate file based on its purpose; never add rules to `tokens.css` unless they are new custom properties.

## Agent Chat

The Agent tab in the left sidebar provides a conversational interface. It is initialized on first switch to the Agent tab (via `initAgentView()` in `main.js`).

### Architecture (`src/agent-ui.js`)

**Feature flag** — `AGENT_HISTORY_ON_RELOAD` at the top of `agent-ui.js` controls whether `initAgentView()` restores conversation history from localStorage on page load. Set to `true` to re-enable; `false` starts each session with a blank conversation (persistence code is always active).

**Conversation state** — a module-level `conversation` array (initially loaded from localStorage when `AGENT_HISTORY_ON_RELOAD` is `true`). Messages have this shape:
```javascript
{ type: 'user' | 'agent' | 'tool_call' | 'tool_cluster', content, timestamp, thinking?, toolName?, params?, result? }
```

**Storage** — conversation is persisted under `localStorage` key `bulk-meal-planner-conversation`. Every mutation (new message, cancelled thinking) triggers `saveConversation()`. History is only rehydrated into memory on page load if `AGENT_HISTORY_ON_RELOAD` is `true`.

**OpenRouter integration** — `callOpenRouter(userMessage)` handles the full message flow:
1. Reads `apiKey` and `model` from agent settings (`loadAgentSettings()`).
2. Falls back to an inline error message if no API key is configured.
3. Builds a `messages` array from the last `AGENT_CONTEXT_WINDOW` (20) conversation turns and POSTs to `https://openrouter.ai/api/v1/chat/completions` with `stream: true`. The API key is passed through `toAscii()` before use to strip non-ASCII characters (e.g. em-dashes) that would cause a `ByteString` header conversion error.
4. After a 400ms delay shows a "Thinking…" bubble; the bubble's text is updated in-place as the stream delivers delta chunks, giving live-response feedback.
5. On completion, the thinking bubble is replaced with the final `content` string. On error, an error message is appended.
6. `cancelAgentTask()` calls `abortController.abort()` to cancel the in-flight fetch, and removes the thinking node from both DOM and state.

**Send / Stop button** — `#agent-send` toggles between:
- **Send** (paper plane icon): appends user message, calls `callOpenRouter()`.
- **Stop** (square icon, warm amber background): calls `cancelAgentTask()`.

Enter key in `#agent-input` also triggers send. Empty messages are ignored.

**Settings button** — a gear icon (`#agent-settings-btn`) sits immediately left of the message input, inside the `.agent-input-row`. On click it opens `#agent-settings-modal`, a `<dialog>` driven by DaisyUI. The modal contains:
- A masked text input (`#agent-api-key`) for the OpenRouter API key.
- A model dropdown (`#agent-model-select`) populated with a static list of popular OpenRouter models. Disabled until the user types a key.
- Save persists `{ apiKey, model }` to localStorage under `bulk-meal-planner-agent-settings`. Cancel closes without persisting.
- Wiring lives in `initAgentSettings()` (in `agent-ui.js`), called from `initAgentView()` with a guard to avoid duplicate event listeners.

**Rendering** — `renderAgentMessages(messages)` groups consecutive `tool_call` entries into `tool_cluster` groups, then renders all. `addAgentMessage(msg)` appends a single message. `renderMessage()` handles the `thinking` flag by updating the bubble text in-place.

### Exports

```javascript
export function initAgentView()       // Load history (if flag enabled), wire up send/stop, show placeholder if empty
export function renderAgentMessages() // Full re-render (used by initAgentView)
export function addAgentMessage()     // Append a single message (used by agent loop)
export function clearAgentConversation() // Clear in-memory state + localStorage (not wired to UI yet)
```

### Known Gaps / TODO

- **Drag reorder doesn't sync to gridState** — cosmetic only, doesn't affect calculations
- **Mobile not optimized** — desktop-first per SPEC
- **ES modules required** — all scripts now use ES module imports/exports, requires modern browser
- **Agent cannot call tools** — `callOpenRouter()` only returns text; tool-use protocol not yet implemented
- **No "Clear chat" button** — `clearAgentConversation()` exists but has no UI trigger yet.

## Print View Behavior

- **Meal Prep Guide** — Only includes recipes that have `prepNotes` defined. Single-ingredient recipes (drinks, snacks) have no prep notes and are excluded from this section to keep the printout clean.
- **Shopping List** — Includes all ingredients from all recipes, including single-ingredient auto-generated ones.
- **Daily Meal Schedule** — Shows all recipes used in the plan, regardless of prep notes.
